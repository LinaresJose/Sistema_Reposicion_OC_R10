/**
 * Rutas Fastify para Gestion de Notificaciones (Polling Ligero).
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { exigirAutenticacion } from '../seguridad/middleware-autorizacion-rbac.js';
import { RepositorioNotificacionesPg } from '../base-de-datos/repositorios/repositorio-notificaciones-pg.js';
import { CasoUsoConsultarNotificaciones } from '../../aplicacion/notificaciones/caso-uso-consultar-notificaciones.js';
import { CasoUsoMarcarNotificacionLeida } from '../../aplicacion/notificaciones/caso-uso-marcar-notificacion-leida.js';

export async function rutasNotificaciones(servidor: FastifyInstance) {
  const repoNotificaciones = new RepositorioNotificacionesPg();
  const casoUsoConsultar = new CasoUsoConsultarNotificaciones(repoNotificaciones);
  const casoUsoMarcar = new CasoUsoMarcarNotificacionLeida(repoNotificaciones);

  // ─── 1. Consultar Notificaciones (Polling Ligero) ───────────────────────────
  servidor.get(
    '/',
    {
      preHandler: [exigirAutenticacion]
    },
    async (solicitud: FastifyRequest, respuesta: FastifyReply) => {
      const usuario = (solicitud as any).usuarioAutenticado;
      const query = solicitud.query as any;

      const soloNoLeidas = query.soloNoLeidas === undefined ? true : query.soloNoLeidas === 'true';
      const limite = query.limite ? parseInt(query.limite, 10) : 50;

      const resultado = await casoUsoConsultar.ejecutar({
        usuarioId: usuario.identificadorUsuario,
        soloNoLeidas,
        limite
      });

      return respuesta.send({
        estadoOperacion: 'EXITOSO',
        intervaloPollingRecomendadoSegundos: 45,
        totalNoLeidas: resultado.totalNoLeidas,
        totalObtenidas: resultado.notificaciones.length,
        datos: resultado.notificaciones
      });
    }
  );

  // ─── 2. Marcar Notificacion Individual como Leida ───────────────────────────
  servidor.put(
    '/:id/leida',
    {
      preHandler: [exigirAutenticacion]
    },
    async (solicitud: FastifyRequest, respuesta: FastifyReply) => {
      const usuario = (solicitud as any).usuarioAutenticado;
      const id = (solicitud.params as any).id;

      const actualizada = await casoUsoMarcar.marcarUna(id, usuario.identificadorUsuario);

      if (!actualizada) {
        return respuesta.status(404).send({
          estadoOperacion: 'NO_ENCONTRADO',
          mensaje: 'Notificacion no encontrada o no pertenece al usuario autenticado'
        });
      }

      return respuesta.send({
        estadoOperacion: 'EXITOSO',
        mensaje: 'Notificacion marcada como leida'
      });
    }
  );

  // ─── 3. Marcar Todas las Notificaciones como Leidas ─────────────────────────
  servidor.post(
    '/marcar-todas-leidas',
    {
      preHandler: [exigirAutenticacion]
    },
    async (solicitud: FastifyRequest, respuesta: FastifyReply) => {
      const usuario = (solicitud as any).usuarioAutenticado;
      const totalMarcadas = await casoUsoMarcar.marcarTodas(usuario.identificadorUsuario);

      return respuesta.send({
        estadoOperacion: 'EXITOSO',
        totalMarcadas,
        mensaje: `${totalMarcadas} notificaciones marcadas como leidas`
      });
    }
  );
}
