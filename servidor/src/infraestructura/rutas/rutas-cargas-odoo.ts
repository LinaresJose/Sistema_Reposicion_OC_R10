/**
 * Rutas Fastify para Cargas de Archivos Odoo, Validacion y Conciliacion.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { exigirAutenticacion, exigirPermiso } from '../seguridad/middleware-autorizacion-rbac.js';
import { AdaptadorArchivosExcelOdoo } from '../odoo/adaptador-archivos-excel-odoo.js';
import { AdaptadorApiRpcOdoo } from '../odoo/adaptador-api-rpc-odoo.js';
import { RepositorioCargasOdooPg } from '../base-de-datos/repositorios/repositorio-cargas-odoo-pg.js';
import { RepositorioNotificacionesPg } from '../base-de-datos/repositorios/repositorio-notificaciones-pg.js';
import { RepositorioAuditoriaPg } from '../base-de-datos/repositorios/repositorio-auditoria-pg.js';
import { CasoUsoProcesarCargaOdoo } from '../../aplicacion/cargas-odoo/caso-uso-procesar-carga-odoo.js';
import { CasoUsoConsultarHistorialCargas } from '../../aplicacion/cargas-odoo/caso-uso-consultar-historial-cargas.js';
import { ArchivosEntradaOdoo } from '../../dominio/puertos/puerto-origen-datos-odoo.js';

export async function rutasCargasOdoo(servidor: FastifyInstance) {
  const adaptadorExcel = new AdaptadorArchivosExcelOdoo();
  const adaptadorRpc = new AdaptadorApiRpcOdoo();
  const repoCargas = new RepositorioCargasOdooPg();
  const repoNotificaciones = new RepositorioNotificacionesPg();
  const repoAuditoria = new RepositorioAuditoriaPg();

  const casoUsoProcesar = new CasoUsoProcesarCargaOdoo(
    adaptadorExcel,
    repoCargas,
    repoNotificaciones,
    repoAuditoria
  );
  const casoUsoHistorial = new CasoUsoConsultarHistorialCargas(repoCargas);

  // ─── 1. Procesar Archivos Odoo (Multipart o JSON Base64) ─────────────────────
  servidor.post(
    '/procesar-archivos',
    {
      preHandler: [exigirAutenticacion, exigirPermiso('SUBIR_ARCHIVOS_ODOO')]
    },
    async (solicitud: FastifyRequest, respuesta: FastifyReply) => {
      const usuario = (solicitud as any).usuarioAutenticado;
      const archivosEntrada: ArchivosEntradaOdoo = {};

      // Si la solicitud es multipart/form-data
      if (solicitud.isMultipart()) {
        const partes = solicitud.parts();
        for await (const parte of partes) {
          if (parte.type === 'file') {
            const buffer = await parte.toBuffer();
            if (parte.fieldname === 'catalogoCostos') archivosEntrada.catalogoCostos = buffer;
            else if (parte.fieldname === 'inventarioMano') archivosEntrada.inventarioMano = buffer;
            else if (parte.fieldname === 'comprasTransito') archivosEntrada.comprasTransito = buffer;
            else if (parte.fieldname === 'historialVentasPrecios') archivosEntrada.historialVentasPrecios = buffer;
          }
        }
      } else {
        // Soporte para JSON con base64 (pruebas automatizadas e integraciones API)
        const esquemaJson = z.object({
          catalogoCostosBase64: z.string().optional(),
          inventarioManoBase64: z.string().optional(),
          comprasTransitoBase64: z.string().optional(),
          historialVentasPreciosBase64: z.string().optional()
        });

        const resultadoJson = esquemaJson.safeParse(solicitud.body);
        if (resultadoJson.success) {
          if (resultadoJson.data.catalogoCostosBase64) {
            archivosEntrada.catalogoCostos = Buffer.from(resultadoJson.data.catalogoCostosBase64, 'base64');
          }
          if (resultadoJson.data.inventarioManoBase64) {
            archivosEntrada.inventarioMano = Buffer.from(resultadoJson.data.inventarioManoBase64, 'base64');
          }
          if (resultadoJson.data.comprasTransitoBase64) {
            archivosEntrada.comprasTransito = Buffer.from(resultadoJson.data.comprasTransitoBase64, 'base64');
          }
          if (resultadoJson.data.historialVentasPreciosBase64) {
            archivosEntrada.historialVentasPrecios = Buffer.from(resultadoJson.data.historialVentasPreciosBase64, 'base64');
          }
        }
      }

      const tieneArchivos = Boolean(
        archivosEntrada.catalogoCostos ||
        archivosEntrada.inventarioMano ||
        archivosEntrada.comprasTransito ||
        archivosEntrada.historialVentasPrecios
      );

      if (!tieneArchivos) {
        return respuesta.status(400).send({
          estadoOperacion: 'ARCHIVOS_FALTANTES',
          mensaje: 'Debe suministrar al menos uno de los archivos requeridos de Odoo'
        });
      }

      const resultado = await casoUsoProcesar.ejecutar({
        archivos: archivosEntrada,
        usuarioId: usuario?.identificadorUsuario || null,
        tipoOrigen: 'ARCHIVOS_MANUALES_EXCEL'
      });

      const codigoHttp = resultado.exito ? 200 : 422;
      return respuesta.status(codigoHttp).send({
        estadoOperacion: resultado.estadoProcesamiento,
        datos: resultado
      });
    }
  );

  // ─── 2. Historial de Cargas ─────────────────────────────────────────────────
  servidor.get(
    '/historial',
    {
      preHandler: [exigirAutenticacion]
    },
    async (solicitud: FastifyRequest, respuesta: FastifyReply) => {
      const query = solicitud.query as any;
      const limite = query.limite ? parseInt(query.limite, 10) : 20;

      const historial = await casoUsoHistorial.listarHistorial(limite);
      return respuesta.send({
        estadoOperacion: 'EXITOSO',
        total: historial.length,
        datos: historial
      });
    }
  );

  // ─── 3. Detalle de Carga y Novedades por ID ─────────────────────────────────
  servidor.get(
    '/:id',
    {
      preHandler: [exigirAutenticacion]
    },
    async (solicitud: FastifyRequest, respuesta: FastifyReply) => {
      const id = (solicitud.params as any).id;
      const carga = await casoUsoHistorial.obtenerPorId(id);

      if (!carga) {
        return respuesta.status(404).send({
          estadoOperacion: 'NO_ENCONTRADO',
          mensaje: 'Carga no encontrada'
        });
      }

      return respuesta.send({
        estadoOperacion: 'EXITOSO',
        datos: carga
      });
    }
  );

  // ─── 4. Estado de Conexiones a Origenes de Datos ─────────────────────────────
  servidor.get(
    '/estado-conexion',
    {
      preHandler: [exigirAutenticacion]
    },
    async (_solicitud: FastifyRequest, respuesta: FastifyReply) => {
      const [estadoExcel, estadoRpc] = await Promise.all([
        adaptadorExcel.consultarEstadoConexion(),
        adaptadorRpc.consultarEstadoConexion()
      ]);

      return respuesta.send({
        estadoOperacion: 'EXITOSO',
        origenes: [estadoExcel, estadoRpc]
      });
    }
  );
}
