// Rutas de Auditoria Inmutable
// Acceso: ADMINISTRADOR_SISTEMA, GERENTE_COMPRAS, AUDITOR_CONTROL
import { FastifyPluginAsync } from 'fastify';
import { exigirAutenticacion, exigirPermiso } from '../seguridad/middleware-autorizacion-rbac.js';
import { RepositorioAuditoriaPg } from '../base-de-datos/repositorios/repositorio-auditoria-pg.js';

export const rutasAuditoria: FastifyPluginAsync = async (servidor) => {
  const repoAuditoria = new RepositorioAuditoriaPg();

  // Todas las rutas requieren autenticacion
  servidor.addHook('preHandler', exigirAutenticacion);

  // GET /api/v1/auditoria — Consultar historial de eventos de auditoria
  servidor.get('/', {
    preHandler: [exigirPermiso('CONSULTAR_AUDITORIA_INMUTABLE')]
  }, async (peticion, respuesta) => {
    const qs = peticion.query as Record<string, string | undefined>;

    const filtros = {
      nombreEntidad: qs.entidad,
      identificadorEntidad: qs.identificadorEntidad,
      usuarioId: qs.usuarioId,
      limite: qs.limite ? parseInt(qs.limite, 10) : 100
    };

    const eventos = await repoAuditoria.consultarEventos(filtros);
    return respuesta.code(200).send({ eventos, total: eventos.length });
  });
};
