import assert from 'node:assert/strict';
import { MotorCalculoR10 } from '../src/aplicacion/motor-reposicion/motor-calculo-r10.js';
import { CalculadorHashInstantanea } from '../src/aplicacion/motor-reposicion/calculador-hash-instantanea.js';
import { CasoUsoAutoasignarProveedor, ErrorAsignacionProveedor } from '../src/aplicacion/asignacion-proveedores/caso-uso-autoasignar-proveedor.js';
import { CasoUsoLiberarProveedor } from '../src/aplicacion/asignacion-proveedores/caso-uso-liberar-proveedor.js';
import { CasoUsoActualizarDecisionSKU, ErrorDecisionCompra } from '../src/aplicacion/decisiones-compra/caso-uso-actualizar-decision-sku.js';
import { PuertoRepositorioProveedores } from '../src/dominio/puertos/puerto-repositorio-proveedores.js';
import { PuertoRepositorioPropuestas } from '../src/dominio/puertos/puerto-repositorio-propuestas.js';
import { PuertoRepositorioAuditoria } from '../src/dominio/puertos/puerto-repositorio-auditoria.js';
import { ProveedorConAsignacion, AsignacionProveedor } from '../src/dominio/entidades/proveedor.js';
import { DecisionCompraSKU, ResumenPropuestaProveedor } from '../src/dominio/entidades/decision-compra.js';
import { RegistroAuditoria } from '../src/dominio/entidades/registro-auditoria.js';
import { ROLES_SISTEMA } from '../src/configuracion/constantes-negocio.js';
import { construirServidor } from '../src/infraestructura/servidor.js';

// --- MOCKS EN MEMORIA PARA PRUEBAS AISLADAS ---

class RepositorioProveedoresMemoria implements PuertoRepositorioProveedores {
  private proveedores: Map<string, ProveedorConAsignacion> = new Map();
  private asignaciones: Map<string, AsignacionProveedor> = new Map();

  agregarProveedor(p: ProveedorConAsignacion) {
    this.proveedores.set(p.identificadorProveedor, { ...p });
    this.asignaciones.set(p.identificadorProveedor, {
      identificadorAsignacion: 'asig-' + p.identificadorProveedor,
      proveedorId: p.identificadorProveedor,
      analistaUsuarioId: p.analistaAsignadaId,
      estadoAsignacion: p.estadoAsignacion,
      fechaHoraToma: p.analistaAsignadaId ? new Date() : null,
      fechaHoraUltimaActividad: p.analistaAsignadaId ? new Date() : null,
      fechaHoraExpiracionBloqueo: p.fechaHoraExpiracionBloqueo,
      bloqueoSuspendidoPorRevision: p.bloqueoSuspendidoPorRevision
    });
  }

  async listarProveedores(): Promise<ProveedorConAsignacion[]> {
    return Array.from(this.proveedores.values());
  }

  async buscarPorId(id: string): Promise<ProveedorConAsignacion | null> {
    return this.proveedores.get(id) || null;
  }

  async obtenerAsignacionActual(id: string): Promise<AsignacionProveedor | null> {
    return this.asignaciones.get(id) || null;
  }

  async autoasignarProveedor(id: string, analistaId: string, minutos: number) {
    const asig = this.asignaciones.get(id);
    if (!asig) return { exito: false };

    const estaOcupado = asig.analistaUsuarioId && asig.analistaUsuarioId !== analistaId;
    const vigente = asig.bloqueoSuspendidoPorRevision || (asig.fechaHoraExpiracionBloqueo && asig.fechaHoraExpiracionBloqueo > new Date());

    if (estaOcupado && vigente) {
      return { exito: false, conflictoConUsuarioId: asig.analistaUsuarioId! };
    }

    asig.analistaUsuarioId = analistaId;
    asig.estadoAsignacion = 'EN_PROCESO_TRABAJO';
    asig.fechaHoraToma = new Date();
    asig.fechaHoraUltimaActividad = new Date();
    asig.fechaHoraExpiracionBloqueo = new Date(Date.now() + minutos * 60 * 1000);
    asig.bloqueoSuspendidoPorRevision = false;

    const prov = this.proveedores.get(id)!;
    prov.estadoAsignacion = 'EN_PROCESO_TRABAJO';
    prov.analistaAsignadaId = analistaId;

    return { exito: true, asignacion: { ...asig } };
  }

