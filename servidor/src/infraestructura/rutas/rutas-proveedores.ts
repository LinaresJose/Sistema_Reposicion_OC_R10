import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { RepositorioProveedoresPg } from '../base-de-datos/repositorios/repositorio-proveedores-pg.js';
import { RepositorioAuditoriaPg } from '../base-de-datos/repositorios/repositorio-auditoria-pg.js';
import { CasoUsoConsultarCartera } from '../../aplicacion/asignacion-proveedores/caso-uso-consultar-cartera.js';
import { CasoUsoAutoasignarProveedor, ErrorAsignacionProveedor } from '../../aplicacion/asignacion-proveedores/caso-uso-autoasignar-proveedor.js';
import { CasoUsoLiberarProveedor } from '../../aplicacion/asignacion-proveedores/caso-uso-liberar-proveedor.js';
import { CasoUsoActualizarProveedor, ErrorActualizarProveedor } from '../../aplicacion/asignacion-proveedores/caso-uso-actualizar-proveedor.js';
import { exigirAutenticacion, exigirPermiso } from '../seguridad/middleware-autorizacion-rbac.js';
import { variablesEntorno } from '../../configuracion/variables-entorno.js';
import { CategoriaCompradora, EstadoAsignacionProveedor } from '../../configuracion/constantes-negocio.js';

