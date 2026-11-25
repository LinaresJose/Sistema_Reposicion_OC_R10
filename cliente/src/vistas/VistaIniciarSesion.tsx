import React, { useState } from 'react';
import { Lock, Mail, AlertCircle, ShieldCheck } from 'lucide-react';
import { usarAutenticacion } from '../contextos/contexto-autenticacion.js';
import { ErrorApi } from '../servicios/cliente-api.js';

export const VistaIniciarSesion: React.FC = () => {
  const { iniciarSesion } = usarAutenticacion();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCargando(true);

    try {
      await iniciarSesion(correo, clave);
    } catch (err: any) {
      if (err instanceof ErrorApi) {
        if (err.estadoOperacion === 'USUARIO_BLOQUEADO_TEMPORALMENTE') {
          setError('Cuenta bloqueada temporalmente por multiples intentos fallidos. Intente en 15 minutos.');
        } else if (err.estadoOperacion === 'CREDENCIALES_INVALIDAS') {
          setError('Correo electronico o contrasena incorrectos.');
        } else {
          setError(err.message || 'Error al iniciar sesion');
        }
      } else {
        setError('No se pudo conectar con el servidor.');
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 via-sky-50/30 to-slate-100">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sky-700 text-white font-black text-2xl shadow-md mb-4">
            R10
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Acceso al Sistema
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Motor de Reposicion y Generacion de Ordenes de Compra
          </p>
          <div className="flex items-center justify-center gap-2 mt-2 text-[11px] font-semibold text-slate-400">
            <span>MULTIMARCAS DEL CENTRO</span>
            <span>&bull;</span>
            <span>GRUPO FERRETERO LYNOX</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={manejarEnvio} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Correo Electronico
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="analista@empresa.com"
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white transition-all text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Contrasena
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white transition-all text-slate-900"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full mt-2 py-2.5 px-4 bg-sky-700 hover:bg-sky-800 text-white font-semibold text-sm rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {cargando ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Iniciar Sesion
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            Seguridad con cifrado Argon2id, bloqueo progresivo y sesiones RBAC seguras.
          </p>
        </div>
      </div>
    </div>
  );
};
