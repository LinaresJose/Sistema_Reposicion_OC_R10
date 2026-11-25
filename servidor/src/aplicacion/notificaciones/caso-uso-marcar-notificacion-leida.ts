/**
 * Caso de uso: Marcar notificaciones como leidas.
 */
import { PuertoRepositorioNotificaciones } from '../../dominio/puertos/puerto-repositorio-notificaciones.js';

export class CasoUsoMarcarNotificacionLeida {
  constructor(private readonly repositorioNotificaciones: PuertoRepositorioNotificaciones) {}

  async marcarUna(identificadorNotificacion: string, usuarioId: string): Promise<boolean> {
    return this.repositorioNotificaciones.marcarComoLeida(identificadorNotificacion, usuarioId);
  }

  async marcarTodas(usuarioId: string): Promise<number> {
    return this.repositorioNotificaciones.marcarTodasComoLeidas(usuarioId);
  }
}
