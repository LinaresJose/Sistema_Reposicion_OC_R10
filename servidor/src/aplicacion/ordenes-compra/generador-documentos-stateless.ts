/**
 * Generador de Documentos Stateless en Memoria.
 *
 * Cumple estrictamente con:
 * 1. Consumo de memoria ultraligero (< 15 MB RAM) sin almacenar archivos en disco.
 * 2. Propuesta para Aprobacion (PDF e Imagen PNG):
 *    - NO lleva membrete ni logo de ninguna de las 2 razones sociales.
 *    - Muestra cabecera completa con datos del proveedor, analista, totales y renglones.
 * 3. Orden de Compra Oficial (PDF):
 *    - SÍ lleva el membrete oficial, logo, RIF y direccion fiscal de la razon social seleccionada (MMC o LYNOX).
 *    - Incluye numero correlativo oficial (OC-MMC-AAAA-NNNN u OC-LYNOX-AAAA-NNNN).
 *    - Incluye nombre completo y telefono_contacto de la analista responsable.
 *    - Renglones confirmados y seccion de firmas/aprobacion.
 */
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';
import { Resvg } from '@resvg/resvg-js';
import { OrdenCompra, RenglonOrdenCompra } from '../../dominio/entidades/orden-compra.js';

export class GeneradorDocumentosStateless {

  // ═════════════════════════════════════════════════════════════════════════════
  // 1. PROPUESTA DE COMPRA (PDF) - SIN MEMBRETE NI LOGO DE EMPRESA
  // ═════════════════════════════════════════════════════════════════════════════

  static async generarPropuestaPDF(orden: OrdenCompra): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    doc.setTitle('PROPUESTA DE REPOSICION Y COMPRA');
    doc.setSubject(`Proveedor: ${orden.nombreProveedor} - RIF: ${orden.registroFiscalProveedor || 'N/A'}`);
    doc.setAuthor(`Analista: ${orden.nombreAnalistaCreadora}`);
    doc.setKeywords(['PROPUESTA_PRELIMINAR', orden.proveedorId, orden.estadoOrden]);

    const fuenteRegular = await doc.embedFont(StandardFonts.Helvetica);
    const fuenteNegrita = await doc.embedFont(StandardFonts.HelveticaBold);

    const ancho = 612; // Carta
    const alto = 792;
    const margen = 40;

    let pagina = doc.addPage([ancho, alto]);
    let y = alto - margen;

    // Encabezado Neutral
    pagina.drawRectangle({
      x: margen,
      y: y - 35,
      width: ancho - (margen * 2),
      height: 40,
      color: rgb(0.12, 0.22, 0.35)
    });

    pagina.drawText('PROPUESTA DE REPOSICION Y COMPRA', {
      x: margen + 15,
      y: y - 18,
      size: 14,
      font: fuenteNegrita,
      color: rgb(1, 1, 1)
    });

    pagina.drawText('DOCUMENTO PRELIMINAR PARA REVISION Y APROBACION', {
      x: margen + 15,
      y: y - 30,
      size: 8,
      font: fuenteRegular,
      color: rgb(0.85, 0.9, 0.95)
    });

    y -= 50;

    // Aviso informativo
    pagina.drawText('NOTA: Este documento no constituye una orden oficial de compra. La empresa emisora se define al aprobar la orden.', {
      x: margen,
      y,
      size: 7.5,
      font: fuenteRegular,
      color: rgb(0.4, 0.4, 0.4)
    });

    y -= 15;

    // Bloque 1: Datos del Proveedor y Analista
    const altoCajaInfo = 75;
    pagina.drawRectangle({
      x: margen,
      y: y - altoCajaInfo,
      width: ancho - (margen * 2),
      height: altoCajaInfo,
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1,
      color: rgb(0.98, 0.98, 0.98)
    });

    const col1X = margen + 10;
    const col2X = margen + 280;
    let infoY = y - 15;

