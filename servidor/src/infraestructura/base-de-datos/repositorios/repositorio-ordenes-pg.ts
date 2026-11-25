/**
 * Repositorio PostgreSQL de ordenes de compra.
 *
 * Garantias:
 * - Generacion atomica de correlativos usando SELECT ... FOR UPDATE por empresa+anio.
 * - Transiciones de estado validadas en BD.
 * - JOIN completo con empresa_razon_social para incluir logo y datos fiscales.
 */
import crypto from 'node:crypto';
import { PuertoRepositorioOrdenes, DatosCrearOrden } from '../../../dominio/puertos/puerto-repositorio-ordenes.js';
import {
  OrdenCompra,
  ResumenOrdenCompra,
  RenglonOrdenCompra,
  EstadoOrdenCompra,
  CanalAprobacion
} from '../../../dominio/entidades/orden-compra.js';
import { baseDeDatos } from '../cliente-postgresql.js';

export class RepositorioOrdenesPg implements PuertoRepositorioOrdenes {

  // ─── Crear borrador ───────────────────────────────────────────────────────────

  async crearOrdenBorrador(datos: DatosCrearOrden): Promise<OrdenCompra> {
    const cliente = await baseDeDatos.obtenerClienteTransaccion();
    try {
      await cliente.query('BEGIN');

      const totalUSD = datos.renglones.reduce((acc, r) => acc + r.subtotalUSD, 0);

      // Insertar cabecera
      await cliente.query(
        `INSERT INTO orden_compra (
          identificador_orden, proveedor_id, analista_creadora_id,
          condicion_pago, tipo_documento_legal,
          plazo_entrega_dias, frecuencia_compra_dias,
          estado_orden, total_renglones, total_inversion_usd
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,'BORRADOR',$8,$9)`,
        [
          datos.identificadorOrden,
          datos.proveedorId,
          datos.analistaCreadoraId,
          datos.condicionPago,
          datos.tipoDocumentoLegal,
          datos.plazoEntregaDias,
          datos.frecuenciaCompraDias,
          datos.renglones.length,
          Math.round(totalUSD * 100) / 100
        ]
      );

      // Insertar renglones
      for (const r of datos.renglones) {
        await cliente.query(
          `INSERT INTO renglon_orden_compra (
            identificador_renglon, orden_compra_id, producto_id,
            codigo_sku, descripcion_producto, marca,
            unidad_minima_empaque, cantidad_ordenada,
            costo_unitario_usd, subtotal_usd, justificacion_ajuste
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            r.identificadorRenglon,
            datos.identificadorOrden,
            r.productoId,
            r.codigoSKU,
            r.descripcionProducto,
            r.marca,
            r.unidadMinimaEmpaque,
            r.cantidadOrdenada,
            r.costoUnitarioUSD,
            r.subtotalUSD,
            r.justificacionAjuste ?? null
          ]
        );
      }

      await cliente.query('COMMIT');
      return (await this.obtenerOrdenPorId(datos.identificadorOrden))!;
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  // ─── Obtener por ID ───────────────────────────────────────────────────────────

  async obtenerOrdenPorId(identificadorOrden: string): Promise<OrdenCompra | null> {
    const consultaCabecera = `
      SELECT
        oc.identificador_orden,
        oc.proveedor_id,
        p.nombre_razon_social AS nombre_proveedor,
        p.registro_informacion_fiscal AS registro_fiscal_proveedor,
        oc.condicion_pago,
        oc.tipo_documento_legal,
        oc.plazo_entrega_dias,
        oc.frecuencia_compra_dias,
        oc.analista_creadora_id,
        u.nombre_completo AS nombre_analista_creadora,
        u.telefono_contacto AS telefono_analista_creadora,
        oc.empresa_emisora_id,
        e.codigo_identificador AS codigo_empresa_emisora,
        e.nombre_razon_social AS nombre_empresa_emisora,
        e.registro_fiscal AS registro_fiscal_empresa,
        e.direccion_fiscal AS direccion_fiscal_empresa,
        e.logo_datos_base64 AS logo_base64_empresa,
        e.texto_pie_pagina AS texto_footer_empresa,
        oc.numero_correlativo_oficial,
        oc.estado_orden,
        oc.canal_aprobacion,
        oc.nota_respaldo_aprobacion,
        oc.aprobado_por_id,
        oc.aprobado_en,
        oc.emitido_en,
        oc.total_renglones,
        oc.total_inversion_usd,
        oc.creado_en,
        oc.actualizado_en
      FROM orden_compra oc
      INNER JOIN proveedor p ON oc.proveedor_id = p.identificador_proveedor
      INNER JOIN usuario u ON oc.analista_creadora_id = u.identificador_usuario
      LEFT JOIN empresa_razon_social e ON oc.empresa_emisora_id = e.identificador_empresa
      WHERE oc.identificador_orden = $1
      LIMIT 1;
    `;
    const resCabecera = await baseDeDatos.ejecutarConsulta(consultaCabecera, [identificadorOrden]);
    if (resCabecera.rows.length === 0) return null;
    const c = resCabecera.rows[0];

    const consultaRenglones = `
      SELECT
        identificador_renglon,
        orden_compra_id,
        producto_id,
        codigo_sku,
        descripcion_producto,
        marca,
        unidad_minima_empaque,
        cantidad_ordenada,
        costo_unitario_usd,
        subtotal_usd,
        justificacion_ajuste,
        creado_en
      FROM renglon_orden_compra
      WHERE orden_compra_id = $1
      ORDER BY codigo_sku ASC;
    `;
    const resRenglones = await baseDeDatos.ejecutarConsulta(consultaRenglones, [identificadorOrden]);

    const renglones: RenglonOrdenCompra[] = resRenglones.rows.map((r: any) => ({
      identificadorRenglon: r.identificador_renglon,
      ordenCompraId: r.orden_compra_id,
      productoId: r.producto_id,
      codigoSKU: r.codigo_sku,
      descripcionProducto: r.descripcion_producto,
      marca: r.marca,
      unidadMinimaEmpaque: Number(r.unidad_minima_empaque),
      cantidadOrdenada: Number(r.cantidad_ordenada),
      costoUnitarioUSD: Number(r.costo_unitario_usd),
      subtotalUSD: Number(r.subtotal_usd),
      justificacionAjuste: r.justificacion_ajuste ?? null,
      creadoEn: new Date(r.creado_en)
    }));

    return this.mapearCabeceraAOrden(c, renglones);
  }

  // ─── Listar ordenes ───────────────────────────────────────────────────────────

  async listarOrdenes(filtros?: {
    estadoOrden?: EstadoOrdenCompra;
    proveedorId?: string;
    analistaCreadoraId?: string;
    empresaEmisoraId?: string;
  }): Promise<ResumenOrdenCompra[]> {
    const condiciones: string[] = [];
    const parametros: any[] = [];
    let indice = 1;

    if (filtros?.estadoOrden) {
      condiciones.push(`oc.estado_orden = $${indice++}`);
      parametros.push(filtros.estadoOrden);
    }
    if (filtros?.proveedorId) {
      condiciones.push(`oc.proveedor_id = $${indice++}`);
      parametros.push(filtros.proveedorId);
    }
    if (filtros?.analistaCreadoraId) {
      condiciones.push(`oc.analista_creadora_id = $${indice++}`);
      parametros.push(filtros.analistaCreadoraId);
    }
    if (filtros?.empresaEmisoraId) {
      condiciones.push(`oc.empresa_emisora_id = $${indice++}`);
      parametros.push(filtros.empresaEmisoraId);
    }

    const clausulaWhere = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const consulta = `
      SELECT
        oc.identificador_orden,
        oc.proveedor_id,
        p.nombre_razon_social AS nombre_proveedor,
        oc.analista_creadora_id,
        u.nombre_completo AS nombre_analista_creadora,
        oc.empresa_emisora_id,
        e.codigo_identificador AS codigo_empresa_emisora,
        oc.numero_correlativo_oficial,
        oc.estado_orden,
        oc.total_renglones,
        oc.total_inversion_usd,
        oc.creado_en,
        oc.actualizado_en
      FROM orden_compra oc
      INNER JOIN proveedor p ON oc.proveedor_id = p.identificador_proveedor
      INNER JOIN usuario u ON oc.analista_creadora_id = u.identificador_usuario
      LEFT JOIN empresa_razon_social e ON oc.empresa_emisora_id = e.identificador_empresa
      ${clausulaWhere}
      ORDER BY oc.creado_en DESC
      LIMIT 200;
    `;

    const resultado = await baseDeDatos.ejecutarConsulta(consulta, parametros);
    return resultado.rows.map((r: any) => {
      const inversionUSD = Number(r.total_inversion_usd);
      return {
        identificadorOrden: r.identificador_orden,
        proveedorId: r.proveedor_id,
        nombreProveedor: r.nombre_proveedor,
        proveedorNombre: r.nombre_proveedor,
        analistaCreadoraId: r.analista_creadora_id,
        analistaUsuarioId: r.analista_creadora_id,
        nombreAnalistaCreadora: r.nombre_analista_creadora,
        analistaNombre: r.nombre_analista_creadora,
        empresaEmisoraId: r.empresa_emisora_id ?? null,
        razonSocialEmisoraId: r.empresa_emisora_id ?? null,
        codigoEmpresaEmisora: r.codigo_empresa_emisora ?? null,
        codigoRazonSocialEmisora: r.codigo_empresa_emisora ?? null,
        numeroCorrelativoOficial: r.numero_correlativo_oficial ?? null,
        estadoOrden: r.estado_orden as EstadoOrdenCompra,
        totalRenglones: Number(r.total_renglones),
        totalInversionUSD: inversionUSD,
        montoTotalNetoUSD: inversionUSD,
        montoTotalBrutoUSD: inversionUSD,
        montoTotalImpuestoUSD: 0,
        creadoEn: new Date(r.creado_en),
        actualizadoEn: new Date(r.actualizado_en)
      };
    });
  }

  // ─── Transiciones de estado ───────────────────────────────────────────────────

  async pasarARevisionWhatsapp(identificadorOrden: string): Promise<OrdenCompra> {
    await baseDeDatos.ejecutarConsulta(
      `UPDATE orden_compra
       SET estado_orden = 'EN_REVISION_WHATSAPP', actualizado_en = CURRENT_TIMESTAMP
       WHERE identificador_orden = $1 AND estado_orden = 'BORRADOR'`,
      [identificadorOrden]
    );
    return (await this.obtenerOrdenPorId(identificadorOrden))!;
  }

  async devolverABorrador(identificadorOrden: string, _motivoDevolucion: string): Promise<OrdenCompra> {
    await baseDeDatos.ejecutarConsulta(
      `UPDATE orden_compra
       SET estado_orden = 'BORRADOR', actualizado_en = CURRENT_TIMESTAMP
       WHERE identificador_orden = $1 AND estado_orden IN ('BORRADOR', 'EN_REVISION_WHATSAPP')`,
      [identificadorOrden]
    );
    return (await this.obtenerOrdenPorId(identificadorOrden))!;
  }

  async registrarAprobacion(
    identificadorOrden: string,
    datos: {
      canalAprobacion: CanalAprobacion;
      notaRespalodoAprobacion: string;
      aprobadoPorId: string;
    }
  ): Promise<OrdenCompra> {
    await baseDeDatos.ejecutarConsulta(
      `UPDATE orden_compra
       SET
         estado_orden = 'APROBADA_PARA_EMISION',
         canal_aprobacion = $2,
         nota_respaldo_aprobacion = $3,
         aprobado_por_id = $4,
         aprobado_en = CURRENT_TIMESTAMP,
         actualizado_en = CURRENT_TIMESTAMP
       WHERE identificador_orden = $1 AND estado_orden IN ('BORRADOR', 'EN_REVISION_WHATSAPP')`,
      [
        identificadorOrden,
        datos.canalAprobacion,
        datos.notaRespalodoAprobacion,
        datos.aprobadoPorId
      ]
    );
    return (await this.obtenerOrdenPorId(identificadorOrden))!;
  }

  // ─── Emision con correlativo atomico ─────────────────────────────────────────

  async emitirOrdenOficial(
    identificadorOrden: string,
    empresaEmisoraId: string,
    _emisorId: string
  ): Promise<OrdenCompra> {
    const cliente = await baseDeDatos.obtenerClienteTransaccion();
    try {
      await cliente.query('BEGIN');

      // Obtener codigo de empresa y anio actual con lock
      const resEmpresa = await cliente.query(
        `SELECT identificador_empresa, codigo_identificador FROM empresa_razon_social 
         WHERE (identificador_empresa::text = $1 OR codigo_identificador = $1) FOR UPDATE`,
        [empresaEmisoraId]
      );
      if (resEmpresa.rows.length === 0) {
        throw new Error('EMPRESA_NO_ENCONTRADA');
      }
      const empresaIdReal: string = resEmpresa.rows[0].identificador_empresa;
      const codigoEmpresa: string = resEmpresa.rows[0].codigo_identificador;
      const anioActual = new Date().getFullYear();

      // Generar correlativo atomico: MAX + 1 dentro de empresa + anio
      const resMax = await cliente.query(
        `SELECT COALESCE(MAX(numero_correlativo_secuencial), 0) + 1 AS proximo
         FROM orden_compra
         WHERE empresa_emisora_id = $1
           AND EXTRACT(YEAR FROM creado_en) = $2
           AND numero_correlativo_oficial IS NOT NULL
         FOR UPDATE`,
        [empresaIdReal, anioActual]
      );
      const proximoNumero: number = Number(resMax.rows[0].proximo);
      const nnnnn = String(proximoNumero).padStart(4, '0');
      const correlativo = `OC-${codigoEmpresa}-${anioActual}-${nnnnn}`;

      // Actualizar orden
      await cliente.query(
        `UPDATE orden_compra
         SET
           estado_orden = 'OC_EMITIDA',
           empresa_emisora_id = $2,
           numero_correlativo_oficial = $3,
           numero_correlativo_secuencial = $4,
           emitido_en = CURRENT_TIMESTAMP,
           actualizado_en = CURRENT_TIMESTAMP
         WHERE identificador_orden = $1 AND estado_orden = 'APROBADA_PARA_EMISION'`,
        [identificadorOrden, empresaIdReal, correlativo, proximoNumero]
      );

      await cliente.query('COMMIT');
      return (await this.obtenerOrdenPorId(identificadorOrden))!;
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  async obtenerProximoCorrelativo(codigoEmpresa: string, anio: number): Promise<number> {
    const consulta = `
      SELECT COALESCE(MAX(numero_correlativo_secuencial), 0) + 1 AS proximo
      FROM orden_compra oc
      INNER JOIN empresa_razon_social e ON oc.empresa_emisora_id = e.identificador_empresa
      WHERE e.codigo_identificador = $1
        AND EXTRACT(YEAR FROM oc.creado_en) = $2
        AND oc.numero_correlativo_oficial IS NOT NULL;
    `;
    const resultado = await baseDeDatos.ejecutarConsulta(consulta, [codigoEmpresa, anio]);
    return Number(resultado.rows[0]?.proximo ?? 1);
  }

  // ─── Mapeo interno ────────────────────────────────────────────────────────────

  private mapearCabeceraAOrden(c: any, renglones: RenglonOrdenCompra[]): OrdenCompra {
    return {
      identificadorOrden: c.identificador_orden,
      proveedorId: c.proveedor_id,
      nombreProveedor: c.nombre_proveedor,
      registroFiscalProveedor: c.registro_fiscal_proveedor,
      condicionPago: c.condicion_pago,
      tipoDocumentoLegal: c.tipo_documento_legal,
      plazoEntregaDias: Number(c.plazo_entrega_dias),
      frecuenciaCompraDias: Number(c.frecuencia_compra_dias),
      analistaCreadoraId: c.analista_creadora_id,
      nombreAnalistaCreadora: c.nombre_analista_creadora,
      telefonoAnalistaCreadora: c.telefono_analista_creadora ?? null,
      empresaEmisoraId: c.empresa_emisora_id ?? null,
      codigoEmpresaEmisora: c.codigo_empresa_emisora ?? null,
      nombreEmpresaEmisora: c.nombre_empresa_emisora ?? null,
      registroFiscalEmpresa: c.registro_fiscal_empresa ?? null,
      direccionFiscalEmpresa: c.direccion_fiscal_empresa ?? null,
      logoBase64Empresa: c.logo_base64_empresa ?? null,
      textoFooterEmpresa: c.texto_footer_empresa ?? null,
      numeroCorrelativoOficial: c.numero_correlativo_oficial ?? null,
      estadoOrden: c.estado_orden as EstadoOrdenCompra,
      canalAprobacion: c.canal_aprobacion ?? null,
      notaRespalodoAprobacion: c.nota_respaldo_aprobacion ?? null,
      aprobadoPorId: c.aprobado_por_id ?? null,
      aprobadoEn: c.aprobado_en ? new Date(c.aprobado_en) : null,
      emitidoEn: c.emitido_en ? new Date(c.emitido_en) : null,
      totalRenglones: Number(c.total_renglones),
      totalInversionUSD: Number(c.total_inversion_usd),
      renglones,
      creadoEn: new Date(c.creado_en),
      actualizadoEn: new Date(c.actualizado_en)
    };
  }
}
