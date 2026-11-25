import { FastifyRequest, FastifyReply } from 'fastify';
import { RolSistema, TipoPermiso, PERMISOS_OPERATIVOS, ROLES_SISTEMA } from '../../configuracion/constantes-negocio.js';

export interface UsuarioAutenticadoToken {
  identificadorUsuario: string;
  correoElectronico: string;
  rolId: RolSistema;
  categoriaCompradora: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    usuarioAutenticado?: UsuarioAutenticadoToken;
  }
}

/**
 * Middleware para exigir que la solicitud cuente con un token JWT valido
 */
export async function exigirAutenticacion(solicitud: FastifyRequest, respuesta: FastifyReply) {
  try {
    const token = solicitud.cookies.tokenAcceso || solicitud.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return respuesta.status(401).send({
        estadoOperacion: 'NO_AUTORIZADO',
        mensaje: 'No se encontro una sesion activa o token de acceso'
      });
    }

    const decodificado = await solicitud.server.jwt.verify<UsuarioAutenticadoToken>(token);
    solicitud.usuarioAutenticado = decodificado;
  } catch (error) {
    return respuesta.status(401).send({
      estadoOperacion: 'TOKEN_INVALIDO',
      mensaje: 'La sesion es invalida o ha expirado. Inicie sesion nuevamente'
    });
  }
}

/**
 * Middleware para exigir permisos especificos de la matriz RBAC
 * Garantiza que ADMINISTRADOR_SISTEMA tenga acceso total a cualquier accion permitida a GERENTE_COMPRAS
 */
export function exigirPermiso(permisoRequerido: TipoPermiso) {
  return async (solicitud: FastifyRequest, respuesta: FastifyReply) => {
    const usuario = solicitud.usuarioAutenticado;

    if (!usuario) {
      return respuesta.status(401).send({
        estadoOperacion: 'NO_AUTORIZADO',
        mensaje: 'Debe iniciar sesion para realizar esta accion'
      });
    }

    // Regla estricta: El rol ADMINISTRADOR_SISTEMA siempre tiene acceso irrestricto
    if (usuario.rolId === ROLES_SISTEMA.ADMINISTRADOR_SISTEMA) {
      return;
    }

    const rolesPermitidos: readonly RolSistema[] = PERMISOS_OPERATIVOS[permisoRequerido];

    if (!rolesPermitidos.includes(usuario.rolId)) {
      return respuesta.status(403).send({
        estadoOperacion: 'ACCESO_DENEGADO',
        mensaje: `Su rol (${usuario.rolId}) no tiene autorizacion para ejecutar la accion: ${permisoRequerido}`
      });
    }
  };
}
