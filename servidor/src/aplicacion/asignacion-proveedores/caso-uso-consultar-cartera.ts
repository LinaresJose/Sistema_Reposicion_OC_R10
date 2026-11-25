import { PuertoRepositorioProveedores } from '../../dominio/puertos/puerto-repositorio-proveedores.js';
import { CategoriaCompradora, EstadoAsignacionProveedor } from '../../configuracion/constantes-negocio.js';
import { ProveedorConAsignacion } from '../../dominio/entidades/proveedor.js';

export interface FiltrosConsultaCartera {
  categoria?: CategoriaCompradora;
  estadoAsignacion?: EstadoAsignacionProveedor;
  analistaUsuarioId?: string;
  busqueda?: string;
}

export class CasoUsoConsultarCartera {
  constructor(private readonly repositorioProveedores: PuertoRepositorioProveedores) {}

  async ejecutar(filtros?: FiltrosConsultaCartera): Promise<ProveedorConAsignacion[]> {
    return await this.repositorioProveedores.listarProveedores(filtros);
  }
}
