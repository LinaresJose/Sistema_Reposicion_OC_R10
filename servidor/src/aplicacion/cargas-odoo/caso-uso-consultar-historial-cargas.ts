/**
 * Caso de uso: Consultar historial de cargas de Odoo y novedades.
 */
import { PuertoRepositorioCargasOdoo } from '../../dominio/puertos/puerto-repositorio-cargas-odoo.js';
import { CargaArchivoOdoo, NovedadCargaOdoo } from '../../dominio/entidades/carga-odoo.js';

export class CasoUsoConsultarHistorialCargas {
  constructor(private readonly repositorioCargas: PuertoRepositorioCargasOdoo) {}

  async listarHistorial(limite: number = 20): Promise<CargaArchivoOdoo[]> {
    return this.repositorioCargas.listarHistorialCargas(limite);
  }

  async obtenerPorId(identificadorCarga: string): Promise<CargaArchivoOdoo | null> {
    return this.repositorioCargas.obtenerCargaPorId(identificadorCarga);
  }

  async listarNovedades(cargaId: string): Promise<NovedadCargaOdoo[]> {
    return this.repositorioCargas.listarNovedadesPorCarga(cargaId);
  }
}
