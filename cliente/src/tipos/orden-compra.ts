export type EstadoOrdenCompra = 
  | 'BORRADOR'
  | 'EN_REVISION_WHATSAPP'
  | 'APROBADA_PARA_EMISION'
  | 'OC_EMITIDA'
  | 'CANCELADA';

export type CodigoRazonSocial = 'MMC' | 'LYNOX';

export interface OrdenCompraResumen {
  identificadorOrden: string;
  codigoOrdenCompra?: string;
  proveedorId: string;
  proveedorNombre: string;
  analistaUsuarioId: string;
  analistaNombre: string;
  analistaTelefono?: string;
  estadoOrden: EstadoOrdenCompra;
  montoTotalBrutoUSD: number;
  montoTotalNetoUSD: number;
  montoTotalImpuestoUSD: number;
  totalUnidades: number;
  totalRenglones: number;
  razonSocialEmisoraId?: string;
  codigoRazonSocialEmisora?: CodigoRazonSocial;
  numeroCorrelativoOficial?: string;
  fechaEmisionOficial?: string;
  fechaAprobacion?: string;
  canalAprobacion?: string;
  notaRespaldoAprobacion?: string;
  creadoEn: string;
  actualizadoEn: string;
}
