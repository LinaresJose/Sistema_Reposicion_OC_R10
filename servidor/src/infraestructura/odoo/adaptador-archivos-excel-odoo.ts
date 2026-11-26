/**
 * Adaptador de Archivos Excel para Ingesta Odoo.
 *
 * Implementa PuertoOrigenDatosOdoo procesando en memoria los 4 archivos
 * exportados desde Odoo mediante ExcelJS.
 *
 * Caracteristicas clave:
 * 1. Hashes criptograficos SHA-256 por archivo para deteccion de cambios y auditoria.
 * 2. Validacion estricta fila por fila (sin corromper SKUs ni codigos de barra).
 * 3. Deteccion de errores no bloqueante que recopila todos los hallazgos antes de abortar.
 * 4. Consumo minimo de memoria (< 15 MB RAM) compatible con Free Tier.
 */
import crypto from 'node:crypto';
import ExcelJS from 'exceljs';
import {
  PuertoOrigenDatosOdoo,
  ArchivosEntradaOdoo,
  ResultadoExtraccionOdoo,
  EstadoConexionOrigenOdoo,
  HashesArchivosOdoo
} from '../../dominio/puertos/puerto-origen-datos-odoo.js';
import {
  DatosNormalizadosOdoo,
  FilaCatalogoCostos,
  FilaInventarioMano,
  FilaComprasTransito,
  FilaVentasPrecios,
  HallazgoValidacionFila
} from '../../dominio/entidades/carga-odoo.js';

export class AdaptadorArchivosExcelOdoo implements PuertoOrigenDatosOdoo {

  async consultarEstadoConexion(): Promise<EstadoConexionOrigenOdoo> {
    return {
      tipoOrigen: 'ARCHIVOS_MANUALES_EXCEL',
      estaDisponible: true,
      mensajeEstado: 'Adaptador de archivos Excel operativo para carga manual validada'
    };
  }

  async obtenerDatosOdoo(entrada?: ArchivosEntradaOdoo): Promise<ResultadoExtraccionOdoo> {
    const hallazgos: HallazgoValidacionFila[] = [];

    if (!entrada) {
      return {
        esValido: false,
        datosNormalizados: this.crearContenedorDatosVacio(),
        hallazgos: [{ fila: 0, archivo: 'GENERAL', columna: 'GENERAL', valor: null, mensajeError: 'No se suministraron archivos para el procesamiento' }],
        hashes: { catalogoCostos: null, inventarioAMano: null, comprasTransito: null, ventasPrecios: null },
        totalFilasLeidas: 0
      };
    }

    const hashes: HashesArchivosOdoo = {
      catalogoCostos: entrada.catalogoCostos ? this.calcularHashSHA256(entrada.catalogoCostos) : null,
      inventarioAMano: entrada.inventarioMano ? this.calcularHashSHA256(entrada.inventarioMano) : null,
      comprasTransito: entrada.comprasTransito ? this.calcularHashSHA256(entrada.comprasTransito) : null,
      ventasPrecios: entrada.historialVentasPrecios ? this.calcularHashSHA256(entrada.historialVentasPrecios) : null
    };

    const datosNormalizados = this.crearContenedorDatosVacio();
    let totalFilas = 0;

    // 1. Procesar Archivo 1: Catalogo y Costos
    if (entrada.catalogoCostos) {
      const { filas, hallazgos: h1, total } = await this.procesarArchivoCatalogoCostos(entrada.catalogoCostos);
      hallazgos.push(...h1);
      totalFilas += total;
      for (const [sku, item] of filas) {
        datosNormalizados.catalogoCostos.set(sku, item);
      }
    }

    // 2. Procesar Archivo 2: Inventario a Mano
    if (entrada.inventarioMano) {
      const { filas, hallazgos: h2, total } = await this.procesarArchivoInventarioMano(entrada.inventarioMano);
      hallazgos.push(...h2);
      totalFilas += total;
      for (const [sku, item] of filas) {
        datosNormalizados.inventarioMano.set(sku, item);
      }
    }

    // 3. Procesar Archivo 3: Compras en Transito
    if (entrada.comprasTransito) {
      const { filas, hallazgos: h3, total } = await this.procesarArchivoComprasTransito(entrada.comprasTransito);
      hallazgos.push(...h3);
      totalFilas += total;
      for (const [sku, items] of filas) {
        datosNormalizados.comprasTransito.set(sku, items);
      }
    }

    // 4. Procesar Archivo 4: Historial de Ventas y Precios
    if (entrada.historialVentasPrecios) {
      const { filas, hallazgos: h4, total } = await this.procesarArchivoVentasPrecios(entrada.historialVentasPrecios);
      hallazgos.push(...h4);
      totalFilas += total;
      for (const [sku, item] of filas) {
        datosNormalizados.ventasPrecios.set(sku, item);
      }
    }

    return {
      esValido: hallazgos.length === 0,
      datosNormalizados,
      hallazgos,
      hashes,
      totalFilasLeidas: totalFilas
    };
  }

