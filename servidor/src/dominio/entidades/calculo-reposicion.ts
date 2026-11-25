import { DiagnosticoUrgencia } from '../../configuracion/constantes-negocio.js';

export interface CalculoReposicionSKU {
  identificadorCalculo: string;
  productoId: string;
  codigoSKU: string;
  descripcionProducto: string;
  proveedorId: string;
  periodoMes: string;
  costoUnitarioUSD: number;
  precioVentaUSD: number;
  unidadMinimaEmpaque: number;
  cantidadAMano: number;
  cantidadTransitoValido: number;
  inventarioEfectivoDisponible: number;
  demandaOperativaMensual: number;
  demandaDiaria: number;
  diasCoberturaActual: number;
  coberturaObjetivoDias: number;
  umbralCompraDias: number;
  cantidadSugeridaBruta: number;
  cantidadSugeridaEmpaque: number;
  inversionSugeridaUSD: number;
  diagnosticoUrgencia: DiagnosticoUrgencia;
  esAptoParaCompra: boolean;
  motivoInaptitud?: string;
  hashInstantaneaCalculo: string;
  fechaCalculo: Date;
}
