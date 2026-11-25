// Caso de Uso: Listar Usuarios del Sistema
// Requiere permiso ADMINISTRAR_USUARIOS
// Usa el PuertoRepositorioUsuarios existente con metodos extendidos
import { baseDeDatos } from '../../infraestructura/base-de-datos/cliente-postgresql.js';
import { Usuario } from '../../dominio/entidades/usuario.js';
import { RolSistema } from '../../configuracion/constantes-negocio.js';

export interface FiltroBusquedaUsuarios {
  soloActivos?: boolean;
  rol?: RolSistema;
}

export interface UsuarioResumenAdmin {
  identificadorUsuario: string;
  nombreCompleto: string;
  correoElectronico: string;
  rolId: RolSistema;
  categoriaCompradora: string;
  estaActivo: boolean;
  telefonoContacto: string | null;
  creadoEn: Date;
  actualizadoEn: Date;
  intentosFallidosLogin: number;
  bloqueadoHasta: Date | null;
}

export interface ResultadoListarUsuarios {
  usuarios: UsuarioResumenAdmin[];
  total: number;
}

function mapearFilaUsuario(fila: Record<string, unknown>): UsuarioResumenAdmin {
  return {
    identificadorUsuario: fila.identificador_usuario as string,
    nombreCompleto: fila.nombre_completo as string,
    correoElectronico: fila.correo_electronico as string,
    rolId: fila.rol_id as RolSistema,
    categoriaCompradora: fila.categoria_compradora as string,
    estaActivo: fila.esta_activo as boolean,
    telefonoContacto: (fila.telefono_contacto as string | null) ?? null,
    creadoEn: new Date(fila.creado_en as string),
    actualizadoEn: new Date(fila.actualizado_en as string),
    intentosFallidosLogin: fila.intentos_fallidos_login as number,
    bloqueadoHasta: fila.bloqueado_hasta ? new Date(fila.bloqueado_hasta as string) : null
  };
}

export class CasoUsoListarUsuarios {
  async ejecutar(filtros: FiltroBusquedaUsuarios = {}): Promise<ResultadoListarUsuarios> {
    const condiciones: string[] = ['1=1'];
    const params: unknown[] = [];
    let idx = 1;

    if (filtros.soloActivos) {
      condiciones.push(`esta_activo = true`);
    }
    if (filtros.rol) {
      condiciones.push(`rol_id = $${idx++}`);
      params.push(filtros.rol);
    }

    const sql = `
      SELECT identificador_usuario, nombre_completo, correo_electronico,
             rol_id, categoria_compradora, esta_activo, intentos_fallidos_login,
             bloqueado_hasta, telefono_contacto, creado_en, actualizado_en
      FROM usuario
      WHERE ${condiciones.join(' AND ')}
      ORDER BY nombre_completo ASC
    `;

    const resultado = await baseDeDatos.ejecutarConsulta(sql, params);
    const usuarios = resultado.rows.map(mapearFilaUsuario);
    return { usuarios, total: usuarios.length };
  }
}
