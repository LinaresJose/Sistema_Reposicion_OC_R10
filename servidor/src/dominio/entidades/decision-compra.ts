export type EstadoDecisionCompra = 'PENDIENTE' | 'APROBADO' | 'EXCLUIDO';

export interface DecisionCompraSKU {
  identificadorDecision: string;
  calculoId: string;
  proveedorId: string;
  analistaUsuarioId: string | null;
  estadoDecision: EstadoDecisionCompra;
  cantidadSugeridaReferencia: number;
  cantidadAjusteManual: number | null;
  cantidadFinalPropuesta: number;
  justificacionAjuste?: string;
  hashFirmaAprobada?: string;
  esCalculoVigente: boolean;
  numeroVersion: number;
  actualizadoEn: Date;
}

export interface RenglonPropuestaReposicion {
  identificadorDecision: string;
  identificadorCalculo: string;
  identificadorProducto: string;
  codigoSKU: string;
  codigoSku?: string;
  descripcionProducto: string;
  marca?: string;
  costoUnitarioUSD: number;
  precioVentaUSD: number;
  margenPorcentual: number;
  unidadMinimaEmpaque: number;
  unidadesEmpaque?: number;
  cantidadAMano: number;
  stockActualMano?: number;
  cantidadTransito: number;
  stockEnTransitoValido?: number;
  inventarioEfectivo: number;
  demandaOperativaMensual: number;
  demandaDiaria?: number;
  diasCoberturaActual: number;
  diasCoberturaEfectiva?: number;
  coberturaObjetivoDias: number;
  umbralCompraDias: number;
  cantidadSugeridaMotor: number;
  sugeridoAjustadoEmpaque?: number;
  sugeridoMatematicoBruto?: number;
  inversionSugeridaUSD: number;
  cantidadAjusteManual: number | null;
  cantidadFinalAprobada: number;
  cantidadFinalPropuesta?: number;
  inversionFinalUSD: number;
  justificacionAjuste?: string;
  estadoDecision: EstadoDecisionCompra;
  diagnosticoUrgencia: string;
  esAptoParaCompra: boolean;
  motivoInaptitud?: string;
  hashCalculoVigente: string;
  hashFirmaCalculo?: string;
  hashFirmaAprobada?: string;
  esCalculoVigente: boolean;
  numeroVersion: number;
}

export interface ResumenPropuestaProveedor {
  proveedorId: string;
  identificadorProveedor?: string;
  nombreProveedor: string;
  nombreRazonSocial?: string;
  registroFiscal?: string;
  registroInformacionFiscal?: string;
  categoriaCompradora: string;
  plazoEntregaDias: number;
  frecuenciaCompraDias: number;
  diasCredito: number;
  descuentoComercial: string;
  formaPago: string;
  tipoDocumento: string;
  analistaAsignadaId: string | null;
  nombreAnalistaAsignada: string | null;
  estadoAsignacion: string;
  totalSkus: number;
  totalSkusAprobados: number;
  totalUnidadesSugeridas?: number;
  totalUnidadesPropuestas?: number;
  totalInversionSugeridaUSD: number;
  totalInversionAprobadaUSD: number;
  totalInversionPropuestaUSD?: number;
  esCalculoVigente?: boolean;
  ordenCompraId?: string;
  estadoOrdenCompra?: string;
  numeroVersionPropuesta?: number;
  renglones: RenglonPropuestaReposicion[];
}
