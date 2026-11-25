export type CategoriaCompradora = 
  | 'NACIONAL_1' 
  | 'NACIONAL_2' 
  | 'NACIONAL_3' 
  | 'INTERNACIONAL';

export type EstadoAsignacionProveedor = 
  | 'DISPONIBLE' 
  | 'EN_PROCESO_TRABAJO' 
  | 'EN_REVISION_WHATSAPP';

export interface Proveedor {
  identificadorProveedor: string;
  codigoProveedorOdoo?: string;
  nombreRazonSocial: string;
  registroInformacionFiscal?: string;
  categoriaCompradora: CategoriaCompradora;
  plazoEntregaDias: number;
  frecuenciaCompraDias: number;
  diasCredito: number;
  descuentoComercialCadena: string;
  formaPagoPredeterminada: string;
  tipoDocumentoPredeterminado: string;
  nombreContacto?: string;
  telefonoContacto?: string;
  correoContacto?: string;
  estaActivo: boolean;
  estadoAsignacion: EstadoAsignacionProveedor;
  analistaAsignadaId: string | null;
  nombreAnalistaAsignada: string | null;
  correoAnalistaAsignada: string | null;
  bloqueoSuspendidoPorRevision: boolean;
  fechaHoraExpiracionBloqueo: string | null;
  totalSkusAptos: number;
  montoSugeridoTotalUSD: number;
}

export interface FormularioEdicionProveedor {
  nombreRazonSocial: string;
  codigoProveedorOdoo?: string;
  registroInformacionFiscal?: string;
  categoriaCompradora: CategoriaCompradora;
  plazoEntregaDias: number;
  frecuenciaCompraDias: number;
  diasCredito: number;
  descuentoComercialCadena: string;
  formaPagoPredeterminada: string;
  tipoDocumentoPredeterminado: string;
  nombreContacto?: string;
  telefonoContacto?: string;
  correoContacto?: string;
  estaActivo: boolean;
}
