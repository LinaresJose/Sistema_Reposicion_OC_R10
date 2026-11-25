import { PuertoRepositorioUsuarios } from '../../../dominio/puertos/puerto-repositorio-usuarios.js';
import { Usuario } from '../../../dominio/entidades/usuario.js';
import { baseDeDatos } from '../cliente-postgresql.js';

export class RepositorioUsuariosPg implements PuertoRepositorioUsuarios {
  async buscarPorCorreo(correoElectronico: string): Promise<Usuario | null> {
    const consulta = `
      SELECT 
        identificador_usuario,
        nombre_completo,
        correo_electronico,
        clave_secreta_hash,
        rol_id,
        categoria_compradora,
        esta_activo,
        intentos_fallidos_login,
        bloqueado_hasta,
        telefono_contacto,
        creado_en,
        actualizado_en
      FROM usuario
      WHERE LOWER(correo_electronico) = LOWER($1)
      LIMIT 1;
    `;
    const resultado = await baseDeDatos.ejecutarConsulta(consulta, [correoElectronico]);
    if (resultado.rows.length === 0) {
      return null;
    }
    return this.mapearFilaAUsuario(resultado.rows[0]);
  }

  async buscarPorId(identificadorUsuario: string): Promise<Usuario | null> {
    const consulta = `
      SELECT 
        identificador_usuario,
        nombre_completo,
        correo_electronico,
        clave_secreta_hash,
        rol_id,
        categoria_compradora,
        esta_activo,
        intentos_fallidos_login,
        bloqueado_hasta,
        telefono_contacto,
        creado_en,
        actualizado_en
      FROM usuario
      WHERE identificador_usuario = $1
      LIMIT 1;
    `;
    const resultado = await baseDeDatos.ejecutarConsulta(consulta, [identificadorUsuario]);
    if (resultado.rows.length === 0) {
      return null;
    }
    return this.mapearFilaAUsuario(resultado.rows[0]);
  }

  async registrarIntentoFallido(identificadorUsuario: string, minutosBloqueo: number = 15): Promise<void> {
    const consulta = `
      UPDATE usuario
      SET 
        intentos_fallidos_login = intentos_fallidos_login + 1,
        bloqueado_hasta = CASE 
          WHEN (intentos_fallidos_login + 1) >= 5 THEN CURRENT_TIMESTAMP + ($2 || ' minutes')::INTERVAL
          ELSE bloqueado_hasta 
        END,
        actualizado_en = CURRENT_TIMESTAMP
      WHERE identificador_usuario = $1;
    `;
    await baseDeDatos.ejecutarConsulta(consulta, [identificadorUsuario, minutosBloqueo.toString()]);
  }

  async restablecerIntentosFallidos(identificadorUsuario: string): Promise<void> {
    const consulta = `
      UPDATE usuario
      SET 
        intentos_fallidos_login = 0,
        bloqueado_hasta = NULL,
        actualizado_en = CURRENT_TIMESTAMP
      WHERE identificador_usuario = $1;
    `;
    await baseDeDatos.ejecutarConsulta(consulta, [identificadorUsuario]);
  }

  async actualizarClaveSecreta(identificadorUsuario: string, nuevaClaveHash: string): Promise<void> {
    const consulta = `
      UPDATE usuario
      SET 
        clave_secreta_hash = $2,
        intentos_fallidos_login = 0,
        bloqueado_hasta = NULL,
        actualizado_en = CURRENT_TIMESTAMP
      WHERE identificador_usuario = $1;
    `;
    await baseDeDatos.ejecutarConsulta(consulta, [identificadorUsuario, nuevaClaveHash]);
  }

  private mapearFilaAUsuario(fila: any): Usuario {
    return {
      identificadorUsuario: fila.identificador_usuario,
      nombreCompleto: fila.nombre_completo,
      correoElectronico: fila.correo_electronico,
      claveSecretaHash: fila.clave_secreta_hash,
      rolId: fila.rol_id,
      categoriaCompradora: fila.categoria_compradora,
      estaActivo: fila.esta_activo,
      intentosFallidosLogin: fila.intentos_fallidos_login,
      bloqueadoHasta: fila.bloqueado_hasta ? new Date(fila.bloqueado_hasta) : null,
      telefonoContacto: fila.telefono_contacto ?? null,
      creadoEn: new Date(fila.creado_en),
      actualizadoEn: new Date(fila.actualizado_en)
    };
  }
}
