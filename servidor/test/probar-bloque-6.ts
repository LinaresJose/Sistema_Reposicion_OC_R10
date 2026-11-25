// Pruebas unitarias de Bloque 6: Administracion, Usuarios, Razones Sociales y Auditoria
import assert from 'node:assert';
import { CasoUsoListarUsuarios } from '../src/aplicacion/administracion/caso-uso-listar-usuarios.js';
import { CasoUsoCrearUsuario, ErrorCrearUsuario } from '../src/aplicacion/administracion/caso-uso-crear-usuario.js';
import { CasoUsoActualizarUsuario, ErrorActualizarUsuario } from '../src/aplicacion/administracion/caso-uso-actualizar-usuario.js';
import { CasoUsoGestionarRazonesSociales } from '../src/aplicacion/administracion/caso-uso-gestionar-razones-sociales.js';
import { PuertoRepositorioUsuarios } from '../src/dominio/puertos/puerto-repositorio-usuarios.js';
import { PuertoRepositorioAuditoria } from '../src/dominio/puertos/puerto-repositorio-auditoria.js';
import { Usuario } from '../src/dominio/entidades/usuario.js';
import { RegistroAuditoria } from '../src/dominio/entidades/registro-auditoria.js';
import { ROLES_SISTEMA, CATEGORIAS_COMPRADORA } from '../src/configuracion/constantes-negocio.js';

// Mocks en memoria
class RepositorioAuditoriaMemoria implements PuertoRepositorioAuditoria {
  public eventos: any[] = [];
  async registrarEvento(evento: any): Promise<void> {
    this.eventos.push({
      ...evento,
      identificadorAuditoria: `aud-${this.eventos.length + 1}`,
      marcaTiempo: new Date()
    });
  }
  async consultarEventos(filtros?: any): Promise<RegistroAuditoria[]> {
    return this.eventos as RegistroAuditoria[];
  }
}

class RepositorioUsuariosMemoria implements PuertoRepositorioUsuarios {
  public usuarios: Usuario[] = [];

  constructor() {
    this.usuarios.push({
      identificadorUsuario: 'user-admin-1',
      nombreCompleto: 'Admin Maestro',
      correoElectronico: 'admin@sistema.local',
      claveSecretaHash: '$argon2id$mock',
      rolId: ROLES_SISTEMA.ADMINISTRADOR_SISTEMA,
      categoriaCompradora: CATEGORIAS_COMPRADORA.NINGUNA,
      estaActivo: true,
      intentosFallidosLogin: 0,
      bloqueadoHasta: null,
      telefonoContacto: '+58-412-1111111',
      creadoEn: new Date(),
      actualizadoEn: new Date()
    });
  }

  async buscarPorCorreo(correoElectronico: string): Promise<Usuario | null> {
    return this.usuarios.find(u => u.correoElectronico.toLowerCase() === correoElectronico.toLowerCase()) || null;
  }
  async buscarPorId(id: string): Promise<Usuario | null> {
    return this.usuarios.find(u => u.identificadorUsuario === id) || null;
  }
  async registrarIntentoFallido(id: string): Promise<void> {}
  async restablecerIntentosFallidos(id: string): Promise<void> {}
  async actualizarClaveSecreta(id: string, nuevaClaveHash: string): Promise<void> {
    const u = await this.buscarPorId(id);
    if (u) u.claveSecretaHash = nuevaClaveHash;
  }
}

async function ejecutarPruebas() {
  const repoAuditoria = new RepositorioAuditoriaMemoria();
  const repoUsuarios = new RepositorioUsuariosMemoria();

  // Test 1: CasoUsoActualizarUsuario validaciones
  const casoActualizar = new CasoUsoActualizarUsuario(repoUsuarios, repoAuditoria);

  // Intentar actualizar usuario inexistente
  await assert.rejects(
    async () => {
      await casoActualizar.ejecutar('id-inexistente', { nombreCompleto: 'Nombre X' }, 'user-admin-1', true);
    },
    (err: any) => err instanceof ErrorActualizarUsuario && err.codigo === 'USUARIO_NO_ENCONTRADO'
  );

  // Nombre muy corto
  await assert.rejects(
    async () => {
      await casoActualizar.ejecutar('user-admin-1', { nombreCompleto: 'AB' }, 'user-admin-1', true);
    },
    (err: any) => err instanceof ErrorActualizarUsuario && err.codigo === 'DATOS_INVALIDOS'
  );

  // No admin intentando cambiar rol de otro
  await assert.rejects(
    async () => {
      await casoActualizar.ejecutar('user-admin-1', { rolId: ROLES_SISTEMA.GERENTE_COMPRAS }, 'user-otro', false);
    },
    (err: any) => err instanceof ErrorActualizarUsuario && err.codigo === 'SIN_PERMISO'
  );

  // Test 2: Validacion de roles y entidades
  assert.strictEqual(ROLES_SISTEMA.ADMINISTRADOR_SISTEMA, 'ADMINISTRADOR_SISTEMA');
  assert.strictEqual(ROLES_SISTEMA.GERENTE_COMPRAS, 'GERENTE_COMPRAS');
  assert.strictEqual(ROLES_SISTEMA.ANALISTA_COMPRAS, 'ANALISTA_COMPRAS');
  assert.strictEqual(ROLES_SISTEMA.AUDITOR_CONTROL, 'AUDITOR_CONTROL');

  console.log('PRUEBAS_BLOQUE_6_UNITARIAS_COMPLETADAS_CORRECTAMENTE');
}

ejecutarPruebas().catch((e) => {
  console.error('ERROR EN PRUEBAS:', e);
  process.exit(1);
});
