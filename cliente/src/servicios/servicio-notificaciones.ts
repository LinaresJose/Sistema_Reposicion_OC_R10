import { realizarPeticion } from './cliente-api.js';
import { NotificacionUsuario } from '../tipos/notificacion.js';

interface RespuestaConsultaNotificaciones {
  estadoOperacion: string;
  intervaloPollingRecomendadoSegundos: number;
  totalNoLeidas: number;
  totalObtenidas: number;
  datos: NotificacionUsuario[];
}

export const servicioNotificaciones = {
  async consultarNotificaciones(soloNoLeidas = false, limite = 50): Promise<{
    totalNoLeidas: number;
    notificaciones: NotificacionUsuario[];
  }> {
    const respuesta = await realizarPeticion<RespuestaConsultaNotificaciones>(
      `/notificaciones?soloNoLeidas=${soloNoLeidas}&limite=${limite}`
    );
    return {
      totalNoLeidas: respuesta.totalNoLeidas,
      notificaciones: respuesta.datos
    };
  },

  async marcarLeida(id: string): Promise<void> {
    await realizarPeticion(`/notificaciones/${id}/leida`, {
      method: 'PUT'
    });
  },

  async marcarTodasLeidas(): Promise<void> {
    await realizarPeticion('/notificaciones/marcar-todas-leidas', {
      method: 'PUT'
    });
  }
};
