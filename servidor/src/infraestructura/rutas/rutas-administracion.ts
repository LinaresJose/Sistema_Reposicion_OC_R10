// Rutas de Administracion del Sistema
// Solo accesibles para ADMINISTRADOR_SISTEMA
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { exigirAutenticacion, exigirPermiso } from '../seguridad/middleware-autorizacion-rbac.js';
import { CasoUsoListarUsuarios } from '../../aplicacion/administracion/caso-uso-listar-usuarios.js';
import { CasoUsoCrearUsuario, ErrorCrearUsuario } from '../../aplicacion/administracion/caso-uso-crear-usuario.js';
import { CasoUsoActualizarUsuario, ErrorActualizarUsuario } from '../../aplicacion/administracion/caso-uso-actualizar-usuario.js';
import { CasoUsoGestionarRazonesSociales } from '../../aplicacion/administracion/caso-uso-gestionar-razones-sociales.js';
import { RepositorioAuditoriaPg } from '../base-de-datos/repositorios/repositorio-auditoria-pg.js';
import { RepositorioUsuariosPg } from '../base-de-datos/repositorios/repositorio-usuarios-pg.js';
import { ROLES_SISTEMA } from '../../configuracion/constantes-negocio.js';

const esquemaCrearUsuario = z.object({
  nombreCompleto: z.string().min(3).max(120),
  correoElectronico: z.string().email(),
  contrasenaPlana: z.string().min(8).max(128),
  rolId: z.enum([
    ROLES_SISTEMA.ADMINISTRADOR_SISTEMA,
    ROLES_SISTEMA.GERENTE_COMPRAS,
    ROLES_SISTEMA.ANALISTA_COMPRAS,
    ROLES_SISTEMA.AUDITOR_CONTROL
  ]),
  categoriaCompradora: z.enum(['NACIONAL_1', 'NACIONAL_2', 'NACIONAL_3', 'INTERNACIONAL', 'NINGUNA']).optional(),
  telefonoContacto: z.string().max(50).optional()
});

const esquemaActualizarUsuario = z.object({
  nombreCompleto: z.string().min(3).max(120).optional(),
  rolId: z.enum([
    ROLES_SISTEMA.ADMINISTRADOR_SISTEMA,
    ROLES_SISTEMA.GERENTE_COMPRAS,
    ROLES_SISTEMA.ANALISTA_COMPRAS,
    ROLES_SISTEMA.AUDITOR_CONTROL
  ]).optional(),
  categoriaCompradora: z.enum(['NACIONAL_1', 'NACIONAL_2', 'NACIONAL_3', 'INTERNACIONAL', 'NINGUNA']).optional(),
  telefonoContacto: z.string().max(50).nullable().optional(),
  estaActivo: z.boolean().optional(),
  nuevaContrasena: z.string().min(8).max(128).optional(),
  contrasenaActual: z.string().optional()
});

const esquemaActualizarRazonSocial = z.object({
  nombreLegal: z.string().min(3).max(200).optional(),
  rif: z.string().max(30).optional(),
  direccionFiscal: z.string().max(400).optional(),
  telefonos: z.string().max(200).optional(),
  correoContacto: z.string().email().optional(),
  urlLogoBase64: z.string().optional() // base64 del logo PNG/JPG
});

