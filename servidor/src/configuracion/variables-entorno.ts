import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const esquemaVariablesEntorno = z.object({
  PUERTO: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  URL_BASE_DATOS: z.string().default('postgresql://postgres:postgres@localhost:5432/reposicion_oc'),
  LIMITE_CONEXIONES_POOL: z.coerce.number().default(5),
  TIEMPO_MAXIMO_ESPERA_CONEXION_MS: z.coerce.number().default(5000),
  CLAVE_SECRETA_JWT: z.string().min(32).default('clave_secreta_super_segura_para_desarrollo_cambiar_en_produccion_2026!'),
  TIEMPO_EXPIRACION_TOKEN_ACCESO: z.string().default('15m'),
  TIEMPO_EXPIRACION_TOKEN_REFRESCO: z.string().default('7d'),
  ENTORNO: z.enum(['desarrollo', 'pruebas', 'produccion']).default('desarrollo'),
  MAXIMO_INTENTOS_FALLIDOS_LOGIN: z.coerce.number().default(5),
  MINUTOS_BLOQUEO_CUENTA: z.coerce.number().default(15),
  MINUTOS_INACTIVIDAD_PROVEEDOR: z.coerce.number().default(45)
});

export type VariablesEntorno = z.infer<typeof esquemaVariablesEntorno>;

export const variablesEntorno: VariablesEntorno = esquemaVariablesEntorno.parse(process.env);
