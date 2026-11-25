/**
 * Caso de uso: Consultar y listar ordenes de compra.
 */
import { PuertoRepositorioOrdenes } from '../../dominio/puertos/puerto-repositorio-ordenes.js';
import { OrdenCompra, ResumenOrdenCompra, EstadoOrdenCompra } from '../../dominio/entidades/orden-compra.js';

export interface FiltrosListarOrdenes {
  estadoOrden?: EstadoOrdenCompra;
  proveedorId?: string;
  analistaCreadoraId?: string;
  empresaEmisoraId?: string;
}

export class CasoUsoConsultarOrden {
  constructor(private readonly repositorioOrdenes: PuertoRepositorioOrdenes) {}

  async obtenerPorId(identificadorOrden: string): Promise<OrdenCompra | null> {
    return this.repositorioOrdenes.obtenerOrdenPorId(identificadorOrden);
  }

  async listar(filtros?: FiltrosListarOrdenes): Promise<ResumenOrdenCompra[]> {
    return this.repositorioOrdenes.listarOrdenes(filtros);
  }
}
