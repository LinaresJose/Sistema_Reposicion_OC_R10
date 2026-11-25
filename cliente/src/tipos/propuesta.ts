export type DiagnosticoUrgencia = 
  | 'URGENTE'
  | 'COMPRAR AHORA'
  | 'POSTERGAR'
  | 'EVALUAR MARGEN'
  | 'REVISAR EMPAQUE'
  | 'SIN DEMANDA'
  | 'REVISAR';

export type ClaseComercialSKU = 
  | 'ALTA ROTACION'
  | 'MEDIA ROTACION'
  | 'COMPLEMENTO';

export interface RenglonPropuestaR10 {
  identificadorDecision?: string;
  identificadorProducto: string;
  codigoSku: string;
  codigoBarras?: string;
  descripcionProducto: string;
  claseComercial: ClaseComercialSKU;
  demandaOperativaMensual: number;
  demandaDiaria: number;
  stockActualMano: number;
  stockEnTransitoValido: number;
  inventarioEfectivo: number;
  diasCoberturaEfectiva: number;
  unidadesEmpaque: number;
  costoUnitarioUSD: number;
  sugeridoMatematicoBruto: number;
  sugeridoAjustadoEmpaque: number;
  inversionSugeridaUSD: number;
  diagnosticoUrgencia: DiagnosticoUrgencia;
  cantidadFinalPropuesta: number;
  justificacionAjuste?: string;
  esCalculoVigente: boolean;
  hashFirmaCalculo: string;
}

export interface ResumenPropuestaProveedor {
  identificadorProveedor: string;
  nombreRazonSocial: string;
  registroInformacionFiscal?: string;
  categoriaCompradora: string;
  plazoEntregaDias: number;
  frecuenciaCompraDias: number;
  diasCredito: number;
  totalSkus: number;
  totalUnidadesSugeridas: number;
  totalInversionSugeridaUSD: number;
  totalUnidadesPropuestas: number;
  totalInversionPropuestaUSD: number;
  esCalculoVigente: boolean;
  ordenCompraId?: string;
  estadoOrdenCompra?: string;
  numeroVersionPropuesta: number;
  renglones: RenglonPropuestaR10[];
}
