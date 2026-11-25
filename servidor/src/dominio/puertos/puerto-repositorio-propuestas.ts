import { ResumenPropuestaProveedor, RenglonPropuestaReposicion, DecisionCompraSKU } from '../entidades/decision-compra.js';
import { CalculoReposicionSKU } from '../entidades/calculo-reposicion.js';

export interface PuertoRepositorioPropuestas {
  obtenerPropuestaPorProveedor(identificadorProveedor: string): Promise<ResumenPropuestaProveedor | null>;

  guardarCalculosReposicion(calculos: CalculoReposicionSKU[]): Promise<void>;

  actualizarDecisionSKU(
    identificadorDecision: string,
    estadoDecision: 'PENDIENTE' | 'APROBADO' | 'EXCLUIDO',
    cantidadAjusteManual: number | null,
    justificacionAjuste: string | null,
    hashCalculoValidado: string,
    numeroVersionEsperado: number,
    analistaUsuarioId: string
  ): Promise<{ exito: boolean; conflictoVersion?: boolean; calculoInvalido?: boolean; decisionActualizada?: DecisionCompraSKU }>;

  buscarDecisionPorId(identificadorDecision: string): Promise<DecisionCompraSKU | null>;
}
