export type RolSistema = 
  | 'ADMINISTRADOR_SISTEMA'
  | 'GERENTE_COMPRAS'
  | 'ANALISTA_COMPRAS'
  | 'AUDITOR_CONTROL';

export interface UsuarioSesion {
  identificadorUsuario: string;
  nombreCompleto: string;
  correoElectronico: string;
  rolId: RolSistema;
  telefonoContacto?: string | null;
  estaActivo: boolean;
}

export interface RespuestaAutenticacion {
  estadoOperacion: string;
  mensaje: string;
  datos?: {
    usuario: UsuarioSesion;
    expiracionTokenMinutos: number;
  };
}
