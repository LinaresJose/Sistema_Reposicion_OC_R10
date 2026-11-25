// Vista de Historial de Ordenes de Compra
// Visible para todos los roles con distintos niveles de accion
import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Eye, RefreshCw, Search, Filter } from 'lucide-react';
import { usarAutenticacion } from '../contextos/contexto-autenticacion.js';
import { servicioOrdenes } from '../servicios/servicio-ordenes.js';
import { OrdenCompraResumen, EstadoOrdenCompra } from '../tipos/orden-compra.js';

const ETIQUETAS_ESTADO: Record<EstadoOrdenCompra, string> = {
  BORRADOR: 'Borrador',
  EN_REVISION_WHATSAPP: 'En Revision WhatsApp',
  APROBADA_PARA_EMISION: 'Aprobada',
  OC_EMITIDA: 'OC Emitida',
  CANCELADA: 'Cancelada'
};

const COLORES_ESTADO: Record<EstadoOrdenCompra, string> = {
  BORRADOR: 'bg-slate-100 text-slate-700',
  EN_REVISION_WHATSAPP: 'bg-amber-100 text-amber-700',
  APROBADA_PARA_EMISION: 'bg-emerald-100 text-emerald-700',
  OC_EMITIDA: 'bg-sky-100 text-sky-700',
  CANCELADA: 'bg-red-100 text-red-700'
};

interface ModalDetalleOrdenProps {
  orden: OrdenCompraResumen | null;
  alCerrar: () => void;
  puedeDescargar: boolean;
}

