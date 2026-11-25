import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { variablesEntorno } from '../../configuracion/variables-entorno.js';

// Configuracion de pool optimizada para capa gratuita (Free Tier):
// Limite maximo reducido (5 conexiones) para no saturar PgBouncer o cuotas de Render/Neon/Supabase.
export const poolPostgresql = new Pool({
  connectionString: variablesEntorno.URL_BASE_DATOS,
  max: variablesEntorno.LIMITE_CONEXIONES_POOL,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: variablesEntorno.TIEMPO_MAXIMO_ESPERA_CONEXION_MS,
  ssl: variablesEntorno.ENTORNO === 'produccion' ? { rejectUnauthorized: false } : undefined
});

poolPostgresql.on('error', (error: Error) => {
  // Manejo explicito de errores sin detener el proceso principal
  console.error('Error imprevisto en el cliente de base de datos PostgreSQL:', error.message);
});

export const baseDeDatos = {
  async ejecutarConsulta<T extends QueryResultRow = any>(
    textoConsulta: string,
    parametros: any[] = []
  ): Promise<QueryResult<T>> {
    const inicio = Date.now();
    try {
      const resultado = await poolPostgresql.query<T>(textoConsulta, parametros);
      return resultado;
    } catch (error: any) {
      console.error('Error al ejecutar consulta SQL:', {
        mensaje: error.message,
        consulta: textoConsulta.slice(0, 100) + '...'
      });
      throw error;
    }
  },

  async obtenerClienteTransaccion(): Promise<PoolClient> {
    const cliente = await poolPostgresql.connect();
    return cliente;
  },

  async cerrarConexiones(): Promise<void> {
    await poolPostgresql.end();
  }
};
