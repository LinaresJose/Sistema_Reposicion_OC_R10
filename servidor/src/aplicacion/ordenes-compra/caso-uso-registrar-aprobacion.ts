/**
 * Caso de uso: Registrar aprobacion de una orden de compra.
 *
 * Reglas de negocio:
 * 1. Solo roles autorizados (GERENTE_COMPRAS o ADMINISTRADOR_SISTEMA) pueden registrar la aprobacion.
 * 2. La orden debe estar en 'EN_REVISION_WHATSAPP' o 'BORRADOR'.
 * 3. Si el canal es 'WHATSAPP', la nota de respaldo (notaRespalodoAprobacion) es ESTRICTAMENTE OBLIGATORIA
 *    y debe contener al menos 10 caracteres con la justificacion/evidencia verbal.
 * 4. La orden pasa a 'APROBADA_PARA_EMISION'.
 */
import { PuertoRepositorioOrdenes } from '../../dominio/puertos/puerto-repositorio-ordenes.js';
import { PuertoRepositorioAuditoria } from '../../dominio/puertos/puerto-repositorio-auditoria.js';
import { OrdenCompra, CanalAprobacion } from '../../dominio/entidades/orden-compra.js';
import { RolSistema } from '../../configuracion/constantes-negocio.js';

export interface ParametrosRegistrarAprobacion {
  identificadorOrden: string;
  usuarioAprobadorId: string;
  rolUsuario: RolSistema;
  canalAprobacion: CanalAprobacion;
  notaRespalodoAprobacion?: string;
}

export class CasoUsoRegistrarAprobacion {
  constructor(
    private readonly repositorioOrdenes: PuertoRepositorioOrdenes,
    private readonly repositorioAuditoria: PuertoRepositorioAuditoria
  ) {}

  async ejecutar(parametros: ParametrosRegistrarAprobacion): Promise<OrdenCompra> {
    // 1. Validar permisos de rol
    const rolesPermitidos: RolSistema[] = ['GERENTE_COMPRAS', 'ADMINISTRADOR_SISTEMA'];
    if (!rolesPermitidos.includes(parametros.rolUsuario)) {
      throw new Error('ACCESO_DENEGADO_ROL_NO_AUTORIZADO');
    }

    // 2. Validar existencia y estado de la orden
    const orden = await this.repositorioOrdenes.obtenerOrdenPorId(parametros.identificadorOrden);
    if (!orden) {
      throw new Error('ORDEN_NO_ENCONTRADA');
    }

    const estadosAprobables = ['BORRADOR', 'EN_REVISION_WHATSAPP'];
    if (!estadosAprobables.includes(orden.estadoOrden)) {
      throw new Error('ESTADO_INVALIDO_PARA_APROBACION');
    }

    // 3. Regla estricta de respaldo para canal WHATSAPP
    const notaLimpia = (parametros.notaRespalodoAprobacion ?? '').trim();
    if (parametros.canalAprobacion === 'WHATSAPP') {
      if (!notaLimpia || notaLimpia.length < 10) {
        throw new Error('NOTA_RESPALDO_WHATSAPP_OBLIGATORIA');
      }
    }

    // 4. Registrar aprobacion
    const ordenAprobada = await this.repositorioOrdenes.registrarAprobacion(
      parametros.identificadorOrden,
      {
        canalAprobacion: parametros.canalAprobacion,
        notaRespalodoAprobacion: notaLimpia || 'Aprobacion directa en sistema interno',
        aprobadoPorId: parametros.usuarioAprobadorId
      }
    );

    // 5. Registrar evento de auditoria
    await this.repositorioAuditoria.registrarEvento({
      usuarioId: parametros.usuarioAprobadorId,
      tipoEvento: 'REGISTRAR_APROBACION_ORDEN',
      nombreEntidad: 'orden_compra',
      identificadorEntidad: parametros.identificadorOrden,
      estadoNuevo: {
        canalAprobacion: parametros.canalAprobacion,
        notaRespaldo: notaLimpia,
        proveedorId: orden.proveedorId,
        totalInversionUSD: orden.totalInversionUSD
      }
    });

    return ordenAprobada;
  }
}
