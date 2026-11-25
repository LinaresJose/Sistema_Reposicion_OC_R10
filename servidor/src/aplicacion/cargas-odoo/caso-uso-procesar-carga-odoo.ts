/**
 * Caso de uso: Procesar Carga, Validacion y Conciliacion de Datos Odoo.
 *
 * Logica y Reglas de Negocio:
 * 1. Extrae y valida los 4 archivos (o API) sin corromper SKUs ni formatos.
 * 2. Si hay errores fila por fila, aborta sin persistir corrupciones y retorna hallazgos.
 * 3. Si los hashes SHA-256 no han cambiado respecto a la ultima carga exitosa,
 *    registra 'SIN_CAMBIOS' y omite recalculos redundantes.
 * 4. Concilia cambios y detecta novedades (NUEVO_SKU, CAMBIO_COSTO, CAMBIO_STOCK, etc.).
 * 5. Dispara el Motor R10 para recalcular coberturas y cantidades sugeridas.
 * 6. Marca vigencia: si el nuevo hash de instantanea difiere de la firma previa,
 *    marca es_calculo_vigente = false en decision_compra_sku.
 * 7. Genera notificaciones automaticas para analistas asignadas y gerencia.
 * 8. Registra evento inmutable en auditoria.
 */
import crypto from 'node:crypto';
import { PuertoOrigenDatosOdoo, ArchivosEntradaOdoo } from '../../dominio/puertos/puerto-origen-datos-odoo.js';
import { PuertoRepositorioCargasOdoo } from '../../dominio/puertos/puerto-repositorio-cargas-odoo.js';
import { PuertoRepositorioNotificaciones } from '../../dominio/puertos/puerto-repositorio-notificaciones.js';
import { PuertoRepositorioAuditoria } from '../../dominio/puertos/puerto-repositorio-auditoria.js';
import {
  CargaArchivoOdoo,
  NovedadCargaOdoo,
  TipoNovedadCarga,
  TipoOrigenDatosOdoo
} from '../../dominio/entidades/carga-odoo.js';
import { MotorCalculoR10 } from '../motor-reposicion/motor-calculo-r10.js';
import { CalculadorHashInstantanea } from '../motor-reposicion/calculador-hash-instantanea.js';
import { baseDeDatos } from '../../infraestructura/base-de-datos/cliente-postgresql.js';

export interface ParametrosProcesarCargaOdoo {
  archivos?: ArchivosEntradaOdoo;
  usuarioId: string | null;
  tipoOrigen?: TipoOrigenDatosOdoo;
}

export interface ResultadoProcesamientoCarga {
  exito: boolean;
  cargaId: string;
  estadoProcesamiento: string;
  totalRegistrosProcesados: number;
  totalNovedadesDetectadas: number;
  resumenNovedades: Record<string, number>;
  totalPropuestasDesactualizadas: number;
  hallazgosValidacion: Array<{
    fila: number;
    archivo: string;
    columna: string;
    valor: any;
    mensajeError: string;
  }>;
}

export class CasoUsoProcesarCargaOdoo {
  constructor(
    private readonly origenDatosOdoo: PuertoOrigenDatosOdoo,
    private readonly repositorioCargas: PuertoRepositorioCargasOdoo,
    private readonly repositorioNotificaciones: PuertoRepositorioNotificaciones,
    private readonly repositorioAuditoria: PuertoRepositorioAuditoria
  ) {}

