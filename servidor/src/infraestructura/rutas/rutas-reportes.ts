/**
 * Rutas Fastify para Exportacion de Reportes y Vista de Control R10.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { exigirAutenticacion } from '../seguridad/middleware-autorizacion-rbac.js';
import { baseDeDatos } from '../base-de-datos/cliente-postgresql.js';
import { ExportadorVistaControlR10, FilaReporteControlR10 } from '../../aplicacion/reportes/exportador-vista-control-r10.js';

export async function rutasReportes(servidor: FastifyInstance) {
  // ─── Exportar Vista de Control R10 a Excel ─────────────────────────────────
  servidor.get(
    '/vista-control-r10',
    {
      preHandler: [exigirAutenticacion]
    },
    async (peticion: FastifyRequest, respuesta: FastifyReply) => {
      const query = peticion.query as any;
      const proveedorId = query.proveedorId;

      let consulta = `
        SELECT 
          ps.codigo_sku,
          ps.descripcion_producto,
          ps.marca,
          p.nombre_razon_social AS nombre_proveedor,
          ps.unidad_minima_empaque,
          ps.costo_unitario_usd,
          ps.precio_venta_usd,
          CASE 
            WHEN ps.precio_venta_usd > 0 THEN ((ps.precio_venta_usd - ps.costo_unitario_usd) / ps.precio_venta_usd) * 100
            ELSE 0 
          END AS margen_porcentual,
          c.cantidad_a_mano,
          c.cantidad_transito_valido,
          c.inventario_efectivo_disponible,
          c.demanda_operativa_mensual,
          c.dias_cobertura_actual,
          c.cobertura_objetivo_dias,
          c.umbral_compra_dias,
          c.cantidad_sugerida_empaque,
          c.inversion_sugerida_usd,
          c.diagnostico_urgencia,
          d.cantidad_ajuste_manual,
          d.cantidad_final_propuesta,
          (d.cantidad_final_propuesta * ps.costo_unitario_usd) AS inversion_final_usd,
          d.estado_decision,
          d.justificacion_ajuste
        FROM producto_sku ps
        INNER JOIN proveedor p ON ps.proveedor_id = p.identificador_proveedor
        INNER JOIN calculo_reposicion_sku c ON ps.identificador_producto = c.producto_id
        INNER JOIN decision_compra_sku d ON c.identificador_calculo = d.calculo_id
      `;

      const parametros: any[] = [];
      if (proveedorId) {
        consulta += ` WHERE ps.proveedor_id = $1`;
        parametros.push(proveedorId);
      }

      consulta += ` ORDER BY p.nombre_razon_social ASC, ps.codigo_sku ASC;`;

      const resultado = await baseDeDatos.ejecutarConsulta(consulta, parametros);

      const filas: FilaReporteControlR10[] = resultado.rows.map((r: any) => ({
        codigoSKU: r.codigo_sku,
        descripcionProducto: r.descripcion_producto,
        marca: r.marca || '',
        nombreProveedor: r.nombre_proveedor,
        unidadMinimaEmpaque: Number(r.unidad_minima_empaque),
        costoUnitarioUSD: Number(r.costo_unitario_usd),
        precioVentaUSD: Number(r.precio_venta_usd),
        margenPorcentual: Math.round(Number(r.margen_porcentual) * 10) / 10,
        cantidadAMano: Number(r.cantidad_a_mano),
        cantidadTransito: Number(r.cantidad_transito_valido),
        inventarioEfectivo: Number(r.inventario_efectivo_disponible),
        demandaOperativaMensual: Number(r.demanda_operativa_mensual),
        diasCoberturaActual: Number(r.dias_cobertura_actual),
        coberturaObjetivoDias: Number(r.cobertura_objetivo_dias),
        umbralCompraDias: Number(r.umbral_compra_dias),
        cantidadSugeridaMotor: Number(r.cantidad_sugerida_empaque),
        inversionSugeridaUSD: Number(r.inversion_sugerida_usd),
        diagnosticoUrgencia: r.diagnostico_urgencia,
        cantidadAjusteManual: r.cantidad_ajuste_manual !== null ? Number(r.cantidad_ajuste_manual) : null,
        cantidadFinalAprobada: Number(r.cantidad_final_propuesta),
        inversionFinalUSD: Math.round(Number(r.inversion_final_usd) * 100) / 100,
        estadoDecision: r.estado_decision,
        justificacionAjuste: r.justificacion_ajuste || null
      }));

      const bufferExcel = await ExportadorVistaControlR10.exportarAExcel(filas);
      const fecha = new Date().toISOString().slice(0, 10);

      return respuesta
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="vista-control-r10-${fecha}.xlsx"`)
        .send(bufferExcel);
    }
  );
}