export async function rutasProveedores(servidor: FastifyInstance, opciones: FastifyPluginOptions) {
  const repositorioProveedores = new RepositorioProveedoresPg();
  const repositorioAuditoria = new RepositorioAuditoriaPg();

  const casoUsoConsultar = new CasoUsoConsultarCartera(repositorioProveedores);
  const casoUsoAutoasignar = new CasoUsoAutoasignarProveedor(repositorioProveedores, repositorioAuditoria);
  const casoUsoLiberar = new CasoUsoLiberarProveedor(repositorioProveedores, repositorioAuditoria);
  const casoUsoActualizar = new CasoUsoActualizarProveedor(repositorioProveedores, repositorioAuditoria);

  // Todas las rutas requieren usuario autenticado
  servidor.addHook('preHandler', exigirAutenticacion);

  // 1. Consultar Cartera de Proveedores
  servidor.get('/', async (solicitud, respuesta) => {
    const consultaEsquema = z.object({
      categoria: z.enum(['NACIONAL_1', 'NACIONAL_2', 'NACIONAL_3', 'INTERNACIONAL']).optional(),
      estadoAsignacion: z.enum(['DISPONIBLE', 'EN_PROCESO_TRABAJO', 'EN_REVISION_WHATSAPP']).optional(),
      analistaUsuarioId: z.string().uuid().optional(),
      busqueda: z.string().optional()
    });

    const filtros = consultaEsquema.parse(solicitud.query);
    const proveedores = await casoUsoConsultar.ejecutar({
      categoria: filtros.categoria as CategoriaCompradora | undefined,
      estadoAsignacion: filtros.estadoAsignacion as EstadoAsignacionProveedor | undefined,
      analistaUsuarioId: filtros.analistaUsuarioId,
      busqueda: filtros.busqueda
    });

    return respuesta.status(200).send({
      estadoOperacion: 'EXITOSO',
      totalProveedores: proveedores.length,
      datos: proveedores
    });
  });

  // 2. Consultar Proveedor por Id
  servidor.get('/:identificadorProveedor', async (solicitud, respuesta) => {
    const params = z.object({ identificadorProveedor: z.string().uuid() }).parse(solicitud.params);
    const proveedor = await repositorioProveedores.buscarPorId(params.identificadorProveedor);

    if (!proveedor) {
      return respuesta.status(404).send({
        estadoOperacion: 'PROVEEDOR_NO_ENCONTRADO',
        mensaje: 'El proveedor solicitado no existe'
      });
    }

    return respuesta.status(200).send({
      estadoOperacion: 'EXITOSO',
      datos: proveedor
    });
  });

  // 3. Autoasignar Proveedor
  servidor.post('/:identificadorProveedor/autoasignar', {
    preHandler: [exigirPermiso('AUTOASIGNAR_PROVEEDOR')]
  }, async (solicitud, respuesta) => {
    const params = z.object({ identificadorProveedor: z.string().uuid() }).parse(solicitud.params);
    const usuario = solicitud.usuarioAutenticado!;

    try {
      const asignacion = await casoUsoAutoasignar.ejecutar(
        params.identificadorProveedor,
        usuario.identificadorUsuario,
        variablesEntorno.MINUTOS_INACTIVIDAD_PROVEEDOR,
        solicitud.ip
      );

      return respuesta.status(200).send({
        estadoOperacion: 'EXITOSO',
        mensaje: 'Proveedor autoasignado exitosamente',
        datos: asignacion
      });
    } catch (error: any) {
      if (error instanceof ErrorAsignacionProveedor) {
        const codigoHttp = error.codigoError === 'PROVEEDOR_OCUPADO' ? 409 : 400;
        return respuesta.status(codigoHttp).send({
          estadoOperacion: error.codigoError,
          mensaje: error.message,
          detalles: error.detalles
        });
      }
      throw error;
    }
  });

  // 4. Liberar Proveedor (Voluntario o Forzado)
  servidor.post('/:identificadorProveedor/liberar', async (solicitud, respuesta) => {
    const params = z.object({ identificadorProveedor: z.string().uuid() }).parse(solicitud.params);
    const cuerpo = z.object({ observacion: z.string().optional() }).parse(solicitud.body || {});
    const usuario = solicitud.usuarioAutenticado!;

    try {
      await casoUsoLiberar.ejecutar(
        params.identificadorProveedor,
        usuario.identificadorUsuario,
        usuario.rolId,
        cuerpo.observacion,
        solicitud.ip
      );

      return respuesta.status(200).send({
        estadoOperacion: 'EXITOSO',
        mensaje: 'Proveedor liberado correctamente'
      });
    } catch (error: any) {
      if (error instanceof ErrorAsignacionProveedor) {
        const codigoHttp = error.codigoError === 'ACCESO_DENEGADO' ? 403 : 400;
        return respuesta.status(codigoHttp).send({
          estadoOperacion: error.codigoError,
          mensaje: error.message
        });
      }
      throw error;
    }
  });

  // 5. Actualizar Datos y Categoria del Proveedor
  servidor.put('/:identificadorProveedor', {
    preHandler: [exigirPermiso('EDITAR_DATOS_PROVEEDOR')]
  }, async (solicitud, respuesta) => {
    const params = z.object({ identificadorProveedor: z.string().uuid() }).parse(solicitud.params);
    const esquemaEdicion = z.object({
      nombreRazonSocial: z.string().min(2).optional(),
      codigoProveedorOdoo: z.string().optional(),
      registroInformacionFiscal: z.string().optional(),
      categoriaCompradora: z.enum(['NACIONAL_1', 'NACIONAL_2', 'NACIONAL_3', 'INTERNACIONAL']).optional(),
      plazoEntregaDias: z.number().int().min(0).optional(),
      frecuenciaCompraDias: z.number().int().min(1).optional(),
      diasCredito: z.number().int().min(0).optional(),
      descuentoComercialCadena: z.string().optional(),
      formaPagoPredeterminada: z.string().optional(),
      tipoDocumentoPredeterminado: z.string().optional(),
      nombreContacto: z.string().optional(),
      telefonoContacto: z.string().optional(),
      correoContacto: z.string().email().optional().or(z.literal('')),
      estaActivo: z.boolean().optional()
    });

    const datosValidados = esquemaEdicion.parse(solicitud.body || {});
    const usuario = solicitud.usuarioAutenticado!;

    try {
      const proveedorActualizado = await casoUsoActualizar.ejecutar(
        params.identificadorProveedor,
        usuario.identificadorUsuario,
        datosValidados,
        solicitud.ip
      );

      return respuesta.status(200).send({
        estadoOperacion: 'EXITOSO',
        mensaje: 'Datos del proveedor actualizados exitosamente',
        datos: proveedorActualizado
      });
    } catch (error: any) {
      if (error instanceof ErrorActualizarProveedor) {
        const codigoHttp = error.codigoError === 'PROVEEDOR_NO_ENCONTRADO' ? 404 : 400;
        return respuesta.status(codigoHttp).send({
          estadoOperacion: error.codigoError,
          mensaje: error.message
        });
      }
      throw error;
    }
  });
}