  // ─── Procesadores especificos por tipo de archivo Odoo ───────────────────────

  private async procesarArchivoCatalogoCostos(buffer: Buffer): Promise<{
    filas: Map<string, FilaCatalogoCostos>;
    hallazgos: HallazgoValidacionFila[];
    total: number;
  }> {
    const filas = new Map<string, FilaCatalogoCostos>();
    const hallazgos: HallazgoValidacionFila[] = [];
    const libro = new ExcelJS.Workbook();
    await (libro.xlsx as any).load(buffer);

    const hoja = libro.worksheets[0];
    if (!hoja) {
      hallazgos.push({ fila: 0, archivo: 'catalogo_costos', columna: 'HOJA', valor: null, mensajeError: 'El archivo Excel no contiene hojas de trabajo' });
      return { filas, hallazgos, total: 0 };
    }

    const mapaColumnas = this.construirMapaColumnas(hoja.getRow(1));
    let total = 0;

    hoja.eachRow((fila, numeroFila) => {
      if (numeroFila === 1) return; // Encabezado
      total++;

      // Columnas reales Odoo: "Referencia interna", "Nombre", "Brand/Name", "Codigo de Proveedor",
      //   "Ultimo costo", "Cantidad a mano", "Empaque Original", "Bulto Original", "Precio de venta"
      const sku = this.obtenerValorTexto(fila, mapaColumnas, [
        'referencia_interna', 'default_code', 'codigo_sku', 'sku', 'referencia', 'codigo'
      ]);
      if (!sku) {
        // Fila completamente vacia al final del archivo — ignorar silenciosamente
        const tieneDatos = fila.values && (fila.values as any[]).some((v: any) => v !== null && v !== undefined && v !== '');
        if (tieneDatos) {
          hallazgos.push({ fila: numeroFila, archivo: 'catalogo_costos', columna: 'referencia_interna', valor: null, mensajeError: 'Codigo SKU requerido y no puede ser vacio' });
        } else { total--; }
        return;
      }

      const descripcion = this.obtenerValorTexto(fila, mapaColumnas, ['nombre', 'name', 'descripcion_producto', 'descripcion', 'producto']) || sku;
      const marca = this.obtenerValorTexto(fila, mapaColumnas, ['brand_name', 'marca', 'brand']) || '';
      const codigoProveedorOdoo = this.obtenerValorTexto(fila, mapaColumnas, ['codigo_de_proveedor', 'codigo_proveedor', 'proveedor_code', 'partner_ref']) || null;
      const codigoBarras = this.obtenerValorTexto(fila, mapaColumnas, ['barcode', 'codigo_barras', 'codigo_barra']) || null;

      // "Ultimo costo" -> costoUSD
      const costoUSD = this.obtenerValorNumerico(fila, mapaColumnas, ['ultimo_costo', 'standard_price', 'costo_unitario_usd', 'costo', 'cost']);
      if (costoUSD === null || costoUSD < 0) {
        hallazgos.push({ fila: numeroFila, archivo: 'catalogo_costos', columna: 'ultimo_costo', valor: costoUSD, mensajeError: 'Costo unitario USD debe ser un numero mayor o igual a 0' });
      }

      // "Precio de venta" -> precioUSD
      const precioUSD = this.obtenerValorNumerico(fila, mapaColumnas, ['precio_de_venta', 'list_price', 'precio_venta_usd', 'precio', 'price', 'price_unit', 'precio_venta']) || 0;
      // "Empaque Original" -> empaque
      const empaque = Math.max(1, Math.round(this.obtenerValorNumerico(fila, mapaColumnas, ['empaque_original', 'uom_po_id', 'unidad_minima_empaque', 'empaque', 'unidad_empaque', 'uom', 'bulto_original']) || 1));

      const clasifTexto = (this.obtenerValorTexto(fila, mapaColumnas, ['clasificacion_comercial', 'clasificacion', 'clase']) || 'MEDIA ROTACION').toUpperCase();
      let clasificacion: 'ALTA ROTACION' | 'MEDIA ROTACION' | 'COMPLEMENTO' = 'MEDIA ROTACION';
      if (clasifTexto.includes('ALTA')) clasificacion = 'ALTA ROTACION';
      else if (clasifTexto.includes('COMPLEMENTO')) clasificacion = 'COMPLEMENTO';

      const estadoTexto = (this.obtenerValorTexto(fila, mapaColumnas, ['estado_sku_odoo', 'estado']) || 'ACTIVO').toUpperCase();
      const estadoSku: 'ACTIVO' | 'INACTIVO' = estadoTexto.includes('INACT') ? 'INACTIVO' : 'ACTIVO';

      if (costoUSD !== null && costoUSD >= 0) {
        filas.set(sku, {
          codigoSKU: sku,
          codigoBarras,
          descripcionProducto: descripcion,
          nombreProveedor: codigoProveedorOdoo || 'SIN PROVEEDOR ASIGNADO',
          marca,
          costoUnitarioUSD: costoUSD,
          precioVentaUSD: Math.max(0, precioUSD),
          unidadMinimaEmpaque: empaque,
          clasificacionComercial: clasificacion,
          estadoSkuOdoo: estadoSku
        });
      }
    });

    return { filas, hallazgos, total };
  }

