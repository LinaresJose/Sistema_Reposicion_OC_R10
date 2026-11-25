/**
 * Repositorio PostgreSQL para Gestion de Notificaciones a Analistas y Gerencia.
 * Diseñado para bajo consumo de recursos en Polling Ligero.
 */
import crypto from 'node:crypto';
import {
  PuertoRepositorioNotificaciones,
  EntradaCrearNotificacion,
  ResultadoConsultaNotificaciones
} from '../../../dominio/puertos/puerto-repositorio-notificaciones.js';
import { NotificacionAnalista, TipoNotificacion } from '../../../dominio/entidades/notificacion.js';
import { baseDeDatos } from '../cliente-postgresql.js';

export class RepositorioNotificacionesPg implements PuertoRepositorioNotificaciones {

  async crearNotificacion(entrada: EntradaCrearNotificacion): Promise<NotificacionAnalista> {
    const id = crypto.randomUUID();
    const consulta = `
      INSERT INTO notificacion_analista (
        identificador_notificacion,
        usuario_destino_id,
        tipo_notificacion,
        titulo_mensaje,
        detalle_mensaje,
        proveedor_id,
        ha_sido_leida,
        creado_en
      ) VALUES ($1, $2, $3, $4, $5, $6, FALSE, CURRENT_TIMESTAMP)
      RETURNING *;
    `;

    const resultado = await baseDeDatos.ejecutarConsulta(consulta, [
      id,
      entrada.usuarioDestinoId,
      entrada.tipoNotificacion,
      entrada.tituloMensaje,
      entrada.detalleMensaje,
      entrada.proveedorId || null
    ]);

    return this.mapearFilaANotificacion(resultado.rows[0]);
  }

  async crearNotificacionesLote(entradas: EntradaCrearNotificacion[]): Promise<number> {
    if (entradas.length === 0) return 0;

    const cliente = await baseDeDatos.obtenerClienteTransaccion();
    try {
      await cliente.query('BEGIN');
      const consulta = `
        INSERT INTO notificacion_analista (
          identificador_notificacion,
          usuario_destino_id,
          tipo_notificacion,
          titulo_mensaje,
          detalle_mensaje,
          proveedor_id,
          ha_sido_leida,
          creado_en
        ) VALUES ($1, $2, $3, $4, $5, $6, FALSE, CURRENT_TIMESTAMP);
      `;

      for (const e of entradas) {
        await cliente.query(consulta, [
          crypto.randomUUID(),
          e.usuarioDestinoId,
          e.tipoNotificacion,
          e.tituloMensaje,
          e.detalleMensaje,
          e.proveedorId || null
        ]);
      }

      await cliente.query('COMMIT');
      return entradas.length;
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  async listarPorUsuario(
    usuarioId: string,
    soloNoLeidas: boolean = false,
    limite: number = 50
  ): Promise<ResultadoConsultaNotificaciones> {
    const clausulaLeida = soloNoLeidas ? 'AND ha_sido_leida = FALSE' : '';

    const consultaLista = `
      SELECT 
        identificador_notificacion,
        usuario_destino_id,
        tipo_notificacion,
        titulo_mensaje,
        detalle_mensaje,
        proveedor_id,
        ha_sido_leida,
        creado_en
      FROM notificacion_analista
      WHERE usuario_destino_id = $1 ${clausulaLeida}
      ORDER BY creado_en DESC
      LIMIT $2;
    `;

    const consultaConteo = `
      SELECT COUNT(*) AS total_no_leidas
      FROM notificacion_analista
      WHERE usuario_destino_id = $1 AND ha_sido_leida = FALSE;
    `;

    const [resLista, resConteo] = await Promise.all([
      baseDeDatos.ejecutarConsulta(consultaLista, [usuarioId, limite]),
      baseDeDatos.ejecutarConsulta(consultaConteo, [usuarioId])
    ]);

    const notificaciones = resLista.rows.map(r => this.mapearFilaANotificacion(r));
    const totalNoLeidas = Number(resConteo.rows[0]?.total_no_leidas || 0);

    return { notificaciones, totalNoLeidas };
  }

  async marcarComoLeida(identificadorNotificacion: string, usuarioId: string): Promise<boolean> {
    const consulta = `
      UPDATE notificacion_analista
      SET ha_sido_leida = TRUE
      WHERE identificador_notificacion = $1 AND usuario_destino_id = $2;
    `;
    const resultado = await baseDeDatos.ejecutarConsulta(consulta, [identificadorNotificacion, usuarioId]);
    return (resultado.rowCount || 0) > 0;
  }

  async marcarTodasComoLeidas(usuarioId: string): Promise<number> {
    const consulta = `
      UPDATE notificacion_analista
      SET ha_sido_leida = TRUE
      WHERE usuario_destino_id = $1 AND ha_sido_leida = FALSE;
    `;
    const resultado = await baseDeDatos.ejecutarConsulta(consulta, [usuarioId]);
    return resultado.rowCount || 0;
  }

  private mapearFilaANotificacion(fila: any): NotificacionAnalista {
    return {
      identificadorNotificacion: fila.identificador_notificacion,
      usuarioDestinoId: fila.usuario_destino_id,
      tipoNotificacion: fila.tipo_notificacion as TipoNotificacion,
      tituloMensaje: fila.titulo_mensaje,
      detalleMensaje: fila.detalle_mensaje,
      proveedorId: fila.proveedor_id || null,
      haSidoLeida: Boolean(fila.ha_sido_leida),
      creadoEn: new Date(fila.creado_en)
    };
  }
}
