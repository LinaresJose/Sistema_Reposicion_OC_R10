/**
 * Puerto del repositorio para persistir cargas de Odoo y sus novedades.
 */
import { CargaArchivoOdoo, NovedadCargaOdoo } from '../entidades/carga-odoo.js';

export interface PuertoRepositorioCargasOdoo {
  registrarCarga(carga: CargaArchivoOdoo): Promise<void>;
  obtenerUltimaCargaExitosa(): Promise<CargaArchivoOdoo | null>;
  obtenerCargaPorId(identificadorCarga: string): Promise<CargaArchivoOdoo | null>;
  listarHistorialCargas(limite?: number): Promise<CargaArchivoOdoo[]>;
  listarNovedadesPorCarga(cargaId: string): Promise<NovedadCargaOdoo[]>;
}