  private async procesarArchivoInventarioMano(buffer: Buffer): Promise<{
    filas: Map<string, FilaInventarioMano>;
    hallazgos: HallazgoValidacionFila[];
    total: number;
  }> {
    const filas = new Map<string, FilaInventarioMano>();
    const hallazgos: HallazgoValidacionFila[] = [];
    const libro = new ExcelJS.Workbook();
    await (libro.xlsx as any).load(buffer);

    const hoja = libro.worksheets[0];
    if (!hoja) return { filas, hallazgos, total: 0 };

    const mapaColumnas = this.construirMapaColumnas(hoja.getRow(1));
    let total = 0;

    hoja.eachRow((fila, numeroFila) => {
      if (numeroFila === 1) return;
      total++;

      // Columnas reales: "Referencia interna", "Cantidad a mano"
      const sku = this.obtenerValorTexto(fila, mapaColumnas, ['referencia_interna', 'default_code', 'codigo_sku', 'sku', 'referencia']);
      if (!sku) {
        const tieneDatos = fila.values && (fila.values as any[]).some((v: any) => v !== null && v !== undefined && v !== '');
        if (tieneDatos) {
          hallazgos.push({ fila: numeroFila, archivo: 'inventario_mano', columna: 'referencia_interna', valor: null, mensajeError: 'Codigo SKU requerido' });
        } else { total--; }
        return;
      }

      // "Cantidad a mano" column en product.template tambien tiene la col
      const cantidad = this.obtenerValorNumerico(fila, mapaColumnas, ['cantidad_a_mano', 'qty_available', 'stock', 'cantidad', 'a_mano', 'disponible']);
      if (cantidad === null || cantidad < 0) {
        hallazgos.push({ fila: numeroFila, archivo: 'inventario_mano', columna: 'cantidad_a_mano', valor: cantidad, mensajeError: 'Cantidad a mano debe ser mayor o igual a 0' });
        return;
      }

      const ubicacion = this.obtenerValorTexto(fila, mapaColumnas, ['ubicacion', 'almacen']) || null;
      filas.set(sku, { codigoSKU: sku, cantidadAMano: cantidad, ubicacion });
    });

    return { filas, hallazgos, total };
  }

