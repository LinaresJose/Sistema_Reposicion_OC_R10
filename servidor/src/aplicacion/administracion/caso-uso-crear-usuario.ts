// Caso de Uso: Crear Usuario del Sistema
// Solo ADMINISTRADOR_SISTEMA puede crear usuarios
import { baseDeDatos } from '../../infraestructura/base-de-datos/cliente-postgresql.js';
import { PuertoRepositorioAuditoria } from '../../dominio/puertos/puerto-repositorio-auditoria.js';
import { ROLES_SISTEMA, RolSistema, CATEGORIAS_COMPRADORA, CategoriaCompradora } from '../../configuracion/constantes-negocio.js';
import { ServicioArgon2id } from '../../infraestructura/seguridad/servicio-argon2id.js';

export interface DatosCreacionUsuario {
  nombreCompleto: string;
  correoElectronico: string;
  contrasenaPlana: string;
  rolId: RolSistema;
  categoriaCompradora?: CategoriaCompradora;
  telefonoContacto?: string;
}

export class ErrorCrearUsuario extends Error {
  constructor(
    public readonly codigo: 'CORREO_DUPLICADO' | 'ROL_INVALIDO' | 'DATOS_INVALIDOS',
    mensaje: string
  ) {
    super(mensaje);
    this.name = 'ErrorCrearUsuario';
  }
}

export class CasoUsoCrearUsuario {
  constructor(private readonly repoAuditoria: PuertoRepositorioAuditoria) {}

  async ejecutar(datos: DatosCreacionUsuario, idAdminCreador: string): Promise<{ identificadorUsuario: string; correoElectronico: string; rolId: string }> {
    // Validar rol
    if (!Object.values(ROLES_SISTEMA).includes(datos.rolId)) {
      throw new ErrorCrearUsuario('ROL_INVALIDO', `Rol '${datos.rolId}' no es valido.`);
    }

    // Validar nombre completo
    if (!datos.nombreCompleto || datos.nombreCompleto.trim().length < 3) {
      throw new ErrorCrearUsuario('DATOS_INVALIDOS', 'El nombre completo debe tener al menos 3 caracteres.');
    }

    // Validar contrasena minima
    if (!datos.contrasenaPlana || datos.contrasenaPlana.length < 8) {
      throw new ErrorCrearUsuario('DATOS_INVALIDOS', 'La contrasena debe tener al menos 8 caracteres.');
    }

    // Validar correo electronico
    const correoNormalizado = datos.correoElectronico.trim().toLowerCase();
    if (!correoNormalizado.includes('@')) {
      throw new ErrorCrearUsuario('DATOS_INVALIDOS', 'El correo electronico no es valido.');
    }

    // Verificar correo duplicado
    const existente = await baseDeDatos.ejecutarConsulta(
      'SELECT identificador_usuario FROM usuario WHERE LOWER(correo_electronico) = $1 LIMIT 1',
      [correoNormalizado]
    );
    if (existente.rows.length > 0) {
      throw new ErrorCrearUsuario('CORREO_DUPLICADO', `El correo '${correoNormalizado}' ya esta registrado.`);
    }

    const claveSecretaHash = await ServicioArgon2id.hashearClave(datos.contrasenaPlana);
    const categoriaAsignada = datos.categoriaCompradora ?? CATEGORIAS_COMPRADORA.NINGUNA;

    const resultado = await baseDeDatos.ejecutarConsulta(
      `INSERT INTO usuario
         (nombre_completo, correo_electronico, clave_secreta_hash, rol_id,
          categoria_compradora, esta_activo, intentos_fallidos_login,
          bloqueado_hasta, telefono_contacto)
       VALUES ($1, $2, $3, $4, $5, true, 0, NULL, $6)
       RETURNING identificador_usuario, correo_electronico, rol_id`,
      [
        datos.nombreCompleto.trim(),
        correoNormalizado,
        claveSecretaHash,
        datos.rolId,
        categoriaAsignada,
        datos.telefonoContacto?.trim() || null
      ]
    );

    const nuevo = resultado.rows[0];

    await this.repoAuditoria.registrarEvento({
      usuarioId: idAdminCreador,
      tipoEvento: 'CREAR_USUARIO',
      nombreEntidad: 'usuario',
      identificadorEntidad: nuevo.identificador_usuario as string,
      estadoNuevo: { correoElectronico: correoNormalizado, rolId: datos.rolId }
    });

    return {
      identificadorUsuario: nuevo.identificador_usuario as string,
      correoElectronico: nuevo.correo_electronico as string,
      rolId: nuevo.rol_id as string
    };
  }
}