  async ejecutar(parametros: ParametrosProcesarCargaOdoo): Promise<ResultadoProcesamientoCarga> {
    const cargaId = crypto.randomUUID();
    const tipoOrigen = parametros.tipoOrigen || 'ARCHIVOS_MANUALES_EXCEL';

    // 1. Extraer y validar datos mediante el puerto de origen
    const resultadoExtraccion = await this.origenDatosOdoo.obtenerDatosOdoo(parametros.archivos);

    // 2. Si no es valido (hay errores estructurales o fila por fila), registrar y rechazar
    if (!resultadoExtraccion.esValido) {
      const cargaRechazada: CargaArchivoOdoo = {
        identificadorCarga: cargaId,
        usuarioId: parametros.usuarioId,
        tipoOrigen,
        hashCatalogoCostos: resultadoExtraccion.hashes.catalogoCostos,
        hashInventarioAMano: resultadoExtraccion.hashes.inventarioAMano,
        hashComprasTransito: resultadoExtraccion.hashes.comprasTransito,
        hashVentasPrecios: resultadoExtraccion.hashes.ventasPrecios,
        totalRegistrosProcesados: resultadoExtraccion.totalFilasLeidas,
        totalNovedadesDetectadas: 0,
        estadoProcesamiento: 'RECHAZADA_CON_ERRORES',
        resumenNovedades: {},
        novedades: [],
        hallazgosValidacion: resultadoExtraccion.hallazgos,
        creadoEn: new Date()
      };

      await this.repositorioCargas.registrarCarga(cargaRechazada);

      return {
        exito: false,
        cargaId,
        estadoProcesamiento: 'RECHAZADA_CON_ERRORES',
        totalRegistrosProcesados: resultadoExtraccion.totalFilasLeidas,
        totalNovedadesDetectadas: 0,
        resumenNovedades: {},
        totalPropuestasDesactualizadas: 0,
        hallazgosValidacion: resultadoExtraccion.hallazgos
      };
    }

    // 3. Verificar si no hubo cambios respecto a la ultima carga exitosa
    const ultimaCarga = await this.repositorioCargas.obtenerUltimaCargaExitosa();
    if (ultimaCarga && this.sonHashesIdenticos(resultadoExtraccion.hashes, ultimaCarga)) {
      const cargaSinCambios: CargaArchivoOdoo = {
        identificadorCarga: cargaId,
        usuarioId: parametros.usuarioId,
        tipoOrigen,
        hashCatalogoCostos: resultadoExtraccion.hashes.catalogoCostos,
        hashInventarioAMano: resultadoExtraccion.hashes.inventarioAMano,
        hashComprasTransito: resultadoExtraccion.hashes.comprasTransito,
        hashVentasPrecios: resultadoExtraccion.hashes.ventasPrecios,
        totalRegistrosProcesados: resultadoExtraccion.totalFilasLeidas,
        totalNovedadesDetectadas: 0,
        estadoProcesamiento: 'SIN_CAMBIOS',
        resumenNovedades: { SIN_CAMBIOS: resultadoExtraccion.totalFilasLeidas },
        novedades: [],
        hallazgosValidacion: [],
        creadoEn: new Date()
      };

      await this.repositorioCargas.registrarCarga(cargaSinCambios);

      return {
        exito: true,
        cargaId,
        estadoProcesamiento: 'SIN_CAMBIOS',
        totalRegistrosProcesados: resultadoExtraccion.totalFilasLeidas,
        totalNovedadesDetectadas: 0,
        resumenNovedades: { SIN_CAMBIOS: resultadoExtraccion.totalFilasLeidas },
        totalPropuestasDesactualizadas: 0,
        hallazgosValidacion: []
      };
    }

    // 4. Conciliacion y deteccion de novedades en Base de Datos
    const { novedades, resumenNovedades, totalPropuestasDesactualizadas, proveedoresAfectados } =
      await this.ejecutarConciliacionYRecalculo(cargaId, resultadoExtraccion.datosNormalizados);

    // 5. Registrar carga completada
    const cargaExitosa: CargaArchivoOdoo = {
      identificadorCarga: cargaId,
      usuarioId: parametros.usuarioId,
      tipoOrigen,
      hashCatalogoCostos: resultadoExtraccion.hashes.catalogoCostos,
      hashInventarioAMano: resultadoExtraccion.hashes.inventarioAMano,
      hashComprasTransito: resultadoExtraccion.hashes.comprasTransito,
      hashVentasPrecios: resultadoExtraccion.hashes.ventasPrecios,
      totalRegistrosProcesados: resultadoExtraccion.totalFilasLeidas,
      totalNovedadesDetectadas: novedades.length,
      estadoProcesamiento: 'COMPLETADA_EXITOSA',
      resumenNovedades,
      novedades,
      hallazgosValidacion: [],
      creadoEn: new Date()
    };

    await this.repositorioCargas.registrarCarga(cargaExitosa);

    // 6. Generar notificaciones para analistas y gerencia
    await this.notificarNovedadesYDesactualizacion(
      proveedoresAfectados,
      novedades.length,
      totalPropuestasDesactualizadas
    );

    // 7. Registrar evento inmutable de auditoria
    await this.repositorioAuditoria.registrarEvento({
      usuarioId: parametros.usuarioId,
      tipoEvento: 'CARGA_ARCHIVOS_ODOO_PROCESADA',
      nombreEntidad: 'carga_archivo_odoo',
      identificadorEntidad: cargaId,
      estadoNuevo: {
        tipoOrigen,
        totalProcesados: resultadoExtraccion.totalFilasLeidas,
        totalNovedades: novedades.length,
        propuestasDesactualizadas: totalPropuestasDesactualizadas,
        resumenNovedades
      }
    });

    return {
      exito: true,
      cargaId,
      estadoProcesamiento: 'COMPLETADA_EXITOSA',
      totalRegistrosProcesados: resultadoExtraccion.totalFilasLeidas,
      totalNovedadesDetectadas: novedades.length,
      resumenNovedades,
      totalPropuestasDesactualizadas,
      hallazgosValidacion: []
    };
  }

