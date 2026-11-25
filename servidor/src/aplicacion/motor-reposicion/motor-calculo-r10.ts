import { ClaseComercialSKU, DiagnosticoUrgencia, DIAGNOSTICOS_URGENCIA } from '../../configuracion/constantes-negocio.js';
import { CalculadorHashInstantanea } from './calculador-hash-instantanea.js';

export interface EntradaCalculoSKUR10 {
  productoId: string;
  codigoSKU: string;
  descripcionProducto: string;
  proveedorId: string;
  periodoMes: string;
  costoUnitarioUSD: number;
  precioVentaUSD: number;
  cantidadAMano: number;
  cantidadTransitoValido: number;
  demandaHistoricaMensual: number;
  metaPresupuestoMensual?: number;
  pesoMetaVentas?: number;
  diasMes?: number;
  plazoEntregaDias: number;
  frecuenciaCompraDias: number;
  coberturaMinimaProveedorDias?: number;
  seguridadProveedorDias?: number;
  seguridadGlobalDias?: number;
  clasificacionComercial: ClaseComercialSKU;
  unidadMinimaEmpaque: number;
  coberturaExcepcionDias?: number;
  umbralExcepcionDias?: number;
  descuentoMargenMinimo?: number;
  usarMayorCoberturaProveedor?: boolean;
  controlarExcesoPorEmpaque?: boolean;
  factorDemandaClase?: number;
  seguridadAdicionalClaseDias?: number;
}

export interface ResultadoCalculoSKUR10 {
  productoId: string;
  codigoSKU: string;
  proveedorId: string;
  periodoMes: string;
  cantidadAMano: number;
  cantidadTransitoValido: number;
  inventarioEfectivoDisponible: number;
  demandaOperativaMensual: number;
  demandaDiaria: number;
  diasCoberturaActual: number;
  leadTimeTotalDias: number;
  coberturaObjetivoDias: number;
  umbralCompraDias: number;
  cantidadSugeridaBruta: number;
  cantidadSugeridaEmpaque: number;
  inversionSugeridaUSD: number;
  diagnosticoUrgencia: DiagnosticoUrgencia;
  esAptoParaCompra: boolean;
  motivoInaptitud?: string;
  hashInstantaneaCalculo: string;
}