    // Columna izquierda: Proveedor
    pagina.drawText('DATOS DEL PROVEEDOR', { x: col1X, y: infoY, size: 8, font: fuenteNegrita, color: rgb(0.2, 0.2, 0.2) });
    infoY -= 12;
    pagina.drawText(`Proveedor: ${orden.nombreProveedor}`, { x: col1X, y: infoY, size: 8, font: fuenteRegular });
    infoY -= 11;
    pagina.drawText(`RIF: ${orden.registroFiscalProveedor || 'N/A'}`, { x: col1X, y: infoY, size: 8, font: fuenteRegular });
    infoY -= 11;
    pagina.drawText(`Condicion Pago: ${orden.condicionPago || 'CREDITO'} | Doc: ${orden.tipoDocumentoLegal || 'FACTURA'}`, { x: col1X, y: infoY, size: 8, font: fuenteRegular });
    infoY -= 11;
    pagina.drawText(`Plazo Entrega: ${orden.plazoEntregaDias} dias | Frecuencia: ${orden.frecuenciaCompraDias} dias`, { x: col1X, y: infoY, size: 8, font: fuenteRegular });

    // Columna derecha: Analista y Control
    infoY = y - 15;
    pagina.drawText('CONTROL Y RESPONSABLE', { x: col2X, y: infoY, size: 8, font: fuenteNegrita, color: rgb(0.2, 0.2, 0.2) });
    infoY -= 12;
    pagina.drawText(`Analista Creadora: ${orden.nombreAnalistaCreadora}`, { x: col2X, y: infoY, size: 8, font: fuenteRegular });
    infoY -= 11;
    pagina.drawText(`Contacto Analista: ${orden.telefonoAnalistaCreadora || 'No registrado'}`, { x: col2X, y: infoY, size: 8, font: fuenteRegular });
    infoY -= 11;
    pagina.drawText(`Fecha Propuesta: ${orden.creadoEn.toLocaleDateString('es-VE')} ${orden.creadoEn.toLocaleTimeString('es-VE')}`, { x: col2X, y: infoY, size: 8, font: fuenteRegular });
    infoY -= 11;
    pagina.drawText(`Estado Actual: ${orden.estadoOrden}`, { x: col2X, y: infoY, size: 8, font: fuenteNegrita, color: rgb(0.8, 0.3, 0) });

    y -= (altoCajaInfo + 15);

