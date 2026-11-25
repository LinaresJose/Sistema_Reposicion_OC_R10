import assert from 'node:assert/strict';
import { ServicioArgon2id } from '../src/infraestructura/seguridad/servicio-argon2id.js';
import { CasoUsoIniciarSesion, ErrorAutenticacion } from '../src/aplicacion/autenticacion/caso-uso-iniciar-sesion.js';
import { PuertoRepositorioUsuarios } from '../src/dominio/puertos/puerto-repositorio-usuarios.js';
import { Usuario } from '../src/dominio/entidades/usuario.js';
import { ROLES_SISTEMA, PERMISOS_OPERATIVOS, RolSistema, TipoPermiso } from '../src/configuracion/constantes-negocio.js';
import { construirServidor } from '../src/infraestructura/servidor.js';

// Repositorio en memoria para pruebas aisladas y deterministas
class RepositorioUsuariosMemoria implements PuertoRepositorioUsuarios {
  private usuarios: Map<string, Usuario> = new Map();

  agregarUsuario(usuario: Usuario) {
    this.usuarios.set(usuario.correoElectronico.toLowerCase(), usuario);
  }

  async buscarPorCorreo(correoElectronico: string): Promise<Usuario | null> {
    const u = this.usuarios.get(correoElectronico.toLowerCase());
    return u ? { ...u } : null;
  }

  async buscarPorId(identificadorUsuario: string): Promise<Usuario | null> {
    for (const u of this.usuarios.values()) {
      if (u.identificadorUsuario === identificadorUsuario) {
        return { ...u };
      }
    }
    return null;
  }

  async registrarIntentoFallido(identificadorUsuario: string, minutosBloqueo: number = 15): Promise<void> {
    for (const [correo, u] of this.usuarios.entries()) {
      if (u.identificadorUsuario === identificadorUsuario) {
        u.intentosFallidosLogin += 1;
        if (u.intentosFallidosLogin >= 5) {
          u.bloqueadoHasta = new Date(Date.now() + minutosBloqueo * 60 * 1000);
        }
        this.usuarios.set(correo, u);
        break;
      }
    }
  }

  async restablecerIntentosFallidos(identificadorUsuario: string): Promise<void> {
    for (const [correo, u] of this.usuarios.entries()) {
      if (u.identificadorUsuario === identificadorUsuario) {
        u.intentosFallidosLogin = 0;
        u.bloqueadoHasta = null;
        this.usuarios.set(correo, u);
        break;
      }
    }
  }

  async actualizarClaveSecreta(identificadorUsuario: string, nuevaClaveHash: string): Promise<void> {
    for (const [correo, u] of this.usuarios.entries()) {
      if (u.identificadorUsuario === identificadorUsuario) {
        u.claveSecretaHash = nuevaClaveHash;
        u.intentosFallidosLogin = 0;
        u.bloqueadoHasta = null;
        this.usuarios.set(correo, u);
        break;
      }
    }
  }
}