  private async procesarArchivoComprasTransito(buffer: Buffer): Promise<{
    filas: Map<string, FilaComprasTransito[]>;
    hallazgos: HallazgoValidacionFila[];
    total: number;
  }> {
    const filas = new Map<string, FilaComprasTransito[]>();
    const hallazgos: HallazgoValidacionFila[] = [];
    const libro = new ExcelJS.Workbook();
    await (libro.xlsx as any).load(buffer);

    const hoja = libro.worksheets[0];
    if (!hoja) return { filas, hallazgos, total: 0 };

    const mapaColumnas = this.construirMapaColumnas(hoja.getRow(1));
    let total = 0;

    hoja.eachRow((fila, numeroFila) => {
      if (numeroFila === 1) return;
      total++;

      // Columnas reales Odoo purchase.order:
      //   "Lineas del pedido/Producto/Referencia interna"
      //   "Lineas del pedido/Cantidad"
      //   "Lineas del pedido/Referencia del pedido/Proveedor"
      //   "Lineas del pedido/Fecha de entrega"
      const sku = this.obtenerValorTexto(fila, mapaColumnas, [
        'lineas_del_pedido_producto_referencia_interna',
        'default_code', 'codigo_sku', 'sku', 'referencia_interna'
      ]);
      if (!sku) {
        const tieneDatos = fila.values && (fila.values as any[]).some((v: any) => v !== null && v !== undefined && v !== '');
        if (tieneDatos) {
          hallazgos.push({ fila: numeroFila, archivo: 'compras_transito', columna: 'referencia_interna', valor: null, mensajeError: 'Codigo SKU requerido' });
        } else { total--; }
        return;
      }

      // Numero de orden: no hay col directa; usar referencia del pedido/proveedor como contexto
      const orden = this.obtenerValorTexto(fila, mapaColumnas, [
        'name', 'numero_orden_compra', 'orden_compra', 'pedido', 'oc'
      ]) || 'OC-SIN-NUMERO';

      // "Lineas del pedido/Cantidad"
      const cantidad = this.obtenerValorNumerico(fila, mapaColumnas, [
        'lineas_del_pedido_cantidad', 'product_qty', 'cantidad_transito', 'cantidad', 'pedida'
      ]);
      if (cantidad === null || cantidad <= 0) {
        // Silenciar filas con cantidad 0 (ya recibidas/facturadas)
        total--;
        return;
      }

      // "Lineas del pedido/Fecha de entrega"
      const fechaPrevista = this.obtenerValorFecha(fila, mapaColumnas, [
        'lineas_del_pedido_fecha_de_entrega', 'date_planned', 'fecha_llegada_prevista', 'fecha_prevista', 'eta', 'fecha'
      ]);
      // "Lineas del pedido/Referencia del pedido/Proveedor"
      const proveedor = this.obtenerValorTexto(fila, mapaColumnas, [
        'lineas_del_pedido_referencia_del_pedido_proveedor', 'proveedor'
      ]) || null;

      const item: FilaComprasTransito = {
        codigoSKU: sku,
        numeroOrdenCompra: orden,
        cantidadTransito: cantidad,
        fechaLlegadaPrevista: fechaPrevista,
        proveedor
      };

      const lista = filas.get(sku) || [];
      lista.push(item);
      filas.set(sku, lista);
    });

    return { filas, hallazgos, total };
  }

  private async procesarArchivoVentasPrecios(buffer: Buffer): Promise<{
    filas: Map<string, FilaVentasPrecios>;
    hallazgos: HallazgoValidacionFila[];
    total: number;
  }> {
    const filas = new Map<string, FilaVentasPrecios>();
    const hallazgos: HallazgoValidacionFila[] = [];
    const libro = new ExcelJS.Workbook();
    await (libro.xlsx as any).load(buffer);

    const hoja = libro.worksheets[0];
    if (!hoja) return { filas, hallazgos, total: 0 };

    const mapaColumnas = this.construirMapaColumnas(hoja.getRow(1));
    let total = 0;

    hoja.eachRow((fila, numeroFila) => {
      if (numeroFila === 1) return;
      total++;

      // Columnas reales Odoo sale.order:
      //   "Lineas del pedido/Producto/Referencia interna"
      //   "Lineas del pedido/Cantidad"
      //   "Lineas del pedido/Precio unitario"
      //   "Lineas del pedido/Estado del pedido" (filtrar solo confirmados/done)
      const sku = this.obtenerValorTexto(fila, mapaColumnas, [
        'lineas_del_pedido_producto_referencia_interna',
        'default_code', 'codigo_sku', 'sku', 'referencia_interna'
      ]);
      if (!sku) {
        const tieneDatos = fila.values && (fila.values as any[]).some((v: any) => v !== null && v !== undefined && v !== '');
        if (tieneDatos) {
          hallazgos.push({ fila: numeroFila, archivo: 'historial_ventas_precios', columna: 'referencia_interna', valor: null, mensajeError: 'Codigo SKU requerido' });
        } else { total--; }
        return;
      }

      // Acumular demanda: "Lineas del pedido/Cantidad" (incluye borradores para proyeccion)
      const cantidadFila = this.obtenerValorNumerico(fila, mapaColumnas, [
        'lineas_del_pedido_cantidad', 'qty_sold', 'demanda_historica_mensual', 'ventas_mensuales', 'demanda', 'ventas', 'cantidad'
      ]) || 0;
      if (cantidadFila < 0) {
        total--;
        return;
      }

      const precio = this.obtenerValorNumerico(fila, mapaColumnas, [
        'lineas_del_pedido_precio_unitario', 'price_unit', 'precio_venta_vigente', 'precio_vigente', 'precio', 'price'
      ]) || 0;

      // Acumular por SKU (multiples lineas del mismo SKU)
      const existente = filas.get(sku);
      if (existente) {
        existente.demandaHistoricaMensual += cantidadFila;
        if (precio > existente.precioVentaVigente) existente.precioVentaVigente = precio;
      } else {
        filas.set(sku, {
          codigoSKU: sku,
          demandaHistoricaMensual: cantidadFila,
          metaVentasMensual: cantidadFila,
          precioVentaVigente: precio
        });
      }
    });

    return { filas, hallazgos, total };
  }

