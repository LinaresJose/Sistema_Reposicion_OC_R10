/**
 * Caso de uso: Consultar notificaciones para un usuario (Polling Ligero).
 */
import {
  PuertoRepositorioNotificaciones,
  ResultadoConsultaNotificaciones
} from '../../dominio/puertos/puerto-repositorio-notificaciones.js';

export interface ParametrosConsultarNotificaciones {
  usuarioId: string;
  soloNoLeidas?: boolean;
  limite?: number;
}

export class CasoUsoConsultarNotificaciones {
  constructor(private readonly repositorioNotificaciones: PuertoRepositorioNotificaciones) {}

  async ejecutar(parametros: ParametrosConsultarNotificaciones): Promise<ResultadoConsultaNotificaciones> {
    const soloNoLeidas = parametros.soloNoLeidas ?? true;
    const limite = parametros.limite ?? 50;

    return this.repositorioNotificaciones.listarPorUsuario(
      parametros.usuarioId,
      soloNoLeidas,
      limite
    );
  }
}