export const rutasAdministracion: FastifyPluginAsync = async (servidor) => {
  const repoAuditoria = new RepositorioAuditoriaPg();
  const repoUsuarios = new RepositorioUsuariosPg();

  // Todas las rutas requieren autenticacion
  servidor.addHook('preHandler', exigirAutenticacion);

  // ===== USUARIOS =====

  // GET /api/v1/admin/usuarios — Listar todos los usuarios
  servidor.get('/usuarios', {
    preHandler: [exigirPermiso('ADMINISTRAR_USUARIOS')]
  }, async (peticion, respuesta) => {
    const qs = peticion.query as Record<string, string | undefined>;
    const soloActivos = qs.soloActivos === 'true';
    const rol = qs.rol as string | undefined;

    const caso = new CasoUsoListarUsuarios();
    const resultado = await caso.ejecutar({ soloActivos, rol: rol as any });
    return respuesta.code(200).send(resultado);
  });

  // GET /api/v1/admin/usuarios/:id — Obtener detalle de un usuario
  servidor.get('/usuarios/:id', {
    preHandler: [exigirPermiso('ADMINISTRAR_USUARIOS')]
  }, async (peticion, respuesta) => {
    const { id } = peticion.params as { id: string };
    const usuario = await repoUsuarios.buscarPorId(id);
    if (!usuario) return respuesta.code(404).send({ error: 'Usuario no encontrado.' });
    const { claveSecretaHash: _, ...seguro } = usuario;
    return respuesta.code(200).send(seguro);
  });

  // POST /api/v1/admin/usuarios — Crear nuevo usuario
  servidor.post('/usuarios', {
    preHandler: [exigirPermiso('ADMINISTRAR_USUARIOS')]
  }, async (peticion, respuesta) => {
    const sesion = peticion.usuarioAutenticado!;
    const parseo = esquemaCrearUsuario.safeParse(peticion.body);
    if (!parseo.success) {
      return respuesta.code(400).send({ error: 'Datos invalidos.', detalles: parseo.error.issues });
    }

    const caso = new CasoUsoCrearUsuario(repoAuditoria);
    try {
      const nuevo = await caso.ejecutar(parseo.data, sesion.identificadorUsuario);
      return respuesta.code(201).send(nuevo);
    } catch (err) {
      if (err instanceof ErrorCrearUsuario) {
        const codigoHttp = err.codigo === 'CORREO_DUPLICADO' ? 409 : 400;
        return respuesta.code(codigoHttp).send({ error: err.message, codigo: err.codigo });
      }
      throw err;
    }
  });

  // PUT /api/v1/admin/usuarios/:id — Actualizar usuario (admin actualiza cualquiera)
  servidor.put('/usuarios/:id', {
    preHandler: [exigirPermiso('ADMINISTRAR_USUARIOS')]
  }, async (peticion, respuesta) => {
    const sesion = peticion.usuarioAutenticado!;
    const { id } = peticion.params as { id: string };
    const parseo = esquemaActualizarUsuario.safeParse(peticion.body);
    if (!parseo.success) {
      return respuesta.code(400).send({ error: 'Datos invalidos.', detalles: parseo.error.issues });
    }

    const caso = new CasoUsoActualizarUsuario(repoUsuarios, repoAuditoria);
    try {
      await caso.ejecutar(id, parseo.data, sesion.identificadorUsuario, true);
      return respuesta.code(204).send();
    } catch (err) {
      if (err instanceof ErrorActualizarUsuario) {
        const codigoHttp = err.codigo === 'USUARIO_NO_ENCONTRADO' ? 404
          : err.codigo === 'CONTRASENA_ACTUAL_INCORRECTA' ? 401
          : err.codigo === 'SIN_PERMISO' ? 403
          : 400;
        return respuesta.code(codigoHttp).send({ error: err.message, codigo: err.codigo });
      }
      throw err;
    }
  });

  // PUT /api/v1/admin/perfil/contrasena — Cambiar propia contrasena (cualquier usuario autenticado)
  // La autenticacion ya fue verificada por el hook global addHook('preHandler', exigirAutenticacion)
  servidor.put('/perfil/contrasena', async (peticion, respuesta) => {
    const sesion = peticion.usuarioAutenticado!;
    const parseo = z.object({
      nuevaContrasena: z.string().min(8).max(128),
      contrasenaActual: z.string()
    }).safeParse(peticion.body);

    if (!parseo.success) {
      return respuesta.code(400).send({ error: 'Datos invalidos.', detalles: parseo.error.issues });
    }

    const caso = new CasoUsoActualizarUsuario(repoUsuarios, repoAuditoria);
    try {
      await caso.ejecutar(
        sesion.identificadorUsuario,
        { nuevaContrasena: parseo.data.nuevaContrasena, contrasenaActual: parseo.data.contrasenaActual },
        sesion.identificadorUsuario,
        false // Siempre requiere contrasena actual cuando se cambia la propia
      );
      return respuesta.code(204).send();
    } catch (err) {
      if (err instanceof ErrorActualizarUsuario) {
        const codigoHttp = err.codigo === 'CONTRASENA_ACTUAL_INCORRECTA' ? 401 : 400;
        return respuesta.code(codigoHttp).send({ error: err.message, codigo: err.codigo });
      }
      throw err;
    }
  });

  // ===== RAZONES SOCIALES =====

  // GET /api/v1/admin/razones-sociales — Listar empresas emisoras
  servidor.get('/razones-sociales', {
    preHandler: [exigirPermiso('CONFIGURAR_RAZONES_SOCIALES')]
  }, async (_peticion, respuesta) => {
    const caso = new CasoUsoGestionarRazonesSociales(repoAuditoria);
    const lista = await caso.listar();
    return respuesta.code(200).send(lista);
  });

  // GET /api/v1/admin/razones-sociales/:id — Obtener detalle con logo en base64
  servidor.get('/razones-sociales/:id', {
    preHandler: [exigirPermiso('CONFIGURAR_RAZONES_SOCIALES')]
  }, async (peticion, respuesta) => {
    const { id } = peticion.params as { id: string };
    const caso = new CasoUsoGestionarRazonesSociales(repoAuditoria);
    const razonSocial = await caso.obtenerConLogo(id);
    if (!razonSocial) return respuesta.code(404).send({ error: 'Razon social no encontrada.' });
    return respuesta.code(200).send(razonSocial);
  });

  // PUT /api/v1/admin/razones-sociales/:id — Actualizar datos fiscales o logo
  servidor.put('/razones-sociales/:id', {
    preHandler: [exigirPermiso('CONFIGURAR_RAZONES_SOCIALES')]
  }, async (peticion, respuesta) => {
    const sesion = peticion.usuarioAutenticado!;
    const { id } = peticion.params as { id: string };
    const parseo = esquemaActualizarRazonSocial.safeParse(peticion.body);
    if (!parseo.success) {
      return respuesta.code(400).send({ error: 'Datos invalidos.', detalles: parseo.error.issues });
    }

    const caso = new CasoUsoGestionarRazonesSociales(repoAuditoria);
    await caso.actualizar(id, parseo.data, sesion.identificadorUsuario);
    return respuesta.code(204).send();
  });
};
