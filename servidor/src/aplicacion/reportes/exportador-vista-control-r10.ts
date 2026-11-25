/**
 * Exportador de Vista de Control R10 a Excel (.xlsx).
 *
 * Reproduce las columnas clave del archivo de control Excel (MMC_R10_v1.1.xlsm)
 * permitiendo a analistas y gerencia auditar y descargar el estado completo de reposicion.
 *
 * Utiliza exceljs en memoria con estilos profesionales, formatos numericos de moneda
 * y congelamiento de cabecera.
 */
import ExcelJS from 'exceljs';
import { RenglonPropuestaReposicion, ResumenPropuestaProveedor } from '../../dominio/entidades/decision-compra.js';

export interface FilaReporteControlR10 {
  codigoSKU: string;
  descripcionProducto: string;
  marca: string;
  nombreProveedor: string;
  unidadMinimaEmpaque: number;
  costoUnitarioUSD: number;
  precioVentaUSD: number;
  margenPorcentual: number;
  cantidadAMano: number;
  cantidadTransito: number;
  inventarioEfectivo: number;
  demandaOperativaMensual: number;
  diasCoberturaActual: number;
  coberturaObjetivoDias: number;
  umbralCompraDias: number;
  cantidadSugeridaMotor: number;
  inversionSugeridaUSD: number;
  diagnosticoUrgencia: string;
  cantidadAjusteManual: number | null;
  cantidadFinalAprobada: number;
  inversionFinalUSD: number;
  estadoDecision: string;
  justificacionAjuste: string | null;
}

export class ExportadorVistaControlR10 {
  static async exportarAExcel(
    filas: FilaReporteControlR10[],
    nombreHoja: string = 'VISTA_CONTROL_R10'
  ): Promise<Buffer> {
    const libro = new ExcelJS.Workbook();
    libro.creator = 'Sistema Multi-Usuario Reposicion R10';
    libro.created = new Date();

    const hoja = libro.addWorksheet(nombreHoja, {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    // Definicion de columnas
    hoja.columns = [
      { header: 'SKU', key: 'codigoSKU', width: 14 },
      { header: 'DESCRIPCION DEL PRODUCTO', key: 'descripcionProducto', width: 36 },
      { header: 'MARCA', key: 'marca', width: 16 },
      { header: 'PROVEEDOR', key: 'nombreProveedor', width: 28 },
      { header: 'EMPAQUE MIN.', key: 'unidadMinimaEmpaque', width: 14 },
      { header: 'COSTO USD', key: 'costoUnitarioUSD', width: 13 },
      { header: 'PRECIO VENTA USD', key: 'precioVentaUSD', width: 16 },
      { header: 'MARGEN %', key: 'margenPorcentual', width: 12 },
      { header: 'STOCK A MANO', key: 'cantidadAMano', width: 14 },
      { header: 'TRANSITO', key: 'cantidadTransito', width: 12 },
      { header: 'INVENTARIO EFECTIVO', key: 'inventarioEfectivo', width: 18 },
      { header: 'DEMANDA MENSUAL', key: 'demandaOperativaMensual', width: 16 },
      { header: 'DIAS COBERTURA', key: 'diasCoberturaActual', width: 15 },
      { header: 'COBERTURA OBJ.', key: 'coberturaObjetivoDias', width: 15 },
      { header: 'UMBRAL DIAS', key: 'umbralCompraDias', width: 14 },
      { header: 'CANT. SUGERIDA', key: 'cantidadSugeridaMotor', width: 15 },
      { header: 'INVERSION SUG. USD', key: 'inversionSugeridaUSD', width: 18 },
      { header: 'DIAGNOSTICO', key: 'diagnosticoUrgencia', width: 18 },
      { header: 'AJUSTE MANUAL', key: 'cantidadAjusteManual', width: 14 },
      { header: 'CANT. APROBADA', key: 'cantidadFinalAprobada', width: 15 },
      { header: 'INVERSION APROB. USD', key: 'inversionFinalUSD', width: 20 },
      { header: 'ESTADO DECISION', key: 'estadoDecision', width: 16 },
      { header: 'JUSTIFICACION AJUSTE', key: 'justificacionAjuste', width: 30 }
    ];

    // Estilo de encabezados
    const filaEncabezado = hoja.getRow(1);
    filaEncabezado.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    filaEncabezado.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Slate oscuro
    };
    filaEncabezado.alignment = { vertical: 'middle', horizontal: 'center' };
    filaEncabezado.height = 28;

    // Agregar datos con formato
    filas.forEach((f, idx) => {
      const fila = hoja.addRow(f);
      const numeroFila = idx + 2;

      // Color alterno de fila
      if (numeroFila % 2 === 0) {
        fila.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' }
        };
      }

      // Formatos numericos
      fila.getCell('costoUnitarioUSD').numFmt = '$#,##0.00';
      fila.getCell('precioVentaUSD').numFmt = '$#,##0.00';
      fila.getCell('margenPorcentual').numFmt = '0.0"%';
      fila.getCell('inversionSugeridaUSD').numFmt = '$#,##0.00';
      fila.getCell('inversionFinalUSD').numFmt = '$#,##0.00';

      fila.getCell('cantidadAMano').numFmt = '#,##0';
      fila.getCell('cantidadTransito').numFmt = '#,##0';
      fila.getCell('inventarioEfectivo').numFmt = '#,##0';
      fila.getCell('demandaOperativaMensual').numFmt = '#,##0.0';
      fila.getCell('diasCoberturaActual').numFmt = '#,##0.0';
      fila.getCell('cantidadSugeridaMotor').numFmt = '#,##0';
      fila.getCell('cantidadFinalAprobada').numFmt = '#,##0';

      // Resaltar diagnostico
      const celdaDiag = fila.getCell('diagnosticoUrgencia');
      if (f.diagnosticoUrgencia === 'URGENTE') {
        celdaDiag.font = { bold: true, color: { argb: 'FFDC2626' } }; // Rojo
      } else if (f.diagnosticoUrgencia === 'COMPRAR AHORA') {
        celdaDiag.font = { bold: true, color: { argb: 'FFEA580C' } }; // Naranja
      }

      // Resaltar estado de decision
      const celdaDecision = fila.getCell('estadoDecision');
      if (f.estadoDecision === 'APROBADO') {
        celdaDecision.font = { bold: true, color: { argb: 'FF16A34A' } }; // Verde
      }
    });

    const buffer = await libro.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