  async liberarProveedor(id: string) {
    const asig = this.asignaciones.get(id);
    if (!asig) return false;
    asig.analistaUsuarioId = null;
    asig.estadoAsignacion = 'DISPONIBLE';
    asig.fechaHoraExpiracionBloqueo = null;
    asig.bloqueoSuspendidoPorRevision = false;

    const prov = this.proveedores.get(id)!;
    prov.estadoAsignacion = 'DISPONIBLE';
    prov.analistaAsignadaId = null;
    return true;
  }

  async actualizarEstadoRevisionWhatsApp(id: string, enRevision: boolean) {
    const asig = this.asignaciones.get(id);
    if (asig) {
      asig.estadoAsignacion = enRevision ? 'EN_REVISION_WHATSAPP' : 'EN_PROCESO_TRABAJO';
      asig.bloqueoSuspendidoPorRevision = enRevision;
    }
  }

  async actualizarActividadProveedor() {}
}

class RepositorioPropuestasMemoria implements PuertoRepositorioPropuestas {
  private decisiones: Map<string, DecisionCompraSKU> = new Map();
  private hashesVigentes: Map<string, string> = new Map();

  agregarDecision(d: DecisionCompraSKU, hashVigente: string) {
    this.decisiones.set(d.identificadorDecision, { ...d });
    this.hashesVigentes.set(d.identificadorDecision, hashVigente);
  }

  async obtenerPropuestaPorProveedor(): Promise<ResumenPropuestaProveedor | null> {
    return null;
  }

  async guardarCalculosReposicion(): Promise<void> {}

  async buscarDecisionPorId(id: string): Promise<DecisionCompraSKU | null> {
    const d = this.decisiones.get(id);
    return d ? { ...d } : null;
  }

  async actualizarDecisionSKU(
    id: string,
    estado: 'PENDIENTE' | 'APROBADO' | 'EXCLUIDO',
    ajuste: number | null,
    justificacion: string | null,
    hashValidado: string,
    versionEsperada: number,
    analistaId: string
  ) {
    const d = this.decisiones.get(id);
    if (!d) return { exito: false };

    if (d.numeroVersion !== versionEsperada) {
      return { exito: false, conflictoVersion: true };
    }

    const hashReal = this.hashesVigentes.get(id);
    if (hashReal !== hashValidado) {
      return { exito: false, calculoInvalido: true };
    }

    d.estadoDecision = estado;
    d.cantidadAjusteManual = ajuste;
    d.cantidadFinalPropuesta = ajuste !== null ? ajuste : d.cantidadSugeridaReferencia;
    d.justificacionAjuste = justificacion || undefined;
    d.analistaUsuarioId = analistaId;
    d.numeroVersion += 1;
    d.actualizadoEn = new Date();

    return { exito: true, decisionActualizada: { ...d } };
  }
}

class RepositorioAuditoriaMemoria implements PuertoRepositorioAuditoria {
  public eventos: RegistroAuditoria[] = [];

  async registrarEvento(e: any): Promise<void> {
    this.eventos.push({
      identificadorAuditoria: 'aud-' + Date.now(),
      usuarioId: e.usuarioId,
      tipoEvento: e.tipoEvento,
      nombreEntidad: e.nombreEntidad,
      identificadorEntidad: e.identificadorEntidad,
      estadoAnterior: e.estadoAnterior || null,
      estadoNuevo: e.estadoNuevo || null,
      direccionIP: e.direccionIP,
      marcaTiempo: new Date()
    });
  }

  async consultarEventos(): Promise<RegistroAuditoria[]> {
    return this.eventos;
  }
}

// --- SUITE PRINCIPAL DE PRUEBAS ---

