/**
 * Caso de uso: Pasar una orden de compra a revision por WhatsApp.
 *
 * Reglas de negocio:
 * 1. La orden debe estar en estado 'BORRADOR'.
 * 2. Transiciona a 'EN_REVISION_WHATSAPP'.
 * 3. Suspende la expiracion por inactividad del proveedor para que no sea liberado mientras se espera respuesta del Gerente.
 * 4. Queda trazado en auditoria.
 */
import { PuertoRepositorioOrdenes } from '../../dominio/puertos/puerto-repositorio-ordenes.js';
import { PuertoRepositorioAuditoria } from '../../dominio/puertos/puerto-repositorio-auditoria.js';
import { PuertoRepositorioProveedores } from '../../dominio/puertos/puerto-repositorio-proveedores.js';
import { OrdenCompra } from '../../dominio/entidades/orden-compra.js';

export class CasoUsoPasarARevisionWhatsapp {
  constructor(
    private readonly repositorioOrdenes: PuertoRepositorioOrdenes,
    private readonly repositorioProveedores: PuertoRepositorioProveedores,
    private readonly repositorioAuditoria: PuertoRepositorioAuditoria
  ) {}

  async ejecutar(identificadorOrden: string, usuarioId: string): Promise<OrdenCompra> {
    const orden = await this.repositorioOrdenes.obtenerOrdenPorId(identificadorOrden);
    if (!orden) {
      throw new Error('ORDEN_NO_ENCONTRADA');
    }

    if (orden.estadoOrden !== 'BORRADOR') {
      throw new Error('ESTADO_INVALIDO_PARA_REVISION');
    }

    // 1. Transicionar la orden
    const ordenActualizada = await this.repositorioOrdenes.pasarARevisionWhatsapp(identificadorOrden);

    // 2. Suspender expiracion por inactividad del proveedor en asignacion_proveedor
    await this.repositorioProveedores.actualizarEstadoRevisionWhatsApp(orden.proveedorId, true);

    // 3. Registrar auditoria
    await this.repositorioAuditoria.registrarEvento({
      usuarioId,
      tipoEvento: 'PASAR_ORDEN_A_REVISION_WHATSAPP',
      nombreEntidad: 'orden_compra',
      identificadorEntidad: identificadorOrden,
      estadoNuevo: {
        proveedorId: orden.proveedorId,
        nombreProveedor: orden.nombreProveedor,
        totalInversionUSD: orden.totalInversionUSD
      }
    });

    return ordenActualizada;
  }
}
