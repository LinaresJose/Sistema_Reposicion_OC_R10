import { realizarPeticion } from './cliente-api.js';
import { RegistroCargaOdoo, HallazgoArchivo } from '../tipos/carga-odoo.js';

export interface ResultadoProcesamientoCarga {
  estadoOperacion: 'EXITOSO' | 'RECHAZADO_CON_ERRORES' | 'SIN_CAMBIOS';
  mensaje: string;
  totalFilasProcesadas: number;
  totalFilasConErrores: number;
  totalNovedadesDetectadas: number;
  hallazgos: Record<string, HallazgoArchivo[]>;
  resumenNovedades?: {
    skusNuevos?: number;
    skusActualizados?: number;
    cambiosCostos?: number;
    cambiosStock?: number;
  };
  recalculoEjecutado?: boolean;
}

interface RespuestaHistorialCargas {
  estadoOperacion: string;
  total: number;
  datos: RegistroCargaOdoo[];
}

export const servicioCargasOdoo = {
  async procesarArchivos(archivos: {
    catalogoCostos?: File;
    inventarioMano?: File;
    comprasTransito?: File;
    historialVentasPrecios?: File;
  }): Promise<ResultadoProcesamientoCarga> {
    const formData = new FormData();
    if (archivos.catalogoCostos) formData.append('catalogoCostos', archivos.catalogoCostos);
    if (archivos.inventarioMano) formData.append('inventarioMano', archivos.inventarioMano);
    if (archivos.comprasTransito) formData.append('comprasTransito', archivos.comprasTransito);
    if (archivos.historialVentasPrecios) formData.append('historialVentasPrecios', archivos.historialVentasPrecios);

    const respuesta = await realizarPeticion<any>('/cargas-odoo/procesar-archivos', {
      method: 'POST',
      body: formData
    });
    return respuesta;
  },

  async consultarHistorial(limite = 20): Promise<RegistroCargaOdoo[]> {
    const respuesta = await realizarPeticion<RespuestaHistorialCargas>(`/cargas-odoo/historial?limite=${limite}`);
    return respuesta.datos;
  }
};
