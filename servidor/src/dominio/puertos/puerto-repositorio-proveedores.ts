import { Proveedor, ProveedorConAsignacion, AsignacionProveedor, DatosActualizacionProveedor } from '../entidades/proveedor.js';
import { CategoriaCompradora, EstadoAsignacionProveedor } from '../../configuracion/constantes-negocio.js';

export interface PuertoRepositorioProveedores {
  listarProveedores(filtros?: {
    categoria?: CategoriaCompradora;
    estadoAsignacion?: EstadoAsignacionProveedor;
    analistaUsuarioId?: string;
    busqueda?: string;
  }): Promise<ProveedorConAsignacion[]>;

  buscarPorId(identificadorProveedor: string): Promise<ProveedorConAsignacion | null>;

  actualizarDatosProveedor(
    identificadorProveedor: string,
    datos: DatosActualizacionProveedor
  ): Promise<ProveedorConAsignacion | null>;

  obtenerAsignacionActual(identificadorProveedor: string): Promise<AsignacionProveedor | null>;

  autoasignarProveedor(
    identificadorProveedor: string,
    analistaUsuarioId: string,
    minutosInactividad: number
  ): Promise<{ exito: boolean; asignacion?: AsignacionProveedor; conflictoConUsuarioId?: string }>;

  liberarProveedor(
    identificadorProveedor: string,
    observacion?: string
  ): Promise<boolean>;

  actualizarEstadoRevisionWhatsApp(
    identificadorProveedor: string,
    enRevision: boolean
  ): Promise<void>;

  actualizarActividadProveedor(identificadorProveedor: string): Promise<void>;
}
