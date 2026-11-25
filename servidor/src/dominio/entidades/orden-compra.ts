/**
 * Entidad de dominio: OrdenCompra y renglones.
 *
 * Maquina de estados:
 *   BORRADOR -> EN_REVISION_WHATSAPP -> APROBADA_PARA_EMISION -> OC_EMITIDA
 *   EN_REVISION_WHATSAPP -> BORRADOR  (devolucion para ajuste)
 *
 * Correlativo oficial: OC-{CODIGO_EMPRESA}-{AAAA}-{NNNN}
 */

/** Estados posibles de una orden de compra */
export type EstadoOrdenCompra =
  | 'BORRADOR'
  | 'EN_REVISION_WHATSAPP'
  | 'APROBADA_PARA_EMISION'
  | 'OC_EMITIDA';

/** Canal por el que se registro la aprobacion */
export type CanalAprobacion = 'SISTEMA' | 'WHATSAPP';

/** Un renglon (linea de producto) dentro de una orden de compra */
export interface RenglonOrdenCompra {
  identificadorRenglon: string;
  ordenCompraId: string;
  productoId: string;
  codigoSKU: string;
  descripcionProducto: string;
  marca: string;
  unidadMinimaEmpaque: number;
  cantidadOrdenada: number;
  costoUnitarioUSD: number;
  subtotalUSD: number;
  justificacionAjuste: string | null;
  creadoEn: Date;
}

/** Cabecera de una orden de compra */
export interface OrdenCompra {
  identificadorOrden: string;
  proveedorId: string;
  nombreProveedor: string;
  registroFiscalProveedor: string;
  condicionPago: string;
  tipoDocumentoLegal: string;
  plazoEntregaDias: number;
  frecuenciaCompraDias: number;
  analistaCreadoraId: string;
  nombreAnalistaCreadora: string;
  telefonoAnalistaCreadora: string | null;
  empresaEmisoraId: string | null;
  codigoEmpresaEmisora: string | null;
  nombreEmpresaEmisora: string | null;
  registroFiscalEmpresa: string | null;
  direccionFiscalEmpresa: string | null;
  logoBase64Empresa: string | null;
  textoFooterEmpresa: string | null;
  numeroCorrelativoOficial: string | null;
  estadoOrden: EstadoOrdenCompra;
  canalAprobacion: CanalAprobacion | null;
  notaRespalodoAprobacion: string | null;
  aprobadoPorId: string | null;
  aprobadoEn: Date | null;
  emitidoEn: Date | null;
  totalRenglones: number;
  totalInversionUSD: number;
  renglones: RenglonOrdenCompra[];
  creadoEn: Date;
  actualizadoEn: Date;
}

/** Resumen ligero para listados */
export interface ResumenOrdenCompra {
  identificadorOrden: string;
  proveedorId: string;
  nombreProveedor: string;
  proveedorNombre?: string;
  analistaCreadoraId: string;
  analistaUsuarioId?: string;
  nombreAnalistaCreadora: string;
  analistaNombre?: string;
  empresaEmisoraId: string | null;
  razonSocialEmisoraId?: string | null;
  codigoEmpresaEmisora: string | null;
  codigoRazonSocialEmisora?: string | null;
  numeroCorrelativoOficial: string | null;
  estadoOrden: EstadoOrdenCompra;
  totalRenglones: number;
  totalInversionUSD: number;
  montoTotalNetoUSD?: number;
  montoTotalBrutoUSD?: number;
  montoTotalImpuestoUSD?: number;
  creadoEn: Date;
  actualizadoEn: Date;
}

/** Datos necesarios para crear una orden en borrador */
export interface EntradaCrearOrdenBorrador {
  proveedorId: string;
  analistaCreadoraId: string;
  /** SKUs aprobados en la propuesta (estado_decision = 'APROBADO') */
  idsDecisionesAprobadas: string[];
}

/** Datos para registrar la aprobacion (WhatsApp o Sistema) */
export interface EntradaRegistrarAprobacion {
  canalAprobacion: CanalAprobacion;
  notaRespalodoAprobacion: string;
  aprobadoPorId: string;
}

/** Datos para emitir la orden oficial */
export interface EntradaEmitirOrdenOficial {
  empresaEmisoraId: string;
  emisorId: string;
}
