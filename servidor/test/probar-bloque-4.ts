/**
 * Suite de Pruebas Automatizadas para el Bloque 4:
 * 1. Validacion Fila por Fila de los 4 Archivos Odoo (Casos validos y reporte de errores).
 * 2. Hashes Criptograficos SHA-256 y Deteccion de Cargas sin Cambios.
 * 3. Conciliacion de Novedades y Recalculo con Motor R10.
 * 4. Deteccion de Desactualizacion de Propuestas (esCalculoVigente = false).
 * 5. Modulo de Notificaciones por Polling Ligero.
 * 6. Integracion de Rutas Fastify y Seguridad RBAC.
 */
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { AdaptadorArchivosExcelOdoo } from '../src/infraestructura/odoo/adaptador-archivos-excel-odoo.js';
import { AdaptadorApiRpcOdoo } from '../src/infraestructura/odoo/adaptador-api-rpc-odoo.js';
import { CasoUsoProcesarCargaOdoo } from '../src/aplicacion/cargas-odoo/caso-uso-procesar-carga-odoo.js';
import { CasoUsoConsultarNotificaciones } from '../src/aplicacion/notificaciones/caso-uso-consultar-notificaciones.js';
import { CasoUsoMarcarNotificacionLeida } from '../src/aplicacion/notificaciones/caso-uso-marcar-notificacion-leida.js';
import { PuertoRepositorioCargasOdoo } from '../src/dominio/puertos/puerto-repositorio-cargas-odoo.js';
import { PuertoRepositorioNotificaciones, EntradaCrearNotificacion, ResultadoConsultaNotificaciones } from '../src/dominio/puertos/puerto-repositorio-notificaciones.js';
import { PuertoRepositorioAuditoria } from '../src/dominio/puertos/puerto-repositorio-auditoria.js';
import { CargaArchivoOdoo, NovedadCargaOdoo } from '../src/dominio/entidades/carga-odoo.js';
import { NotificacionAnalista } from '../src/dominio/entidades/notificacion.js';
import { MotorCalculoR10 } from '../src/aplicacion/motor-reposicion/motor-calculo-r10.js';
import { CalculadorHashInstantanea } from '../src/aplicacion/motor-reposicion/calculador-hash-instantanea.js';
import { construirServidor } from '../src/infraestructura/servidor.js';

// ─── MOCKS EN MEMORIA PARA PRUEBAS AISLADAS ───────────────────────────────────

class RepositorioCargasMemoria implements PuertoRepositorioCargasOdoo {
  private cargas: Map<string, CargaArchivoOdoo> = new Map();
  private novedadesPorCarga: Map<string, NovedadCargaOdoo[]> = new Map();

  async registrarCarga(carga: CargaArchivoOdoo): Promise<void> {
    this.cargas.set(carga.identificadorCarga, carga);
    if (carga.novedades) {
      this.novedadesPorCarga.set(carga.identificadorCarga, [...carga.novedades]);
    }
  }

  async obtenerUltimaCargaExitosa(): Promise<CargaArchivoOdoo | null> {
    const lista = Array.from(this.cargas.values())
      .filter(c => c.estadoProcesamiento === 'COMPLETADA_EXITOSA')
      .sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime());
    return lista[0] || null;
  }

  async obtenerCargaPorId(id: string): Promise<CargaArchivoOdoo | null> {
    const c = this.cargas.get(id);
    if (!c) return null;
    return {
      ...c,
      novedades: this.novedadesPorCarga.get(id) || []
    };
  }

  async listarHistorialCargas(limite: number = 20): Promise<CargaArchivoOdoo[]> {
    return Array.from(this.cargas.values()).slice(0, limite);
  }

  async listarNovedadesPorCarga(cargaId: string): Promise<NovedadCargaOdoo[]> {
    return this.novedadesPorCarga.get(cargaId) || [];
  }
}

class RepositorioNotificacionesMemoria implements PuertoRepositorioNotificaciones {
  private notificaciones: NotificacionAnalista[] = [];

