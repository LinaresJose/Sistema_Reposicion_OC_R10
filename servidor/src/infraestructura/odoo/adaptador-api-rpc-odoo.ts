/**
 * Adaptador de Integracion Odoo via API (JSON-RPC / XML-RPC).
 *
 * Implementa PuertoOrigenDatosOdoo desacoplando el nucleo del sistema.
 * Hoy opera como puerto preparado para conexion futura sin tocar
 * la logica de negocio, calculo ni conciliacion.
 */
import {
  PuertoOrigenDatosOdoo,
  ArchivosEntradaOdoo,
  ResultadoExtraccionOdoo,
  EstadoConexionOrigenOdoo
} from '../../dominio/puertos/puerto-origen-datos-odoo.js';

export interface ConfiguracionApiRpcOdoo {
  urlServidor?: string;
  nombreBaseDatos?: string;
  usuarioOdoo?: string;
  claveApiKey?: string;
  estaHabilitada?: boolean;
}

export class AdaptadorApiRpcOdoo implements PuertoOrigenDatosOdoo {
  constructor(private readonly configuracion: ConfiguracionApiRpcOdoo = {}) {}

  async consultarEstadoConexion(): Promise<EstadoConexionOrigenOdoo> {
    const habilitada = Boolean(
      this.configuracion.estaHabilitada &&
      this.configuracion.urlServidor &&
      this.configuracion.nombreBaseDatos &&
      this.configuracion.claveApiKey
    );

    return {
      tipoOrigen: 'API_RPC_ODOO',
      estaDisponible: habilitada,
      mensajeEstado: habilitada
        ? `Conexion API RPC configurada hacia ${this.configuracion.urlServidor}`
        : 'Adaptador API RPC preparado. Actualmente en espera de credenciales de produccion de Odoo.'
    };
  }

  async obtenerDatosOdoo(_entrada?: ArchivosEntradaOdoo): Promise<ResultadoExtraccionOdoo> {
    const estado = await this.consultarEstadoConexion();

    if (!estado.estaDisponible) {
      return {
        esValido: false,
        datosNormalizados: {
          catalogoCostos: new Map(),
          inventarioMano: new Map(),
          comprasTransito: new Map(),
          ventasPrecios: new Map()
        },
        hallazgos: [
          {
            fila: 0,
            archivo: 'API_RPC_ODOO',
            columna: 'CONEXION',
            valor: null,
            mensajeError: 'La integracion por API RPC de Odoo no cuenta con credenciales activas. Utilice carga de archivos Excel.'
          }
        ],
        hashes: {
          catalogoCostos: null,
          inventarioAMano: null,
          comprasTransito: null,
          ventasPrecios: null
        },
        totalFilasLeidas: 0
      };
    }

    // Nota arquitectonica: Cuando se suministren las credenciales de produccion,
    // se conecta al cliente XML-RPC/JSON-RPC y normaliza a las mismas interfaces DatosNormalizadosOdoo
    return {
      esValido: true,
      datosNormalizados: {
        catalogoCostos: new Map(),
        inventarioMano: new Map(),
        comprasTransito: new Map(),
        ventasPrecios: new Map()
      },
      hallazgos: [],
      hashes: {
        catalogoCostos: 'hash-api-rpc-catalogo',
        inventarioAMano: 'hash-api-rpc-stock',
        comprasTransito: 'hash-api-rpc-transito',
        ventasPrecios: 'hash-api-rpc-ventas'
      },
      totalFilasLeidas: 0
    };
  }
}
