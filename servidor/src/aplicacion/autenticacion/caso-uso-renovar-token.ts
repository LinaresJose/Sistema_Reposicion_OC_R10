import { PuertoRepositorioUsuarios } from '../../dominio/puertos/puerto-repositorio-usuarios.js';
import { UsuarioSesionPublica } from '../../dominio/entidades/usuario.js';
import { ErrorAutenticacion } from './caso-uso-iniciar-sesion.js';

export class CasoUsoRenovarToken {
  constructor(private readonly repositorioUsuarios: PuertoRepositorioUsuarios) {}

  async ejecutar(identificadorUsuario: string): Promise<UsuarioSesionPublica> {
    const usuario = await this.repositorioUsuarios.buscarPorId(identificadorUsuario);

    if (!usuario) {
      throw new ErrorAutenticacion('Usuario no encontrado', 'USUARIO_NO_ENCONTRADO');
    }

    if (!usuario.estaActivo) {
      throw new ErrorAutenticacion('La cuenta de usuario se encuentra inactiva', 'CUENTA_INACTIVA');
    }

    return {
      identificadorUsuario: usuario.identificadorUsuario,
      nombreCompleto: usuario.nombreCompleto,
      correoElectronico: usuario.correoElectronico,
      rolId: usuario.rolId,
      categoriaCompradora: usuario.categoriaCompradora,
      telefonoContacto: usuario.telefonoContacto ?? null
    };
  }
}
