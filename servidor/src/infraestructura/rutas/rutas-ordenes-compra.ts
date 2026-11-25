/**
 * Rutas Fastify para Gestion de Ordenes de Compra y Generacion de Documentos.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { exigirAutenticacion, exigirPermiso } from '../seguridad/middleware-autorizacion-rbac.js';
import { RepositorioOrdenesPg } from '../base-de-datos/repositorios/repositorio-ordenes-pg.js';
import { RepositorioPropuestasPg } from '../base-de-datos/repositorios/repositorio-propuestas-pg.js';
import { RepositorioProveedoresPg } from '../base-de-datos/repositorios/repositorio-proveedores-pg.js';
import { RepositorioAuditoriaPg } from '../base-de-datos/repositorios/repositorio-auditoria-pg.js';
import { CasoUsoCrearBorradorOrden } from '../../aplicacion/ordenes-compra/caso-uso-crear-borrador-orden.js';
import { CasoUsoPasarARevisionWhatsapp } from '../../aplicacion/ordenes-compra/caso-uso-pasar-a-revision-whatsapp.js';
import { CasoUsoRegistrarAprobacion } from '../../aplicacion/ordenes-compra/caso-uso-registrar-aprobacion.js';
import { CasoUsoEmitirOrdenOficial } from '../../aplicacion/ordenes-compra/caso-uso-emitir-orden-oficial.js';
import { CasoUsoConsultarOrden } from '../../aplicacion/ordenes-compra/caso-uso-consultar-orden.js';
import { GeneradorDocumentosStateless } from '../../aplicacion/ordenes-compra/generador-documentos-stateless.js';
import { EstadoOrdenCompra, CanalAprobacion } from '../../dominio/entidades/orden-compra.js';
import { baseDeDatos } from '../base-de-datos/cliente-postgresql.js';

export async function rutasOrdenesCompra(servidor: FastifyInstance) {
  const repoOrdenes = new RepositorioOrdenesPg();
  const repoPropuestas = new RepositorioPropuestasPg();
  const repoProveedores = new RepositorioProveedoresPg();
  const repoAuditoria = new RepositorioAuditoriaPg();

  const casoUsoCrearBorrador = new CasoUsoCrearBorradorOrden(repoOrdenes, repoPropuestas, repoAuditoria);
  const casoUsoRevision = new CasoUsoPasarARevisionWhatsapp(repoOrdenes, repoProveedores, repoAuditoria);
  const casoUsoAprobacion = new CasoUsoRegistrarAprobacion(repoOrdenes, repoAuditoria);
  const casoUsoEmitir = new CasoUsoEmitirOrdenOficial(repoOrdenes, repoAuditoria);
  const casoUsoConsultar = new CasoUsoConsultarOrden(repoOrdenes);

  // ─── 0. Listar Empresas Emisoras Oficiales (MMC y LYNOX) ───────────────────
  servidor.get(
    '/empresas-emisoras',
    {
      preHandler: [exigirAutenticacion]
    },
    async (_peticion: FastifyRequest, respuesta: FastifyReply) => {
      const consulta = `
        SELECT 
          identificador_empresa AS "identificadorEmpresa",
          codigo_identificador AS "codigoIdentificador",
          nombre_razon_social AS "nombreRazonSocial",
          registro_fiscal AS "registroFiscal",
          direccion_fiscal AS "direccionFiscal"
        FROM empresa_razon_social
        WHERE esta_activa = TRUE
        ORDER BY codigo_identificador ASC;
      `;
      const resultado = await baseDeDatos.ejecutarConsulta(consulta);
      return respuesta.send({
        estadoOperacion: 'EXITOSO',
        datos: resultado.rows
      });
    }
  );

  // ─── 1. Crear borrador de orden ─────────────────────────────────────────────
  servidor.post(
    '/',
    {
      preHandler: [exigirAutenticacion, exigirPermiso('CREAR_ORDEN_COMPRA')]
    },
    async (peticion: FastifyRequest, respuesta: FastifyReply) => {
      const esquema = z.object({
        proveedorId: z.string().uuid(),
        idsDecisionesAprobadas: z.array(z.string().uuid()).optional()
      });

      const resultado = esquema.safeParse(peticion.body);
      if (!resultado.success) {
        return respuesta.status(400).send({
          error: 'DATOS_INVALIDOS',
          detalles: resultado.error.format()
        });
      }

      try {
        const usuarioSesion = (peticion as any).usuarioAutenticado;
        const orden = await casoUsoCrearBorrador.ejecutar({
          proveedorId: resultado.data.proveedorId,
          analistaCreadoraId: usuarioSesion.identificadorUsuario,
          idsDecisionesAprobadas: resultado.data.idsDecisionesAprobadas || []
        });

        return respuesta.status(201).send({
          mensaje: 'Borrador de orden de compra creado exitosamente',
          orden
        });
      } catch (error: any) {
        if (error.message === 'SIN_SKUS_APROBADOS_PARA_ORDEN') {
          return respuesta.status(422).send({
            error: 'SIN_SKUS_APROBADOS',
            mensaje: 'No hay productos aprobados con cantidad mayor a cero para generar una orden.'
          });
        }
        if (error.message === 'PROVEEDOR_NO_ENCONTRADO') {
          return respuesta.status(404).send({ error: 'PROVEEDOR_NO_ENCONTRADO' });
        }
        return respuesta.status(500).send({ error: 'ERROR_INTERNO_SERVIDOR', mensaje: error.message });
      }
    }
  );

  // ─── 2. Listar ordenes de compra ────────────────────────────────────────────
  servidor.get(
    '/',
    {
      preHandler: [exigirAutenticacion]
    },
    async (peticion: FastifyRequest, respuesta: FastifyReply) => {
      const query = peticion.query as any;
      const ordenes = await casoUsoConsultar.listar({
        estadoOrden: query.estadoOrden as EstadoOrdenCompra,
        proveedorId: query.proveedorId,
        analistaCreadoraId: query.analistaCreadoraId,
        empresaEmisoraId: query.empresaEmisoraId
      });
      return respuesta.send({ ordenes, total: ordenes.length });
    }
  );

  // ─── 3. Obtener orden por ID ────────────────────────────────────────────────
  servidor.get(
    '/:id',
    {
      preHandler: [exigirAutenticacion]
    },
    async (peticion: FastifyRequest, respuesta: FastifyReply) => {
      const id = (peticion.params as any).id;
      const orden = await casoUsoConsultar.obtenerPorId(id);
      if (!orden) {
        return respuesta.status(404).send({ error: 'ORDEN_NO_ENCONTRADA' });
      }
      return respuesta.send(orden);
    }
  );

  // ─── 4. Pasar orden a revision WhatsApp ─────────────────────────────────────
  servidor.post(
    '/:id/revision-whatsapp',
    {
      preHandler: [exigirAutenticacion]
    },
    async (peticion: FastifyRequest, respuesta: FastifyReply) => {
      try {
        const id = (peticion.params as any).id;
        const usuarioSesion = (peticion as any).usuarioAutenticado;
        const ordenActualizada = await casoUsoRevision.ejecutar(
          id,
          usuarioSesion.identificadorUsuario
        );
        return respuesta.send({
          mensaje: 'Orden de compra pasada a revision por WhatsApp exitosamente',
          orden: ordenActualizada
        });
      } catch (error: any) {
        if (error.message === 'ORDEN_NO_ENCONTRADA') {
          return respuesta.status(404).send({ error: 'ORDEN_NO_ENCONTRADA' });
        }
        if (error.message === 'ESTADO_INVALIDO_PARA_REVISION') {
          return respuesta.status(409).send({
            error: 'ESTADO_INVALIDO',
            mensaje: 'Solo las ordenes en estado BORRADOR pueden pasar a revision WhatsApp.'
          });
        }
        return respuesta.status(500).send({ error: 'ERROR_INTERNO_SERVIDOR', mensaje: error.message });
      }
    }
  );

  // ─── 5. Registrar aprobacion ────────────────────────────────────────────────
  servidor.post(
    '/:id/registrar-aprobacion',
    {
      preHandler: [exigirAutenticacion, exigirPermiso('APROBAR_ORDEN_COMPRA')]
    },
    async (peticion: FastifyRequest, respuesta: FastifyReply) => {
      const id = (peticion.params as any).id;
      const esquema = z.object({
        canalAprobacion: z.enum(['SISTEMA', 'WHATSAPP']),
        notaRespalodoAprobacion: z.string().optional()
      });

      const resultado = esquema.safeParse(peticion.body);
      if (!resultado.success) {
        return respuesta.status(400).send({
          error: 'DATOS_INVALIDOS',
          detalles: resultado.error.format()
        });
      }

      try {
        const usuarioSesion = (peticion as any).usuarioAutenticado;
        const ordenAprobada = await casoUsoAprobacion.ejecutar({
          identificadorOrden: id,
          usuarioAprobadorId: usuarioSesion.identificadorUsuario,
          rolUsuario: usuarioSesion.rolId,
          canalAprobacion: resultado.data.canalAprobacion as CanalAprobacion,
          notaRespalodoAprobacion: resultado.data.notaRespalodoAprobacion
        });

        return respuesta.send({
          mensaje: 'Aprobacion registrada exitosamente. Lista para emision oficial.',
          orden: ordenAprobada
        });
      } catch (error: any) {
        if (error.message === 'NOTA_RESPALDO_WHATSAPP_OBLIGATORIA') {
          return respuesta.status(422).send({
            error: 'NOTA_RESPALDO_OBLIGATORIA',
            mensaje: 'Para aprobaciones verbales o por WhatsApp se exige registrar una nota de respaldo (minimo 10 caracteres).'
          });
        }
        if (error.message === 'ORDEN_NO_ENCONTRADA') {
          return respuesta.status(404).send({ error: 'ORDEN_NO_ENCONTRADA' });
        }
        if (error.message === 'ESTADO_INVALIDO_PARA_APROBACION') {
          return respuesta.status(409).send({
            error: 'ESTADO_INVALIDO',
            mensaje: 'Solo ordenes en BORRADOR o EN_REVISION_WHATSAPP pueden ser aprobadas.'
          });
        }
        return respuesta.status(500).send({ error: 'ERROR_INTERNO_SERVIDOR', mensaje: error.message });
      }
    }
  );

  // ─── 6. Emitir orden oficial ────────────────────────────────────────────────
  servidor.post(
    '/:id/emitir',
    {
      preHandler: [exigirAutenticacion, exigirPermiso('EMITIR_ORDEN_COMPRA_OFICIAL')]
    },
    async (peticion: FastifyRequest, respuesta: FastifyReply) => {
      const id = (peticion.params as any).id;
      const esquema = z.object({
        empresaEmisoraId: z.string().min(1)
      });

      const resultado = esquema.safeParse(peticion.body);
      if (!resultado.success) {
        return respuesta.status(400).send({
          error: 'DATOS_INVALIDOS',
          detalles: resultado.error.format()
        });
      }

      try {
        const usuarioSesion = (peticion as any).usuarioAutenticado;
        const ordenEmitida = await casoUsoEmitir.ejecutar({
          identificadorOrden: id,
          usuarioEmisorId: usuarioSesion.identificadorUsuario,
          rolUsuario: usuarioSesion.rolId,
          empresaEmisoraId: resultado.data.empresaEmisoraId
        });

        return respuesta.send({
          mensaje: 'Orden de compra emitida oficialmente',
          numeroCorrelativoOficial: ordenEmitida.numeroCorrelativoOficial,
          orden: ordenEmitida
        });
      } catch (error: any) {
        if (error.message === 'ORDEN_NO_ENCONTRADA') {
          return respuesta.status(404).send({ error: 'ORDEN_NO_ENCONTRADA' });
        }
        if (error.message === 'ESTADO_INVALIDO_PARA_EMISION') {
          return respuesta.status(409).send({
            error: 'ESTADO_INVALIDO',
            mensaje: 'Solo las ordenes en estado APROBADA_PARA_EMISION pueden ser emitidas.'
          });
        }
        if (error.message === 'EMPRESA_NO_ENCONTRADA') {
          return respuesta.status(404).send({ error: 'EMPRESA_NO_ENCONTRADA' });
        }
        return respuesta.status(500).send({ error: 'ERROR_INTERNO_SERVIDOR', mensaje: error.message });
      }
    }
  );

  // ─── 7. Descargar propuesta (PDF o PNG) ──────────────────────────────────────
  servidor.get(
    '/:id/descargar-propuesta',
    {
      preHandler: [exigirAutenticacion]
    },
    async (peticion: FastifyRequest, respuesta: FastifyReply) => {
      const id = (peticion.params as any).id;
      const orden = await casoUsoConsultar.obtenerPorId(id);
      if (!orden) {
        return respuesta.status(404).send({ error: 'ORDEN_NO_ENCONTRADA' });
      }

      const formato = ((peticion.query as any).formato || 'PDF').toUpperCase();

      if (formato === 'PNG') {
        const bufferPNG = await GeneradorDocumentosStateless.generarPropuestaPNG(orden);
        return respuesta
          .header('Content-Type', 'image/png')
          .header('Content-Disposition', `inline; filename="propuesta-${orden.proveedorId}.png"`)
          .send(bufferPNG);
      } else {
        const bytesPDF = await GeneradorDocumentosStateless.generarPropuestaPDF(orden);
        return respuesta
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `attachment; filename="propuesta-${orden.proveedorId}.pdf"`)
          .send(Buffer.from(bytesPDF));
      }
    }
  );

  // ─── 8. Descargar Orden Oficial Emitida (PDF) ──────────────────────────────
  servidor.get(
    '/:id/descargar-orden-oficial',
    {
      preHandler: [exigirAutenticacion]
    },
    async (peticion: FastifyRequest, respuesta: FastifyReply) => {
      const id = (peticion.params as any).id;
      const orden = await casoUsoConsultar.obtenerPorId(id);
      if (!orden) {
        return respuesta.status(404).send({ error: 'ORDEN_NO_ENCONTRADA' });
      }

      if (orden.estadoOrden !== 'OC_EMITIDA') {
        return respuesta.status(409).send({
          error: 'ORDEN_NO_EMITIDA',
          mensaje: 'El documento oficial solo esta disponible despues de que la orden haya sido emitida oficialmente.'
        });
      }

      const bytesPDF = await GeneradorDocumentosStateless.generarOrdenOficialPDF(orden);
      const nombreArchivo = `${orden.numeroCorrelativoOficial || 'orden-compra'}.pdf`;

      return respuesta
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${nombreArchivo}"`)
        .send(Buffer.from(bytesPDF));
    }
  );
}