async function ejecutarPruebas() {
  // 1. Prueba de Hasheo y Verificacion Argon2id
  const clavePrueba = 'ClaveSegura2026!';
  const hashGenerado = await ServicioArgon2id.hashearClave(clavePrueba);
  assert.ok(hashGenerado.startsWith('$argon2id$'), 'El hash debe iniciar con $argon2id$');
  
  const coincideCorrecta = await ServicioArgon2id.verificarClave(hashGenerado, clavePrueba);
  assert.equal(coincideCorrecta, true, 'La clave correcta debe verificar positivamente');

  const coincideErronea = await ServicioArgon2id.verificarClave(hashGenerado, 'ClaveIncorrecta!');
  assert.equal(coincideErronea, false, 'La clave incorrecta debe ser rechazada');

  // 2. Prueba del Caso de Uso Iniciar Sesion con credenciales validas
  const repoMemoria = new RepositorioUsuariosMemoria();
  repoMemoria.agregarUsuario({
    identificadorUsuario: 'user-admin-01',
    nombreCompleto: 'Admin General',
    correoElectronico: 'admin@multimarcas.com',
    claveSecretaHash: hashGenerado,
    rolId: ROLES_SISTEMA.ADMINISTRADOR_SISTEMA,
    categoriaCompradora: 'NINGUNA',
    estaActivo: true,
    intentosFallidosLogin: 0,
    bloqueadoHasta: null,
    creadoEn: new Date(),
    actualizadoEn: new Date()
  });

  const casoUsoLogin = new CasoUsoIniciarSesion(repoMemoria);
  const resultadoLogin = await casoUsoLogin.ejecutar({
    correoElectronico: 'admin@multimarcas.com',
    claveSecreta: clavePrueba
  });

  assert.equal(resultadoLogin.usuario.correoElectronico, 'admin@multimarcas.com');
  assert.equal(resultadoLogin.usuario.rolId, ROLES_SISTEMA.ADMINISTRADOR_SISTEMA);

  // 3. Prueba de Bloqueo Progresivo tras 5 intentos fallidos
  for (let i = 1; i <= 4; i++) {
    try {
      await casoUsoLogin.ejecutar({
        correoElectronico: 'admin@multimarcas.com',
        claveSecreta: 'PasswordErrado'
      });
      assert.fail('Debio lanzar error de credenciales invalidas');
    } catch (e: any) {
      assert.equal(e.codigoError, 'CREDENCIALES_INVALIDAS');
    }
  }

  // Intento 5: debe fallar y bloquear
  try {
    await casoUsoLogin.ejecutar({
      correoElectronico: 'admin@multimarcas.com',
      claveSecreta: 'PasswordErrado'
    });
    assert.fail('Debio fallar en el 5to intento');
  } catch (e: any) {
    assert.equal(e.codigoError, 'CREDENCIALES_INVALIDAS');
  }

  // Intento 6: debe indicar que la cuenta esta bloqueada temporalmente
  try {
    await casoUsoLogin.ejecutar({
      correoElectronico: 'admin@multimarcas.com',
      claveSecreta: clavePrueba
    });
    assert.fail('Debio rechazar por cuenta bloqueada');
  } catch (e: any) {
    assert.equal(e.codigoError, 'CUENTA_BLOQUEADA');
  }

  // 4. Verificacion de Matriz RBAC
  // ADMINISTRADOR_SISTEMA debe tener acceso garantizado a TODOS los permisos
  const todosLosPermisos = Object.keys(PERMISOS_OPERATIVOS) as TipoPermiso[];
  for (const permiso of todosLosPermisos) {
    const roles: readonly RolSistema[] = PERMISOS_OPERATIVOS[permiso];
    const tieneAccesoAdmin = roles.includes(ROLES_SISTEMA.ADMINISTRADOR_SISTEMA);
    assert.equal(tieneAccesoAdmin, true, `ADMINISTRADOR_SISTEMA debe tener acceso al permiso ${permiso}`);
  }

  // GERENTE_COMPRAS y ADMINISTRADOR_SISTEMA comparten los permisos de operacion y emision
  assert.ok(PERMISOS_OPERATIVOS.REGISTRAR_APROBACION_WHATSAPP.includes(ROLES_SISTEMA.GERENTE_COMPRAS));
  assert.ok(PERMISOS_OPERATIVOS.REGISTRAR_APROBACION_WHATSAPP.includes(ROLES_SISTEMA.ADMINISTRADOR_SISTEMA));
  assert.ok(PERMISOS_OPERATIVOS.EMITIR_ORDEN_COMPRA_OFICIAL.includes(ROLES_SISTEMA.GERENTE_COMPRAS));
  assert.ok(PERMISOS_OPERATIVOS.EMITIR_ORDEN_COMPRA_OFICIAL.includes(ROLES_SISTEMA.ADMINISTRADOR_SISTEMA));

  // 5. Prueba de Arranque y Healthcheck del Servidor Fastify
  const servidor = await construirServidor();
  const respuestaSalud = await servidor.inject({
    method: 'GET',
    url: '/api/v1/salud'
  });
  assert.equal(respuestaSalud.statusCode, 200);
  const cuerpoSalud = JSON.parse(respuestaSalud.body);
  assert.equal(cuerpoSalud.estado, 'OPERATIVO');

  await servidor.close();
}

ejecutarPruebas()
  .then(() => {
    console.log('PRUEBAS_UNITARIAS_RBAC_OK');
  })
  .catch((err) => {
    console.error('ERROR_PRUEBAS:', err);
    process.exit(1);
  });
