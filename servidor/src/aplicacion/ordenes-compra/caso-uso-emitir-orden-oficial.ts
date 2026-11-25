/**
 * Caso de uso: Emitir orden de compra oficial.
 *
 * Reglas de negocio:
 * 1. Solo roles autorizados (GERENTE_COMPRAS o ADMINISTRADOR_SISTEMA) pueden emitir la orden.
 * 2. La orden debe estar en estado 'APROBADA_PARA_EMISION'.
 * 3. Se debe especificar la razon social emisora ('MMC' o 'LYNOX').
 * 4. Genera de forma atomica y sin colisiones el correlativo oficial:
 *    OC-{CODIGO_EMPRESA}-{AAAA}-{NNNN} (ej. OC-MMC-2026-0001 u OC-LYNOX-2026-0001).
 * 5. Transiciona a 'OC_EMITIDA'.
 * 6. Registra auditoria inmutable.
 */
import { PuertoRepositorioOrdenes } from '../../dominio/puertos/puerto-repositorio-ordenes.js';
import { PuertoRepositorioAuditoria } from '../../dominio/puertos/puerto-repositorio-auditoria.js';
import { OrdenCompra } from '../../dominio/entidades/orden-compra.js';
import { RolSistema } from '../../configuracion/constantes-negocio.js';

export interface ParametrosEmitirOrdenOficial {
  identificadorOrden: string;
  usuarioEmisorId: string;
  rolUsuario: RolSistema;
  empresaEmisoraId: string;
}

export class CasoUsoEmitirOrdenOficial {
  constructor(
    private readonly repositorioOrdenes: PuertoRepositorioOrdenes,
    private readonly repositorioAuditoria: PuertoRepositorioAuditoria
  ) {}

  async ejecutar(parametros: ParametrosEmitirOrdenOficial): Promise<OrdenCompra> {
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

    if (orden.estadoOrden !== 'APROBADA_PARA_EMISION') {
      throw new Error('ESTADO_INVALIDO_PARA_EMISION');
    }

    if (!parametros.empresaEmisoraId) {
      throw new Error('EMPRESA_EMISORA_OBLIGATORIA');
    }

    // 3. Emitir en repositorio (generacion atomica de correlativo y asignacion de membrete)
    const ordenEmitida = await this.repositorioOrdenes.emitirOrdenOficial(
      parametros.identificadorOrden,
      parametros.empresaEmisoraId,
      parametros.usuarioEmisorId
    );

    // 4. Registrar evento de auditoria
    await this.repositorioAuditoria.registrarEvento({
      usuarioId: parametros.usuarioEmisorId,
      tipoEvento: 'EMITIR_ORDEN_COMPRA_OFICIAL',
      nombreEntidad: 'orden_compra',
      identificadorEntidad: parametros.identificadorOrden,
      estadoNuevo: {
        correlativoOficial: ordenEmitida.numeroCorrelativoOficial,
        empresaEmisoraId: parametros.empresaEmisoraId,
        codigoEmpresa: ordenEmitida.codigoEmpresaEmisora,
        nombreEmpresa: ordenEmitida.nombreEmpresaEmisora,
        proveedorId: orden.proveedorId,
        totalInversionUSD: ordenEmitida.totalInversionUSD,
        totalRenglones: ordenEmitida.totalRenglones
      }
    });

    return ordenEmitida;
  }
}