const ModalDetalleOrden: React.FC<ModalDetalleOrdenProps> = ({ orden, alCerrar, puedeDescargar }) => {
  const [descargando, setDescargando] = useState<string | null>(null);

  if (!orden) return null;

  const descargar = async (tipo: 'pdf-propuesta' | 'png-whatsapp' | 'oc-oficial') => {
    setDescargando(tipo);
    try {
      if (tipo === 'pdf-propuesta') {
        await servicioOrdenes.descargarPropuesta(orden.identificadorOrden, 'PDF');
      } else if (tipo === 'png-whatsapp') {
        await servicioOrdenes.descargarPropuesta(orden.identificadorOrden, 'PNG');
      } else {
        await servicioOrdenes.descargarOrdenOficial(orden.identificadorOrden, orden.numeroCorrelativoOficial);
      }
    } finally {
      setDescargando(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {orden.numeroCorrelativoOficial || `Orden ${orden.identificadorOrden.slice(-8).toUpperCase()}`}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{orden.proveedorNombre || (orden as any).nombreProveedor || 'Proveedor'}</p>
          </div>
          <button onClick={alCerrar} className="text-slate-400 hover:text-slate-600 text-lg font-bold px-2">×</button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="font-semibold text-slate-600">Estado:</span> <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${COLORES_ESTADO[orden.estadoOrden]}`}>{ETIQUETAS_ESTADO[orden.estadoOrden]}</span></div>
            <div><span className="font-semibold text-slate-600">Analista:</span> <span className="text-slate-700 ml-1">{orden.analistaNombre || (orden as any).nombreAnalistaCreadora || 'Analista'}</span></div>
            {orden.analistaTelefono && <div><span className="font-semibold text-slate-600">Tel. Analista:</span> <span className="text-slate-700 ml-1">{orden.analistaTelefono}</span></div>}
            <div><span className="font-semibold text-slate-600">Empresa Emisora:</span> <span className="text-slate-700 ml-1">{orden.codigoRazonSocialEmisora || (orden as any).codigoEmpresaEmisora || '—'}</span></div>
            {orden.canalAprobacion && <div><span className="font-semibold text-slate-600">Canal Aprobacion:</span> <span className="text-slate-700 ml-1">{orden.canalAprobacion === 'INSTRUCCION_VERBAL_WHATSAPP' ? 'WhatsApp' : 'Sistema Web'}</span></div>}
            {orden.fechaAprobacion && <div><span className="font-semibold text-slate-600">Aprobada:</span> <span className="text-slate-700 ml-1">{new Date(orden.fechaAprobacion).toLocaleDateString('es-VE')}</span></div>}
            {orden.fechaEmisionOficial && <div><span className="font-semibold text-slate-600">Emitida:</span> <span className="text-slate-700 ml-1">{new Date(orden.fechaEmisionOficial).toLocaleDateString('es-VE')}</span></div>}
          </div>

          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-700 mb-2">Resumen Economico (USD)</p>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <p className="text-[10px] text-slate-500">Bruto</p>
                <p className="font-bold text-slate-900">${orden.montoTotalBrutoUSD?.toFixed(2) || '0.00'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">Impuesto</p>
                <p className="font-bold text-slate-900">${orden.montoTotalImpuestoUSD?.toFixed(2) || '0.00'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">Neto Total</p>
                <p className="font-bold text-sky-700">${orden.montoTotalNetoUSD?.toFixed(2) || '0.00'}</p>
              </div>
            </div>
          </div>

          {orden.notaRespaldoAprobacion && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <span className="font-semibold">Nota de Aprobacion: </span>{orden.notaRespaldoAprobacion}
            </div>
          )}

          {puedeDescargar && (
            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold text-slate-600 mb-2">Descargar Documentos</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => descargar('pdf-propuesta')}
                  disabled={!!descargando}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" /> PDF Propuesta
                </button>
                <button
                  onClick={() => descargar('png-whatsapp')}
                  disabled={!!descargando}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" /> PNG WhatsApp
                </button>
                {orden.estadoOrden === 'OC_EMITIDA' && (
                  <button
                    onClick={() => descargar('oc-oficial')}
                    disabled={!!descargando}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <FileText className="w-3.5 h-3.5" /> OC Oficial PDF
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const VistaHistorialOrdenes: React.FC = () => {
  const { esAdmin, esGerente, usuario } = usarAutenticacion();
  const [ordenes, setOrdenes] = useState<OrdenCompraResumen[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<EstadoOrdenCompra | ''>('');
  const [busqueda, setBusqueda] = useState('');
  const [ordenDetalle, setOrdenDetalle] = useState<OrdenCompraResumen | null>(null);

  const puedeDescargar = !!(esAdmin || esGerente || usuario);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const resultado = await servicioOrdenes.listarOrdenes(
        filtroEstado ? { estadoOrden: filtroEstado } : undefined
      );
      setOrdenes(resultado);
    } catch (e: any) {
      setError(e?.message || 'Error al cargar ordenes de compra.');
    } finally {
      setCargando(false);
    }
  }, [filtroEstado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const ordenesFiltradas = busqueda
    ? ordenes.filter(o => {
        const prov = (o.proveedorNombre || (o as any).nombreProveedor || '').toLowerCase();
        const anal = (o.analistaNombre || (o as any).nombreAnalistaCreadora || '').toLowerCase();
        const correlativo = (o.numeroCorrelativoOficial || '').toLowerCase();
        const term = busqueda.toLowerCase();
        return prov.includes(term) || anal.includes(term) || correlativo.includes(term);
      })
    : ordenes;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-5 h-5 text-sky-700" />
          <h1 className="text-lg font-bold text-slate-900">Historial de Ordenes de Compra</h1>
        </div>
        <p className="text-xs text-slate-500">Todas las ordenes del sistema con descarga de documentos.</p>
      </div>

      {/* Barra de filtros */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
            placeholder="Buscar por proveedor, analista o numero OC..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value as EstadoOrdenCompra | '')}
          >
            <option value="">Todos los estados</option>
            <option value="BORRADOR">Borrador</option>
            <option value="EN_REVISION_WHATSAPP">En Revision WhatsApp</option>
            <option value="APROBADA_PARA_EMISION">Aprobada</option>
            <option value="OC_EMITIDA">OC Emitida</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
        </div>
        <button onClick={cargar} className="p-2 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors" title="Recargar">
          <RefreshCw className="w-4 h-4" />
        </button>
        <span className="text-xs text-slate-400">{ordenesFiltradas.length} orden(es)</span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3 mb-4">{error}</div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-semibold text-slate-600">OC / Correlativo</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Proveedor</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Analista</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Empresa</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Neto USD</th>
              <th className="text-center px-4 py-3 font-semibold text-slate-600">Estado</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Creada</th>
              <th className="text-center px-4 py-3 font-semibold text-slate-600">Ver</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cargando ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Cargando ordenes...</td></tr>
            ) : ordenesFiltradas.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No hay ordenes de compra.</td></tr>
            ) : (
              ordenesFiltradas.map(o => (
                <tr key={o.identificadorOrden} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-slate-700">
                    {o.numeroCorrelativoOficial || `#${o.identificadorOrden.slice(-6).toUpperCase()}`}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-slate-900 max-w-[200px] truncate">{o.proveedorNombre || (o as any).nombreProveedor || 'Proveedor'}</td>
                  <td className="px-4 py-2.5 text-slate-600">{o.analistaNombre || (o as any).nombreAnalistaCreadora || 'Analista'}</td>
                  <td className="px-4 py-2.5">
                    {(o.codigoRazonSocialEmisora || (o as any).codigoEmpresaEmisora)
                      ? <span className="px-2 py-0.5 bg-slate-900 text-white text-[10px] font-bold rounded">{o.codigoRazonSocialEmisora || (o as any).codigoEmpresaEmisora}</span>
                      : <span className="text-slate-400">—</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-900">${(o.montoTotalNetoUSD || 0).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${COLORES_ESTADO[o.estadoOrden]}`}>
                      {ETIQUETAS_ESTADO[o.estadoOrden]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                    {new Date(o.creadoEn).toLocaleDateString('es-VE')}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={() => setOrdenDetalle(o)}
                      className="p-1.5 text-slate-400 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors"
                      title="Ver detalle"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ModalDetalleOrden
        orden={ordenDetalle}
        alCerrar={() => setOrdenDetalle(null)}
        puedeDescargar={puedeDescargar}
      />
    </div>
  );
};
