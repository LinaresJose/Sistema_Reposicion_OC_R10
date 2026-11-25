import crypto from 'node:crypto';

export interface ParametrosHashInstantanea {
  codigoSKU: string;
  proveedorId: string;
  clasificacionComercial: string;
  costoUnitarioUSD: number;
  precioVentaUSD: number;
  cantidadAMano: number;
  inventarioEfectivo: number;
  demandaOperativaMensual: number;
  plazoEntregaDias: number;
  frecuenciaCompraDias: number;
  seguridadAdicionalDias: number;
  coberturaObjetivoDias: number;
  umbralCompraDias: number;
  cantidadSugerida: number;
  esAptoParaCompra: boolean;
  unidadMinimaEmpaque: number;
  margenMinimoComercial?: number;
}

export class CalculadorHashInstantanea {
  /**
   * Genera una huella criptografica SHA-256 determinista a partir de los parametros criticos
   * Reemplaza de forma segura la firma de calculo (columna BS) del Excel R10
   */
  static calcular(parametros: ParametrosHashInstantanea): string {
    const cadenaCanonica = [
      parametros.codigoSKU.trim(),
      parametros.proveedorId.trim(),
      parametros.clasificacionComercial.trim(),
      parametros.costoUnitarioUSD.toFixed(4),
      parametros.precioVentaUSD.toFixed(4),
      parametros.cantidadAMano.toFixed(2),
      parametros.inventarioEfectivo.toFixed(2),
      parametros.demandaOperativaMensual.toFixed(2),
      parametros.plazoEntregaDias.toString(),
      parametros.frecuenciaCompraDias.toString(),
      parametros.seguridadAdicionalDias.toString(),
      parametros.coberturaObjetivoDias.toString(),
      parametros.umbralCompraDias.toString(),
      parametros.cantidadSugerida.toString(),
      parametros.esAptoParaCompra ? '1' : '0',
      parametros.unidadMinimaEmpaque.toString(),
      (parametros.margenMinimoComercial ?? 0.40).toFixed(4)
    ].join('|');

    return crypto.createHash('sha256').update(cadenaCanonica, 'utf8').digest('hex');
  }
}
