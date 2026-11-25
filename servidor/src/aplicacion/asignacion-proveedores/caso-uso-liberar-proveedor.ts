import { PuertoRepositorioProveedores } from '../../dominio/puertos/puerto-repositorio-proveedores.js';
import { PuertoRepositorioAuditoria } from '../../dominio/puertos/puerto-repositorio-auditoria.js';
import { ROLES_SISTEMA, RolSistema } from '../../configuracion/constantes-negocio.js';
import { ErrorAsignacionProveedor } from './caso-uso-autoasignar-proveedor.js';

export class CasoUsoLiberarProveedor {
  constructor(
    private readonly repositorioProveedores: PuertoRepositorioProveedores,
    private readonly repositorioAuditoria: PuertoRepositorioAuditoria
  ) {}

  async ejecutar(
    identificadorProveedor: string,
    usuarioSolicitanteId: string,
    rolUsuarioSolicitante: RolSistema,
    observacion?: string,
    direccionIP?: string
  ): Promise<void> {
    const asignacion = await this.repositorioProveedores.obtenerAsignacionActual(identificadorProveedor);

    if (!asignacion) {
      throw new ErrorAsignacionProveedor('El proveedor solicitado no existe', 'PROVEEDOR_NO_ENCONTRADO');
    }

    if (asignacion.estadoAsignacion === 'DISPONIBLE' && !asignacion.analistaUsuarioId) {
      return; // Ya esta libre
    }

    // Regla de autorizacion:
    // Si no es el propio analista asignado, solo Gerente o Administrador pueden forzar liberacion
    const esPropioAnalista = asignacion.analistaUsuarioId === usuarioSolicitanteId;
    const esAdminOGerente =
      rolUsuarioSolicitante === ROLES_SISTEMA.ADMINISTRADOR_SISTEMA ||
      rolUsuarioSolicitante === ROLES_SISTEMA.GERENTE_COMPRAS;

    if (!esPropioAnalista && !esAdminOGerente) {
      throw new ErrorAsignacionProveedor(
        'No tiene permisos para liberar un proveedor asignado a otra analista',
        'ACCESO_DENEGADO'
      );
    }

    await this.repositorioProveedores.liberarProveedor(identificadorProveedor, observacion);

    await this.repositorioAuditoria.registrarEvento({
      usuarioId: usuarioSolicitanteId,
      tipoEvento: esPropioAnalista ? 'LIBERACION_PROVEEDOR_VOLUNTARIA' : 'LIBERACION_PROVEEDOR_FORZADA',
      nombreEntidad: 'proveedor',
      identificadorEntidad: identificadorProveedor,
      estadoAnterior: { analistaUsuarioId: asignacion.analistaUsuarioId, estadoAsignacion: asignacion.estadoAsignacion },
      estadoNuevo: { analistaUsuarioId: null, estadoAsignacion: 'DISPONIBLE' },
      direccionIP
    });
  }
}
