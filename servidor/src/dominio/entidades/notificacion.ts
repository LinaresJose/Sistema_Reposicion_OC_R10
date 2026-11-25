/**
 * Entidad de dominio: Notificacion para Analistas y Gerencia.
 * Optimizada para Polling Ligero en Free Tier (consultas cada 45-60s).
 */

export type TipoNotificacion =
  | 'NOVEDAD_CARGA_ODOO'
  | 'CALCULO_DESACTUALIZADO'
  | 'EXPIRACION_ASIGNACION'
  | 'ORDEN_APROBADA'
  | 'SISTEMA';

export interface NotificacionAnalista {
  identificadorNotificacion: string;
  usuarioDestinoId: string;
  tipoNotificacion: TipoNotificacion;
  tituloMensaje: string;
  detalleMensaje: string;
  proveedorId: string | null;
  haSidoLeida: boolean;
  creadoEn: Date;
}
