import { realizarPeticion } from './cliente-api.js';
import { UsuarioSesion } from '../tipos/usuario.js';

export const servicioAutenticacion = {
  async iniciarSesion(correoElectronico: string, contrasena: string): Promise<UsuarioSesion> {
    const respuesta = await realizarPeticion<any>('/autenticacion/iniciar-sesion', {
      method: 'POST',
      body: JSON.stringify({
        correoElectronico,
        claveSecreta: contrasena,
        contrasena
      })
    });
    return respuesta.datos?.usuario || respuesta.datos;
  },

  async cerrarSesion(): Promise<void> {
    await realizarPeticion('/autenticacion/cerrar-sesion', {
      method: 'POST'
    });
  },

  async consultarPerfil(): Promise<UsuarioSesion> {
    const respuesta = await realizarPeticion<any>('/autenticacion/perfil', {
      method: 'GET'
    });
    return respuesta.datos?.usuario || respuesta.datos;
  },

  async renovarToken(): Promise<void> {
    await realizarPeticion('/autenticacion/renovar-token', {
      method: 'POST'
    });
  }
};
