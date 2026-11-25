import React, { useState, useEffect, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Bell, 
  LogOut, 
  User, 
  Layers, 
  UploadCloud,
  FileText,
  Shield,
  ClipboardList
} from 'lucide-react';
import { usarAutenticacion } from '../../contextos/contexto-autenticacion.js';
import { servicioNotificaciones } from '../../servicios/servicio-notificaciones.js';
import { servicioOrdenes } from '../../servicios/servicio-ordenes.js';
import { NotificacionUsuario } from '../../tipos/notificacion.js';

export type PestanaNavegacion = 'CARTERA' | 'PROPUESTA' | 'CARGAS_ODOO' | 'HISTORIAL_ORDENES' | 'AUDITORIA' | 'ADMINISTRACION';

interface BarraNavegacionProps {
  pestanaActiva: PestanaNavegacion;
  alCambiarPestana: (pestana: PestanaNavegacion) => void;
  nombreProveedorActivo?: string | null;
}

export const BarraNavegacion: React.FC<BarraNavegacionProps> = ({
  pestanaActiva,
  alCambiarPestana,
  nombreProveedorActivo
}) => {
  const { usuario, cerrarSesion, esAdmin, esGerente, esAuditor } = usarAutenticacion();
  const [notificaciones, setNotificaciones] = useState<NotificacionUsuario[]>([]);
  const [totalNoLeidas, setTotalNoLeidas] = useState<number>(0);
  const [menuNotificacionesAbierto, setMenuNotificacionesAbierto] = useState<boolean>(false);
  const [exportandoExcel, setExportandoExcel] = useState<boolean>(false);
  const referenciaMenu = useRef<HTMLDivElement>(null);

  // Polling ligero de notificaciones cada 45 segundos
  useEffect(() => {
    let cancelado = false;

    const cargarNotificaciones = async () => {
      try {
        const resultado = await servicioNotificaciones.consultarNotificaciones(false, 20);
        if (!cancelado) {
          setNotificaciones(resultado.notificaciones);
          setTotalNoLeidas(resultado.totalNoLeidas);
        }
      } catch {
        // En caso de error de red o sesion expirada, ignorar silenciosamente en polling
      }
    };

    cargarNotificaciones();
    const intervalo = setInterval(cargarNotificaciones, 45000);

    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, []);

  // Cerrar dropdown al hacer click afuera
  useEffect(() => {
    const clickAfuera = (e: MouseEvent) => {
      if (referenciaMenu.current && !referenciaMenu.current.contains(e.target as Node)) {
        setMenuNotificacionesAbierto(false);
      }
    };
    document.addEventListener('mousedown', clickAfuera);
    return () => document.removeEventListener('mousedown', clickAfuera);
  }, []);

  const manejarMarcarLeida = async (id: string) => {
    try {
      await servicioNotificaciones.marcarLeida(id);
      setNotificaciones((previas) =>
        previas.map((n) => (n.identificadorNotificacion === id ? { ...n, haSidoLeida: true } : n))
      );
      setTotalNoLeidas((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error(e);
    }
  };

  const manejarMarcarTodasLeidas = async () => {
    try {
      await servicioNotificaciones.marcarTodasLeidas();
      setNotificaciones((previas) => previas.map((n) => ({ ...n, haSidoLeida: true })));
      setTotalNoLeidas(0);
    } catch (e) {
      console.error(e);
    }
  };

  const manejarExportarExcel = async () => {
    setExportandoExcel(true);
    try {
      await servicioOrdenes.exportarVistaControlR10();
    } catch (e) {
      alert('Error al exportar vista de control R10 a Excel');
    } finally {
      setExportandoExcel(false);
    }
  };

  const formatearRol = (rol?: string) => {
    switch (rol) {
      case 'ADMINISTRADOR_SISTEMA':
        return 'Administrador';
      case 'GERENTE_COMPRAS':
        return 'Gerente de Compras';
      case 'ANALISTA_COMPRAS':
        return 'Analista de Compras';
      case 'AUDITOR_CONTROL':
        return 'Auditor de Control';
      default:
        return rol || '';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo y Titulo */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-700 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                R10
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 leading-tight">
                  Sistema de Reposicion
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  MMC & LYNOX &bull; Motor R10
                </p>
              </div>
            </div>

            {/* Selector de Pestanas */}
            <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => alCambiarPestana('CARTERA')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pestanaActiva === 'CARTERA'
                    ? 'bg-white text-sky-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-4 h-4" />
                Cartera de Proveedores
              </button>

              <button
                onClick={() => alCambiarPestana('PROPUESTA')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pestanaActiva === 'PROPUESTA'
                    ? 'bg-white text-sky-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Propuesta R10
                {nombreProveedorActivo && (
                  <span className="text-xs px-2 py-0.5 bg-sky-100 text-sky-800 rounded-full font-semibold max-w-[130px] truncate">
                    {nombreProveedorActivo}
                  </span>
                )}
              </button>

              {(esAdmin || esGerente) && (
                <button
                  onClick={() => alCambiarPestana('CARGAS_ODOO')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    pestanaActiva === 'CARGAS_ODOO'
                      ? 'bg-white text-sky-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  Cargas Odoo
                </button>
              )}

              <button
                onClick={() => alCambiarPestana('HISTORIAL_ORDENES')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pestanaActiva === 'HISTORIAL_ORDENES'
                    ? 'bg-white text-sky-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                Ordenes
              </button>

              {(esAdmin || esGerente || esAuditor) && (
                <button
                  onClick={() => alCambiarPestana('AUDITORIA')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    pestanaActiva === 'AUDITORIA'
                      ? 'bg-white text-sky-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  Auditoria
                </button>
              )}

              {esAdmin && (
                <button
                  onClick={() => alCambiarPestana('ADMINISTRACION')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    pestanaActiva === 'ADMINISTRACION'
                      ? 'bg-white text-purple-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Admin
                </button>
              )}
            </nav>
          </div>

          {/* Acciones Derecha */}
          <div className="flex items-center gap-3">
            {/* Boton Exportar Vista Control R10 */}
            <button
              onClick={manejarExportarExcel}
              disabled={exportandoExcel}
              title="Exportar archivo Excel de Control R10"
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              {exportandoExcel ? 'Generando...' : 'Exportar Excel R10'}
            </button>

            {/* Campana de Notificaciones */}
            <div className="relative" ref={referenciaMenu}>
              <button
                onClick={() => setMenuNotificacionesAbierto(!menuNotificacionesAbierto)}
                className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                title="Notificaciones"
              >
                <Bell className="w-5 h-5" />
                {totalNoLeidas > 0 && (
                  <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-600 rounded-full ring-2 ring-white">
                    {totalNoLeidas > 99 ? '99+' : totalNoLeidas}
                  </span>
                )}
              </button>

              {menuNotificacionesAbierto && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                    <span className="text-sm font-semibold text-slate-800">
                      Notificaciones ({totalNoLeidas} nuevas)
                    </span>
                    {totalNoLeidas > 0 && (
                      <button
                        onClick={manejarMarcarTodasLeidas}
                        className="text-xs text-sky-600 hover:text-sky-800 font-medium"
                      >
                        Marcar todas leídas
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notificaciones.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-500">
                        No hay notificaciones recientes
                      </div>
                    ) : (
                      notificaciones.map((notif) => (
                        <div
                          key={notif.identificadorNotificacion}
                          className={`p-3 text-left transition-colors ${
                            notif.haSidoLeida ? 'bg-white opacity-70' : 'bg-sky-50/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-xs font-semibold text-slate-900">
                              {notif.tituloNotificacion}
                            </h4>
                            {!notif.haSidoLeida && (
                              <button
                                onClick={() => manejarMarcarLeida(notif.identificadorNotificacion)}
                                className="text-[10px] text-sky-600 hover:text-sky-800 font-medium whitespace-nowrap"
                              >
                                Marcar
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                            {notif.cuerpoMensaje}
                          </p>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {new Date(notif.creadoEn).toLocaleString('es-VE')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Informacion de Usuario */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                <User className="w-4 h-4" />
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-slate-800 leading-tight">
                  {usuario?.nombreCompleto}
                </div>
                <div className="text-[10px] font-medium text-slate-500">
                  {formatearRol(usuario?.rolId)}
                </div>
              </div>

              <button
                onClick={cerrarSesion}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
                title="Cerrar sesion"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
