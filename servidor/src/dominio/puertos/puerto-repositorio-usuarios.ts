import { Usuario } from '../entidades/usuario.js';

export interface PuertoRepositorioUsuarios {
  buscarPorCorreo(correoElectronico: string): Promise<Usuario | null>;
  buscarPorId(identificadorUsuario: string): Promise<Usuario | null>;
  registrarIntentoFallido(identificadorUsuario: string, minutosBloqueo?: number): Promise<void>;
  restablecerIntentosFallidos(identificadorUsuario: string): Promise<void>;
  actualizarClaveSecreta(identificadorUsuario: string, nuevaClaveHash: string): Promise<void>;
}