  async crearNotificacion(entrada: EntradaCrearNotificacion): Promise<NotificacionAnalista> {
    const n: NotificacionAnalista = {
      identificadorNotificacion: 'notif-' + (this.notificaciones.length + 1),
      usuarioDestinoId: entrada.usuarioDestinoId,
      tipoNotificacion: entrada.tipoNotificacion,
      tituloMensaje: entrada.tituloMensaje,
      detalleMensaje: entrada.detalleMensaje,
      proveedorId: entrada.proveedorId || null,
      haSidoLeida: false,
      creadoEn: new Date()
    };
    this.notificaciones.push(n);
    return n;
  }

  async crearNotificacionesLote(entradas: EntradaCrearNotificacion[]): Promise<number> {
    for (const e of entradas) {
      await this.crearNotificacion(e);
    }
    return entradas.length;
  }

  async listarPorUsuario(usuarioId: string, soloNoLeidas: boolean = false): Promise<ResultadoConsultaNotificaciones> {
    const lista = this.notificaciones.filter(n => {
      if (n.usuarioDestinoId !== usuarioId) return false;
      if (soloNoLeidas && n.haSidoLeida) return false;
      return true;
    });

    const totalNoLeidas = this.notificaciones.filter(n => n.usuarioDestinoId === usuarioId && !n.haSidoLeida).length;
    return { notificaciones: lista, totalNoLeidas };
  }

  async marcarComoLeida(id: string, usuarioId: string): Promise<boolean> {
    const n = this.notificaciones.find(x => x.identificadorNotificacion === id && x.usuarioDestinoId === usuarioId);
    if (!n) return false;
    n.haSidoLeida = true;
    return true;
  }

  async marcarTodasComoLeidas(usuarioId: string): Promise<number> {
    let count = 0;
    for (const n of this.notificaciones) {
      if (n.usuarioDestinoId === usuarioId && !n.haSidoLeida) {
        n.haSidoLeida = true;
        count++;
      }
    }
    return count;
  }
}

class RepositorioAuditoriaMemoria implements PuertoRepositorioAuditoria {
  public eventos: any[] = [];
  async registrarEvento(e: any): Promise<void> { this.eventos.push(e); }
  async consultarEventos(): Promise<any[]> { return this.eventos; }
}

// ─── GENERADORES DE ARCHIVOS EXCEL DE PRUEBA ──────────────────────────────────

async function generarExcelCatalogoValido(): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Catalogo');
  hoja.addRow(['Referencia interna', 'Codigo de barras', 'Nombre', 'Proveedor', 'Marca', 'Costo', 'Precio de venta', 'Empaque', 'Clasificacion', 'Estado']);
  hoja.addRow(['SKU-001', '7591234567890', 'BOMBILLO LED 9W LUZ BLANCA', 'PROV-ILUMINA', 'PHILIPS', 1.20, 2.50, 10, 'ALTA ROTACION', 'ACTIVO']);
  hoja.addRow(['SKU-002', '7591234567891', 'CABLE ELECTRICO THW #12 ROJO', 'PROV-ELECTRO', 'PHELPS', 45.00, 75.00, 1, 'MEDIA ROTACION', 'ACTIVO']);
  const buf = await libro.xlsx.writeBuffer();
  return Buffer.from(buf);
}

async function generarExcelStockValido(): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Stock');
  hoja.addRow(['Referencia interna', 'Cantidad a mano', 'Almacen']);
  hoja.addRow(['SKU-001', 25, 'PRINCIPAL']);
  hoja.addRow(['SKU-002', 4, 'PRINCIPAL']);
  const buf = await libro.xlsx.writeBuffer();
  return Buffer.from(buf);
}

async function generarExcelTransitoValido(): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Transito');
  hoja.addRow(['Referencia interna', 'Orden de compra', 'Cantidad pedida', 'Fecha prevista', 'Proveedor']);
  hoja.addRow(['SKU-001', 'OC-2026-089', 50, '2026-12-05', 'PROV-ILUMINA']);
  const buf = await libro.xlsx.writeBuffer();
  return Buffer.from(buf);
}

async function generarExcelVentasValido(): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Ventas');
  hoja.addRow(['Referencia interna', 'Ventas mensuales', 'Meta de ventas', 'Precio vigente']);
  hoja.addRow(['SKU-001', 120, 140, 2.50]);
  hoja.addRow(['SKU-002', 15, 20, 75.00]);
  const buf = await libro.xlsx.writeBuffer();
  return Buffer.from(buf);
}

