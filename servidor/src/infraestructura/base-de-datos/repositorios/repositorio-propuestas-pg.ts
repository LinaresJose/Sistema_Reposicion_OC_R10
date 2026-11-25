import { PuertoRepositorioPropuestas } from '../../../dominio/puertos/puerto-repositorio-propuestas.js';
import { ResumenPropuestaProveedor, RenglonPropuestaReposicion, DecisionCompraSKU } from '../../../dominio/entidades/decision-compra.js';
import { CalculoReposicionSKU } from '../../../dominio/entidades/calculo-reposicion.js';
import { baseDeDatos } from '../cliente-postgresql.js';

export class RepositorioPropuestasPg implements PuertoRepositorioPropuestas {
  async obtenerPropuestaPorProveedor(identificadorProveedor: string): Promise<ResumenPropuestaProveedor | null> {
    // 1. Obtener datos cabecera del proveedor y asignacion
    const consultaCabecera = `
      SELECT 
        p.identificador_proveedor,
        p.nombre_razon_social,
        p.registro_informacion_fiscal,
        p.categoria_compradora,
        p.plazo_entrega_dias,
        p.frecuencia_compra_dias,
        p.dias_credito,
        p.descuento_comercial_cadena,
        p.forma_pago_predeterminada,
        p.tipo_documento_predeterminado,
        a.analista_usuario_id,
        u.nombre_completo AS nombre_analista_asignada,
        COALESCE(a.estado_asignacion, 'DISPONIBLE') AS estado_asignacion
      FROM proveedor p
      LEFT JOIN asignacion_proveedor a ON p.identificador_proveedor = a.proveedor_id
      LEFT JOIN usuario u ON a.analista_usuario_id = u.identificador_usuario
      WHERE p.identificador_proveedor = $1
      LIMIT 1;
    `;
    const resCabecera = await baseDeDatos.ejecutarConsulta(consultaCabecera, [identificadorProveedor]);
    if (resCabecera.rows.length === 0) return null;
    const c = resCabecera.rows[0];

    // 2. Obtener los renglones de propuesta con calculo y decisiones
    const consultaRenglones = `
      SELECT 
        d.identificador_decision,
        c.identificador_calculo,
        ps.identificador_producto,
        ps.codigo_sku,
        ps.descripcion_producto,
        ps.marca,
        ps.costo_unitario_usd,
        ps.precio_venta_usd,
        ps.unidad_minima_empaque,
        c.cantidad_a_mano,
        c.cantidad_transito_valido,
        c.inventario_efectivo_disponible,
        c.demanda_operativa_mensual,
        c.dias_cobertura_actual,
        c.cobertura_objetivo_dias,
        c.umbral_compra_dias,
        c.cantidad_sugerida_empaque AS cantidad_sugerida_motor,
        c.inversion_sugerida_usd,
        d.cantidad_ajuste_manual,
        d.cantidad_final_propuesta,
        (d.cantidad_final_propuesta * ps.costo_unitario_usd) AS inversion_final_usd,
        d.justificacion_ajuste,
        d.estado_decision,
        c.diagnostico_urgencia,
        c.es_apto_para_compra,
        c.motivo_inaptitud,
        c.hash_instantanea_calculo,
        d.hash_firma_aprobada,
        (d.hash_firma_aprobada = c.hash_instantanea_calculo) AS es_calculo_vigente,
        d.numero_version
      FROM producto_sku ps
      INNER JOIN calculo_reposicion_sku c ON ps.identificador_producto = c.producto_id
      INNER JOIN decision_compra_sku d ON c.identificador_calculo = d.calculo_id
      WHERE ps.proveedor_id = $1
      ORDER BY 
        CASE c.diagnostico_urgencia
          WHEN 'URGENTE' THEN 1
          WHEN 'COMPRAR AHORA' THEN 2
          WHEN 'EVALUAR MARGEN' THEN 3
          WHEN 'REVISAR EMPAQUE' THEN 4
          WHEN 'POSTERGAR' THEN 5
          WHEN 'SIN DEMANDA' THEN 6
          ELSE 7
        END,
        c.inversion_sugerida_usd DESC,
        ps.codigo_sku ASC;
    `;
    const resRenglones = await baseDeDatos.ejecutarConsulta(consultaRenglones, [identificadorProveedor]);

    let totalInversionSugeridaUSD = 0;
    let totalInversionAprobadaUSD = 0;
    let totalSkusAprobados = 0;
    let totalUnidadesSugeridas = 0;
    let totalUnidadesPropuestas = 0;

    const renglones: RenglonPropuestaReposicion[] = resRenglones.rows.map((r: any) => {
      const costo = Number(r.costo_unitario_usd);
      const precio = Number(r.precio_venta_usd);
      const margen = precio > 0 ? ((precio - costo) / precio) * 100 : 0;
      const sugeridaUSD = Number(r.inversion_sugerida_usd);
      const finalUSD = Number(r.inversion_final_usd);
      const cantSugerida = Number(r.cantidad_sugerida_motor);
      const cantFinal = Number(r.cantidad_final_propuesta);

      totalInversionSugeridaUSD += sugeridaUSD;
      totalUnidadesSugeridas += cantSugerida;
      totalUnidadesPropuestas += cantFinal;

      if (r.estado_decision === 'APROBADO') {
        totalInversionAprobadaUSD += finalUSD;
        totalSkusAprobados++;
      }

      return {
        identificadorDecision: r.identificador_decision,
        identificadorCalculo: r.identificador_calculo,
        identificadorProducto: r.identificador_producto,
        codigoSKU: r.codigo_sku,
        codigoSku: r.codigo_sku,
        descripcionProducto: r.descripcion_producto,
        marca: r.marca,
        costoUnitarioUSD: costo,
        precioVentaUSD: precio,
        margenPorcentual: Math.round(margen * 100) / 100,
        unidadMinimaEmpaque: Number(r.unidad_minima_empaque),
        unidadesEmpaque: Number(r.unidad_minima_empaque),
        cantidadAMano: Number(r.cantidad_a_mano),
        stockActualMano: Number(r.cantidad_a_mano),
        cantidadTransito: Number(r.cantidad_transito_valido),
        stockEnTransitoValido: Number(r.cantidad_transito_valido),
        inventarioEfectivo: Number(r.inventario_efectivo_disponible),
        demandaOperativaMensual: Number(r.demanda_operativa_mensual),
        demandaDiaria: Number(r.demanda_operativa_mensual) / 30,
        diasCoberturaActual: Number(r.dias_cobertura_actual),
        diasCoberturaEfectiva: Number(r.dias_cobertura_actual),
        coberturaObjetivoDias: Number(r.cobertura_objetivo_dias),
        umbralCompraDias: Number(r.umbral_compra_dias),
        cantidadSugeridaMotor: cantSugerida,
        sugeridoAjustadoEmpaque: cantSugerida,
        sugeridoMatematicoBruto: cantSugerida,
        inversionSugeridaUSD: sugeridaUSD,
        cantidadAjusteManual: r.cantidad_ajuste_manual !== null ? Number(r.cantidad_ajuste_manual) : null,
        cantidadFinalAprobada: cantFinal,
        cantidadFinalPropuesta: cantFinal,
        inversionFinalUSD: finalUSD,
        justificacionAjuste: r.justificacion_ajuste,
        estadoDecision: r.estado_decision,
        diagnosticoUrgencia: r.diagnostico_urgencia,
        esAptoParaCompra: Boolean(r.es_apto_para_compra),
        motivoInaptitud: r.motivo_inaptitud,
        hashCalculoVigente: r.hash_instantanea_calculo,
        hashFirmaCalculo: r.hash_instantanea_calculo,
        hashFirmaAprobada: r.hash_firma_aprobada,
        esCalculoVigente: Boolean(r.es_calculo_vigente),
        numeroVersion: Number(r.numero_version)
      };
    });

    return {
      proveedorId: c.identificador_proveedor,
      identificadorProveedor: c.identificador_proveedor,
      nombreProveedor: c.nombre_razon_social,
      nombreRazonSocial: c.nombre_razon_social,
      registroFiscal: c.registro_informacion_fiscal,
      registroInformacionFiscal: c.registro_informacion_fiscal,
      categoriaCompradora: c.categoria_compradora,
      plazoEntregaDias: Number(c.plazo_entrega_dias),
      frecuenciaCompraDias: Number(c.frecuencia_compra_dias),
      diasCredito: Number(c.dias_credito),
      descuentoComercial: c.descuento_comercial_cadena,
      formaPago: c.forma_pago_predeterminada,
      tipoDocumento: c.tipo_documento_predeterminado,
      analistaAsignadaId: c.analista_usuario_id,
      nombreAnalistaAsignada: c.nombre_analista_asignada,
      estadoAsignacion: c.estado_asignacion,
      totalSkus: renglones.length,
      totalSkusAprobados,
      totalUnidadesSugeridas,
      totalUnidadesPropuestas,
      totalInversionSugeridaUSD: Math.round(totalInversionSugeridaUSD * 100) / 100,
      totalInversionAprobadaUSD: Math.round(totalInversionAprobadaUSD * 100) / 100,
      totalInversionPropuestaUSD: Math.round(totalInversionAprobadaUSD * 100) / 100,
      esCalculoVigente: renglones.length > 0 ? renglones.every(r => r.esCalculoVigente) : true,
      numeroVersionPropuesta: renglones.length > 0 ? Math.max(...renglones.map(r => r.numeroVersion)) : 1,
      renglones
    };
  }