  // ─── Conciliacion y Recalculo Atomico en Base de Datos ───────────────────────

  private async ejecutarConciliacionYRecalculo(
    cargaId: string,
    datos: any
  ): Promise<{
    novedades: NovedadCargaOdoo[];
    resumenNovedades: Record<string, number>;
    totalPropuestasDesactualizadas: number;
    proveedoresAfectados: Set<string>;
  }> {
    const novedades: NovedadCargaOdoo[] = [];
    const resumenNovedades: Record<string, number> = {};
    const proveedoresAfectados = new Set<string>();
    let totalPropuestasDesactualizadas = 0;

    const cliente = await baseDeDatos.obtenerClienteTransaccion();

    try {
      await cliente.query('BEGIN');

      // Obtener SKUs existentes en la base de datos
      const resSkusExistentes = await cliente.query(`
        SELECT 
          ps.identificador_producto,
          ps.codigo_sku,
          ps.costo_unitario_usd,
          ps.precio_venta_usd,
          ps.unidad_minima_empaque,
          ps.clasificacion_comercial,
          ps.estado_sku_odoo,
          ps.proveedor_id,
          p.plazo_entrega_dias,
          p.frecuencia_compra_dias,
          p.dias_seguridad_adicional,
          p.cobertura_minima_dias,
          c.identificador_calculo,
          c.cantidad_a_mano,
          c.cantidad_transito_valido,
          c.demanda_operativa_mensual,
          c.hash_instantanea_calculo,
          d.identificador_decision,
          d.hash_firma_aprobada,
          d.es_calculo_vigente
        FROM producto_sku ps
        LEFT JOIN proveedor p ON ps.proveedor_id = p.identificador_proveedor
        LEFT JOIN calculo_reposicion_sku c ON ps.identificador_producto = c.producto_id
        LEFT JOIN decision_compra_sku d ON c.identificador_calculo = d.calculo_id;
      `);

      const skusDbMap = new Map<string, any>();
      resSkusExistentes.rows.forEach(r => skusDbMap.set(r.codigo_sku, r));

      // 1. Conciliar y actualizar cada producto suministrado en cualquiera de los archivos cargados
      const skusAProcesar = new Set<string>([
        ...datos.catalogoCostos.keys(),
        ...datos.inventarioMano.keys(),
        ...datos.comprasTransito.keys(),
        ...datos.ventasPrecios.keys()
      ]);

      for (const sku of skusAProcesar) {
        const itemCatalogo = datos.catalogoCostos.get(sku);
        const itemStock = datos.inventarioMano.get(sku);
        const itemTransitoLista = datos.comprasTransito.get(sku) || [];
        const itemVentas = datos.ventasPrecios.get(sku);

        const dbSku = skusDbMap.get(sku);

        // Sumar transito valido
        let transitoTotal = 0;
        for (const t of itemTransitoLista) {
          transitoTotal += t.cantidadTransito;
        }

        const stockAMano = itemStock ? itemStock.cantidadAMano : (dbSku ? Number(dbSku.cantidad_a_mano || 0) : 0);
        const transitoValido = itemTransitoLista.length > 0 ? transitoTotal : (dbSku ? Number(dbSku.cantidad_transito_valido || 0) : 0);
        const demandaMensual = itemVentas ? (itemVentas.demandaHistoricaMensual * 0.5 + itemVentas.metaVentasMensual * 0.5) : (dbSku ? Number(dbSku.demanda_operativa_mensual || 0) : 0);

        if (!dbSku) {
          if (itemCatalogo) {
            // NUEVO SKU
            this.agregarNovedad(novedades, resumenNovedades, cargaId, 'NUEVO_SKU', sku, null, `$${itemCatalogo.costoUnitarioUSD}`, `Nuevo SKU incorporado desde Odoo: ${itemCatalogo.descripcionProducto}`);
          }
          continue;
        }

        const costoUSD = itemCatalogo ? itemCatalogo.costoUnitarioUSD : Number(dbSku.costo_unitario_usd || 0);
        const precioUSD = itemCatalogo ? itemCatalogo.precioVentaUSD : Number(dbSku.precio_venta_usd || 0);
        const empaque = itemCatalogo ? itemCatalogo.unidadMinimaEmpaque : Number(dbSku.unidad_minima_empaque || 1);
        const descripcionProducto = itemCatalogo ? itemCatalogo.descripcionProducto : (dbSku.descripcion_producto || sku);

        let huboCambio = false;

        // Validar cambio de costo
        if (itemCatalogo && Number(dbSku.costo_unitario_usd) !== itemCatalogo.costoUnitarioUSD) {
          this.agregarNovedad(novedades, resumenNovedades, cargaId, 'CAMBIO_COSTO', sku, `$${dbSku.costo_unitario_usd}`, `$${itemCatalogo.costoUnitarioUSD}`, 'Costo unitario actualizado en Odoo');
          huboCambio = true;
        }

        // Validar cambio de precio
        if (itemCatalogo && Number(dbSku.precio_venta_usd) !== itemCatalogo.precioVentaUSD) {
          this.agregarNovedad(novedades, resumenNovedades, cargaId, 'CAMBIO_PRECIO', sku, `$${dbSku.precio_venta_usd}`, `$${itemCatalogo.precioVentaUSD}`, 'Precio de venta actualizado en Odoo');
          huboCambio = true;
        }

        // Validar cambio de empaque
        if (itemCatalogo && Number(dbSku.unidad_minima_empaque) !== itemCatalogo.unidadMinimaEmpaque) {
          this.agregarNovedad(novedades, resumenNovedades, cargaId, 'CAMBIO_EMPAQUE', sku, String(dbSku.unidad_minima_empaque), String(itemCatalogo.unidadMinimaEmpaque), 'Empaque minimo comercial modificado');
          huboCambio = true;
        }

        // Validar cambio de stock
        if (itemStock && Number(dbSku.cantidad_a_mano) !== stockAMano) {
          this.agregarNovedad(novedades, resumenNovedades, cargaId, 'CAMBIO_STOCK', sku, String(dbSku.cantidad_a_mano), String(stockAMano), 'Inventario fisico a mano actualizado');
          huboCambio = true;
        }

        // Validar cambio de transito
        if (datos.comprasTransito.has(sku) && Number(dbSku.cantidad_transito_valido) !== transitoValido) {
          this.agregarNovedad(novedades, resumenNovedades, cargaId, 'CAMBIO_TRANSITO', sku, String(dbSku.cantidad_transito_valido), String(transitoValido), 'Ordenes de compra en transito actualizadas');
          huboCambio = true;
        }

        // Validar cambio de demanda
        if (itemVentas && Math.abs(Number(dbSku.demanda_operativa_mensual) - demandaMensual) > 0.01) {
          this.agregarNovedad(novedades, resumenNovedades, cargaId, 'CAMBIO_DEMANDA', sku, String(dbSku.demanda_operativa_mensual), String(demandaMensual), 'Demanda operativa mensual recalculada');
          huboCambio = true;
        }

        // Si hubo cambios, actualizar catalogo y ejecutar Motor R10
        if (huboCambio && dbSku.proveedor_id) {
          proveedoresAfectados.add(dbSku.proveedor_id);

          // 1. Actualizar tabla producto_sku si vino catalogo
          if (itemCatalogo) {
            await cliente.query(`
              UPDATE producto_sku
              SET 
                costo_unitario_usd = $1,
                precio_venta_usd = $2,
                unidad_minima_empaque = $3,
                actualizado_en = CURRENT_TIMESTAMP
              WHERE codigo_sku = $4;
            `, [itemCatalogo.costoUnitarioUSD, itemCatalogo.precioVentaUSD, itemCatalogo.unidadMinimaEmpaque, sku]);
          }

          // 2. Ejecutar Motor R10
          const plazoDias = Number(dbSku.plazo_entrega_dias || 7);
          const frecDias = Number(dbSku.frecuencia_compra_dias || 15);
          const segDias = Number(dbSku.dias_seguridad_adicional || 0);
          const cobMinima = Number(dbSku.cobertura_minima_dias || 0);

          const resultadoMotor = MotorCalculoR10.calcular({
            productoId: dbSku.identificador_producto,
            codigoSKU: sku,
            descripcionProducto: descripcionProducto,
            proveedorId: dbSku.proveedor_id,
            periodoMes: '2026-11',
            costoUnitarioUSD: costoUSD,
            precioVentaUSD: precioUSD,
            cantidadAMano: stockAMano,
            cantidadTransitoValido: transitoValido,
            demandaHistoricaMensual: itemVentas ? itemVentas.demandaHistoricaMensual : demandaMensual,
            metaPresupuestoMensual: itemVentas ? itemVentas.metaVentasMensual : undefined,
            plazoEntregaDias: plazoDias,
            frecuenciaCompraDias: frecDias,
            seguridadProveedorDias: segDias,
            coberturaMinimaProveedorDias: cobMinima,
            clasificacionComercial: dbSku.clasificacion_comercial || 'MEDIA ROTACION',
            unidadMinimaEmpaque: empaque
          });

          // 3. Obtener hash canonico generado por el motor
          const nuevoHash = resultadoMotor.hashInstantaneaCalculo;

          // 4. Actualizar calculo_reposicion_sku
          await cliente.query(`
            UPDATE calculo_reposicion_sku
            SET
              cantidad_a_mano = $1,
              cantidad_transito_valido = $2,
              inventario_efectivo_disponible = $3,
              demanda_operativa_mensual = $4,
              demanda_diaria = $5,
              dias_cobertura_actual = $6,
              cobertura_objetivo_dias = $7,
              umbral_compra_dias = $8,
              cantidad_sugerida_bruta = $9,
              cantidad_sugerida_empaque = $10,
              inversion_sugerida_usd = $11,
              diagnostico_urgencia = $12,
              hash_instantanea_calculo = $13,
              fecha_calculo = CURRENT_TIMESTAMP
            WHERE producto_id = $14;
          `, [
            stockAMano,
            transitoValido,
            resultadoMotor.inventarioEfectivoDisponible,
            demandaMensual,
            resultadoMotor.demandaDiaria,
            resultadoMotor.diasCoberturaActual,
            resultadoMotor.coberturaObjetivoDias,
            resultadoMotor.umbralCompraDias,
            resultadoMotor.cantidadSugeridaBruta,
            resultadoMotor.cantidadSugeridaEmpaque,
            resultadoMotor.inversionSugeridaUSD,
            resultadoMotor.diagnosticoUrgencia,
            nuevoHash,
            dbSku.identificador_producto
          ]);

          // 5. Verificar y marcar vigencia en decision_compra_sku
          if (dbSku.identificador_decision) {
            const esVigente = dbSku.hash_firma_aprobada === nuevoHash;

            if (!esVigente && dbSku.es_calculo_vigente) {
              totalPropuestasDesactualizadas++;
            }

            await cliente.query(`
              UPDATE decision_compra_sku
              SET 
                es_calculo_vigente = $1,
                actualizado_en = CURRENT_TIMESTAMP
              WHERE identificador_decision = $2;
            `, [esVigente, dbSku.identificador_decision]);
          }
        }
      }

      await cliente.query('COMMIT');
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }

    return {
      novedades,
      resumenNovedades,
      totalPropuestasDesactualizadas,
      proveedoresAfectados
    };
  }

