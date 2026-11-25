export type TipoArchivoOdoo = 
  | 'catalogoCostos'
  | 'inventarioMano'
  | 'comprasTransito'
  | 'historialVentasPrecios';

export interface HallazgoArchivo {
  fila: number;
  columna?: string;
  sku?: string;
  tipoHallazgo: 'ERROR_ESTRUCTURA' | 'DATO_INVALIDO' | 'SKU_NO_ENCONTRADO' | 'VALOR_NEGATIVO';
  mensaje: string;
}

export interface RegistroCargaOdoo {
  identificadorCarga: string;
  usuarioId: string;
  nombreUsuario?: string;
  tipoCarga: string;
  estadoCarga: 'PROCESADO_EXITOSO' | 'RECHAZADO_CON_ERRORES' | 'SIN_CAMBIOS';
  totalFilasProcesadas: number;
  totalFilasConErrores: number;
  totalNovedadesDetectadas: number;
  resumenNovedades?: {
    skusNuevos?: number;
    skusActualizados?: number;
    cambiosCostos?: number;
    cambiosStock?: number;
  };
  fechaHoraCarga: string;
}
