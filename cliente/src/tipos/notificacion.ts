export interface NotificacionUsuario {
  identificadorNotificacion: string;
  usuarioId: string;
  tituloNotificacion: string;
  cuerpoMensaje: string;
  tipoNotificacion: string;
  enlaceDestino?: string;
  haSidoLeida: boolean;
  creadoEn: string;
}
