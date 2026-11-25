// Caso de Uso: Actualizar Usuario del Sistema
// ADMINISTRADOR_SISTEMA puede cambiar cualquier campo; usuario propio puede cambiar contrasena
import { baseDeDatos } from '../../infraestructura/base-de-datos/cliente-postgresql.js';
import { PuertoRepositorioUsuarios } from '../../dominio/puertos/puerto-repositorio-usuarios.js';
import { PuertoRepositorioAuditoria } from '../../dominio/puertos/puerto-repositorio-auditoria.js';
import { RolSistema, CategoriaCompradora } from '../../configuracion/constantes-negocio.js';
import { ServicioArgon2id } from '../../infraestructura/seguridad/servicio-argon2id.js';

export interface DatosActualizacionUsuario {
  nombreCompleto?: string;
  rolId?: RolSistema;
  categoriaCompradora?: CategoriaCompradora;
  telefonoContacto?: string | null;
  estaActivo?: boolean;
  nuevaContrasena?: string;
  contrasenaActual?: string; // Requerida si el propio usuario cambia su contrasena
}

export class ErrorActualizarUsuario extends Error {
  constructor(
    public readonly codigo:
      | 'USUARIO_NO_ENCONTRADO'
      | 'DATOS_INVALIDOS'
      | 'CONTRASENA_ACTUAL_INCORRECTA'
      | 'SIN_PERMISO',
    mensaje: string
  ) {
    super(mensaje);
    this.name = 'ErrorActualizarUsuario';
  }
}

export class CasoUsoActualizarUsuario {
  constructor(
    private readonly repoUsuarios: PuertoRepositorioUsuarios,
    private readonly repoAuditoria: PuertoRepositorioAuditoria
  ) {}

  async ejecutar(
    idUsuarioObjetivo: string,
    datos: DatosActualizacionUsuario,
    idUsuarioActor: string,
    esAdmin: boolean
  ): Promise<void> {
    const objetivo = await this.repoUsuarios.buscarPorId(idUsuarioObjetivo);
    if (!objetivo) {
      throw new ErrorActualizarUsuario('USUARIO_NO_ENCONTRADO', 'El usuario no existe.');
    }

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    const camposModificados: string[] = [];

    // Solo admin puede cambiar campos de otros usuarios
    if (datos.nombreCompleto !== undefined) {
      if (!esAdmin && idUsuarioActor !== idUsuarioObjetivo) {
        throw new ErrorActualizarUsuario('SIN_PERMISO', 'Sin permiso para modificar este campo.');
      }
      if (datos.nombreCompleto.trim().length < 3) {
        throw new ErrorActualizarUsuario('DATOS_INVALIDOS', 'El nombre completo debe tener al menos 3 caracteres.');
      }
      setClauses.push(`nombre_completo = $${idx++}`);
      params.push(datos.nombreCompleto.trim());
      camposModificados.push('nombreCompleto');
    }

    if (datos.rolId !== undefined) {
      if (!esAdmin) {
        throw new ErrorActualizarUsuario('SIN_PERMISO', 'Solo el administrador puede cambiar el rol.');
      }
      setClauses.push(`rol_id = $${idx++}`);
      params.push(datos.rolId);
      camposModificados.push('rolId');
    }

    if (datos.categoriaCompradora !== undefined) {
      if (!esAdmin) {
        throw new ErrorActualizarUsuario('SIN_PERMISO', 'Solo el administrador puede cambiar la categoria compradora.');
      }
      setClauses.push(`categoria_compradora = $${idx++}`);
      params.push(datos.categoriaCompradora);
      camposModificados.push('categoriaCompradora');
    }

    if (datos.estaActivo !== undefined) {
      if (!esAdmin) {
        throw new ErrorActualizarUsuario('SIN_PERMISO', 'Solo el administrador puede activar o desactivar usuarios.');
      }
      setClauses.push(`esta_activo = $${idx++}`);
      params.push(datos.estaActivo);
      camposModificados.push('estaActivo');
    }

    if (datos.telefonoContacto !== undefined) {
      setClauses.push(`telefono_contacto = $${idx++}`);
      params.push(datos.telefonoContacto?.trim() || null);
      camposModificados.push('telefonoContacto');
    }

    // Cambio de contrasena
    if (datos.nuevaContrasena !== undefined) {
      if (datos.nuevaContrasena.length < 8) {
        throw new ErrorActualizarUsuario('DATOS_INVALIDOS', 'La nueva contrasena debe tener al menos 8 caracteres.');
      }
      // Si no es admin, o es admin cambiando su propia contrasena, verificar contrasena actual
      if (!esAdmin || idUsuarioActor === idUsuarioObjetivo) {
        if (!datos.contrasenaActual) {
          throw new ErrorActualizarUsuario('DATOS_INVALIDOS', 'Debe proveer la contrasena actual para cambiarla.');
        }
        const correcta = await ServicioArgon2id.verificarClave(objetivo.claveSecretaHash, datos.contrasenaActual);
        if (!correcta) {
          throw new ErrorActualizarUsuario('CONTRASENA_ACTUAL_INCORRECTA', 'La contrasena actual es incorrecta.');
        }
      }
      const nuevoHash = await ServicioArgon2id.hashearClave(datos.nuevaContrasena);
      setClauses.push(`clave_secreta_hash = $${idx++}`);
      params.push(nuevoHash);
      setClauses.push(`intentos_fallidos_login = 0`);
      setClauses.push(`bloqueado_hasta = NULL`);
      camposModificados.push('contrasena');
    }

    if (setClauses.length === 0) return;

    setClauses.push(`actualizado_en = CURRENT_TIMESTAMP`);
    params.push(idUsuarioObjetivo);

    await baseDeDatos.ejecutarConsulta(
      `UPDATE usuario SET ${setClauses.join(', ')} WHERE identificador_usuario = $${idx}`,
      params
    );

    await this.repoAuditoria.registrarEvento({
      usuarioId: idUsuarioActor,
      tipoEvento: 'ACTUALIZAR_USUARIO',
      nombreEntidad: 'usuario',
      identificadorEntidad: idUsuarioObjetivo,
      estadoNuevo: { camposModificados }
    });
  }
}