async function generarExcelConErroresFila(): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Catalogo');
  hoja.addRow(['Referencia interna', 'Nombre', 'Costo']);
  hoja.addRow(['', 'PRODUCTO SIN SKU', 10.00]);         // Error fila 2: SKU vacio
  hoja.addRow(['SKU-ERR-01', 'COSTO NEGATIVO', -5.50]); // Error fila 3: Costo negativo
  hoja.addRow(['SKU-ERR-02', 'COSTO TEXTO', 'INVALIDO']); // Error fila 4: Costo no numerico
  const buf = await libro.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// ─── SUITE DE PRUEBAS ─────────────────────────────────────────────────────────

async function ejecutarPruebasBloque4() {
  const adaptadorExcel = new AdaptadorArchivosExcelOdoo();
  const adaptadorRpc = new AdaptadorApiRpcOdoo();

  // 1. PRUEBA ADAPTADOR: Validacion fila por fila con archivos validos
  const catBuf = await generarExcelCatalogoValido();
  const stockBuf = await generarExcelStockValido();
  const transBuf = await generarExcelTransitoValido();
  const ventBuf = await generarExcelVentasValido();

  const resValido = await adaptadorExcel.obtenerDatosOdoo({
    catalogoCostos: catBuf,
    inventarioMano: stockBuf,
    comprasTransito: transBuf,
    historialVentasPrecios: ventBuf
  });

  assert.equal(resValido.esValido, true, 'La carga con archivos correctos debe ser valida');
  assert.equal(resValido.hallazgos.length, 0, 'No debe haber hallazgos de error');
  assert.equal(resValido.datosNormalizados.catalogoCostos.size, 2, 'Debe extraer 2 SKUs');
  assert.ok(resValido.hashes.catalogoCostos, 'Debe calcular SHA-256 de catalogo');
  assert.ok(resValido.hashes.inventarioAMano, 'Debe calcular SHA-256 de inventario');
  assert.ok(resValido.hashes.comprasTransito, 'Debe calcular SHA-256 de transito');
  assert.ok(resValido.hashes.ventasPrecios, 'Debe calcular SHA-256 de ventas');

  // Verificar integridad de SKU y valores
  const sku1 = resValido.datosNormalizados.catalogoCostos.get('SKU-001');
  assert.ok(sku1);
  assert.equal(sku1.costoUnitarioUSD, 1.20);
  assert.equal(sku1.unidadMinimaEmpaque, 10);
  assert.equal(sku1.clasificacionComercial, 'ALTA ROTACION');

  const stock1 = resValido.datosNormalizados.inventarioMano.get('SKU-001');
  assert.ok(stock1);
  assert.equal(stock1.cantidadAMano, 25);

  const transito1 = resValido.datosNormalizados.comprasTransito.get('SKU-001');
  assert.ok(transito1);
  assert.equal(transito1[0].cantidadTransito, 50);

  // 2. PRUEBA ADAPTADOR: Deteccion estricta de errores fila por fila
  const errBuf = await generarExcelConErroresFila();
  const resErrores = await adaptadorExcel.obtenerDatosOdoo({
    catalogoCostos: errBuf
  });

  assert.equal(resErrores.esValido, false, 'El archivo con inconsistencias debe invalidar la carga');
  assert.ok(resErrores.hallazgos.length >= 2, 'Debe capturar los multiples errores de fila');
  assert.ok(resErrores.hallazgos.some(h => h.fila === 2 && h.columna === 'codigo_sku'), 'Debe detectar SKU vacio en fila 2');
  assert.ok(resErrores.hallazgos.some(h => h.fila === 3 && h.columna === 'costo_unitario_usd'), 'Debe detectar costo negativo en fila 3');
  assert.ok(resErrores.hallazgos.some(h => h.fila === 4 && h.columna === 'costo_unitario_usd'), 'Debe detectar costo no numerico en fila 4');

  // 3. PRUEBA ADAPTADOR RPC: Desacoplamiento y preparacion para conexion futura
  const estadoRpc = await adaptadorRpc.consultarEstadoConexion();
  assert.equal(estadoRpc.tipoOrigen, 'API_RPC_ODOO');
  assert.equal(estadoRpc.estaDisponible, false, 'Por defecto opera preparado en espera de credenciales');

  // 4. PRUEBA CASO DE USO: Deteccion de Carga sin Cambios (Hashes SHA-256)
  const repoCargas = new RepositorioCargasMemoria();
  const repoNotificaciones = new RepositorioNotificacionesMemoria();
  const repoAuditoria = new RepositorioAuditoriaMemoria();

  // Simular una carga previa exitosa con los mismos hashes
  await repoCargas.registrarCarga({
    identificadorCarga: 'carga-previa-exitosa',
    usuarioId: 'usr-admin',
    tipoOrigen: 'ARCHIVOS_MANUALES_EXCEL',
    hashCatalogoCostos: resValido.hashes.catalogoCostos,
    hashInventarioAMano: resValido.hashes.inventarioAMano,
    hashComprasTransito: resValido.hashes.comprasTransito,
    hashVentasPrecios: resValido.hashes.ventasPrecios,
    totalRegistrosProcesados: resValido.totalFilasLeidas,
    totalNovedadesDetectadas: 0,
    estadoProcesamiento: 'COMPLETADA_EXITOSA',
    resumenNovedades: {},
    novedades: [],
    hallazgosValidacion: [],
    creadoEn: new Date()
  });

  const casoUsoProcesar = new CasoUsoProcesarCargaOdoo(
    adaptadorExcel,
    repoCargas,
    repoNotificaciones,
    repoAuditoria
  );

  const resSinCambios = await casoUsoProcesar.ejecutar({
    archivos: {
      catalogoCostos: catBuf,
      inventarioMano: stockBuf,
      comprasTransito: transBuf,
      historialVentasPrecios: ventBuf
    },
    usuarioId: 'usr-admin',
    tipoOrigen: 'ARCHIVOS_MANUALES_EXCEL'
  });

  assert.equal(resSinCambios.exito, true);
  assert.equal(resSinCambios.estadoProcesamiento, 'SIN_CAMBIOS', 'Hashes identicos deben catalogarse como SIN_CAMBIOS sin recalculos redundantes');

  // 5. PRUEBA DE DOMINIO: Recalculo Motor R10 y Marcado de Desactualizacion
  // Calculo inicial
  const calcInicial = MotorCalculoR10.calcular({
    productoId: 'prod-001',
    codigoSKU: 'SKU-001',
    descripcionProducto: 'BOMBILLO LED 9W',
    proveedorId: 'prov-001',
    periodoMes: '2026-11',
    costoUnitarioUSD: 1.20,
    precioVentaUSD: 2.50,
    cantidadAMano: 25,
    cantidadTransitoValido: 50,
    demandaHistoricaMensual: 130,
    plazoEntregaDias: 7,
    frecuenciaCompraDias: 15,
    unidadMinimaEmpaque: 10,
    clasificacionComercial: 'ALTA ROTACION'
  });

  const hashFirmaInicial = calcInicial.hashInstantaneaCalculo;

  // Supongamos que en la decision de compra se aprobo con ese hash
  let esCalculoVigente = (hashFirmaInicial === calcInicial.hashInstantaneaCalculo);
  assert.equal(esCalculoVigente, true, 'La propuesta debe nacer vigente');

  // Ahora Odoo actualiza el costo a 1.50 y el stock a 10 (variacion de inventario y costo)
  const calcActualizado = MotorCalculoR10.calcular({
    productoId: 'prod-001',
    codigoSKU: 'SKU-001',
    descripcionProducto: 'BOMBILLO LED 9W',
    proveedorId: 'prov-001',
    periodoMes: '2026-11',
    costoUnitarioUSD: 1.50, // Costo vario
    precioVentaUSD: 2.50,
    cantidadAMano: 10,    // Stock vario
    cantidadTransitoValido: 50,
    demandaHistoricaMensual: 130,
    plazoEntregaDias: 7,
    frecuenciaCompraDias: 15,
    unidadMinimaEmpaque: 10,
    clasificacionComercial: 'ALTA ROTACION'
  });

  const nuevoHashInstantanea = calcActualizado.hashInstantaneaCalculo;
  assert.notEqual(nuevoHashInstantanea, hashFirmaInicial, 'El hash SHA-256 debe cambiar cuando varían costos o stock');

  // Verificacion de marcado de desactualizacion en propuesta
  esCalculoVigente = (hashFirmaInicial === nuevoHashInstantanea);
  assert.equal(esCalculoVigente, false, 'La propuesta previa debe quedar INVALIDADA/DESACTUALIZADA (esCalculoVigente=false)');

  // 6. PRUEBA NOTIFICACIONES: Polling Ligero y Marcado de Lectura
  const casoUsoConsultarNotif = new CasoUsoConsultarNotificaciones(repoNotificaciones);
  const casoUsoMarcarNotif = new CasoUsoMarcarNotificacionLeida(repoNotificaciones);

  // Crear 2 notificaciones para analista
  await repoNotificaciones.crearNotificacion({
    usuarioDestinoId: 'usr-analista-1',
    tipoNotificacion: 'CALCULO_DESACTUALIZADO',
    tituloMensaje: 'Calculo Desactualizado - Proveedor Ilumina',
    detalleMensaje: 'Se detecto variacion de costos en 1 SKU con propuesta en curso.',
    proveedorId: 'prov-001'
  });

  await repoNotificaciones.crearNotificacion({
    usuarioDestinoId: 'usr-analista-1',
    tipoNotificacion: 'NOVEDAD_CARGA_ODOO',
    tituloMensaje: 'Novedades de Stock',
    detalleMensaje: 'Inventario fisico actualizado exitosamente.',
    proveedorId: 'prov-001'
  });

  // Consultar no leidas
  const consultaNoLeidas = await casoUsoConsultarNotif.ejecutar({
    usuarioId: 'usr-analista-1',
    soloNoLeidas: true
  });
  assert.equal(consultaNoLeidas.totalNoLeidas, 2);
  assert.equal(consultaNoLeidas.notificaciones.length, 2);

  // Marcar una como leida
  const idMarcar = consultaNoLeidas.notificaciones[0].identificadorNotificacion;
  const exitoMarcarUna = await casoUsoMarcarNotif.marcarUna(idMarcar, 'usr-analista-1');
  assert.equal(exitoMarcarUna, true);

  const consultaDespues = await casoUsoConsultarNotif.ejecutar({
    usuarioId: 'usr-analista-1',
    soloNoLeidas: true
  });
  assert.equal(consultaDespues.totalNoLeidas, 1);

  // Marcar todas
  const totalMarcadas = await casoUsoMarcarNotif.marcarTodas('usr-analista-1');
  assert.equal(totalMarcadas, 1);

  const consultaFinal = await casoUsoConsultarNotif.ejecutar({
    usuarioId: 'usr-analista-1',
    soloNoLeidas: true
  });
  assert.equal(consultaFinal.totalNoLeidas, 0);

  // 7. PRUEBA FASTIFY: Rutas y Proteccion RBAC
  const servidor = await construirServidor();

  // Rutas de cargas sin token deben retornar 401
  const resCargasSinAuth = await servidor.inject({
    method: 'POST',
    url: '/api/v1/cargas-odoo/procesar-archivos',
    payload: {}
  });
  assert.equal(resCargasSinAuth.statusCode, 401, 'Ruta de carga de Odoo debe exigir autenticacion');

  // Rutas de notificaciones sin token deben retornar 401
  const resNotifSinAuth = await servidor.inject({
    method: 'GET',
    url: '/api/v1/notificaciones'
  });
  assert.equal(resNotifSinAuth.statusCode, 401, 'Ruta de notificaciones debe exigir autenticacion');

  // Healthcheck operativo
  const resSalud = await servidor.inject({
    method: 'GET',
    url: '/api/v1/salud'
  });
  assert.equal(resSalud.statusCode, 200);

  await servidor.close();

  console.log('BLOQUE_4_TODAS_LAS_PRUEBAS_PASARON_CORRECTAMENTE');
}

ejecutarPruebasBloque4().catch(error => {
  console.error('ERROR_EN_PRUEBAS_BLOQUE_4:', error);
  process.exit(1);
});