    // Resumen de cifras
    pagina.drawRectangle({
      x: margen,
      y: y - 25,
      width: ancho - (margen * 2),
      height: 25,
      color: rgb(0.93, 0.95, 0.98)
    });
    pagina.drawText(`Total Renglones Aprobados: ${orden.totalRenglones}`, { x: margen + 10, y: y - 16, size: 9, font: fuenteNegrita });
    pagina.drawText(`Inversion Total Propuesta: USD $${orden.totalInversionUSD.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, {
      x: col2X,
      y: y - 16,
      size: 9,
      font: fuenteNegrita,
      color: rgb(0.05, 0.45, 0.15)
    });

    y -= 35;

    // Encabezado de la tabla de renglones
    const dibujarCabeceraTabla = (p: PDFPage, py: number) => {
      p.drawRectangle({
        x: margen,
        y: py - 16,
        width: ancho - (margen * 2),
        height: 18,
        color: rgb(0.25, 0.35, 0.45)
      });
      p.drawText('SKU', { x: margen + 5, y: py - 12, size: 7.5, font: fuenteNegrita, color: rgb(1, 1, 1) });
      p.drawText('DESCRIPCION PRODUCTO', { x: margen + 65, y: py - 12, size: 7.5, font: fuenteNegrita, color: rgb(1, 1, 1) });
      p.drawText('MARCA', { x: margen + 245, y: py - 12, size: 7.5, font: fuenteNegrita, color: rgb(1, 1, 1) });
      p.drawText('EMP.', { x: margen + 320, y: py - 12, size: 7.5, font: fuenteNegrita, color: rgb(1, 1, 1) });
      p.drawText('CANT.', { x: margen + 355, y: py - 12, size: 7.5, font: fuenteNegrita, color: rgb(1, 1, 1) });
      p.drawText('COSTO USD', { x: margen + 400, y: py - 12, size: 7.5, font: fuenteNegrita, color: rgb(1, 1, 1) });
      p.drawText('SUBTOTAL USD', { x: margen + 465, y: py - 12, size: 7.5, font: fuenteNegrita, color: rgb(1, 1, 1) });
    };

    dibujarCabeceraTabla(pagina, y);
    y -= 22;

    // Filas de renglones
    for (let i = 0; i < orden.renglones.length; i++) {
      const r = orden.renglones[i];

      // Paginacion automatica
      if (y < 60) {
        pagina = doc.addPage([ancho, alto]);
        y = alto - margen;
        dibujarCabeceraTabla(pagina, y);
        y -= 22;
      }

      const esFilaPar = i % 2 === 0;
      if (esFilaPar) {
        pagina.drawRectangle({
          x: margen,
          y: y - 12,
          width: ancho - (margen * 2),
          height: 14,
          color: rgb(0.97, 0.97, 0.97)
        });
      }

      const descCorta = r.descripcionProducto.length > 38
        ? r.descripcionProducto.substring(0, 36) + '...'
        : r.descripcionProducto;

      pagina.drawText(r.codigoSKU, { x: margen + 5, y: y - 8, size: 7, font: fuenteRegular });
      pagina.drawText(descCorta, { x: margen + 65, y: y - 8, size: 7, font: fuenteRegular });
      pagina.drawText(r.marca ? r.marca.substring(0, 14) : '', { x: margen + 245, y: y - 8, size: 7, font: fuenteRegular });
      pagina.drawText(String(r.unidadMinimaEmpaque), { x: margen + 325, y: y - 8, size: 7, font: fuenteRegular });
      pagina.drawText(String(r.cantidadOrdenada), { x: margen + 360, y: y - 8, size: 7, font: fuenteNegrita });
      pagina.drawText(`$${r.costoUnitarioUSD.toFixed(2)}`, { x: margen + 405, y: y - 8, size: 7, font: fuenteRegular });
      pagina.drawText(`$${r.subtotalUSD.toFixed(2)}`, { x: margen + 475, y: y - 8, size: 7, font: fuenteNegrita });

      y -= 14;

      // Justificacion si existe
      if (r.justificacionAjuste) {
        if (y < 50) {
          pagina = doc.addPage([ancho, alto]);
          y = alto - margen;
          dibujarCabeceraTabla(pagina, y);
          y -= 22;
        }
        pagina.drawText(`   * Justificacion: ${r.justificacionAjuste}`, {
          x: margen + 65,
          y: y - 6,
          size: 6.5,
          font: fuenteRegular,
          color: rgb(0.5, 0.2, 0.1)
        });
        y -= 11;
      }
    }

    return doc.save();
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 2. PROPUESTA PARA WHATSAPP (PNG) - IMAGEN LIGERA Y NITIDA
  // ═════════════════════════════════════════════════════════════════════════════

  static async generarPropuestaPNG(orden: OrdenCompra): Promise<Buffer> {
    const anchoSVG = 950;
    const altoCabecera = 220;
    const altoPorFila = 28;
    const totalFilas = orden.renglones.length;
    const altoTabla = (totalFilas * altoPorFila) + 40;
    const altoPie = 80;
    const altoSVG = altoCabecera + altoTabla + altoPie;

    // Generacion de filas SVG
    let filasSVG = '';
    let filaY = altoCabecera + 35;

    orden.renglones.forEach((r, idx) => {
      const bg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
      const desc = r.descripcionProducto.length > 45 ? r.descripcionProducto.substring(0, 43) + '..' : r.descripcionProducto;
      filasSVG += `
        <rect x="30" y="${filaY - 18}" width="890" height="26" fill="${bg}"/>
        <text x="40" y="${filaY}" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="600" fill="#1e293b">${r.codigoSKU}</text>
        <text x="140" y="${filaY}" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#334155">${desc}</text>
        <text x="510" y="${filaY}" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#475569">${r.marca || '-'}</text>
        <text x="640" y="${filaY}" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#475569" text-anchor="middle">${r.unidadMinimaEmpaque}</text>
        <text x="710" y="${filaY}" font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="700" fill="#0f172a" text-anchor="middle">${r.cantidadOrdenada}</text>
        <text x="780" y="${filaY}" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#475569" text-anchor="end">$${r.costoUnitarioUSD.toFixed(2)}</text>
        <text x="890" y="${filaY}" font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="700" fill="#15803d" text-anchor="end">$${r.subtotalUSD.toFixed(2)}</text>
      `;
      filaY += altoPorFila;
    });

    const svg = `
      <svg width="${anchoSVG}" height="${altoSVG}" viewBox="0 0 ${anchoSVG} ${altoSVG}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${anchoSVG}" height="${altoSVG}" fill="#f1f5f9"/>

        <!-- Cabecera Principal (Sin logo ni membrete de empresa) -->
        <rect x="20" y="20" width="910" height="70" rx="8" fill="#0f172a"/>
        <text x="40" y="52" font-family="Helvetica, Arial, sans-serif" font-size="20" font-weight="700" fill="#ffffff">PROPUESTA DE REPOSICION - REVISION WHATSAPP</text>
        <text x="40" y="74" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#94a3b8">Documento preliminar de evaluacion comercial para aprobacion de compra</text>

        <!-- Tarjetas de Informacion Clave -->
        <!-- Tarjeta Proveedor -->
        <rect x="20" y="100" width="445" height="100" rx="6" fill="#ffffff" stroke="#cbd5e1"/>
        <text x="35" y="122" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#64748b">PROVEEDOR</text>
        <text x="35" y="142" font-family="Helvetica, Arial, sans-serif" font-size="14" font-weight="700" fill="#0f172a">${orden.nombreProveedor}</text>
        <text x="35" y="162" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#475569">RIF: ${orden.registroFiscalProveedor || 'N/A'} | Condicion: ${orden.condicionPago}</text>
        <text x="35" y="180" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#475569">Plazo Entrega: ${orden.plazoEntregaDias} dias | Frecuencia: ${orden.frecuenciaCompraDias} dias</text>

        <!-- Tarjeta Analista y Totales -->
        <rect x="485" y="100" width="445" height="100" rx="6" fill="#ffffff" stroke="#cbd5e1"/>
        <text x="500" y="122" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#64748b">RESPONSABLE Y TOTALES</text>
        <text x="500" y="142" font-family="Helvetica, Arial, sans-serif" font-size="13" font-weight="600" fill="#0f172a">Analista: ${orden.nombreAnalistaCreadora}</text>
        <text x="500" y="162" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#475569">Fecha: ${orden.creadoEn.toLocaleDateString('es-VE')} | Renglones: ${orden.totalRenglones}</text>
        <text x="500" y="187" font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="800" fill="#16a34a">TOTAL PROPUESTO: USD $${orden.totalInversionUSD.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</text>

        <!-- Cabecera de Tabla -->
        <rect x="30" y="${altoCabecera + 2}" width="890" height="28" rx="4" fill="#334155"/>
        <text x="40" y="${altoCabecera + 20}" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#ffffff">SKU</text>
        <text x="140" y="${altoCabecera + 20}" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#ffffff">DESCRIPCION PRODUCTO</text>
        <text x="510" y="${altoCabecera + 20}" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#ffffff">MARCA</text>
        <text x="640" y="${altoCabecera + 20}" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">EMP.</text>
        <text x="710" y="${altoCabecera + 20}" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">CANT.</text>
        <text x="780" y="${altoCabecera + 20}" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#ffffff" text-anchor="end">COSTO</text>
        <text x="890" y="${altoCabecera + 20}" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#ffffff" text-anchor="end">SUBTOTAL</text>

        <!-- Filas de Productos -->
        ${filasSVG}

        <!-- Pie de Pagina -->
        <rect x="20" y="${altoSVG - 60}" width="910" height="45" rx="6" fill="#e2e8f0"/>
        <text x="40" y="${altoSVG - 38}" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="600" fill="#475569">Canal de Revision: Instruccion verbal o mensaje de WhatsApp para aprobacion ejecutiva</text>
        <text x="40" y="${altoSVG - 23}" font-family="Helvetica, Arial, sans-serif" font-size="10" fill="#64748b">Al aprobar, se emitira la orden de compra oficial con membrete y numero correlativo asignado.</text>
      </svg>
    `;

    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: anchoSVG }
    });
    const imagenRenderizada = resvg.render();
    return imagenRenderizada.asPng();
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 3. ORDEN DE COMPRA OFICIAL (PDF) - CON MEMBRETE, LOGO Y DATOS FISCALES
  // ═════════════════════════════════════════════════════════════════════════════

  static async generarOrdenOficialPDF(orden: OrdenCompra): Promise<Uint8Array> {
    if (orden.estadoOrden !== 'OC_EMITIDA' || !orden.numeroCorrelativoOficial) {
      throw new Error('LA_ORDEN_DEBE_ESTAR_EMITIDA_CON_CORRELATIVO');
    }

    const doc = await PDFDocument.create();
    doc.setTitle(`ORDEN DE COMPRA OFICIAL - ${orden.numeroCorrelativoOficial}`);
    doc.setSubject(`Emisor: ${orden.nombreEmpresaEmisora} - RIF: ${orden.registroFiscalEmpresa}`);
    doc.setAuthor(`Analista: ${orden.nombreAnalistaCreadora} - Tel: ${orden.telefonoAnalistaCreadora || 'N/A'}`);
    doc.setKeywords([
      orden.numeroCorrelativoOficial,
      orden.codigoEmpresaEmisora || '',
      orden.registroFiscalEmpresa || '',
      orden.telefonoAnalistaCreadora || '',
      orden.nombreProveedor
    ]);
    const fuenteRegular = await doc.embedFont(StandardFonts.Helvetica);
    const fuenteNegrita = await doc.embedFont(StandardFonts.HelveticaBold);

    const ancho = 612; // Carta
    const alto = 792;
    const margen = 35;

    let pagina = doc.addPage([ancho, alto]);
    let y = alto - margen;

    // 1. Incrustar logo oficial de la empresa emisora (desde Base64)
    if (orden.logoBase64Empresa) {
      try {
        const bufferLogo = Buffer.from(orden.logoBase64Empresa, 'base64');
        const imagenLogo = await doc.embedPng(bufferLogo);
        // Dimensionar manteniendo proporcion
        const dimLogo = imagenLogo.scale(0.35);
        pagina.drawImage(imagenLogo, {
          x: margen,
          y: y - dimLogo.height + 10,
          width: dimLogo.width,
          height: dimLogo.height
        });
      } catch {
        // En caso de logo corrupto, dibuja texto institucional
        pagina.drawText(orden.nombreEmpresaEmisora || 'EMPRESA EMISORA', {
          x: margen,
          y: y - 10,
          size: 14,
          font: fuenteNegrita
        });
      }
    }

    // Recuadro del Correlativo Oficial en esquina superior derecha
    const anchoCajaOC = 210;
    const altoCajaOC = 65;
    const xCajaOC = ancho - margen - anchoCajaOC;

    pagina.drawRectangle({
      x: xCajaOC,
      y: y - altoCajaOC,
      width: anchoCajaOC,
      height: altoCajaOC,
      borderColor: rgb(0.1, 0.2, 0.4),
      borderWidth: 1.5,
      color: rgb(0.96, 0.98, 1)
    });

    pagina.drawText('ORDEN DE COMPRA', {
      x: xCajaOC + 35,
      y: y - 18,
      size: 12,
      font: fuenteNegrita,
      color: rgb(0.1, 0.2, 0.4)
    });

    pagina.drawText(orden.numeroCorrelativoOficial, {
      x: xCajaOC + 15,
      y: y - 36,
      size: 13,
      font: fuenteNegrita,
      color: rgb(0.8, 0.1, 0.1)
    });

    pagina.drawText(`Fecha Emision: ${orden.emitidoEn ? orden.emitidoEn.toLocaleDateString('es-VE') : new Date().toLocaleDateString('es-VE')}`, {
      x: xCajaOC + 15,
      y: y - 52,
      size: 8,
      font: fuenteRegular,
      color: rgb(0.3, 0.3, 0.3)
    });

    y -= 75;

    // Datos Fiscales de la Empresa Emisora
    pagina.drawText(orden.nombreEmpresaEmisora || '', {
      x: margen,
      y,
      size: 10,
      font: fuenteNegrita,
      color: rgb(0.1, 0.1, 0.1)
    });
    y -= 11;

    pagina.drawText(`RIF: ${orden.registroFiscalEmpresa || ''}`, {
      x: margen,
      y,
      size: 8.5,
      font: fuenteNegrita
    });
    y -= 11;

    const direccionLinea = (orden.direccionFiscalEmpresa || '').length > 70
      ? orden.direccionFiscalEmpresa!.substring(0, 70) + '...'
      : orden.direccionFiscalEmpresa || '';
    pagina.drawText(`Direccion: ${direccionLinea}`, {
      x: margen,
      y,
      size: 7.5,
      font: fuenteRegular,
      color: rgb(0.3, 0.3, 0.3)
    });

    y -= 18;

    // Bloque Datos del Proveedor y Analista Responsable
    const altoCajaDatos = 75;
    pagina.drawRectangle({
      x: margen,
      y: y - altoCajaDatos,
      width: ancho - (margen * 2),
      height: altoCajaDatos,
      borderColor: rgb(0.75, 0.75, 0.75),
      borderWidth: 1,
      color: rgb(0.98, 0.98, 0.98)
    });

    const col1 = margen + 10;
    const col2 = margen + 280;
    let datosY = y - 14;

    // Columna 1: Proveedor
    pagina.drawText('PROVEEDOR ADJUDICADO', { x: col1, y: datosY, size: 8, font: fuenteNegrita, color: rgb(0.1, 0.2, 0.4) });
    datosY -= 11;
    pagina.drawText(`Razon Social: ${orden.nombreProveedor}`, { x: col1, y: datosY, size: 8, font: fuenteRegular });
    datosY -= 11;
    pagina.drawText(`RIF: ${orden.registroFiscalProveedor || 'N/A'}`, { x: col1, y: datosY, size: 8, font: fuenteRegular });
    datosY -= 11;
    pagina.drawText(`Condicion Pago: ${orden.condicionPago || 'CREDITO'} | Doc: ${orden.tipoDocumentoLegal || 'FACTURA'}`, { x: col1, y: datosY, size: 8, font: fuenteRegular });
    datosY -= 11;
    pagina.drawText(`Plazo Entrega: ${orden.plazoEntregaDias} dias | Frecuencia: ${orden.frecuenciaCompraDias} dias`, { x: col1, y: datosY, size: 8, font: fuenteRegular });

    // Columna 2: Analista Responsable con Telefono de Contacto Obligatorio
    datosY = y - 14;
    pagina.drawText('ANALISTA RESPONSABLE DE EMISION', { x: col2, y: datosY, size: 8, font: fuenteNegrita, color: rgb(0.1, 0.2, 0.4) });
    datosY -= 11;
    pagina.drawText(`Analista: ${orden.nombreAnalistaCreadora}`, { x: col2, y: datosY, size: 8.5, font: fuenteNegrita });
    datosY -= 11;
    pagina.drawText(`Telefono Contacto: ${orden.telefonoAnalistaCreadora || 'No registrado'}`, {
      x: col2,
      y: datosY,
      size: 8.5,
      font: fuenteNegrita,
      color: rgb(0.05, 0.4, 0.15)
    });
    datosY -= 11;
    pagina.drawText(`Canal Aprobacion: ${orden.canalAprobacion || 'SISTEMA'}`, { x: col2, y: datosY, size: 8, font: fuenteRegular });
    datosY -= 11;
    const notaCorta = orden.notaRespalodoAprobacion
      ? (orden.notaRespalodoAprobacion.length > 32 ? orden.notaRespalodoAprobacion.substring(0, 30) + '..' : orden.notaRespalodoAprobacion)
      : 'Aprobacion en sistema';
    pagina.drawText(`Respaldo: ${notaCorta}`, { x: col2, y: datosY, size: 7.5, font: fuenteRegular, color: rgb(0.4, 0.4, 0.4) });

    y -= (altoCajaDatos + 15);

    // Cabecera de Tabla de Renglones Confirmados
    const dibujarCabeceraTablaOficial = (p: PDFPage, py: number) => {
      p.drawRectangle({
        x: margen,
        y: py - 16,
        width: ancho - (margen * 2),
        height: 18,
        color: rgb(0.1, 0.2, 0.35)
      });
      p.drawText('SKU', { x: margen + 5, y: py - 12, size: 7.5, font: fuenteNegrita, color: rgb(1, 1, 1) });
      p.drawText('DESCRIPCION DEL PRODUCTO', { x: margen + 75, y: py - 12, size: 7.5, font: fuenteNegrita, color: rgb(1, 1, 1) });
      p.drawText('MARCA', { x: margen + 265, y: py - 12, size: 7.5, font: fuenteNegrita, color: rgb(1, 1, 1) });
      p.drawText('EMP.', { x: margen + 340, y: py - 12, size: 7.5, font: fuenteNegrita, color: rgb(1, 1, 1) });
      p.drawText('CANT.', { x: margen + 380, y: py - 12, size: 7.5, font: fuenteNegrita, color: rgb(1, 1, 1) });
      p.drawText('COSTO USD', { x: margen + 430, y: py - 12, size: 7.5, font: fuenteNegrita, color: rgb(1, 1, 1) });
      p.drawText('SUBTOTAL USD', { x: margen + 485, y: py - 12, size: 7.5, font: fuenteNegrita, color: rgb(1, 1, 1) });
    };

    dibujarCabeceraTablaOficial(pagina, y);
    y -= 20;

    // Filas de Renglones
    for (let i = 0; i < orden.renglones.length; i++) {
      const r = orden.renglones[i];

      if (y < 95) {
        pagina = doc.addPage([ancho, alto]);
        y = alto - margen;
        dibujarCabeceraTablaOficial(pagina, y);
        y -= 20;
      }

      if (i % 2 === 0) {
        pagina.drawRectangle({
          x: margen,
          y: y - 11,
          width: ancho - (margen * 2),
          height: 13,
          color: rgb(0.96, 0.96, 0.97)
        });
      }

      const desc = r.descripcionProducto.length > 40
        ? r.descripcionProducto.substring(0, 38) + '...'
        : r.descripcionProducto;

      pagina.drawText(r.codigoSKU, { x: margen + 5, y: y - 8, size: 7, font: fuenteRegular });
      pagina.drawText(desc, { x: margen + 75, y: y - 8, size: 7, font: fuenteRegular });
      pagina.drawText(r.marca ? r.marca.substring(0, 14) : '', { x: margen + 265, y: y - 8, size: 7, font: fuenteRegular });
      pagina.drawText(String(r.unidadMinimaEmpaque), { x: margen + 345, y: y - 8, size: 7, font: fuenteRegular });
      pagina.drawText(String(r.cantidadOrdenada), { x: margen + 385, y: y - 8, size: 7, font: fuenteNegrita });
      pagina.drawText(`$${r.costoUnitarioUSD.toFixed(2)}`, { x: margen + 435, y: y - 8, size: 7, font: fuenteRegular });
      pagina.drawText(`$${r.subtotalUSD.toFixed(2)}`, { x: margen + 495, y: y - 8, size: 7, font: fuenteNegrita });

      y -= 13;
    }

    y -= 10;

    // Total General
    if (y < 120) {
      pagina = doc.addPage([ancho, alto]);
      y = alto - margen;
    }

    pagina.drawRectangle({
      x: margen + 330,
      y: y - 22,
      width: ancho - margen - (margen + 330),
      height: 22,
      color: rgb(0.1, 0.2, 0.35)
    });

    pagina.drawText('TOTAL ORDEN DE COMPRA USD:', {
      x: margen + 340,
      y: y - 15,
      size: 8,
      font: fuenteNegrita,
      color: rgb(1, 1, 1)
    });

    pagina.drawText(`$${orden.totalInversionUSD.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, {
      x: margen + 480,
      y: y - 15,
      size: 10,
      font: fuenteNegrita,
      color: rgb(1, 1, 1)
    });

    y -= 50;

    // Seccion de Firmas y Aprobaciones
    const xFirma1 = margen + 25;
    const xFirma2 = margen + 300;

    pagina.drawLine({
      start: { x: xFirma1, y },
      end: { x: xFirma1 + 180, y },
      thickness: 1,
      color: rgb(0.4, 0.4, 0.4)
    });

    pagina.drawLine({
      start: { x: xFirma2, y },
      end: { x: xFirma2 + 180, y },
      thickness: 1,
      color: rgb(0.4, 0.4, 0.4)
    });

    pagina.drawText(`Elaborado por: ${orden.nombreAnalistaCreadora}`, {
      x: xFirma1 + 5,
      y: y - 12,
      size: 7.5,
      font: fuenteNegrita
    });
    pagina.drawText(`Analista de Compras | Tel: ${orden.telefonoAnalistaCreadora || 'N/A'}`, {
      x: xFirma1 + 5,
      y: y - 22,
      size: 7,
      font: fuenteRegular,
      color: rgb(0.4, 0.4, 0.4)
    });

    pagina.drawText('Aprobado y Autorizado por:', {
      x: xFirma2 + 25,
      y: y - 12,
      size: 7.5,
      font: fuenteNegrita
    });
    pagina.drawText('Gerencia de Compras / Direccion Ejecutiva', {
      x: xFirma2 + 10,
      y: y - 22,
      size: 7,
      font: fuenteRegular,
      color: rgb(0.4, 0.4, 0.4)
    });

    // Pie de Pagina Oficial de la Empresa
    const textoFooter = orden.textoFooterEmpresa || `${orden.nombreEmpresaEmisora} · RIF: ${orden.registroFiscalEmpresa}`;
    pagina.drawText(textoFooter, {
      x: margen,
      y: margen - 15,
      size: 7,
      font: fuenteRegular,
      color: rgb(0.5, 0.5, 0.5)
    });

    return doc.save();
  }
}
