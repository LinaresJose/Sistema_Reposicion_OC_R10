import { PuertoRepositorioUsuarios } from '../../dominio/puertos/puerto-repositorio-usuarios.js';
import { UsuarioSesionPublica } from '../../dominio/entidades/usuario.js';
import { ServicioArgon2id } from '../../infraestructura/seguridad/servicio-argon2id.js';

export interface SolicitudInicioSesion {
  correoElectronico: string;
  claveSecreta: string;
}

export interface ResultadoInicioSesion {
  usuario: UsuarioSesionPublica;
}

export class ErrorAutenticacion extends Error {
  constructor(mensaje: string, public codigoError: string) {
    super(mensaje);
    this.name = 'ErrorAutenticacion';
  }
}

export class CasoUsoIniciarSesion {
  constructor(private readonly repositorioUsuarios: PuertoRepositorioUsuarios) {}

  async ejecutar(solicitud: SolicitudInicioSesion): Promise<ResultadoInicioSesion> {
    const correoNormalizado = solicitud.correoElectronico.trim().toLowerCase();
    const usuario = await this.repositorioUsuarios.buscarPorCorreo(correoNormalizado);

    if (!usuario) {
      throw new ErrorAutenticacion('Credenciales de acceso incorrectas', 'CREDENCIALES_INVALIDAS');
    }

    if (!usuario.estaActivo) {
      throw new ErrorAutenticacion('La cuenta de usuario se encuentra inactiva', 'CUENTA_INACTIVA');
    }

    // Comprobar si la cuenta se encuentra bloqueada temporalmente
    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
      const minutosRestantes = Math.ceil((usuario.bloqueadoHasta.getTime() - Date.now()) / (1000 * 60));
      throw new ErrorAutenticacion(
        `Cuenta bloqueada temporalmente por multiples intentos fallidos. Intente nuevamente en ${minutosRestantes} minutos`,
        'CUENTA_BLOQUEADA'
      );
    }

    // Verificacion de clave con Argon2id
    const esClaveValida = await ServicioArgon2id.verificarClave(usuario.claveSecretaHash, solicitud.claveSecreta);

    if (!esClaveValida) {
      await this.repositorioUsuarios.registrarIntentoFallido(usuario.identificadorUsuario);
      throw new ErrorAutenticacion('Credenciales de acceso incorrectas', 'CREDENCIALES_INVALIDAS');
    }

    // Restablecer intentos fallidos si el login fue exitoso
    if (usuario.intentosFallidosLogin > 0 || usuario.bloqueadoHasta) {
      await this.repositorioUsuarios.restablecerIntentosFallidos(usuario.identificadorUsuario);
    }

    return {
      usuario: {
        identificadorUsuario: usuario.identificadorUsuario,
        nombreCompleto: usuario.nombreCompleto,
        correoElectronico: usuario.correoElectronico,
        rolId: usuario.rolId,
        categoriaCompradora: usuario.categoriaCompradora,
        telefonoContacto: usuario.telefonoContacto ?? null
      }
    };
  }
}