  async buscarDecisionPorId(identificadorDecision: string): Promise<DecisionCompraSKU | null> {
    const consulta = `
      SELECT 
        identificador_decision,
        calculo_id,
        proveedor_id,
        analista_usuario_id,
        estado_decision,
        cantidad_sugerida_referencia,
        cantidad_ajuste_manual,
        cantidad_final_propuesta,
        justificacion_ajuste,
        hash_firma_aprobada,
        es_calculo_vigente,
        numero_version,
        actualizado_en
      FROM decision_compra_sku
      WHERE identificador_decision = $1
      LIMIT 1;
    `;
    const resultado = await baseDeDatos.ejecutarConsulta(consulta, [identificadorDecision]);
    if (resultado.rows.length === 0) return null;
    return this.mapearFilaADecision(resultado.rows[0]);
  }

  async actualizarDecisionSKU(
    identificadorDecision: string,
    estadoDecision: 'PENDIENTE' | 'APROBADO' | 'EXCLUIDO',
    cantidadAjusteManual: number | null,
    justificacionAjuste: string | null,
    hashCalculoValidado: string,
    numeroVersionEsperado: number,
    analistaUsuarioId: string
  ): Promise<{ exito: boolean; conflictoVersion?: boolean; calculoInvalido?: boolean; decisionActualizada?: DecisionCompraSKU }> {
    const cliente = await baseDeDatos.obtenerClienteTransaccion();
    try {
      await cliente.query('BEGIN');

      // 1. Obtener decision y calculo asociado con bloqueo de fila
      const consultaVerificacion = `
        SELECT 
          d.identificador_decision,
          d.numero_version,
          d.cantidad_sugerida_referencia,
          c.hash_instantanea_calculo
        FROM decision_compra_sku d
        INNER JOIN calculo_reposicion_sku c ON d.calculo_id = c.identificador_calculo
        WHERE d.identificador_decision = $1
        FOR UPDATE;
      `;
      const resVerif = await cliente.query(consultaVerificacion, [identificadorDecision]);

      if (resVerif.rows.length === 0) {
        await cliente.query('ROLLBACK');
        return { exito: false };
      }

      const fila = resVerif.rows[0];

      // Control de Concurrencia Optimista
      if (Number(fila.numero_version) !== numeroVersionEsperado) {
        await cliente.query('ROLLBACK');
        return { exito: false, conflictoVersion: true };
      }

      // Verificacion de integridad de la instantanea de calculo (Firma)
      if (fila.hash_instantanea_calculo !== hashCalculoValidado) {
        await cliente.query('ROLLBACK');
        return { exito: false, calculoInvalido: true };
      }

      const cantidadFinal = cantidadAjusteManual !== null && cantidadAjusteManual !== undefined
        ? cantidadAjusteManual
        : Number(fila.cantidad_sugerida_referencia);

      // 2. Ejecutar actualizacion atomica con incremento de version
      const consultaActualizar = `
        UPDATE decision_compra_sku
        SET 
          estado_decision = $2,
          cantidad_ajuste_manual = $3,
          cantidad_final_propuesta = $4,
          justificacion_ajuste = $5,
          hash_firma_aprobada = $6,
          es_calculo_vigente = TRUE,
          analista_usuario_id = $7,
          numero_version = numero_version + 1,
          actualizado_en = CURRENT_TIMESTAMP
        WHERE identificador_decision = $1 AND numero_version = $8
        RETURNING *;
      `;
      const resUpdate = await cliente.query(consultaActualizar, [
        identificadorDecision,
        estadoDecision,
        cantidadAjusteManual,
        cantidadFinal,
        justificacionAjuste,
        hashCalculoValidado,
        analistaUsuarioId,
        numeroVersionEsperado
      ]);

      if (resUpdate.rowCount === 0) {
        await cliente.query('ROLLBACK');
        return { exito: false, conflictoVersion: true };
      }

      await cliente.query('COMMIT');

      return {
        exito: true,
        decisionActualizada: this.mapearFilaADecision(resUpdate.rows[0])
      };
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  async guardarCalculosReposicion(calculos: CalculoReposicionSKU[]): Promise<void> {
    const cliente = await baseDeDatos.obtenerClienteTransaccion();
    try {
      await cliente.query('BEGIN');
      for (const c of calculos) {
        // Upsert calculo
        const sqlCalculo = `
          INSERT INTO calculo_reposicion_sku (
            producto_id, periodo_mes, cantidad_a_mano, cantidad_transito_valido,
            inventario_efectivo_disponible, demanda_operativa_mensual, demanda_diaria,
            dias_cobertura_actual, cobertura_objetivo_dias, umbral_compra_dias,
            cantidad_sugerida_bruta, cantidad_sugerida_empaque, inversion_sugerida_usd,
            diagnostico_urgencia, es_apto_para_compra, motivo_inaptitud,
            hash_instantanea_calculo, fecha_calculo
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, CURRENT_TIMESTAMP
          )
          RETURNING identificador_calculo;
        `;
        const resCalc = await cliente.query(sqlCalculo, [
          c.productoId, c.periodoMes, c.cantidadAMano, c.cantidadTransitoValido,
          c.inventarioEfectivoDisponible, c.demandaOperativaMensual, c.demandaDiaria,
          c.diasCoberturaActual, c.coberturaObjetivoDias, c.umbralCompraDias,
          c.cantidadSugeridaBruta, c.cantidadSugeridaEmpaque, c.inversionSugeridaUSD,
          c.diagnosticoUrgencia, c.esAptoParaCompra, c.motivoInaptitud,
          c.hashInstantaneaCalculo
        ]);

        const calcId = resCalc.rows[0].identificador_calculo;

        // Upsert decision inicial vinculada
        const sqlDecision = `
          INSERT INTO decision_compra_sku (
            calculo_id, proveedor_id, estado_decision, cantidad_sugerida_referencia,
            cantidad_final_propuesta, hash_firma_aprobada, es_calculo_vigente, numero_version, actualizado_en
          ) VALUES (
            $1, $2, 'PENDIENTE', $3, $3, $4, TRUE, 1, CURRENT_TIMESTAMP
          )
          ON CONFLICT DO NOTHING;
        `;
        await cliente.query(sqlDecision, [calcId, c.proveedorId, c.cantidadSugeridaEmpaque, c.hashInstantaneaCalculo]);
      }
      await cliente.query('COMMIT');
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  private mapearFilaADecision(fila: any): DecisionCompraSKU {
    return {
      identificadorDecision: fila.identificador_decision,
      calculoId: fila.calculo_id,
      proveedorId: fila.proveedor_id,
      analistaUsuarioId: fila.analista_usuario_id,
      estadoDecision: fila.estado_decision,
      cantidadSugeridaReferencia: Number(fila.cantidad_sugerida_referencia),
      cantidadAjusteManual: fila.cantidad_ajuste_manual !== null ? Number(fila.cantidad_ajuste_manual) : null,
      cantidadFinalPropuesta: Number(fila.cantidad_final_propuesta),
      justificacionAjuste: fila.justificacion_ajuste,
      hashFirmaAprobada: fila.hash_firma_aprobada,
      esCalculoVigente: Boolean(fila.es_calculo_vigente),
      numeroVersion: Number(fila.numero_version),
      actualizadoEn: new Date(fila.actualizado_en)
    };
  }
}
