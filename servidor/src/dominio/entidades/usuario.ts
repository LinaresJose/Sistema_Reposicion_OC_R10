import { RolSistema, CategoriaCompradora } from '../../configuracion/constantes-negocio.js';

export interface Usuario {
  identificadorUsuario: string;
  nombreCompleto: string;
  correoElectronico: string;
  claveSecretaHash: string;
  rolId: RolSistema;
  categoriaCompradora: CategoriaCompradora;
  estaActivo: boolean;
  intentosFallidosLogin: number;
  bloqueadoHasta: Date | null;
  telefonoContacto: string | null;
  creadoEn: Date;
  actualizadoEn: Date;
}

export interface UsuarioSesionPublica {
  identificadorUsuario: string;
  nombreCompleto: string;
  correoElectronico: string;
  rolId: RolSistema;
  categoriaCompradora: CategoriaCompradora;
  telefonoContacto: string | null;
}
