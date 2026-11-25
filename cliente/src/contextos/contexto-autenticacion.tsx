import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { UsuarioSesion, RolSistema } from '../tipos/usuario.js';
import { servicioAutenticacion } from '../servicios/servicio-autenticacion.js';

interface ContextoAutenticacionTipo {
  usuario: UsuarioSesion | null;
  cargando: boolean;
  iniciarSesion: (correo: string, clave: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
  refrescarPerfil: () => Promise<void>;
  esAdmin: boolean;
  esGerente: boolean;
  esAnalista: boolean;
  esAuditor: boolean;
  puedeAprobar: boolean;
  puedeEmitir: boolean;
  puedeSubirOdoo: boolean;
  puedeEditarProveedor: boolean;
}

const ContextoAutenticacion = createContext<ContextoAutenticacionTipo | undefined>(undefined);

export const ProveedorAutenticacion: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);

  const refrescarPerfil = useCallback(async () => {
    try {
      const perfil = await servicioAutenticacion.consultarPerfil();
      setUsuario(perfil);
    } catch {
      setUsuario(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    refrescarPerfil();
  }, [refrescarPerfil]);

  const iniciarSesion = async (correo: string, clave: string) => {
    setCargando(true);
    try {
      const usuarioLogueado = await servicioAutenticacion.iniciarSesion(correo, clave);
      setUsuario(usuarioLogueado);
    } finally {
      setCargando(false);
    }
  };

  const cerrarSesion = async () => {
    try {
      await servicioAutenticacion.cerrarSesion();
    } finally {
      setUsuario(null);
    }
  };

  const rol: RolSistema | undefined = usuario?.rolId;
  const esAdmin = rol === 'ADMINISTRADOR_SISTEMA';
  const esGerente = rol === 'GERENTE_COMPRAS';
  const esAnalista = rol === 'ANALISTA_COMPRAS';
  const esAuditor = rol === 'AUDITOR_CONTROL';

  // Permisos derivados
  const puedeAprobar = esAdmin || esGerente;
  const puedeEmitir = esAdmin || esGerente;
  const puedeSubirOdoo = esAdmin || esGerente;
  const puedeEditarProveedor = esAdmin || esGerente || esAnalista;

  return (
    <ContextoAutenticacion.Provider
      value={{
        usuario,
        cargando,
        iniciarSesion,
        cerrarSesion,
        refrescarPerfil,
        esAdmin,
        esGerente,
        esAnalista,
        esAuditor,
        puedeAprobar,
        puedeEmitir,
        puedeSubirOdoo,
        puedeEditarProveedor
      }}
    >
      {children}
    </ContextoAutenticacion.Provider>
  );
};

export function usarAutenticacion(): ContextoAutenticacionTipo {
  const contexto = useContext(ContextoAutenticacion);
  if (!contexto) {
    throw new Error('usarAutenticacion debe usarse dentro de un ProveedorAutenticacion');
  }
  return contexto;
}
