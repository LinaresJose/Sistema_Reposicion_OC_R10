import assert from 'node:assert/strict';
import { CasoUsoActualizarProveedor, ErrorActualizarProveedor } from '../src/aplicacion/asignacion-proveedores/caso-uso-actualizar-proveedor.js';
import { PuertoRepositorioProveedores } from '../src/dominio/puertos/puerto-repositorio-proveedores.js';
import { PuertoRepositorioAuditoria } from '../src/dominio/puertos/puerto-repositorio-auditoria.js';
import { ProveedorConAsignacion, DatosActualizacionProveedor } from '../src/dominio/entidades/proveedor.js';
import { PERMISOS_OPERATIVOS, ROLES_SISTEMA } from '../src/configuracion/constantes-negocio.js';

class RepositorioProveedoresMemoriaEdicion implements PuertoRepositorioProveedores {
  private proveedores: Map<string, ProveedorConAsignacion> = new Map();

  agregarProveedor(p: ProveedorConAsignacion) {
    this.proveedores.set(p.identificadorProveedor, { ...p });
  }

  async listarProveedores(): Promise<ProveedorConAsignacion[]> {
    return Array.from(this.proveedores.values());
  }

  async buscarPorId(id: string): Promise<ProveedorConAsignacion | null> {
    return this.proveedores.get(id) || null;
  }

  async actualizarDatosProveedor(
    id: string,
    datos: DatosActualizacionProveedor
  ): Promise<ProveedorConAsignacion | null> {
    const prov = this.proveedores.get(id);
    if (!prov) return null;

    const actualizado: ProveedorConAsignacion = {
      ...prov,
      ...datos,
      actualizadoEn: new Date()
    };
    this.proveedores.set(id, actualizado);
    return actualizado;
  }

  async obtenerAsignacionActual(): Promise<any> { return null; }
  async autoasignarProveedor(): Promise<any> { return { exito: true }; }
  async liberarProveedor(): Promise<boolean> { return true; }
  async actualizarEstadoRevisionWhatsApp(): Promise<void> {}
  async actualizarActividadProveedor(): Promise<void> {}
}

class RepositorioAuditoriaMemoria implements PuertoRepositorioAuditoria {
  public eventos: any[] = [];
  async registrarEvento(evento: any): Promise<void> {
    this.eventos.push(evento);
  }
  async consultarEventos(): Promise<any[]> {
    return this.eventos;
  }
}

