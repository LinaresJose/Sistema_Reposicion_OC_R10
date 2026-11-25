/**
 * Suite de Pruebas Automatizadas para el Bloque 3:
 * 1. Generador de Documentos Stateless (Propuesta PDF sin membrete, PNG WhatsApp, Orden Oficial con membrete/logo/contacto).
 * 2. Maquina de Estados de la Orden de Compra y Aprobacion Verbal con Respaldo Obligatorio.
 * 3. Correlativos Atomicos por Razon Social y Anio (OC-MMC-AAAA-NNNN / OC-LYNOX-AAAA-NNNN).
 * 4. Exportador Excel de Vista de Control R10.
 * 5. Integracion de Rutas Fastify y Seguridad RBAC.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { GeneradorDocumentosStateless } from '../src/aplicacion/ordenes-compra/generador-documentos-stateless.js';
import { ExportadorVistaControlR10, FilaReporteControlR10 } from '../src/aplicacion/reportes/exportador-vista-control-r10.js';
import { CasoUsoCrearBorradorOrden } from '../src/aplicacion/ordenes-compra/caso-uso-crear-borrador-orden.js';
import { CasoUsoPasarARevisionWhatsapp } from '../src/aplicacion/ordenes-compra/caso-uso-pasar-a-revision-whatsapp.js';
import { CasoUsoRegistrarAprobacion } from '../src/aplicacion/ordenes-compra/caso-uso-registrar-aprobacion.js';
import { CasoUsoEmitirOrdenOficial } from '../src/aplicacion/ordenes-compra/caso-uso-emitir-orden-oficial.js';
import { OrdenCompra, RenglonOrdenCompra, EstadoOrdenCompra, CanalAprobacion } from '../src/dominio/entidades/orden-compra.js';
import { PuertoRepositorioOrdenes, DatosCrearOrden } from '../src/dominio/puertos/puerto-repositorio-ordenes.js';
import { PuertoRepositorioPropuestas } from '../src/dominio/puertos/puerto-repositorio-propuestas.js';
import { PuertoRepositorioProveedores } from '../src/dominio/puertos/puerto-repositorio-proveedores.js';
import { PuertoRepositorioAuditoria } from '../src/dominio/puertos/puerto-repositorio-auditoria.js';
import { ROLES_SISTEMA } from '../src/configuracion/constantes-negocio.js';
import { construirServidor } from '../src/infraestructura/servidor.js';

// ─── MOCKS EN MEMORIA ─────────────────────────────────────────────────────────

class RepositorioOrdenesMemoria implements PuertoRepositorioOrdenes {
  private ordenes: Map<string, OrdenCompra> = new Map();
  private correlativosPorEmpresa: Map<string, number> = new Map();

  async crearOrdenBorrador(datos: DatosCrearOrden): Promise<OrdenCompra> {
    const orden: OrdenCompra = {
      identificadorOrden: datos.identificadorOrden,
      proveedorId: datos.proveedorId,
      nombreProveedor: 'PROVEEDOR FERRETERO CENTRAL, C.A.',
      registroFiscalProveedor: 'J-12345678-9',
      condicionPago: datos.condicionPago,
      tipoDocumentoLegal: datos.tipoDocumentoLegal,
      plazoEntregaDias: datos.plazoEntregaDias,
      frecuenciaCompraDias: datos.frecuenciaCompraDias,
      analistaCreadoraId: datos.analistaCreadoraId,
      nombreAnalistaCreadora: 'Maria Gomez',
      telefonoAnalistaCreadora: '+58 412 1234567',
      empresaEmisoraId: null,
      codigoEmpresaEmisora: null,
      nombreEmpresaEmisora: null,
      registroFiscalEmpresa: null,
      direccionFiscalEmpresa: null,
      logoBase64Empresa: null,
      textoFooterEmpresa: null,
      numeroCorrelativoOficial: null,
      estadoOrden: 'BORRADOR',
      canalAprobacion: null,
      notaRespalodoAprobacion: null,
      aprobadoPorId: null,
      aprobadoEn: null,
      emitidoEn: null,
      totalRenglones: datos.renglones.length,
      totalInversionUSD: datos.renglones.reduce((acc, r) => acc + r.subtotalUSD, 0),
      renglones: datos.renglones.map(r => ({
        ...r,
        ordenCompraId: datos.identificadorOrden,
        creadoEn: new Date()
      })),
      creadoEn: new Date(),
      actualizadoEn: new Date()
    };
    this.ordenes.set(datos.identificadorOrden, orden);
    return orden;
  }

  async obtenerOrdenPorId(id: string): Promise<OrdenCompra | null> {
    return this.ordenes.get(id) || null;
  }

  async listarOrdenes(): Promise<any[]> {
    return Array.from(this.ordenes.values());
  }

  async pasarARevisionWhatsapp(id: string): Promise<OrdenCompra> {
    const o = this.ordenes.get(id)!;
    o.estadoOrden = 'EN_REVISION_WHATSAPP';
    o.actualizadoEn = new Date();
    return o;
  }

  async devolverABorrador(id: string): Promise<OrdenCompra> {
    const o = this.ordenes.get(id)!;
    o.estadoOrden = 'BORRADOR';
    o.actualizadoEn = new Date();
    return o;
  }

  async registrarAprobacion(id: string, datos: any): Promise<OrdenCompra> {
    const o = this.ordenes.get(id)!;
    o.estadoOrden = 'APROBADA_PARA_EMISION';
    o.canalAprobacion = datos.canalAprobacion;
    o.notaRespalodoAprobacion = datos.notaRespalodoAprobacion;
    o.aprobadoPorId = datos.aprobadoPorId;
    o.aprobadoEn = new Date();
    o.actualizadoEn = new Date();
    return o;
  }

  async emitirOrdenOficial(id: string, empresaEmisoraId: string, emisorId: string): Promise<OrdenCompra> {
    const o = this.ordenes.get(id)!;
    const esMMC = empresaEmisoraId === 'empresa-mmc-id';
    const codigo = esMMC ? 'MMC' : 'LYNOX';
    const anio = 2026;

    const clave = `${codigo}-${anio}`;
    const seq = (this.correlativosPorEmpresa.get(clave) || 0) + 1;
    this.correlativosPorEmpresa.set(clave, seq);

    const correlativo = `OC-${codigo}-${anio}-${String(seq).padStart(4, '0')}`;

    o.estadoOrden = 'OC_EMITIDA';
    o.empresaEmisoraId = empresaEmisoraId;
    o.codigoEmpresaEmisora = codigo;
    o.nombreEmpresaEmisora = esMMC ? 'MULTIMARCAS DEL CENTRO, C.A.' : 'GRUPO FERRETERO LYNOX, C.A.';
    o.registroFiscalEmpresa = esMMC ? 'J-50330258-5' : 'J-50053430-2';
    o.direccionFiscalEmpresa = esMMC
      ? 'AV PRINCIPAL LOCAL NRO L-17 URB PARQUE COMERCIO CIUDAD INDUSTRIAL CASTILLITO VALENCIA CARABOBO ZONA POSTAL 2006'
      : 'CALLE 6TA TRANSVERSAL, AVENIDA 83 NORTE, N° N-J-1 LOCAL GALPON NRO 2 ZONA INDUSTRIAL CARABOBO VALENCIA CARABOBO ZONA POSTAL 2003';
    o.numeroCorrelativoOficial = correlativo;
    o.emitidoEn = new Date();
    o.actualizadoEn = new Date();
    return o;
  }

  async obtenerProximoCorrelativo(codigo: string, anio: number): Promise<number> {
    return (this.correlativosPorEmpresa.get(`${codigo}-${anio}`) || 0) + 1;
  }
}

class RepositorioPropuestasMemoria implements PuertoRepositorioPropuestas {
  async obtenerPropuestaPorProveedor(proveedorId: string): Promise<any> {
    return {
      proveedorId,
      nombreProveedor: 'PROVEEDOR FERRETERO CENTRAL, C.A.',
      registroFiscal: 'J-12345678-9',
      categoriaCompradora: 'NACIONAL_1',
      plazoEntregaDias: 7,
      frecuenciaCompraDias: 15,
      diasCredito: 30,
      descuentoComercial: '5%',
      formaPago: 'CREDITO',
      tipoDocumento: 'FACTURA',
      analistaAsignadaId: 'usr-analista-1',
      nombreAnalistaAsignada: 'Maria Gomez',
      totalSkus: 2,
      totalSkusAprobados: 2,
      totalInversionSugeridaUSD: 1500,
      totalInversionAprobadaUSD: 1650,
      renglones: [
        {
          identificadorDecision: 'dec-1',
          identificadorCalculo: 'calc-1',
          identificadorProducto: 'prod-1',
          codigoSKU: 'HERR-001',
          descripcionProducto: 'MARTILLO DE BOLA 16 OZ MANGO FIBRA',
          marca: 'STANLEY',
          costoUnitarioUSD: 5.50,
          precioVentaUSD: 9.00,
          margenPorcentual: 38.89,
          unidadMinimaEmpaque: 6,
          cantidadAMano: 12,
          cantidadTransito: 0,
          inventarioEfectivo: 12,
          demandaOperativaMensual: 45,
          diasCoberturaActual: 8,
          coberturaObjetivoDias: 30,
          umbralCompraDias: 15,
          cantidadSugeridaMotor: 36,
          inversionSugeridaUSD: 198.00,
          cantidadAjusteManual: 42,
          cantidadFinalAprobada: 42,
          inversionFinalUSD: 231.00,
          justificacionAjuste: 'Aumento por temporada alta de construccion',
          estadoDecision: 'APROBADO',
          diagnosticoUrgencia: 'URGENTE',
          esAptoParaCompra: true,
          hashCalculoVigente: 'hash1',
          hashFirmaAprobada: 'hash1',
          esCalculoVigente: true,
          numeroVersion: 1
        },
        {
          identificadorDecision: 'dec-2',
          identificadorCalculo: 'calc-2',
          identificadorProducto: 'prod-2',
          codigoSKU: 'ELEC-002',
          descripcionProducto: 'TALADRO PERCUTOR 1/2 PULGADA 650W',
          marca: 'DEWALT',
          costoUnitarioUSD: 45.00,
          precioVentaUSD: 75.00,
          margenPorcentual: 40.0,
          unidadMinimaEmpaque: 2,
          cantidadAMano: 4,
          cantidadTransito: 0,
          inventarioEfectivo: 4,
          demandaOperativaMensual: 18,
          diasCoberturaActual: 6.7,
          coberturaObjetivoDias: 30,
          umbralCompraDias: 15,
          cantidadSugeridaMotor: 16,
          inversionSugeridaUSD: 720.00,
          cantidadAjusteManual: null,
          cantidadFinalAprobada: 16,
          inversionFinalUSD: 720.00,
          justificacionAjuste: null,
          estadoDecision: 'APROBADO',
          diagnosticoUrgencia: 'COMPRAR AHORA',
          esAptoParaCompra: true,
          hashCalculoVigente: 'hash2',
          hashFirmaAprobada: 'hash2',
          esCalculoVigente: true,
          numeroVersion: 1
        }
      ]
    };
  }

  async buscarDecisionPorId(): Promise<any> { return null; }
  async actualizarDecisionSKU(): Promise<any> { return null; }
}

class RepositorioProveedoresMemoria implements Partial<PuertoRepositorioProveedores> {
  public revisionWhatsApp = false;
  async actualizarEstadoRevisionWhatsApp(_id: string, enRevision: boolean): Promise<void> {
    this.revisionWhatsApp = enRevision;
  }
}

class RepositorioAuditoriaMemoria implements PuertoRepositorioAuditoria {
  public eventos: any[] = [];
  async registrarEvento(e: any): Promise<void> {
    this.eventos.push(e);
  }
  async consultarEventos(): Promise<any[]> {
    return this.eventos;
  }
}

// ─── EJECUCION DE PRUEBAS ─────────────────────────────────────────────────────

async function ejecutarPruebasBloque3() {
  const repoOrdenes = new RepositorioOrdenesMemoria();
  const repoPropuestas = new RepositorioPropuestasMemoria();
  const repoProveedores = new RepositorioProveedoresMemoria() as any;
  const repoAuditoria = new RepositorioAuditoriaMemoria();

  // Leer logos reales de recursos
  const rutaLogoMMC = path.resolve(process.cwd(), 'recursos/logos/logo-mmc-base64.txt');
  const rutaLogoLynox = path.resolve(process.cwd(), 'recursos/logos/logo-lynox-base64.txt');
  const logoMMCBase64 = fs.existsSync(rutaLogoMMC) ? fs.readFileSync(rutaLogoMMC, 'utf-8').trim() : '';
  const logoLynoxBase64 = fs.existsSync(rutaLogoLynox) ? fs.readFileSync(rutaLogoLynox, 'utf-8').trim() : '';

  // 1. Crear Orden Borrador desde propuesta
  const casoUsoCrear = new CasoUsoCrearBorradorOrden(repoOrdenes, repoPropuestas, repoAuditoria);
  const ordenBorrador = await casoUsoCrear.ejecutar({
    proveedorId: 'prov-101',
    analistaCreadoraId: 'usr-analista-1',
    idsDecisionesAprobadas: ['dec-1', 'dec-2']
  });

  assert.equal(ordenBorrador.estadoOrden, 'BORRADOR');
  assert.equal(ordenBorrador.totalRenglones, 2);
  assert.equal(ordenBorrador.totalInversionUSD, 951.00); // 42*5.5 + 16*45 = 231 + 720 = 951
  assert.equal(ordenBorrador.empresaEmisoraId, null, 'Un borrador no debe tener empresa emisora asignada');
  assert.equal(ordenBorrador.numeroCorrelativoOficial, null, 'Un borrador no debe tener correlativo oficial');

  // 2. PRUEBA DOCUMENTAL: Generar Propuesta PDF (Regla: SIN Membrete ni Logo)
  const bytesPropuestaPDF = await GeneradorDocumentosStateless.generarPropuestaPDF(ordenBorrador);
  assert.ok(bytesPropuestaPDF.length > 1000, 'El PDF de propuesta debe generarse');
  const pdfPropuestaCabecera = Buffer.from(bytesPropuestaPDF.slice(0, 5)).toString();
  assert.equal(pdfPropuestaCabecera, '%PDF-', 'Debe ser un documento PDF valido');

  const docPropuestaCargado = await PDFDocument.load(bytesPropuestaPDF);
  assert.equal(docPropuestaCargado.getTitle(), 'PROPUESTA DE REPOSICION Y COMPRA');
  assert.ok(docPropuestaCargado.getSubject()?.includes('PROVEEDOR FERRETERO CENTRAL'), 'Debe incluir nombre de proveedor');
  assert.ok(docPropuestaCargado.getAuthor()?.includes('Maria Gomez'), 'Debe incluir analista');
  assert.ok(docPropuestaCargado.getKeywords()?.includes('PROPUESTA_PRELIMINAR'), 'Debe identificarse como propuesta preliminar');
  assert.ok(!docPropuestaCargado.getKeywords()?.includes('MMC'), 'Propuesta preliminar NO debe incluir razon social MMC');
  assert.ok(!docPropuestaCargado.getKeywords()?.includes('LYNOX'), 'Propuesta preliminar NO debe incluir razon social LYNOX');
  assert.ok(docPropuestaCargado.getPageCount() >= 1);

  // 3. PRUEBA DOCUMENTAL: Generar Propuesta PNG para WhatsApp
  const bufferPropuestaPNG = await GeneradorDocumentosStateless.generarPropuestaPNG(ordenBorrador);
  assert.ok(bufferPropuestaPNG.length > 1000, 'El PNG de propuesta para WhatsApp debe generarse');
  // Firma magica de archivo PNG: 89 50 4E 47 0D 0A 1A 0A
  assert.equal(bufferPropuestaPNG[0], 0x89);
  assert.equal(bufferPropuestaPNG[1], 0x50);
  assert.equal(bufferPropuestaPNG[2], 0x4E);
  assert.equal(bufferPropuestaPNG[3], 0x47);

  // 4. Pasar a Revision WhatsApp
  const casoUsoRevision = new CasoUsoPasarARevisionWhatsapp(repoOrdenes, repoProveedores, repoAuditoria);
  const ordenEnRevision = await casoUsoRevision.ejecutar(ordenBorrador.identificadorOrden, 'usr-analista-1');
  assert.equal(ordenEnRevision.estadoOrden, 'EN_REVISION_WHATSAPP');
  assert.equal(repoProveedores.revisionWhatsApp, true, 'Debe suspenderse expiracion por inactividad');

  // 5. Validacion de Aprobacion por WhatsApp (Nota Obligatoria)
  const casoUsoAprobacion = new CasoUsoRegistrarAprobacion(repoOrdenes, repoAuditoria);

  // Intento sin nota o con nota corta debe fallar
  await assert.rejects(
    async () => {
      await casoUsoAprobacion.ejecutar({
        identificadorOrden: ordenBorrador.identificadorOrden,
        usuarioAprobadorId: 'usr-gerente-1',
        rolUsuario: ROLES_SISTEMA.GERENTE_COMPRAS,
        canalAprobacion: 'WHATSAPP',
        notaRespalodoAprobacion: 'ok' // Menos de 10 caracteres
      });
    },
    /NOTA_RESPALDO_WHATSAPP_OBLIGATORIA/,
    'Debe rechazar aprobacion por WhatsApp sin nota de respaldo descriptiva'
  );

  // Aprobacion valida con nota
  const ordenAprobada = await casoUsoAprobacion.ejecutar({
    identificadorOrden: ordenBorrador.identificadorOrden,
    usuarioAprobadorId: 'usr-gerente-1',
    rolUsuario: ROLES_SISTEMA.GERENTE_COMPRAS,
    canalAprobacion: 'WHATSAPP',
    notaRespalodoAprobacion: 'Aprobado por Gerente de Compras via nota de voz WhatsApp a las 11:30 AM'
  });
  assert.equal(ordenAprobada.estadoOrden, 'APROBADA_PARA_EMISION');
  assert.equal(ordenAprobada.canalAprobacion, 'WHATSAPP');

  // 6. Emitir Orden Oficial con Correlativo Atomico
  const casoUsoEmitir = new CasoUsoEmitirOrdenOficial(repoOrdenes, repoAuditoria);

  // Emision para MMC
  const ordenEmitidaMMC = await casoUsoEmitir.ejecutar({
    identificadorOrden: ordenBorrador.identificadorOrden,
    usuarioEmisorId: 'usr-gerente-1',
    rolUsuario: ROLES_SISTEMA.GERENTE_COMPRAS,
    empresaEmisoraId: 'empresa-mmc-id'
  });
  ordenEmitidaMMC.logoBase64Empresa = logoMMCBase64;

  assert.equal(ordenEmitidaMMC.estadoOrden, 'OC_EMITIDA');
  assert.equal(ordenEmitidaMMC.codigoEmpresaEmisora, 'MMC');
  assert.equal(ordenEmitidaMMC.numeroCorrelativoOficial, 'OC-MMC-2026-0001');

  // Emision de una segunda orden para probar correlativo incremental e independiente para LYNOX
  const orden2 = await casoUsoCrear.ejecutar({
    proveedorId: 'prov-101',
    analistaCreadoraId: 'usr-analista-1',
    idsDecisionesAprobadas: ['dec-1']
  });
  await casoUsoRevision.ejecutar(orden2.identificadorOrden, 'usr-analista-1');
  await casoUsoAprobacion.ejecutar({
    identificadorOrden: orden2.identificadorOrden,
    usuarioAprobadorId: 'usr-admin-1',
    rolUsuario: ROLES_SISTEMA.ADMINISTRADOR_SISTEMA,
    canalAprobacion: 'SISTEMA'
  });
  const ordenEmitidaLynox = await casoUsoEmitir.ejecutar({
    identificadorOrden: orden2.identificadorOrden,
    usuarioEmisorId: 'usr-admin-1',
    rolUsuario: ROLES_SISTEMA.ADMINISTRADOR_SISTEMA,
    empresaEmisoraId: 'empresa-lynox-id'
  });
  ordenEmitidaLynox.logoBase64Empresa = logoLynoxBase64;

  assert.equal(ordenEmitidaLynox.codigoEmpresaEmisora, 'LYNOX');
  assert.equal(ordenEmitidaLynox.numeroCorrelativoOficial, 'OC-LYNOX-2026-0001', 'LYNOX debe iniciar su propia secuencia 0001');

  // 7. PRUEBA DOCUMENTAL: Generar PDF Oficial Emitido (Regla: SÍ lleva Membrete, Logo, RIF, Direccion, Correlativo y Contacto)
  const bytesOficialMMC = await GeneradorDocumentosStateless.generarOrdenOficialPDF(ordenEmitidaMMC);
  assert.ok(bytesOficialMMC.length > 1000, 'El PDF oficial debe generarse');
  const docMMC = await PDFDocument.load(bytesOficialMMC);
  assert.ok(docMMC.getTitle()?.includes('OC-MMC-2026-0001'), 'Debe incluir numero correlativo oficial');
  assert.ok(docMMC.getSubject()?.includes('MULTIMARCAS DEL CENTRO'), 'Debe incluir razon social oficial de MMC');
  assert.ok(docMMC.getSubject()?.includes('J-50330258-5'), 'Debe incluir RIF oficial de MMC');
  assert.ok(docMMC.getAuthor()?.includes('+58 412 1234567'), 'Debe incluir telefono_contacto de la analista');
  assert.ok(docMMC.getKeywords()?.includes('OC-MMC-2026-0001'));
  assert.ok(docMMC.getKeywords()?.includes('MMC'));
  assert.ok(docMMC.getPageCount() >= 1);

  const bytesOficialLynox = await GeneradorDocumentosStateless.generarOrdenOficialPDF(ordenEmitidaLynox);
  assert.ok(bytesOficialLynox.length > 1000, 'El PDF oficial de LYNOX debe generarse');
  const docLynox = await PDFDocument.load(bytesOficialLynox);
  assert.ok(docLynox.getTitle()?.includes('OC-LYNOX-2026-0001'), 'Debe incluir correlativo oficial de LYNOX');
  assert.ok(docLynox.getSubject()?.includes('GRUPO FERRETERO LYNOX'), 'Debe incluir razon social oficial de LYNOX');
  assert.ok(docLynox.getSubject()?.includes('J-50053430-2'), 'Debe incluir RIF oficial de LYNOX');
  assert.ok(docLynox.getAuthor()?.includes('+58 412 1234567'), 'Debe incluir telefono_contacto de la analista');
  assert.ok(docLynox.getKeywords()?.includes('OC-LYNOX-2026-0001'));
  assert.ok(docLynox.getKeywords()?.includes('LYNOX'));
  assert.ok(docLynox.getPageCount() >= 1);

  // 8. PRUEBA EXPORTADOR: Vista de Control R10 a Excel (.xlsx)
  const filasReporte: FilaReporteControlR10[] = [
    {
      codigoSKU: 'HERR-001',
      descripcionProducto: 'MARTILLO DE BOLA 16 OZ',
      marca: 'STANLEY',
      nombreProveedor: 'PROVEEDOR FERRETERO CENTRAL, C.A.',
      unidadMinimaEmpaque: 6,
      costoUnitarioUSD: 5.5,
      precioVentaUSD: 9.0,
      margenPorcentual: 38.9,
      cantidadAMano: 12,
      cantidadTransito: 0,
      inventarioEfectivo: 12,
      demandaOperativaMensual: 45,
      diasCoberturaActual: 8,
      coberturaObjetivoDias: 30,
      umbralCompraDias: 15,
      cantidadSugeridaMotor: 36,
      inversionSugeridaUSD: 198.0,
      diagnosticoUrgencia: 'URGENTE',
      cantidadAjusteManual: 42,
      cantidadFinalAprobada: 42,
      inversionFinalUSD: 231.0,
      estadoDecision: 'APROBADO',
      justificacionAjuste: 'Temporada alta'
    }
  ];

  const bufferExcel = await ExportadorVistaControlR10.exportarAExcel(filasReporte);
  assert.ok(bufferExcel.length > 2000, 'El archivo Excel generado debe ser un buffer valido');
  // Cabecera ZIP de archivo XLSX: 50 4B 03 04 ('PK\x03\x04')
  assert.equal(bufferExcel[0], 0x50);
  assert.equal(bufferExcel[1], 0x4b);
  assert.equal(bufferExcel[2], 0x03);
  assert.equal(bufferExcel[3], 0x04);

  // 9. PRUEBA SEGURIDAD RBAC Y RUTAS EN SERVIDOR FASTIFY
  const servidor = await construirServidor();

  // Intento no autenticado a ordenes debe retornar 401
  const resOrdenesSinAuth = await servidor.inject({
    method: 'GET',
    url: '/api/v1/ordenes-compra'
  });
  assert.equal(resOrdenesSinAuth.statusCode, 401, 'Ruta de ordenes debe exigir autenticacion (401)');

  // Intento no autenticado a reportes debe retornar 401
  const resReportesSinAuth = await servidor.inject({
    method: 'GET',
    url: '/api/v1/reportes/vista-control-r10'
  });
  assert.equal(resReportesSinAuth.statusCode, 401, 'Ruta de reportes debe exigir autenticacion (401)');

  // Healthcheck operativo
  const resSalud = await servidor.inject({
    method: 'GET',
    url: '/api/v1/salud'
  });
  assert.equal(resSalud.statusCode, 200);

  await servidor.close();

  console.log('BLOQUE_3_TODAS_LAS_PRUEBAS_PASARON_CORRECTAMENTE');
}

ejecutarPruebasBloque3().catch(error => {
  console.error('ERROR_EN_PRUEBAS_BLOQUE_3:', error);
  process.exit(1);
});
