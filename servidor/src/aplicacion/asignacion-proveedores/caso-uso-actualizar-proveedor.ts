import { PuertoRepositorioProveedores } from '../../dominio/puertos/puerto-repositorio-proveedores.js';
import { PuertoRepositorioAuditoria } from '../../dominio/puertos/puerto-repositorio-auditoria.js';
import { DatosActualizacionProveedor, ProveedorConAsignacion } from '../../dominio/entidades/proveedor.js';
import { CategoriaCompradora } from '../../configuracion/constantes-negocio.js';

export class ErrorActualizarProveedor extends Error {
  constructor(
    public readonly codigoError: 'PROVEEDOR_NO_ENCONTRADO' | 'DATOS_INVALIDOS',
    mensaje: string
  ) {
    super(mensaje);
    this.name = 'ErrorActualizarProveedor';
  }
}

export class CasoUsoActualizarProveedor {
  constructor(
    private readonly repositorioProveedores: PuertoRepositorioProveedores,
    private readonly repositorioAuditoria: PuertoRepositorioAuditoria
  ) {}

  async ejecutar(
    identificadorProveedor: string,
    usuarioId: string,
    datos: DatosActualizacionProveedor,
    direccionIP?: string
  ): Promise<ProveedorConAsignacion> {
    const proveedorActual = await this.repositorioProveedores.buscarPorId(identificadorProveedor);
    if (!proveedorActual) {
      throw new ErrorActualizarProveedor(
        'PROVEEDOR_NO_ENCONTRADO',
        `No se encontro ningun proveedor con identificador: ${identificadorProveedor}`
      );
    }

    if (datos.categoriaCompradora) {
      const categoriasValidas: CategoriaCompradora[] = [
        'NACIONAL_1',
        'NACIONAL_2',
        'NACIONAL_3',
        'INTERNACIONAL'
      ];
      if (!categoriasValidas.includes(datos.categoriaCompradora)) {
        throw new ErrorActualizarProveedor(
          'DATOS_INVALIDOS',
          `La categoria compradora '${datos.categoriaCompradora}' no es valida`
        );
      }
    }

    if (datos.plazoEntregaDias !== undefined && datos.plazoEntregaDias < 0) {
      throw new ErrorActualizarProveedor(
        'DATOS_INVALIDOS',
        'El plazo de entrega en dias no puede ser negativo'
      );
    }

    if (datos.frecuenciaCompraDias !== undefined && datos.frecuenciaCompraDias <= 0) {
      throw new ErrorActualizarProveedor(
        'DATOS_INVALIDOS',
        'La frecuencia de compra en dias debe ser mayor a 0'
      );
    }

    if (datos.diasCredito !== undefined && datos.diasCredito < 0) {
      throw new ErrorActualizarProveedor(
        'DATOS_INVALIDOS',
        'Los dias de credito no pueden ser negativos'
      );
    }

    const proveedorActualizado = await this.repositorioProveedores.actualizarDatosProveedor(
      identificadorProveedor,
      datos
    );

    if (!proveedorActualizado) {
      throw new ErrorActualizarProveedor(
        'PROVEEDOR_NO_ENCONTRADO',
        `No se pudo actualizar el proveedor con identificador: ${identificadorProveedor}`
      );
    }

    // Registrar en auditoria inmutable
    await this.repositorioAuditoria.registrarEvento({
      usuarioId,
      tipoEvento: 'ACTUALIZAR_DATOS_PROVEEDOR',
      nombreEntidad: 'proveedor',
      identificadorEntidad: identificadorProveedor,
      estadoAnterior: {
        nombreRazonSocial: proveedorActual.nombreRazonSocial,
        registroInformacionFiscal: proveedorActual.registroInformacionFiscal,
        categoriaCompradora: proveedorActual.categoriaCompradora,
        plazoEntregaDias: proveedorActual.plazoEntregaDias,
        frecuenciaCompraDias: proveedorActual.frecuenciaCompraDias,
        diasCredito: proveedorActual.diasCredito,
        descuentoComercialCadena: proveedorActual.descuentoComercialCadena,
        formaPagoPredeterminada: proveedorActual.formaPagoPredeterminada,
        tipoDocumentoPredeterminado: proveedorActual.tipoDocumentoPredeterminado,
        nombreContacto: proveedorActual.nombreContacto,
        telefonoContacto: proveedorActual.telefonoContacto,
        correoContacto: proveedorActual.correoContacto,
        estaActivo: proveedorActual.estaActivo
      },
      estadoNuevo: {
        nombreRazonSocial: proveedorActualizado.nombreRazonSocial,
        registroInformacionFiscal: proveedorActualizado.registroInformacionFiscal,
        categoriaCompradora: proveedorActualizado.categoriaCompradora,
        plazoEntregaDias: proveedorActualizado.plazoEntregaDias,
        frecuenciaCompraDias: proveedorActualizado.frecuenciaCompraDias,
        diasCredito: proveedorActualizado.diasCredito,
        descuentoComercialCadena: proveedorActualizado.descuentoComercialCadena,
        formaPagoPredeterminada: proveedorActualizado.formaPagoPredeterminada,
        tipoDocumentoPredeterminado: proveedorActualizado.tipoDocumentoPredeterminado,
        nombreContacto: proveedorActualizado.nombreContacto,
        telefonoContacto: proveedorActualizado.telefonoContacto,
        correoContacto: proveedorActualizado.correoContacto,
        estaActivo: proveedorActualizado.estaActivo
      },
      direccionIP
    });

    return proveedorActualizado;
  }
}
