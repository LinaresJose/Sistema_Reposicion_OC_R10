/**
 * Puerto (interfaz) del repositorio de ordenes de compra.
 * Desacopla el dominio de la implementacion PostgreSQL.
 */
import {
  OrdenCompra,
  ResumenOrdenCompra,
  RenglonOrdenCompra,
  EstadoOrdenCompra,
  CanalAprobacion
} from '../entidades/orden-compra.js';
import { RenglonPropuestaReposicion } from '../entidades/decision-compra.js';

export interface DatosCrearOrden {
  identificadorOrden: string;
  proveedorId: string;
  analistaCreadoraId: string;
  condicionPago: string;
  tipoDocumentoLegal: string;
  plazoEntregaDias: number;
  frecuenciaCompraDias: number;
  renglones: Array<{
    identificadorRenglon: string;
    productoId: string;
    codigoSKU: string;
    descripcionProducto: string;
    marca: string;
    unidadMinimaEmpaque: number;
    cantidadOrdenada: number;
    costoUnitarioUSD: number;
    subtotalUSD: number;
    justificacionAjuste: string | null;
  }>;
}

export interface PuertoRepositorioOrdenes {
  /** Crea la cabecera y renglones de una nueva orden en estado BORRADOR */
  crearOrdenBorrador(datos: DatosCrearOrden): Promise<OrdenCompra>;

  /** Obtiene una orden completa con renglones por su ID */
  obtenerOrdenPorId(identificadorOrden: string): Promise<OrdenCompra | null>;

  /** Lista ordenes resumidas con filtros opcionales */
  listarOrdenes(filtros?: {
    estadoOrden?: EstadoOrdenCompra;
    proveedorId?: string;
    analistaCreadoraId?: string;
    empresaEmisoraId?: string;
  }): Promise<ResumenOrdenCompra[]>;

  /** Transiciona la orden a EN_REVISION_WHATSAPP */
  pasarARevisionWhatsapp(identificadorOrden: string): Promise<OrdenCompra>;

  /** Devuelve la orden a BORRADOR para ajuste */
  devolverABorrador(identificadorOrden: string, motivoDevolucion: string): Promise<OrdenCompra>;

  /** Registra la aprobacion (canal + nota obligatoria para WhatsApp) */
  registrarAprobacion(
    identificadorOrden: string,
    datos: {
      canalAprobacion: CanalAprobacion;
      notaRespalodoAprobacion: string;
      aprobadoPorId: string;
    }
  ): Promise<OrdenCompra>;

  /**
   * Emite la orden oficial:
   * 1. Genera correlativo atomico OC-{EMPRESA}-{AAAA}-{NNNN}
   * 2. Vincula empresa emisora
   * 3. Transiciona a OC_EMITIDA
   */
  emitirOrdenOficial(
    identificadorOrden: string,
    empresaEmisoraId: string,
    emisorId: string
  ): Promise<OrdenCompra>;

  /** Obtiene el proximo numero correlativo NNNN para empresa+anio (sin consumirlo) */
  obtenerProximoCorrelativo(codigoEmpresa: string, anio: number): Promise<number>;
}
