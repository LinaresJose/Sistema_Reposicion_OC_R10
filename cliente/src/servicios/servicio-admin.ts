// Servicio de Administracion del Sistema
// Acceso a endpoints /api/v1/admin/*
import { realizarPeticion } from './cliente-api.js';

export interface UsuarioAdmin {
  identificadorUsuario: string;
  nombreCompleto: string;
  correoElectronico: string;
  rolId: string;
  categoriaCompradora: string;
  estaActivo: boolean;
  telefonoContacto: string | null;
  creadoEn: string;
  actualizadoEn: string;
  intentosFallidosLogin: number;
  bloqueadoHasta: string | null;
}

export interface FormularioCrearUsuario {
  nombreCompleto: string;
  correoElectronico: string;
  contrasenaPlana: string;
  rolId: string;
  categoriaCompradora?: string;
  telefonoContacto?: string;
}

export interface FormularioActualizarUsuario {
  nombreCompleto?: string;
  rolId?: string;
  categoriaCompradora?: string;
  telefonoContacto?: string | null;
  estaActivo?: boolean;
  nuevaContrasena?: string;
  contrasenaActual?: string;
}

export interface RazonSocialAdmin {
  id: string;
  codigoIdentificador: string;
  nombreLegal: string;
  rif: string;
  direccionFiscal: string;
  telefonos: string | null;
  correoContacto: string | null;
  tieneLogoConfigurado: boolean;
  fechaActualizacion: string;
}

export interface FormularioActualizarRazonSocial {
  nombreLegal?: string;
  rif?: string;
  direccionFiscal?: string;
  telefonos?: string;
  correoContacto?: string;
  urlLogoBase64?: string;
}

export const servicioAdmin = {
  // Usuarios
  async listarUsuarios(filtros?: { soloActivos?: boolean; rol?: string }): Promise<{ usuarios: UsuarioAdmin[]; total: number }> {
    const params = new URLSearchParams();
    if (filtros?.soloActivos) params.set('soloActivos', 'true');
    if (filtros?.rol) params.set('rol', filtros.rol);
    const qs = params.toString();
    return realizarPeticion(`/api/v1/admin/usuarios${qs ? `?${qs}` : ''}`);
  },

  async crearUsuario(datos: FormularioCrearUsuario): Promise<{ identificadorUsuario: string }> {
    return realizarPeticion('/api/v1/admin/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
  },

  async actualizarUsuario(id: string, datos: FormularioActualizarUsuario): Promise<void> {
    return realizarPeticion(`/api/v1/admin/usuarios/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
  },

  async cambiarContrasenaPropia(nuevaContrasena: string, contrasenaActual: string): Promise<void> {
    return realizarPeticion('/api/v1/admin/perfil/contrasena', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nuevaContrasena, contrasenaActual })
    });
  },

  // Razones Sociales
  async listarRazonesSociales(): Promise<RazonSocialAdmin[]> {
    return realizarPeticion('/api/v1/admin/razones-sociales');
  },

  async obtenerRazonSocialConLogo(id: string): Promise<RazonSocialAdmin & { urlLogoBase64: string | null }> {
    return realizarPeticion(`/api/v1/admin/razones-sociales/${id}`);
  },

  async actualizarRazonSocial(id: string, datos: FormularioActualizarRazonSocial): Promise<void> {
    return realizarPeticion(`/api/v1/admin/razones-sociales/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
  }
};
