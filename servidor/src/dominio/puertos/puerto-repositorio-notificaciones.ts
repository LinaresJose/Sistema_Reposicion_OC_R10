/**
 * Puerto del repositorio para gestion de notificaciones a analistas y gerencia.
 */
import { NotificacionAnalista, TipoNotificacion } from '../entidades/notificacion.js';

export interface EntradaCrearNotificacion {
  usuarioDestinoId: string;
  tipoNotificacion: TipoNotificacion;
  tituloMensaje: string;
  detalleMensaje: string;
  proveedorId?: string | null;
}

export interface ResultadoConsultaNotificaciones {
  notificaciones: NotificacionAnalista[];
  totalNoLeidas: number;
}

export interface PuertoRepositorioNotificaciones {
  crearNotificacion(entrada: EntradaCrearNotificacion): Promise<NotificacionAnalista>;
  crearNotificacionesLote(entradas: EntradaCrearNotificacion[]): Promise<number>;
  listarPorUsuario(usuarioId: string, soloNoLeidas?: boolean, limite?: number): Promise<ResultadoConsultaNotificaciones>;
  marcarComoLeida(identificadorNotificacion: string, usuarioId: string): Promise<boolean>;
  marcarTodasComoLeidas(usuarioId: string): Promise<number>;
}