async function correrPruebasBloque2() {
  // 1. Validacion Matematica del Motor R10
  const resultadoR10 = MotorCalculoR10.calcular({
    productoId: 'prod-01',
    codigoSKU: '0101008',
    descripcionProducto: 'FUMIGADORA MANUAL 20Lts ATOUAN',
    proveedorId: 'prov-01',
    periodoMes: '2026-11',
    costoUnitarioUSD: 10.45,
    precioVentaUSD: 39.00,
    cantidadAMano: 12,
    cantidadTransitoValido: 0,
    demandaHistoricaMensual: 60,
    plazoEntregaDias: 7,
    frecuenciaCompraDias: 15,
    coberturaMinimaProveedorDias: 30,
    clasificacionComercial: 'ALTA ROTACION',
    unidadMinimaEmpaque: 6,
    usarMayorCoberturaProveedor: true
  });

  // Demanda diaria = 60 / 30 = 2 unidades/dia
  assert.equal(resultadoR10.demandaDiaria, 2);
  // Cobertura actual = 12 / 2 = 6 dias
  assert.equal(resultadoR10.diasCoberturaActual, 6);
  // Cobertura objetivo = max(22, 30) = 30 dias
  assert.equal(resultadoR10.coberturaObjetivoDias, 30);
  // Umbral = max(22, 30 - 15) = 22 dias
  assert.equal(resultadoR10.umbralCompraDias, 22);
  // Deficit = ceil(2 * 30) - 12 = 60 - 12 = 48 unidades
  // Ajuste a empaque 6: 48 es divisible entre 6 = 48 unidades
  assert.equal(resultadoR10.cantidadSugeridaEmpaque, 48);
  // Diagnostico: como dias cobertura (6) <= plazo(7)+seguridad(0) -> URGENTE
  assert.equal(resultadoR10.diagnosticoUrgencia, 'URGENTE');
  assert.equal(resultadoR10.esAptoParaCompra, true);
  assert.equal(resultadoR10.hashInstantaneaCalculo.length, 64);

  // Verificacion de Hash Determinista: mismo input da mismo hash, cambio altera hash
  const hashOriginal = resultadoR10.hashInstantaneaCalculo;
  const hashRecalculado = CalculadorHashInstantanea.calcular({
    codigoSKU: '0101008',
    proveedorId: 'prov-01',
    clasificacionComercial: 'ALTA ROTACION',
    costoUnitarioUSD: 10.45,
    precioVentaUSD: 39.00,
    cantidadAMano: 12,
    inventarioEfectivo: 12,
    demandaOperativaMensual: 60,
    plazoEntregaDias: 7,
    frecuenciaCompraDias: 15,
    seguridadAdicionalDias: 0,
    coberturaObjetivoDias: 30,
    umbralCompraDias: 22,
    cantidadSugerida: 48,
    esAptoParaCompra: true,
    unidadMinimaEmpaque: 6,
    margenMinimoComercial: 0.40
  });
  assert.equal(hashOriginal, hashRecalculado, 'El hash debe ser determinista');

  // Si cambia el costo a 11.00, el hash DEBE cambiar
  const hashModificado = CalculadorHashInstantanea.calcular({
    codigoSKU: '0101008',
    proveedorId: 'prov-01',
    clasificacionComercial: 'ALTA ROTACION',
    costoUnitarioUSD: 11.00, // Cambio
    precioVentaUSD: 39.00,
    cantidadAMano: 12,
    inventarioEfectivo: 12,
    demandaOperativaMensual: 60,
    plazoEntregaDias: 7,
    frecuenciaCompraDias: 15,
    seguridadAdicionalDias: 0,
    coberturaObjetivoDias: 30,
    umbralCompraDias: 22,
    cantidadSugerida: 48,
    esAptoParaCompra: true,
    unidadMinimaEmpaque: 6,
    margenMinimoComercial: 0.40
  });
  assert.notEqual(hashOriginal, hashModificado, 'El hash debe variar si cambia cualquier variable base');

  // 2. Pruebas de Autoasignacion, Concurrencia y Bloqueo
  const repoProv = new RepositorioProveedoresMemoria();
  const repoAud = new RepositorioAuditoriaMemoria();

  repoProv.agregarProveedor({
    identificadorProveedor: 'prov-tornillos-01',
    nombreRazonSocial: 'INVERSIONES TORNILLOS SERRANO, C.A.',
    categoriaCompradora: 'NACIONAL_2',
    plazoEntregaDias: 7,
    frecuenciaCompraDias: 15,
    diasCredito: 30,
    descuentoComercialCadena: '0%',
    formaPagoPredeterminada: 'DIVISAS_TRANSFERENCIA',
    tipoDocumentoPredeterminado: 'FACTURA',
    estaActivo: true,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    estadoAsignacion: 'DISPONIBLE',
    analistaAsignadaId: null,
    nombreAnalistaAsignada: null,
    correoAnalistaAsignada: null,
    bloqueoSuspendidoPorRevision: false,
    fechaHoraExpiracionBloqueo: null,
    totalSkusAptos: 15,
    montoSugeridoTotalUSD: 12500
  });

  const casoAutoasignar = new CasoUsoAutoasignarProveedor(repoProv, repoAud);
  const casoLiberar = new CasoUsoLiberarProveedor(repoProv, repoAud);

  // Analista 1 se autoasigna exitosamente
  const asig1 = await casoAutoasignar.ejecutar('prov-tornillos-01', 'analista-mariana-01', 45);
  assert.equal(asig1.analistaUsuarioId, 'analista-mariana-01');
  assert.equal(asig1.estadoAsignacion, 'EN_PROCESO_TRABAJO');

  // Analista 2 intenta autoasignar el mismo proveedor -> DEBE FALLAR con conflicto (409)
  try {
    await casoAutoasignar.ejecutar('prov-tornillos-01', 'analista-elena-02', 45);
    assert.fail('Debio rechazar por proveedor ocupado');
  } catch (err: any) {
    assert.equal(err.codigoError, 'PROVEEDOR_OCUPADO');
  }

  // Analista 2 intenta liberar el proveedor de Analista 1 -> DEBE FALLAR por permisos (403)
  try {
    await casoLiberar.ejecutar('prov-tornillos-01', 'analista-elena-02', ROLES_SISTEMA.ANALISTA_COMPRAS);
    assert.fail('Debio rechazar liberacion no autorizada');
  } catch (err: any) {
    assert.equal(err.codigoError, 'ACCESO_DENEGADO');
  }

  // Gerente o Admin fuerza liberacion -> EXITO
  await casoLiberar.ejecutar('prov-tornillos-01', 'admin-01', ROLES_SISTEMA.ADMINISTRADOR_SISTEMA, 'Liberado por Gerencia');
  const asigLiberada = await repoProv.obtenerAsignacionActual('prov-tornillos-01');
  assert.equal(asigLiberada?.estadoAsignacion, 'DISPONIBLE');
  assert.equal(asigLiberada?.analistaUsuarioId, null);

  // 3. Pruebas de Decisiones por SKU, Versionado Optimista y Justificacion
  const repoProp = new RepositorioPropuestasMemoria();
  repoProp.agregarDecision({
    identificadorDecision: 'dec-sku-01',
    calculoId: 'calc-01',
    proveedorId: 'prov-tornillos-01',
    analistaUsuarioId: null,
    estadoDecision: 'PENDIENTE',
    cantidadSugeridaReferencia: 48,
    cantidadAjusteManual: null,
    cantidadFinalPropuesta: 48,
    esCalculoVigente: true,
    numeroVersion: 1,
    actualizadoEn: new Date()
  }, hashOriginal);

  const casoActualizarDecision = new CasoUsoActualizarDecisionSKU(repoProp, repoAud);

  // Intento de modificar cantidad sugerida (48 -> 30) sin justificacion -> DEBE FALLAR (422)
  try {
    await casoActualizarDecision.ejecutar({
      identificadorDecision: 'dec-sku-01',
      estadoDecision: 'APROBADO',
      cantidadAjusteManual: 30,
      justificacionAjuste: '', // Vacia
      hashCalculoValidado: hashOriginal,
      numeroVersionEsperado: 1,
      analistaUsuarioId: 'analista-mariana-01'
    });
    assert.fail('Debio exigir justificacion obligatoria');
  } catch (err: any) {
    assert.equal(err.codigoError, 'JUSTIFICACION_OBLIGATORIA');
  }

  // Modificacion con justificacion valida -> EXITO y version se incrementa a 2
  const decActualizada = await casoActualizarDecision.ejecutar({
    identificadorDecision: 'dec-sku-01',
    estadoDecision: 'APROBADO',
    cantidadAjusteManual: 36,
    justificacionAjuste: 'Se ajusta a 6 bultos por capacidad de bodega',
    hashCalculoValidado: hashOriginal,
    numeroVersionEsperado: 1,
    analistaUsuarioId: 'analista-mariana-01'
  });
  assert.equal(decActualizada.cantidadFinalPropuesta, 36);
  assert.equal(decActualizada.numeroVersion, 2);

  // Intento simultaneo con version vieja (version 1) -> DEBE FALLAR con CONFLICTO_CONCURRENCIA (409)
  try {
    await casoActualizarDecision.ejecutar({
      identificadorDecision: 'dec-sku-01',
      estadoDecision: 'APROBADO',
      cantidadAjusteManual: 24,
      justificacionAjuste: 'Ajuste concurrente que colisiona',
      hashCalculoValidado: hashOriginal,
      numeroVersionEsperado: 1, // Desfasada
      analistaUsuarioId: 'analista-elena-02'
    });
    assert.fail('Debio rechazar por conflicto de version optimista');
  } catch (err: any) {
    assert.equal(err.codigoError, 'CONFLICTO_CONCURRENCIA');
  }

  // Intento con hash desactualizado -> DEBE FALLAR con CALCULO_DESACTUALIZADO (422)
  try {
    await casoActualizarDecision.ejecutar({
      identificadorDecision: 'dec-sku-01',
      estadoDecision: 'APROBADO',
      cantidadAjusteManual: 36,
      justificacionAjuste: 'Reintento con calculo viejo',
      hashCalculoValidado: 'hash_obsoleto_invalido_12345678901234567890123456789012345678901234',
      numeroVersionEsperado: 2,
      analistaUsuarioId: 'analista-mariana-01'
    });
    assert.fail('Debio rechazar por calculo desactualizado');
  } catch (err: any) {
    assert.equal(err.codigoError, 'CALCULO_DESACTUALIZADO');
  }

  // 4. Verificacion de Trazabilidad en Auditoria Inmutable
  const eventosAuditados = await repoAud.consultarEventos();
  assert.ok(eventosAuditados.length >= 3, 'Deben haberse registrado al menos 3 eventos de auditoria');
  const tiposEventos = eventosAuditados.map(e => e.tipoEvento);
  assert.ok(tiposEventos.includes('AUTOASIGNACION_PROVEEDOR'));
  assert.ok(tiposEventos.includes('LIBERACION_PROVEEDOR_FORZADA'));
  assert.ok(tiposEventos.includes('ACTUALIZAR_DECISION_SKU'));

  // 5. Verificacion de Rutas en Fastify
  const servidor = await construirServidor();
  const resSalud = await servidor.inject({ method: 'GET', url: '/api/v1/salud' });
  assert.equal(resSalud.statusCode, 200);

  // Verificacion de proteccion de rutas: sin token da 401
  const resProveedoresSinAuth = await servidor.inject({ method: 'GET', url: '/api/v1/proveedores' });
  assert.equal(resProveedoresSinAuth.statusCode, 401);

  const resPropuestaSinAuth = await servidor.inject({ method: 'GET', url: '/api/v1/propuestas/proveedor/12345678-1234-1234-1234-123456789012' });
  assert.equal(resPropuestaSinAuth.statusCode, 401);

  await servidor.close();
}

correrPruebasBloque2()
  .then(() => {
    console.log('BLOQUE_2_PRUEBAS_UNITARIAS_OK');
  })
  .catch((err) => {
    console.error('ERROR_BLOQUE_2:', err);
    process.exit(1);
  });
