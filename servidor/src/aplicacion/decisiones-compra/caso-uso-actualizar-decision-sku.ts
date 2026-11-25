import { PuertoRepositorioPropuestas } from '../../dominio/puertos/puerto-repositorio-propuestas.js';
import { PuertoRepositorioAuditoria } from '../../dominio/puertos/puerto-repositorio-auditoria.js';
import { DecisionCompraSKU } from '../../dominio/entidades/decision-compra.js';

export interface SolicitudActualizarDecisionSKU {
  identificadorDecision: string;
  estadoDecision: 'PENDIENTE' | 'APROBADO' | 'EXCLUIDO';
  cantidadAjusteManual: number | null;
  justificacionAjuste: string | null;
  hashCalculoValidado: string;
  numeroVersionEsperado: number;
  analistaUsuarioId: string;
  direccionIP?: string;
}

export class ErrorDecisionCompra extends Error {
  constructor(mensaje: string, public codigoError: string, public detalles?: any) {
    super(mensaje);
    this.name = 'ErrorDecisionCompra';
  }
}

export class CasoUsoActualizarDecisionSKU {
  constructor(
    private readonly repositorioPropuestas: PuertoRepositorioPropuestas,
    private readonly repositorioAuditoria: PuertoRepositorioAuditoria
  ) {}

  async ejecutar(solicitud: SolicitudActualizarDecisionSKU): Promise<DecisionCompraSKU> {
    const decisionActual = await this.repositorioPropuestas.buscarDecisionPorId(solicitud.identificadorDecision);

    if (!decisionActual) {
      throw new ErrorDecisionCompra('La decision solicitada no existe', 'DECISION_NO_ENCONTRADA');
    }

    // Regla de negocio: si la cantidad aprobada difiere de la sugerida por el motor, la justificacion es obligatoria
    const tieneAjuste = solicitud.cantidadAjusteManual !== null && solicitud.cantidadAjusteManual !== undefined;
    if (tieneAjuste && solicitud.cantidadAjusteManual !== decisionActual.cantidadSugeridaReferencia) {
      if (!solicitud.justificacionAjuste || solicitud.justificacionAjuste.trim().length < 5) {
        throw new ErrorDecisionCompra(
          'Debe ingresar una justificacion clara (minimo 5 caracteres) al modificar la cantidad sugerida',
          'JUSTIFICACION_OBLIGATORIA'
        );
      }
    }

    const resultado = await this.repositorioPropuestas.actualizarDecisionSKU(
      solicitud.identificadorDecision,
      solicitud.estadoDecision,
      solicitud.cantidadAjusteManual,
      solicitud.justificacionAjuste,
      solicitud.hashCalculoValidado,
      solicitud.numeroVersionEsperado,
      solicitud.analistaUsuarioId
    );

    if (resultado.conflictoVersion) {
      throw new ErrorDecisionCompra(
        'El renglon fue modificado por otra sesion simultanea. Recargue la propuesta antes de guardar',
        'CONFLICTO_CONCURRENCIA'
      );
    }

    if (resultado.calculoInvalido) {
      throw new ErrorDecisionCompra(
        'Los datos base del calculo han cambiado (costo, inventario o demanda). Revise la propuesta actualizada antes de aprobar',
        'CALCULO_DESACTUALIZADO'
      );
    }

    if (!resultado.decisionActualizada) {
      throw new ErrorDecisionCompra('No se pudo actualizar la decision', 'ERROR_ACTUALIZACION');
    }

    // Registrar en auditoria inmutable
    await this.repositorioAuditoria.registrarEvento({
      usuarioId: solicitud.analistaUsuarioId,
      tipoEvento: 'ACTUALIZAR_DECISION_SKU',
      nombreEntidad: 'decision_compra_sku',
      identificadorEntidad: solicitud.identificadorDecision,
      estadoAnterior: {
        estadoDecision: decisionActual.estadoDecision,
        cantidadAjusteManual: decisionActual.cantidadAjusteManual,
        cantidadFinalPropuesta: decisionActual.cantidadFinalPropuesta,
        numeroVersion: decisionActual.numeroVersion
      },
      estadoNuevo: {
        estadoDecision: resultado.decisionActualizada.estadoDecision,
        cantidadAjusteManual: resultado.decisionActualizada.cantidadAjusteManual,
        cantidadFinalPropuesta: resultado.decisionActualizada.cantidadFinalPropuesta,
        numeroVersion: resultado.decisionActualizada.numeroVersion
      },
      direccionIP: solicitud.direccionIP
    });

    return resultado.decisionActualizada;
  }
}
