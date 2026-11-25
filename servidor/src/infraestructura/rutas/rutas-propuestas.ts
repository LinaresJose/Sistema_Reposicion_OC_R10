import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { RepositorioPropuestasPg } from '../base-de-datos/repositorios/repositorio-propuestas-pg.js';
import { RepositorioProveedoresPg } from '../base-de-datos/repositorios/repositorio-proveedores-pg.js';
import { RepositorioAuditoriaPg } from '../base-de-datos/repositorios/repositorio-auditoria-pg.js';
import { CasoUsoConsultarPropuestaProveedor } from '../../aplicacion/decisiones-compra/caso-uso-consultar-propuesta-proveedor.js';
import { CasoUsoActualizarDecisionSKU, ErrorDecisionCompra } from '../../aplicacion/decisiones-compra/caso-uso-actualizar-decision-sku.js';
import { exigirAutenticacion, exigirPermiso } from '../seguridad/middleware-autorizacion-rbac.js';

export async function rutasPropuestas(servidor: FastifyInstance, opciones: FastifyPluginOptions) {
  const repositorioPropuestas = new RepositorioPropuestasPg();
  const repositorioProveedores = new RepositorioProveedoresPg();
  const repositorioAuditoria = new RepositorioAuditoriaPg();

  const casoUsoConsultar = new CasoUsoConsultarPropuestaProveedor(repositorioPropuestas);
  const casoUsoActualizar = new CasoUsoActualizarDecisionSKU(repositorioPropuestas, repositorioAuditoria);

  servidor.addHook('preHandler', exigirAutenticacion);

  // 1. Consultar Propuesta de Reposicion por Proveedor
  servidor.get('/proveedor/:identificadorProveedor', async (solicitud, respuesta) => {
    const params = z.object({ identificadorProveedor: z.string().uuid() }).parse(solicitud.params);
    const propuesta = await casoUsoConsultar.ejecutar(params.identificadorProveedor);

    if (!propuesta) {
      return respuesta.status(404).send({
        estadoOperacion: 'PROVEEDOR_NO_ENCONTRADO',
        mensaje: 'El proveedor solicitado no existe o no tiene catalogo cargado'
      });
    }

    return respuesta.status(200).send({
      estadoOperacion: 'EXITOSO',
      datos: propuesta
    });
  });

  // 2. Actualizar Decision por SKU (Aprobacion, Ajuste Manual y Versionado Optimista)
  servidor.put('/decisiones/:identificadorDecision', {
    preHandler: [exigirPermiso('AJUSTAR_CANTIDAD_PROPUESTA')]
  }, async (solicitud, respuesta) => {
    const params = z.object({ identificadorDecision: z.string().uuid() }).parse(solicitud.params);

    const esquemaCuerpo = z.object({
      estadoDecision: z.enum(['PENDIENTE', 'APROBADO', 'EXCLUIDO']),
      cantidadAjusteManual: z.number().int().min(0).nullable(),
      justificacionAjuste: z.string().nullable().optional(),
      hashCalculoValidado: z.string().length(64, 'El hash de validacion debe ser SHA-256 de 64 caracteres'),
      numeroVersionEsperado: z.number().int().min(1)
    });

    const cuerpo = esquemaCuerpo.parse(solicitud.body);
    const usuario = solicitud.usuarioAutenticado!;

    try {
      const decisionActualizada = await casoUsoActualizar.ejecutar({
        identificadorDecision: params.identificadorDecision,
        estadoDecision: cuerpo.estadoDecision,
        cantidadAjusteManual: cuerpo.cantidadAjusteManual,
        justificacionAjuste: cuerpo.justificacionAjuste || null,
        hashCalculoValidado: cuerpo.hashCalculoValidado,
        numeroVersionEsperado: cuerpo.numeroVersionEsperado,
        analistaUsuarioId: usuario.identificadorUsuario,
        direccionIP: solicitud.ip
      });

      return respuesta.status(200).send({
        estadoOperacion: 'EXITOSO',
        mensaje: 'Decision de compra actualizada correctamente',
        datos: decisionActualizada
      });
    } catch (error: any) {
      if (error instanceof ErrorDecisionCompra) {
        let codigoHttp = 400;
        if (error.codigoError === 'CONFLICTO_CONCURRENCIA') codigoHttp = 409;
        if (error.codigoError === 'CALCULO_DESACTUALIZADO') codigoHttp = 422;
        if (error.codigoError === 'JUSTIFICACION_OBLIGATORIA') codigoHttp = 422;
        if (error.codigoError === 'DECISION_NO_ENCONTRADA') codigoHttp = 404;

        return respuesta.status(codigoHttp).send({
          estadoOperacion: error.codigoError,
          mensaje: error.message,
          detalles: error.detalles
        });
      }
      throw error;
    }
  });

  // 3. Activar o desactivar estado de Revision WhatsApp para el Proveedor
  servidor.post('/proveedor/:identificadorProveedor/revision-whatsapp', {
    preHandler: [exigirPermiso('PASAR_A_REVISION_WHATSAPP')]
  }, async (solicitud, respuesta) => {
    const params = z.object({ identificadorProveedor: z.string().uuid() }).parse(solicitud.params);
    const cuerpo = z.object({ enRevision: z.boolean() }).parse(solicitud.body);
    const usuario = solicitud.usuarioAutenticado!;

    await repositorioProveedores.actualizarEstadoRevisionWhatsApp(params.identificadorProveedor, cuerpo.enRevision);

    await repositorioAuditoria.registrarEvento({
      usuarioId: usuario.identificadorUsuario,
      tipoEvento: cuerpo.enRevision ? 'ACTIVAR_REVISION_WHATSAPP' : 'DESACTIVAR_REVISION_WHATSAPP',
      nombreEntidad: 'proveedor',
      identificadorEntidad: params.identificadorProveedor,
      estadoNuevo: { estadoAsignacion: cuerpo.enRevision ? 'EN_REVISION_WHATSAPP' : 'EN_PROCESO_TRABAJO', bloqueoSuspendido: cuerpo.enRevision },
      direccionIP: solicitud.ip
    });

    return respuesta.status(200).send({
      estadoOperacion: 'EXITOSO',
      mensaje: cuerpo.enRevision
        ? 'Propuesta colocada en revision de WhatsApp. El bloqueo por inactividad ha sido suspendido'
        : 'Propuesta retirada de revision de WhatsApp'
    });
  });
}