async function ejecutarPruebasEdicionProveedor() {
  const repoProv = new RepositorioProveedoresMemoriaEdicion();
  const repoAud = new RepositorioAuditoriaMemoria();
  const casoUso = new CasoUsoActualizarProveedor(repoProv, repoAud);

  const proveedorInicial: ProveedorConAsignacion = {
    identificadorProveedor: '11111111-1111-1111-1111-111111111111',
    codigoProveedorOdoo: 'PROV-001',
    nombreRazonSocial: 'TORNILLOS Y HERRAMIENTAS NACIONALES C.A.',
    registroInformacionFiscal: 'J-12345678-0',
    categoriaCompradora: 'NACIONAL_1',
    plazoEntregaDias: 7,
    frecuenciaCompraDias: 15,
    diasCredito: 0,
    descuentoComercialCadena: '0%',
    formaPagoPredeterminada: 'DIVISAS_TRANSFERENCIA',
    tipoDocumentoPredeterminado: 'FACTURA',
    nombreContacto: 'Carlos Perez',
    telefonoContacto: '+58 412 1112233',
    correoContacto: 'cperez@tornillos.com',
    estaActivo: true,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    estadoAsignacion: 'DISPONIBLE',
    analistaAsignadaId: null,
    nombreAnalistaAsignada: null,
    correoAnalistaAsignada: null,
    bloqueoSuspendidoPorRevision: false,
    fechaHoraExpiracionBloqueo: null,
    totalSkusAptos: 25,
    montoSugeridoTotalUSD: 1450.00
  };

  repoProv.agregarProveedor(proveedorInicial);

  // 1. Validar Permisos RBAC para EDITAR_DATOS_PROVEEDOR
  assert.ok(PERMISOS_OPERATIVOS.EDITAR_DATOS_PROVEEDOR.includes(ROLES_SISTEMA.ANALISTA_COMPRAS), 'ANALISTA_COMPRAS debe tener permiso para editar proveedor');
  assert.ok(PERMISOS_OPERATIVOS.EDITAR_DATOS_PROVEEDOR.includes(ROLES_SISTEMA.GERENTE_COMPRAS), 'GERENTE_COMPRAS debe tener permiso para editar proveedor');
  assert.ok(PERMISOS_OPERATIVOS.EDITAR_DATOS_PROVEEDOR.includes(ROLES_SISTEMA.ADMINISTRADOR_SISTEMA), 'ADMINISTRADOR_SISTEMA debe tener permiso para editar proveedor');
  assert.equal(PERMISOS_OPERATIVOS.EDITAR_DATOS_PROVEEDOR.includes(ROLES_SISTEMA.AUDITOR_CONTROL as any), false, 'AUDITOR_CONTROL no debe poder editar proveedor');

  // 2. Actualizar Categoria y Datos Comerciales por Analista
  const datosNuevos: DatosActualizacionProveedor = {
    categoriaCompradora: 'INTERNACIONAL',
    plazoEntregaDias: 45,
    frecuenciaCompraDias: 60,
    diasCredito: 30,
    descuentoComercialCadena: '10% + 5%',
    formaPagoPredeterminada: 'TRANSFERENCIA_EXTERIOR',
    tipoDocumentoPredeterminado: 'INVOICE',
    nombreContacto: 'Maria Gomez',
    telefonoContacto: '+1 305 5551234',
    correoContacto: 'mgomez@internationaltools.com',
    estaActivo: true
  };

  const actualizado = await casoUso.ejecutar(
    proveedorInicial.identificadorProveedor,
    'usuario-analista-uuid',
    datosNuevos,
    '192.168.1.50'
  );

  assert.equal(actualizado.categoriaCompradora, 'INTERNACIONAL');
  assert.equal(actualizado.plazoEntregaDias, 45);
  assert.equal(actualizado.frecuenciaCompraDias, 60);
  assert.equal(actualizado.diasCredito, 30);
  assert.equal(actualizado.descuentoComercialCadena, '10% + 5%');
  assert.equal(actualizado.formaPagoPredeterminada, 'TRANSFERENCIA_EXTERIOR');
  assert.equal(actualizado.nombreContacto, 'Maria Gomez');

  // 3. Validar Auditoria Inmutable
  assert.equal(repoAud.eventos.length, 1);
  const eventoAuditoria = repoAud.eventos[0];
  assert.equal(eventoAuditoria.tipoEvento, 'ACTUALIZAR_DATOS_PROVEEDOR');
  assert.equal(eventoAuditoria.identificadorEntidad, proveedorInicial.identificadorProveedor);
  assert.equal(eventoAuditoria.estadoAnterior.categoriaCompradora, 'NACIONAL_1');
  assert.equal(eventoAuditoria.estadoNuevo.categoriaCompradora, 'INTERNACIONAL');
  assert.equal(eventoAuditoria.direccionIP, '192.168.1.50');

  // 4. Validar Rechazo de Categoria Invalida
  await assert.rejects(
    async () => {
      await casoUso.ejecutar(
        proveedorInicial.identificadorProveedor,
        'usuario-analista-uuid',
        { categoriaCompradora: 'CATEGORIA_INEXISTENTE' as any }
      );
    },
    (err: ErrorActualizarProveedor) => {
      assert.equal(err.codigoError, 'DATOS_INVALIDOS');
      return true;
    }
  );

  // 5. Validar Rechazo de Frecuencia Invalida (<= 0)
  await assert.rejects(
    async () => {
      await casoUso.ejecutar(
        proveedorInicial.identificadorProveedor,
        'usuario-analista-uuid',
        { frecuenciaCompraDias: 0 }
      );
    },
    (err: ErrorActualizarProveedor) => {
      assert.equal(err.codigoError, 'DATOS_INVALIDOS');
      return true;
    }
  );

  // 6. Validar Rechazo de Proveedor Inexistente
  await assert.rejects(
    async () => {
      await casoUso.ejecutar(
        '00000000-0000-0000-0000-000000000000',
        'usuario-analista-uuid',
        { nombreRazonSocial: 'Nuevo Nombre' }
      );
    },
    (err: ErrorActualizarProveedor) => {
      assert.equal(err.codigoError, 'PROVEEDOR_NO_ENCONTRADO');
      return true;
    }
  );

  console.log('PRUEBAS_EDICION_PROVEEDOR_EXITOSAS');
}

ejecutarPruebasEdicionProveedor().catch((err) => {
  console.error('ERROR_PRUEBAS_EDICION_PROVEEDOR:', err);
  process.exit(1);
});
