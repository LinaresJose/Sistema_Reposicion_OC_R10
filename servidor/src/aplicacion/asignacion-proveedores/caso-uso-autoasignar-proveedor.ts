import { PuertoRepositorioProveedores } from '../../dominio/puertos/puerto-repositorio-proveedores.js';
import { PuertoRepositorioAuditoria } from '../../dominio/puertos/puerto-repositorio-auditoria.js';
import { AsignacionProveedor } from '../../dominio/entidades/proveedor.js';

export class ErrorAsignacionProveedor extends Error {
  constructor(mensaje: string, public codigoError: string, public detalles?: any) {
    super(mensaje);
    this.name = 'ErrorAsignacionProveedor';
  }
}

export class CasoUsoAutoasignarProveedor {
  constructor(
    private readonly repositorioProveedores: PuertoRepositorioProveedores,
    private readonly repositorioAuditoria: PuertoRepositorioAuditoria
  ) {}

  async ejecutar(
    identificadorProveedor: string,
    analistaUsuarioId: string,
    minutosInactividad: number = 45,
    direccionIP?: string
  ): Promise<AsignacionProveedor> {
    const proveedor = await this.repositorioProveedores.buscarPorId(identificadorProveedor);
    if (!proveedor) {
      throw new ErrorAsignacionProveedor('El proveedor solicitado no existe', 'PROVEEDOR_NO_ENCONTRADO');
    }

    const resultado = await this.repositorioProveedores.autoasignarProveedor(
      identificadorProveedor,
      analistaUsuarioId,
      minutosInactividad
    );

    if (!resultado.exito || !resultado.asignacion) {
      throw new ErrorAsignacionProveedor(
        'El proveedor ya se encuentra tomado por otra analista activa',
        'PROVEEDOR_OCUPADO',
        {
          proveedorId: identificadorProveedor,
          ocupadoPorUsuarioId: resultado.conflictoConUsuarioId
        }
      );
    }

    // Registro en auditoria
    await this.repositorioAuditoria.registrarEvento({
      usuarioId: analistaUsuarioId,
      tipoEvento: 'AUTOASIGNACION_PROVEEDOR',
      nombreEntidad: 'proveedor',
      identificadorEntidad: identificadorProveedor,
      estadoAnterior: { estadoAsignacion: proveedor.estadoAsignacion, analistaAsignadaId: proveedor.analistaAsignadaId },
      estadoNuevo: { estadoAsignacion: resultado.asignacion.estadoAsignacion, analistaUsuarioId },
      direccionIP
    });

    return resultado.asignacion;
  }
}