export class MotorCalculoR10 {
  /**
   * Ejecuta el calculo determinista del algoritmo R10 para un SKU
   */
  static calcular(entrada: EntradaCalculoSKUR10): ResultadoCalculoSKUR10 {
    const diasMes = entrada.diasMes && entrada.diasMes > 0 ? entrada.diasMes : 30;
    const pesoMeta = entrada.pesoMetaVentas ?? 0.50;
    const factorDemanda = entrada.factorDemandaClase ?? 1.0;
    const margenMinimo = entrada.descuentoMargenMinimo ?? 0.40;
    const empaque = Math.max(1, entrada.unidadMinimaEmpaque);

    // 1. Demanda operativa mensual y diaria (BM y AH)
    let demandaBase = entrada.demandaHistoricaMensual;
    if (entrada.metaPresupuestoMensual !== undefined && entrada.metaPresupuestoMensual > 0) {
      demandaBase = (entrada.demandaHistoricaMensual * (1 - pesoMeta)) + (entrada.metaPresupuestoMensual * pesoMeta);
    }
    const demandaOperativaMensual = Math.max(0, Math.round(demandaBase * factorDemanda * 100) / 100);
    const demandaDiaria = demandaOperativaMensual > 0 ? demandaOperativaMensual / diasMes : 0;

    // 2. Tiempos de entrega y parametros base (AI, AJ, AK, AL, AM)
    const plazoEntrega = Math.max(0, entrada.plazoEntregaDias);
    const frecuencia = Math.max(0, entrada.frecuenciaCompraDias);
    const seguridad = Math.max(0, (entrada.seguridadProveedorDias ?? 0) + (entrada.seguridadGlobalDias ?? 0) + (entrada.seguridadAdicionalClaseDias ?? 0));
    const leadTimeTotal = plazoEntrega + frecuencia + seguridad; // AM
    const coberturaMinimaProveedor = Math.max(0, entrada.coberturaMinimaProveedorDias ?? 0); // AL

    // 3. Inventario disponible efectivo (AO)
    const stockFisico = entrada.cantidadAMano;
    const transitoValido = Math.max(0, entrada.cantidadTransitoValido);
    const inventarioEfectivoDisponible = stockFisico + transitoValido; // AO

    // 4. Dias de cobertura actual (AN)
    let diasCoberturaActual = 999;
    if (demandaDiaria > 0) {
      diasCoberturaActual = Math.max(0, stockFisico) / demandaDiaria;
    }

    // 5. Cobertura objetivo efectiva en dias (BE)
    let coberturaObjetivo = leadTimeTotal;
    if (entrada.usarMayorCoberturaProveedor && coberturaMinimaProveedor > 0) {
      coberturaObjetivo = Math.max(coberturaObjetivo, coberturaMinimaProveedor);
    }
    if (entrada.coberturaExcepcionDias && entrada.coberturaExcepcionDias > 0) {
      coberturaObjetivo = Math.max(coberturaObjetivo, entrada.coberturaExcepcionDias);
    }

    // 6. Umbral de compra efectivo en dias (BF)
    let umbralCompra = leadTimeTotal;
    if (entrada.umbralExcepcionDias && entrada.umbralExcepcionDias > 0) {
      umbralCompra = Math.max(leadTimeTotal, entrada.umbralExcepcionDias);
    } else if (entrada.clasificacionComercial === 'ALTA ROTACION') {
      umbralCompra = Math.max(leadTimeTotal, coberturaObjetivo - frecuencia);
    }

    // 7. Validacion de Aptitud comercial y tecnica (BN)
    let esApto = true;
    let motivoInaptitud: string | undefined;

    if (entrada.costoUnitarioUSD <= 0 || entrada.precioVentaUSD <= 0) {
      esApto = false;
      motivoInaptitud = 'COSTO/PRECIO ERP INVALIDO';
    } else if (umbralCompra > coberturaObjetivo) {
      esApto = false;
      motivoInaptitud = 'UMBRAL MAYOR A COBERTURA';
    }

    // 8. Cantidad sugerida preliminar con empaque (AR)
    let cantidadSugeridaBruta = 0;
    let cantidadSugeridaEmpaque = 0;

    if (demandaDiaria > 0) {
      const unidadesRequeridas = Math.ceil(demandaDiaria * coberturaObjetivo) - inventarioEfectivoDisponible;
      cantidadSugeridaBruta = Math.max(0, unidadesRequeridas);
      if (cantidadSugeridaBruta > 0) {
        cantidadSugeridaEmpaque = Math.ceil(cantidadSugeridaBruta / empaque) * empaque;
      }
    }

    // 9. Cantidad sugerida final R10 (AT)
    let cantidadFinalSugerida = cantidadSugeridaEmpaque;
    if (!esApto || demandaDiaria <= 0 || diasCoberturaActual > umbralCompra) {
      cantidadFinalSugerida = 0;
    } else if (entrada.controlarExcesoPorEmpaque) {
      const topeMaximo = Math.ceil(demandaDiaria * (coberturaObjetivo + frecuencia));
      if (Math.max(0, inventarioEfectivoDisponible) + cantidadSugeridaEmpaque > topeMaximo) {
        cantidadFinalSugerida = 0;
      }
    }

    // 10. Diagnostico de urgencia y prioridad (AQ)
    let diagnostico: DiagnosticoUrgencia = DIAGNOSTICOS_URGENCIA.POSTERGAR;

    if (!esApto) {
      diagnostico = DIAGNOSTICOS_URGENCIA.REVISAR;
    } else if (demandaOperativaMensual <= 0) {
      diagnostico = DIAGNOSTICOS_URGENCIA.SIN_DEMANDA;
    } else if (diasCoberturaActual <= umbralCompra && cantidadSugeridaEmpaque > 0 && cantidadFinalSugerida === 0) {
      diagnostico = DIAGNOSTICOS_URGENCIA.REVISAR_EMPAQUE;
    } else if (entrada.precioVentaUSD * (1 - margenMinimo) < entrada.costoUnitarioUSD) {
      diagnostico = DIAGNOSTICOS_URGENCIA.EVALUAR_MARGEN;
    } else if (stockFisico < 0 || diasCoberturaActual <= plazoEntrega + seguridad) {
      diagnostico = DIAGNOSTICOS_URGENCIA.URGENTE;
    } else if (diasCoberturaActual <= umbralCompra) {
      diagnostico = DIAGNOSTICOS_URGENCIA.COMPRAR_AHORA;
    } else {
      diagnostico = DIAGNOSTICOS_URGENCIA.POSTERGAR;
    }

    const inversionSugeridaUSD = Math.round(cantidadFinalSugerida * Math.max(0, entrada.costoUnitarioUSD) * 100) / 100;

    // 11. Huella SHA-256 de integridad (Firma de Calculo)
    const hashInstantaneaCalculo = CalculadorHashInstantanea.calcular({
      codigoSKU: entrada.codigoSKU,
      proveedorId: entrada.proveedorId,
      clasificacionComercial: entrada.clasificacionComercial,
      costoUnitarioUSD: entrada.costoUnitarioUSD,
      precioVentaUSD: entrada.precioVentaUSD,
      cantidadAMano: entrada.cantidadAMano,
      inventarioEfectivo: inventarioEfectivoDisponible,
      demandaOperativaMensual: demandaOperativaMensual,
      plazoEntregaDias: plazoEntrega,
      frecuenciaCompraDias: frecuencia,
      seguridadAdicionalDias: seguridad,
      coberturaObjetivoDias: coberturaObjetivo,
      umbralCompraDias: umbralCompra,
      cantidadSugerida: cantidadFinalSugerida,
      esAptoParaCompra: esApto,
      unidadMinimaEmpaque: empaque,
      margenMinimoComercial: margenMinimo
    });

    return {
      productoId: entrada.productoId,
      codigoSKU: entrada.codigoSKU,
      proveedorId: entrada.proveedorId,
      periodoMes: entrada.periodoMes,
      cantidadAMano: stockFisico,
      cantidadTransitoValido: transitoValido,
      inventarioEfectivoDisponible,
      demandaOperativaMensual,
      demandaDiaria,
      diasCoberturaActual,
      leadTimeTotalDias: leadTimeTotal,
      coberturaObjetivoDias: coberturaObjetivo,
      umbralCompraDias: umbralCompra,
      cantidadSugeridaBruta,
      cantidadSugeridaEmpaque: cantidadFinalSugerida,
      inversionSugeridaUSD,
      diagnosticoUrgencia: diagnostico,
      esAptoParaCompra: esApto,
      motivoInaptitud,
      hashInstantaneaCalculo
    };
  }
}
