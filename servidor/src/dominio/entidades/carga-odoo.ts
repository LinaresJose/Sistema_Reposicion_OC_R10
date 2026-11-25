/**
 * Entidades de dominio para Carga, Validacion y Conciliacion de Datos Odoo.
 */

export type TipoOrigenDatosOdoo = 'ARCHIVOS_MANUALES_EXCEL' | 'API_RPC_ODOO';

export type EstadoProcesamientoCarga =
  | 'PROCESANDO'
  | 'COMPLETADA_EXITOSA'
  | 'RECHAZADA_CON_ERRORES'
  | 'SIN_CAMBIOS';

export type TipoNovedadCarga =
  | 'NUEVO_SKU'
  | 'CAMBIO_COSTO'
  | 'CAMBIO_PRECIO'
  | 'CAMBIO_STOCK'
  | 'CAMBIO_TRANSITO'
  | 'CAMBIO_DEMANDA'
  | 'CAMBIO_EMPAQUE'
  | 'SKU_INACTIVO';

export interface HallazgoValidacionFila {
  fila: number;
  archivo: string;
  columna: string;
  valor: any;
  mensajeError: string;
}

export interface NovedadCargaOdoo {
  identificadorNovedad: string;
  cargaId: string;
  tipoNovedad: TipoNovedadCarga;
  codigoSKU: string;
  valorAnterior: string | null;
  valorNuevo: string | null;
  detalleNovedad: string;
  creadoEn: Date;
}

export interface CargaArchivoOdoo {
  identificadorCarga: string;
  usuarioId: string | null;
  tipoOrigen: TipoOrigenDatosOdoo;
  hashCatalogoCostos: string | null;
  hashInventarioAMano: string | null;
  hashComprasTransito: string | null;
  hashVentasPrecios: string | null;
  totalRegistrosProcesados: number;
  totalNovedadesDetectadas: number;
  estadoProcesamiento: EstadoProcesamientoCarga;
  resumenNovedades: Record<string, number>;
  novedades: NovedadCargaOdoo[];
  hallazgosValidacion: HallazgoValidacionFila[];
  creadoEn: Date;
}

// ─── Estructuras Normalizadas Extraidas de los Archivos Odoo ──────────────────

export interface FilaCatalogoCostos {
  codigoSKU: string;
  codigoBarras: string | null;
  descripcionProducto: string;
  nombreProveedor: string;
  marca: string;
  costoUnitarioUSD: number;
  precioVentaUSD: number;
  unidadMinimaEmpaque: number;
  clasificacionComercial: 'ALTA ROTACION' | 'MEDIA ROTACION' | 'COMPLEMENTO';
  estadoSkuOdoo: 'ACTIVO' | 'INACTIVO';
}

export interface FilaInventarioMano {
  codigoSKU: string;
  cantidadAMano: number;
  ubicacion?: string | null;
}

export interface FilaComprasTransito {
  codigoSKU: string;
  numeroOrdenCompra: string;
  cantidadTransito: number;
  fechaLlegadaPrevista: Date | null;
  proveedor?: string | null;
}

export interface FilaVentasPrecios {
  codigoSKU: string;
  demandaHistoricaMensual: number;
  metaVentasMensual: number;
  precioVentaVigente: number;
}

export interface DatosNormalizadosOdoo {
  catalogoCostos: Map<string, FilaCatalogoCostos>;
  inventarioMano: Map<string, FilaInventarioMano>;
  comprasTransito: Map<string, FilaComprasTransito[]>;
  ventasPrecios: Map<string, FilaVentasPrecios>;
}