  private agregarNovedad(
    novedades: NovedadCargaOdoo[],
    resumen: Record<string, number>,
    cargaId: string,
    tipo: TipoNovedadCarga,
    sku: string,
    anterior: string | null,
    nuevo: string | null,
    detalle: string
  ) {
    novedades.push({
      identificadorNovedad: crypto.randomUUID(),
      cargaId,
      tipoNovedad: tipo,
      codigoSKU: sku,
      valorAnterior: anterior,
      valorNuevo: nuevo,
      detalleNovedad: detalle,
      creadoEn: new Date()
    });
    resumen[tipo] = (resumen[tipo] || 0) + 1;
  }

  private sonHashesIdenticos(actuales: any, previa: CargaArchivoOdoo): boolean {
    if (!previa) return false;
    return (
      actuales.catalogoCostos === previa.hashCatalogoCostos &&
      actuales.inventarioAMano === previa.hashInventarioAMano &&
      actuales.comprasTransito === previa.hashComprasTransito &&
      actuales.ventasPrecios === previa.hashVentasPrecios
    );
  }

  private async notificarNovedadesYDesactualizacion(
    proveedoresAfectados: Set<string>,
    totalNovedades: number,
    propuestasDesactualizadas: number
  ): Promise<void> {
    if (proveedoresAfectados.size === 0 && totalNovedades === 0) return;

    // 1. Obtener analistas asignadas a los proveedores afectados
    for (const provId of proveedoresAfectados) {
      const resAsig = await baseDeDatos.ejecutarConsulta(`
        SELECT a.analista_usuario_id, p.nombre_razon_social
        FROM asignacion_proveedor a
        INNER JOIN proveedor p ON a.proveedor_id = p.identificador_proveedor
        WHERE a.proveedor_id = $1 AND a.analista_usuario_id IS NOT NULL;
      `, [provId]);

      if (resAsig.rows.length > 0) {
        const fila = resAsig.rows[0];
        await this.repositorioNotificaciones.crearNotificacion({
          usuarioDestinoId: fila.analista_usuario_id,
          tipoNotificacion: propuestasDesactualizadas > 0 ? 'CALCULO_DESACTUALIZADO' : 'NOVEDAD_CARGA_ODOO',
          tituloMensaje: `Actualizacion Odoo: ${fila.nombre_razon_social}`,
          detalleMensaje: `Se procesaron datos de Odoo con novedades en costos/stock. ${propuestasDesactualizadas > 0 ? 'Una o mas propuestas requieren revision por desactualizacion.' : 'El inventario y costos se encuentran al dia.'}`,
          proveedorId: provId
        });
      }
    }

    // 2. Notificar a Gerente y Administrador sobre el resumen de la carga
    const resGerentes = await baseDeDatos.ejecutarConsulta(`
      SELECT identificador_usuario
      FROM usuario
      WHERE rol_id IN ('GERENTE_COMPRAS', 'ADMINISTRADOR_SISTEMA') AND esta_activo = TRUE;
    `);

    for (const g of resGerentes.rows) {
      await this.repositorioNotificaciones.crearNotificacion({
        usuarioDestinoId: g.identificador_usuario,
        tipoNotificacion: 'NOVEDAD_CARGA_ODOO',
        tituloMensaje: 'Carga de Archivos Odoo Procesada Exitosamente',
        detalleMensaje: `Carga completada: ${totalNovedades} novedades detectadas y ${propuestasDesactualizadas} propuestas marcadas para revision por variacion de costos/stock.`
      });
    }
  }
}
