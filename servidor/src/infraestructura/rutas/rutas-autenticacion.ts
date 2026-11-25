import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { CasoUsoIniciarSesion, ErrorAutenticacion } from '../../aplicacion/autenticacion/caso-uso-iniciar-sesion.js';
import { RepositorioUsuariosPg } from '../base-de-datos/repositorios/repositorio-usuarios-pg.js';
import { exigirAutenticacion } from '../seguridad/middleware-autorizacion-rbac.js';
import { variablesEntorno } from '../../configuracion/variables-entorno.js';

const esquemaInicioSesion = z.object({
  correoElectronico: z.string().email('El correo electronico no tiene un formato valido'),
  claveSecreta: z.string().min(6).optional(),
  contrasena: z.string().min(6).optional()
}).refine(data => data.claveSecreta || data.contrasena, {
  message: 'La contrasena es requerida'
}).transform(data => ({
  correoElectronico: data.correoElectronico,
  claveSecreta: (data.claveSecreta || data.contrasena)!
}));

export async function rutasAutenticacion(servidor: FastifyInstance, opciones: FastifyPluginOptions) {
  const repositorioUsuarios = new RepositorioUsuariosPg();
  const casoUsoIniciarSesion = new CasoUsoIniciarSesion(repositorioUsuarios);

  // 1. Iniciar Sesion
  servidor.post('/iniciar-sesion', async (solicitud, respuesta) => {
    try {
      const datosValidados = esquemaInicioSesion.parse(solicitud.body);
      const resultado = await casoUsoIniciarSesion.ejecutar(datosValidados);

      // Generar token JWT con vigencia configurada
      const tokenAcceso = servidor.jwt.sign(
        {
          identificadorUsuario: resultado.usuario.identificadorUsuario,
          correoElectronico: resultado.usuario.correoElectronico,
          rolId: resultado.usuario.rolId,
          categoriaCompradora: resultado.usuario.categoriaCompradora
        },
        { expiresIn: variablesEntorno.TIEMPO_EXPIRACION_TOKEN_ACCESO }
      );

      // Asignar cookie segura HttpOnly
      respuesta.setCookie('tokenAcceso', tokenAcceso, {
        path: '/',
        httpOnly: true,
        secure: variablesEntorno.ENTORNO === 'produccion',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 // 24 horas en segundos
      });

      return respuesta.status(200).send({
        estadoOperacion: 'EXITOSO',
        mensaje: 'Sesion iniciada correctamente',
        datos: {
          usuario: resultado.usuario,
          tokenAcceso: tokenAcceso
        }
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return respuesta.status(400).send({
          estadoOperacion: 'ERROR_VALIDACION',
          mensaje: 'Datos de inicio de sesion invalidos',
          detalles: error.errors.map(e => ({ campo: e.path.join('.'), mensaje: e.message }))
        });
      }

      if (error instanceof ErrorAutenticacion) {
        const codigoHttp = error.codigoError === 'CUENTA_BLOQUEADA' ? 423 : 401;
        return respuesta.status(codigoHttp).send({
          estadoOperacion: error.codigoError,
          mensaje: error.message
        });
      }

      solicitud.log.error(error);
      return respuesta.status(500).send({
        estadoOperacion: 'ERROR_INTERNO',
        mensaje: 'Ocurrio un error inesperado al procesar el inicio de sesion'
      });
    }
  });

  // 2. Cerrar Sesion
  servidor.post('/cerrar-sesion', async (solicitud, respuesta) => {
    respuesta.clearCookie('tokenAcceso', {
      path: '/',
      httpOnly: true,
      secure: variablesEntorno.ENTORNO === 'produccion',
      sameSite: 'strict'
    });

    return respuesta.status(200).send({
      estadoOperacion: 'EXITOSO',
      mensaje: 'Sesion cerrada exitosamente'
    });
  });

  // 3. Consultar Perfil Actual
  const manejadorPerfil = async (solicitud: any, respuesta: any) => {
    return respuesta.status(200).send({
      estadoOperacion: 'EXITOSO',
      datos: {
        usuario: solicitud.usuarioAutenticado,
        ...solicitud.usuarioAutenticado
      }
    });
  };

  servidor.get('/perfil', { preHandler: [exigirAutenticacion] }, manejadorPerfil);
  servidor.get('/perfil-actual', { preHandler: [exigirAutenticacion] }, manejadorPerfil);
}
