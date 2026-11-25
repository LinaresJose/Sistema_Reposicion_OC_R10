/**
 * Puerto de origen de datos Odoo (Arquitectura Hexagonal).
 * Desacopla la fuente de datos (archivos Excel hoy, API XML-RPC/JSON-RPC en el futuro)
 * del nucleo del sistema.
 */
import {
  DatosNormalizadosOdoo,
  HallazgoValidacionFila,
  TipoOrigenDatosOdoo
} from '../entidades/carga-odoo.js';

export interface ArchivosEntradaOdoo {
  catalogoCostos?: Buffer;
  inventarioMano?: Buffer;
  comprasTransito?: Buffer;
  historialVentasPrecios?: Buffer;
}

export interface HashesArchivosOdoo {
  catalogoCostos: string | null;
  inventarioAMano: string | null;
  comprasTransito: string | null;
  ventasPrecios: string | null;
}

export interface ResultadoExtraccionOdoo {
  esValido: boolean;
  datosNormalizados: DatosNormalizadosOdoo;
  hallazgos: HallazgoValidacionFila[];
  hashes: HashesArchivosOdoo;
  totalFilasLeidas: number;
}

export interface EstadoConexionOrigenOdoo {
  tipoOrigen: TipoOrigenDatosOdoo;
  estaDisponible: boolean;
  mensajeEstado: string;
}

export interface PuertoOrigenDatosOdoo {
  /**
   * Extrae y valida los datos provenientes de la fuente Odoo.
   * Si es por archivos, recibe los buffers de Excel.
   * Si es por API, se conecta remotamente.
   */
  obtenerDatosOdoo(entrada?: ArchivosEntradaOdoo): Promise<ResultadoExtraccionOdoo>;

  /**
   * Consulta el estado y tipo del adaptador activo.
   */
  consultarEstadoConexion(): Promise<EstadoConexionOrigenOdoo>;
}
