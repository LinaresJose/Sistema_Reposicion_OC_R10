import { CategoriaCompradora, EstadoAsignacionProveedor } from '../../configuracion/constantes-negocio.js';

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
  creadoEn: Date;
  actualizadoEn: Date;
}

export interface DatosActualizacionProveedor {
  nombreRazonSocial?: string;
  codigoProveedorOdoo?: string;
  registroInformacionFiscal?: string;
  categoriaCompradora?: CategoriaCompradora;
  plazoEntregaDias?: number;
  frecuenciaCompraDias?: number;
  diasCredito?: number;
  descuentoComercialCadena?: string;
  formaPagoPredeterminada?: string;
  tipoDocumentoPredeterminado?: string;
  nombreContacto?: string;
  telefonoContacto?: string;
  correoContacto?: string;
  estaActivo?: boolean;
}

export interface AsignacionProveedor {
  identificadorAsignacion: string;
  proveedorId: string;
  analistaUsuarioId: string | null;
  estadoAsignacion: EstadoAsignacionProveedor;
  fechaHoraToma: Date | null;
  fechaHoraUltimaActividad: Date | null;
  fechaHoraExpiracionBloqueo: Date | null;
  bloqueoSuspendidoPorRevision: boolean;
  observacionBloqueo?: string;
}

export interface ProveedorConAsignacion extends Proveedor {
  estadoAsignacion: EstadoAsignacionProveedor;
  analistaAsignadaId: string | null;
  nombreAnalistaAsignada: string | null;
  correoAnalistaAsignada: string | null;
  bloqueoSuspendidoPorRevision: boolean;
  fechaHoraExpiracionBloqueo: Date | null;
  totalSkusAptos: number;
  montoSugeridoTotalUSD: number;
}
