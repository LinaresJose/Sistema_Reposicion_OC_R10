/**
 * Repositorio PostgreSQL para Cargas Odoo y Novedades.
 *
 * Implementa PuertoRepositorioCargasOdoo asegurando persistencia transaccional
 * de las cargas, hashes SHA-256 y novedades detectadas.
 */
import { PuertoRepositorioCargasOdoo } from '../../../dominio/puertos/puerto-repositorio-cargas-odoo.js';
import { CargaArchivoOdoo, NovedadCargaOdoo, EstadoProcesamientoCarga, TipoOrigenDatosOdoo, TipoNovedadCarga } from '../../../dominio/entidades/carga-odoo.js';
import { baseDeDatos } from '../cliente-postgresql.js';

export class RepositorioCargasOdooPg implements PuertoRepositorioCargasOdoo {

  async registrarCarga(carga: CargaArchivoOdoo): Promise<void> {
    const cliente = await baseDeDatos.obtenerClienteTransaccion();
    try {
      await cliente.query('BEGIN');

      // 1. Insertar cabecera de carga
      const consultaCarga = `
        INSERT INTO carga_archivo_odoo (
          identificador_carga,
          usuario_id,
          tipo_origen,
          hash_catalogo_costos,
          hash_inventario_a_mano,
          hash_compras_transito,
          hash_ventas_precios,
          total_registros_procesados,
          total_novedades_detectadas,
          estado_procesamiento,
          resumen_novedades,
          creado_en
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (identificador_carga) DO UPDATE SET
          total_registros_procesados = EXCLUDED.total_registros_procesados,
          total_novedades_detectadas = EXCLUDED.total_novedades_detectadas,
          estado_procesamiento = EXCLUDED.estado_procesamiento,
          resumen_novedades = EXCLUDED.resumen_novedades;
      `;

      await cliente.query(consultaCarga, [
        carga.identificadorCarga,
        carga.usuarioId,
        carga.tipoOrigen,
        carga.hashCatalogoCostos,
        carga.hashInventarioAMano,
        carga.hashComprasTransito,
        carga.hashVentasPrecios,
        carga.totalRegistrosProcesados,
        carga.totalNovedadesDetectadas,
        carga.estadoProcesamiento,
        JSON.stringify(carga.resumenNovedades || {}),
        carga.creadoEn
      ]);

      // 2. Insertar novedades detectadas
      if (carga.novedades && carga.novedades.length > 0) {
        const consultaNovedad = `
          INSERT INTO novedad_carga_odoo (
            identificador_novedad,
            carga_id,
            tipo_novedad,
            codigo_sku,
            valor_anterior,
            valor_nuevo,
            detalle_novedad,
            creado_en
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (identificador_novedad) DO NOTHING;
        `;

        for (const nov of carga.novedades) {
          await cliente.query(consultaNovedad, [
            nov.identificadorNovedad,
            carga.identificadorCarga,
            nov.tipoNovedad,
            nov.codigoSKU,
            nov.valorAnterior,
            nov.valorNuevo,
            nov.detalleNovedad,
            nov.creadoEn
          ]);
        }
      }

      await cliente.query('COMMIT');
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  async obtenerUltimaCargaExitosa(): Promise<CargaArchivoOdoo | null> {
    const consulta = `
      SELECT 
        identificador_carga,
        usuario_id,
        tipo_origen,
        hash_catalogo_costos,
        hash_inventario_a_mano,
        hash_compras_transito,
        hash_ventas_precios,
        total_registros_procesados,
        total_novedades_detectadas,
        estado_procesamiento,
        resumen_novedades,
        creado_en
      FROM carga_archivo_odoo
      WHERE estado_procesamiento = 'COMPLETADA_EXITOSA'
      ORDER BY creado_en DESC
      LIMIT 1;
    `;

    const resultado = await baseDeDatos.ejecutarConsulta(consulta);
    if (resultado.rows.length === 0) return null;
    return this.mapearFilaACarga(resultado.rows[0]);
  }

  async obtenerCargaPorId(identificadorCarga: string): Promise<CargaArchivoOdoo | null> {
    const consulta = `
      SELECT 
        identificador_carga,
        usuario_id,
        tipo_origen,
        hash_catalogo_costos,
        hash_inventario_a_mano,
        hash_compras_transito,
        hash_ventas_precios,
        total_registros_procesados,
        total_novedades_detectadas,
        estado_procesamiento,
        resumen_novedades,
        creado_en
      FROM carga_archivo_odoo
      WHERE identificador_carga = $1
      LIMIT 1;
    `;

    const resultado = await baseDeDatos.ejecutarConsulta(consulta, [identificadorCarga]);
    if (resultado.rows.length === 0) return null;

    const carga = this.mapearFilaACarga(resultado.rows[0]);
    carga.novedades = await this.listarNovedadesPorCarga(identificadorCarga);
    return carga;
  }

  async listarHistorialCargas(limite: number = 20): Promise<CargaArchivoOdoo[]> {
    const consulta = `
      SELECT 
        identificador_carga,
        usuario_id,
        tipo_origen,
        hash_catalogo_costos,
        hash_inventario_a_mano,
        hash_compras_transito,
        hash_ventas_precios,
        total_registros_procesados,
        total_novedades_detectadas,
        estado_procesamiento,
        resumen_novedades,
        creado_en
      FROM carga_archivo_odoo
      ORDER BY creado_en DESC
      LIMIT $1;
    `;

    const resultado = await baseDeDatos.ejecutarConsulta(consulta, [limite]);
    return resultado.rows.map(fila => this.mapearFilaACarga(fila));
  }

  async listarNovedadesPorCarga(cargaId: string): Promise<NovedadCargaOdoo[]> {
    const consulta = `
      SELECT 
        identificador_novedad,
        carga_id,
        tipo_novedad,
        codigo_sku,
        valor_anterior,
        valor_nuevo,
        detalle_novedad,
        creado_en
      FROM novedad_carga_odoo
      WHERE carga_id = $1
      ORDER BY creado_en ASC;
    `;

    const resultado = await baseDeDatos.ejecutarConsulta(consulta, [cargaId]);
    return resultado.rows.map(fila => ({
      identificadorNovedad: fila.identificador_novedad,
      cargaId: fila.carga_id,
      tipoNovedad: fila.tipo_novedad as TipoNovedadCarga,
      codigoSKU: fila.codigo_sku,
      valorAnterior: fila.valor_anterior,
      valorNuevo: fila.valor_nuevo,
      detalleNovedad: fila.detalle_novedad,
      creadoEn: new Date(fila.creado_en)
    }));
  }

  private mapearFilaACarga(fila: any): CargaArchivoOdoo {
    return {
      identificadorCarga: fila.identificador_carga,
      usuarioId: fila.usuario_id || null,
      tipoOrigen: fila.tipo_origen as TipoOrigenDatosOdoo,
      hashCatalogoCostos: fila.hash_catalogo_costos || null,
      hashInventarioAMano: fila.hash_inventario_a_mano || null,
      hashComprasTransito: fila.hash_compras_transito || null,
      hashVentasPrecios: fila.hash_ventas_precios || null,
      totalRegistrosProcesados: Number(fila.total_registros_procesados),
      totalNovedadesDetectadas: Number(fila.total_novedades_detectadas),
      estadoProcesamiento: fila.estado_procesamiento as EstadoProcesamientoCarga,
      resumenNovedades: typeof fila.resumen_novedades === 'object' ? fila.resumen_novedades : JSON.parse(fila.resumen_novedades || '{}'),
      novedades: [],
      hallazgosValidacion: [],
      creadoEn: new Date(fila.creado_en)
    };
  }
}
