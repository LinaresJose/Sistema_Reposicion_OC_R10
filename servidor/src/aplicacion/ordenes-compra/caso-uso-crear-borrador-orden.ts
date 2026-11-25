/**
 * Caso de uso: Crear borrador de orden de compra a partir de decisiones aprobadas.
 *
 * Reglas de negocio:
 * 1. Solo se pueden incluir renglones cuya decision de compra este en estado 'APROBADO'.
 * 2. Se debe incluir al menos un SKU aprobado.
 * 3. La orden nace en estado 'BORRADOR' sin membrete ni razon social emisora asignada.
 * 4. Queda registrada en la auditoria del sistema.
 */
import crypto from 'node:crypto';
import { PuertoRepositorioOrdenes } from '../../dominio/puertos/puerto-repositorio-ordenes.js';
import { PuertoRepositorioPropuestas } from '../../dominio/puertos/puerto-repositorio-propuestas.js';
import { PuertoRepositorioAuditoria } from '../../dominio/puertos/puerto-repositorio-auditoria.js';
import { OrdenCompra, EntradaCrearOrdenBorrador } from '../../dominio/entidades/orden-compra.js';

export class CasoUsoCrearBorradorOrden {
  constructor(
    private readonly repositorioOrdenes: PuertoRepositorioOrdenes,
    private readonly repositorioPropuestas: PuertoRepositorioPropuestas,
    private readonly repositorioAuditoria: PuertoRepositorioAuditoria
  ) {}

  async ejecutar(entrada: EntradaCrearOrdenBorrador): Promise<OrdenCompra> {
    // 1. Obtener la propuesta actual del proveedor
    const propuesta = await this.repositorioPropuestas.obtenerPropuestaPorProveedor(entrada.proveedorId);
    if (!propuesta) {
      throw new Error('PROVEEDOR_NO_ENCONTRADO');
    }

    // 2. Filtrar los renglones aprobados especificados o todos los aprobados de la propuesta
    const renglonesAprobados = propuesta.renglones.filter(r => {
      const estaAprobado = r.estadoDecision === 'APROBADO' && r.cantidadFinalAprobada > 0;
      if (entrada.idsDecisionesAprobadas && entrada.idsDecisionesAprobadas.length > 0) {
        return estaAprobado && entrada.idsDecisionesAprobadas.includes(r.identificadorDecision);
      }
      return estaAprobado;
    });

    if (renglonesAprobados.length === 0) {
      throw new Error('SIN_SKUS_APROBADOS_PARA_ORDEN');
    }

    // 3. Generar identificadores unicos
    const identificadorOrden = crypto.randomUUID();

    const renglonesParaCrear = renglonesAprobados.map(r => ({
      identificadorRenglon: crypto.randomUUID(),
      productoId: r.identificadorProducto,
      codigoSKU: r.codigoSKU,
      descripcionProducto: r.descripcionProducto,
      marca: r.marca || '',
      unidadMinimaEmpaque: r.unidadMinimaEmpaque,
      cantidadOrdenada: r.cantidadFinalAprobada,
      costoUnitarioUSD: r.costoUnitarioUSD,
      subtotalUSD: Math.round(r.cantidadFinalAprobada * r.costoUnitarioUSD * 100) / 100,
      justificacionAjuste: r.justificacionAjuste ?? null
    }));

    // 4. Crear la orden en el repositorio
    const ordenCreada = await this.repositorioOrdenes.crearOrdenBorrador({
      identificadorOrden,
      proveedorId: entrada.proveedorId,
      analistaCreadoraId: entrada.analistaCreadoraId,
      condicionPago: propuesta.formaPago || 'CREDITO',
      tipoDocumentoLegal: propuesta.tipoDocumento || 'FACTURA',
      plazoEntregaDias: propuesta.plazoEntregaDias,
      frecuenciaCompraDias: propuesta.frecuenciaCompraDias,
      renglones: renglonesParaCrear
    });

    // 5. Registrar evento en auditoria
    await this.repositorioAuditoria.registrarEvento({
      usuarioId: entrada.analistaCreadoraId,
      tipoEvento: 'CREAR_BORRADOR_ORDEN',
      nombreEntidad: 'orden_compra',
      identificadorEntidad: identificadorOrden,
      estadoNuevo: {
        proveedorId: entrada.proveedorId,
        nombreProveedor: propuesta.nombreProveedor,
        totalRenglones: ordenCreada.totalRenglones,
        totalInversionUSD: ordenCreada.totalInversionUSD
      }
    });

    return ordenCreada;
  }
}
