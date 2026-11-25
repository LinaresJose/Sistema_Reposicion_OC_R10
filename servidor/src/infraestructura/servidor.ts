import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyMultipart from '@fastify/multipart';
import { variablesEntorno } from '../configuracion/variables-entorno.js';
import { rutasAutenticacion } from './rutas/rutas-autenticacion.js';
import { rutasProveedores } from './rutas/rutas-proveedores.js';
import { rutasPropuestas } from './rutas/rutas-propuestas.js';
import { rutasOrdenesCompra } from './rutas/rutas-ordenes-compra.js';
import { rutasReportes } from './rutas/rutas-reportes.js';
import { rutasCargasOdoo } from './rutas/rutas-cargas-odoo.js';
import { rutasNotificaciones } from './rutas/rutas-notificaciones.js';
import { rutasAdministracion } from './rutas/rutas-administracion.js';
import { rutasAuditoria } from './rutas/rutas-auditoria.js';

export async function construirServidor() {
  const servidor = Fastify({
    logger: variablesEntorno.ENTORNO === 'desarrollo' ? {
      level: 'info'
    } : false
  });

  // 1. Configuracion de CORS restrictivo
  await servidor.register(fastifyCors, {
    origin: true, // Configurable por variable de entorno para produccion
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  });

  // 2. Manejo de Cookies seguras
  await servidor.register(fastifyCookie);

  // 3. Manejo de Tokens JWT
  await servidor.register(fastifyJwt, {
    secret: variablesEntorno.CLAVE_SECRETA_JWT,
    cookie: {
      cookieName: 'tokenAcceso',
      signed: false
    }
  });

  // 4. Manejo de archivos Multipart (Cargas Odoo)
  await servidor.register(fastifyMultipart, {
    limits: {
      fileSize: 25 * 1024 * 1024 // 25 MB max por archivo
    }
  });

  // 5. Ruta de comprobacion de salud del servicio (Healthcheck)
  servidor.get('/api/v1/salud', async () => {
    return {
      estado: 'OPERATIVO',
      sistema: 'Plataforma Reposicion y Ordenes de Compra R10',
      marcaTiempo: new Date().toISOString()
    };
  });

  // 6. Registro de rutas modulares
  await servidor.register(rutasAutenticacion, { prefix: '/api/v1/autenticacion' });
  await servidor.register(rutasProveedores, { prefix: '/api/v1/proveedores' });
  await servidor.register(rutasPropuestas, { prefix: '/api/v1/propuestas' });
  await servidor.register(rutasOrdenesCompra, { prefix: '/api/v1/ordenes-compra' });
  await servidor.register(rutasReportes, { prefix: '/api/v1/reportes' });
  await servidor.register(rutasCargasOdoo, { prefix: '/api/v1/cargas-odoo' });
  await servidor.register(rutasNotificaciones, { prefix: '/api/v1/notificaciones' });
  await servidor.register(rutasAdministracion, { prefix: '/api/v1/admin' });
  await servidor.register(rutasAuditoria, { prefix: '/api/v1/auditoria' });

  return servidor;
}

// Inicializacion del servidor si se ejecuta directamente
const esModuloPrincipal = process.argv[1]?.endsWith('servidor.ts') || process.argv[1]?.endsWith('servidor.js');
if (esModuloPrincipal) {
  construirServidor()
    .then(servidor => {
      servidor.listen({ port: variablesEntorno.PUERTO, host: variablesEntorno.HOST }, (err, address) => {
        if (err) {
          console.error('Error al arrancar servidor Fastify:', err);
          process.exit(1);
        }
        console.log(`Servidor Fastify escuchando en ${address}`);
      });
    })
    .catch(error => {
      console.error('Error fatal al construir servidor:', error);
      process.exit(1);
    });
}