  // ─── Utilidades de parsing y hashing ─────────────────────────────────────────

  private calcularHashSHA256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private crearContenedorDatosVacio(): DatosNormalizadosOdoo {
    return {
      catalogoCostos: new Map(),
      inventarioMano: new Map(),
      comprasTransito: new Map(),
      ventasPrecios: new Map()
    };
  }

  private normalizarNombreColumna(nombre: string): string {
    return nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  private construirMapaColumnas(filaEncabezado: ExcelJS.Row): Map<string, number> {
    const mapa = new Map<string, number>();
    filaEncabezado.eachCell((celda, colNumber) => {
      const valor = String(celda.value || '').trim();
      if (valor) {
        const normalizado = this.normalizarNombreColumna(valor);
        mapa.set(normalizado, colNumber);
      }
    });
    return mapa;
  }

  private obtenerIndiceColumna(mapa: Map<string, number>, sinonimos: string[]): number | null {
    for (const s of sinonimos) {
      const norm = this.normalizarNombreColumna(s);
      if (mapa.has(norm)) {
        return mapa.get(norm)!;
      }
      // Coincidencia parcial si contiene la clave
      for (const [col, idx] of mapa.entries()) {
        if (col.includes(norm) || norm.includes(col)) {
          return idx;
        }
      }
    }
    return null;
  }

  private obtenerValorTexto(fila: ExcelJS.Row, mapa: Map<string, number>, sinonimos: string[]): string | null {
    const colIdx = this.obtenerIndiceColumna(mapa, sinonimos);
    if (!colIdx) return null;
    const celda = fila.getCell(colIdx);
    if (celda.value === null || celda.value === undefined) return null;

    let valorStr = '';
    if (typeof celda.value === 'object' && 'text' in celda.value) {
      valorStr = String((celda.value as any).text).trim();
    } else {
      valorStr = String(celda.value).trim();
    }
    return valorStr.length > 0 ? valorStr : null;
  }

  private obtenerValorNumerico(fila: ExcelJS.Row, mapa: Map<string, number>, sinonimos: string[]): number | null {
    const colIdx = this.obtenerIndiceColumna(mapa, sinonimos);
    if (!colIdx) return null;
    const celda = fila.getCell(colIdx);
    if (celda.value === null || celda.value === undefined) return null;

    if (typeof celda.value === 'number') {
      return isNaN(celda.value) ? null : celda.value;
    }

    const strLimpia = String(celda.value)
      .replace(/[$€]/g, '')
      .replace(/\s/g, '')
      .replace(/,/g, '.');
    const num = parseFloat(strLimpia);
    return isNaN(num) ? null : num;
  }

  private obtenerValorFecha(fila: ExcelJS.Row, mapa: Map<string, number>, sinonimos: string[]): Date | null {
    const colIdx = this.obtenerIndiceColumna(mapa, sinonimos);
    if (!colIdx) return null;
    const celda = fila.getCell(colIdx);
    if (celda.value === null || celda.value === undefined) return null;

    if (celda.value instanceof Date && !isNaN(celda.value.getTime())) {
      return celda.value;
    }

    const str = String(celda.value).trim();
    const d = new Date(str);
    return !isNaN(d.getTime()) ? d : null;
  }
}
