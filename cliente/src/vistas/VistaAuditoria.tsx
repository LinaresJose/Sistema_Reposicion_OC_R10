// Vista de Historial de Auditoria Inmutable
// Acceso: ADMINISTRADOR_SISTEMA, GERENTE_COMPRAS, AUDITOR_CONTROL
import React, { useState, useEffect, useCallback } from 'react';
import { Shield, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { servicioAuditoria, EventoAuditoria } from '../servicios/servicio-auditoria.js';

const ETIQUETAS_ENTIDAD: Record<string, string> = {
  usuario: 'Usuario',
  proveedor: 'Proveedor',
  orden_compra: 'Orden de Compra',
  empresa_razon_social: 'Razon Social',
  carga_archivo_odoo: 'Carga Odoo'
};

const COLORES_EVENTO: Record<string, string> = {
  INICIAR_SESION: 'bg-slate-100 text-slate-700',
  CREAR_USUARIO: 'bg-purple-100 text-purple-700',
  ACTUALIZAR_USUARIO: 'bg-blue-100 text-blue-700',
  AUTOASIGNAR_PROVEEDOR: 'bg-emerald-100 text-emerald-700',
  LIBERAR_PROVEEDOR: 'bg-amber-100 text-amber-700',
  CREAR_ORDEN: 'bg-sky-100 text-sky-700',
  APROBAR_ORDEN: 'bg-green-100 text-green-700',
  EMITIR_ORDEN: 'bg-indigo-100 text-indigo-700',
  ACTUALIZAR_RAZON_SOCIAL: 'bg-orange-100 text-orange-700'
};

const FilaEvento: React.FC<{ evento: EventoAuditoria }> = ({ evento }) => {
  const [expandido, setExpandido] = useState(false);
  const tieneDetalles = evento.estadoAnterior || evento.estadoNuevo;

  return (
    <>
      <tr
        className={`hover:bg-slate-50 cursor-pointer ${expandido ? 'bg-slate-50' : ''}`}
        onClick={() => tieneDetalles && setExpandido(e => !e)}
      >
        <td className="px-4 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">
          {new Date(evento.marcaTiempo).toLocaleString('es-VE')}
        </td>
        <td className="px-4 py-2.5">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${COLORES_EVENTO[evento.tipoEvento] || 'bg-slate-100 text-slate-700'}`}>
            {evento.tipoEvento.replace(/_/g, ' ')}
          </span>
        </td>
        <td className="px-4 py-2.5 text-[11px] text-slate-600">
          {ETIQUETAS_ENTIDAD[evento.nombreEntidad] || evento.nombreEntidad}
        </td>
        <td className="px-4 py-2.5 text-[11px] text-slate-500 font-mono">
          {evento.identificadorEntidad.length > 16
            ? `...${evento.identificadorEntidad.slice(-12)}`
            : evento.identificadorEntidad}
        </td>
        <td className="px-4 py-2.5 text-[11px] text-slate-500 font-mono">
          {evento.usuarioId
            ? `...${evento.usuarioId.slice(-8)}`
            : '—'}
        </td>
        <td className="px-4 py-2.5 text-center">
          {tieneDetalles && (
            <span className="text-slate-400">
              {expandido ? <ChevronDown className="w-3.5 h-3.5 inline" /> : <ChevronRight className="w-3.5 h-3.5 inline" />}
            </span>
          )}
        </td>
      </tr>
      {expandido && tieneDetalles && (
        <tr className="bg-slate-50">
          <td colSpan={6} className="px-4 pb-3 pt-0">
            <div className="grid grid-cols-2 gap-3 mt-1">
              {evento.estadoAnterior && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 mb-1">Estado Anterior</p>
                  <pre className="text-[10px] bg-white border border-slate-200 rounded p-2 overflow-auto max-h-32 text-slate-700">
                    {JSON.stringify(evento.estadoAnterior, null, 2)}
                  </pre>
                </div>
              )}
              {evento.estadoNuevo && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 mb-1">Estado Nuevo</p>
                  <pre className="text-[10px] bg-white border border-slate-200 rounded p-2 overflow-auto max-h-32 text-slate-700">
                    {JSON.stringify(evento.estadoNuevo, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export const VistaAuditoria: React.FC = () => {
  const [eventos, setEventos] = useState<EventoAuditoria[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtroEntidad, setFiltroEntidad] = useState('');
  const [limite, setLimite] = useState(100);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const resultado = await servicioAuditoria.consultar({
        entidad: filtroEntidad || undefined,
        limite
      });
      setEventos(resultado.eventos);
    } catch (e: any) {
      setError(e?.message || 'Error al cargar historial de auditoria.');
    } finally {
      setCargando(false);
    }
  }, [filtroEntidad, limite]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-sky-700" />
          <h1 className="text-lg font-bold text-slate-900">Historial de Auditoria Inmutable</h1>
        </div>
        <p className="text-xs text-slate-500">Registro de todas las acciones del sistema. Solo lectura — no se puede modificar.</p>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-4">
        <select
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
          value={filtroEntidad}
          onChange={e => setFiltroEntidad(e.target.value)}
        >
          <option value="">Todas las entidades</option>
          <option value="usuario">Usuarios</option>
          <option value="proveedor">Proveedores</option>
          <option value="orden_compra">Ordenes de Compra</option>
          <option value="empresa_razon_social">Razones Sociales</option>
          <option value="carga_archivo_odoo">Cargas Odoo</option>
        </select>
        <select
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
          value={limite}
          onChange={e => setLimite(Number(e.target.value))}
        >
          <option value={50}>Ultimos 50</option>
          <option value={100}>Ultimos 100</option>
          <option value={250}>Ultimos 250</option>
          <option value={500}>Ultimos 500</option>
        </select>
        <button
          onClick={cargar}
          className="p-2 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors"
          title="Recargar"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <span className="text-xs text-slate-400 ml-auto">{eventos.length} evento(s)</span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3 mb-4">{error}</div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Fecha/Hora</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Evento</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Entidad</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">ID Entidad</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">ID Usuario</th>
              <th className="text-center px-4 py-3 font-semibold text-slate-600">Detalles</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cargando ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Cargando...</td></tr>
            ) : eventos.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No hay eventos de auditoria.</td></tr>
            ) : (
              eventos.map(e => <FilaEvento key={e.identificadorAuditoria} evento={e} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
