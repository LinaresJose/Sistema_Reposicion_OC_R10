import { ClaseComercialSKU } from '../../configuracion/constantes-negocio.js';

export interface ProductoSKU {
  identificadorProducto: string;
  codigoSKU: string;
  codigoBarras?: string;
  descripcionProducto: string;
  marca?: string;
  proveedorId?: string;
  costoUnitarioUSD: number;
  precioVentaUSD: number;
  unidadMinimaEmpaque: number;
  clasificacionComercial: ClaseComercialSKU;
  estadoSKUOdoo: string;
  coberturaExcepcionDias?: number;
  umbralExcepcionDias?: number;
  justificacionExcepcion?: string;
  creadoEn: Date;
  actualizadoEn: Date;
}
