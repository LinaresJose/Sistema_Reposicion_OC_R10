import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  UserCheck, 
  Unlock, 
  Edit3, 
  ArrowRight, 
  Clock, 
  Layers, 
  AlertCircle,
  RefreshCw,
  Building
} from 'lucide-react';
import { usarAutenticacion } from '../contextos/contexto-autenticacion.js';
import { servicioProveedores } from '../servicios/servicio-proveedores.js';
import { Proveedor, CategoriaCompradora, EstadoAsignacionProveedor } from '../tipos/proveedor.js';
import { ModalEditarProveedor } from './ModalEditarProveedor.js';

interface VistaCarteraProveedoresProps {
  alSeleccionarProveedorParaPropuesta: (proveedor: Proveedor) => void;
}

export const VistaCarteraProveedores: React.FC<VistaCarteraProveedoresProps> = ({
  alSeleccionarProveedorParaPropuesta
}) => {
  const { usuario, esAdmin, esGerente, puedeEditarProveedor } = usarAutenticacion();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS');
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [busqueda, setBusqueda] = useState<string>('');

  // Modal de edicion de proveedor
  const [proveedorAEditar, setProveedorAEditar] = useState<Proveedor | null>(null);
  const [modalEdicionAbierto, setModalEdicionAbierto] = useState<boolean>(false);

  const cargarProveedores = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const datos = await servicioProveedores.listarProveedores({
        categoria: filtroCategoria !== 'TODAS' ? (filtroCategoria as CategoriaCompradora) : undefined,
        estadoAsignacion: filtroEstado !== 'TODOS' ? (filtroEstado as EstadoAsignacionProveedor) : undefined,
        busqueda: busqueda.trim() ? busqueda.trim() : undefined
      });
      setProveedores(datos);
    } catch (err: any) {
      setError(err.message || 'Error al cargar la cartera de proveedores');
    } finally {
      setCargando(false);
    }
  }, [filtroCategoria, filtroEstado, busqueda]);

  useEffect(() => {
    cargarProveedores();
  }, [cargarProveedores]);

  const manejarAutoasignar = async (proveedor: Proveedor) => {
    try {
      await servicioProveedores.autoasignarProveedor(proveedor.identificadorProveedor);
      await cargarProveedores();
    } catch (err: any) {
      alert(err.message || 'Error al autoasignar proveedor');
    }
  };

  const manejarLiberar = async (proveedor: Proveedor) => {
    const confirmacion = window.confirm(
      `¿Esta seguro de liberar al proveedor ${proveedor.nombreRazonSocial}?`
    );
    if (!confirmacion) return;

    try {
      await servicioProveedores.liberarProveedor(proveedor.identificadorProveedor, 'Liberacion desde vista web');
      await cargarProveedores();
    } catch (err: any) {
      alert(err.message || 'Error al liberar proveedor');
    }
  };

  const abrirEdicion = (proveedor: Proveedor) => {
    setProveedorAEditar(proveedor);
    setModalEdicionAbierto(true);
  };

  const manejarGuardadoExitoso = (proveedorActualizado: Proveedor) => {
    setProveedores((previos) =>
      previos.map((p) =>
        p.identificadorProveedor === proveedorActualizado.identificadorProveedor
          ? { ...p, ...proveedorActualizado }
          : p
      )
    );
  };

  const formatearMonto = (monto: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(monto);
  };

  const categorias = [
    { clave: 'TODAS', etiqueta: 'Todas las Categorias' },
    { clave: 'NACIONAL_1', etiqueta: 'Nacional 1' },
    { clave: 'NACIONAL_2', etiqueta: 'Nacional 2' },
    { clave: 'NACIONAL_3', etiqueta: 'Nacional 3' },
    { clave: 'INTERNACIONAL', etiqueta: 'Internacional' }
  ];

  const estados = [
    { clave: 'TODOS', etiqueta: 'Todos los Estados' },
    { clave: 'DISPONIBLE', etiqueta: 'Disponible' },
    { clave: 'EN_PROCESO_TRABAJO', etiqueta: 'En Proceso' },
    { clave: 'EN_REVISION_WHATSAPP', etiqueta: 'En Revision WhatsApp' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Cabecera y Titulo */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-sky-700" />
            Cartera de Proveedores
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gestion de asignaciones dinamicas, parametros de reposicion y catalogo clasificado.
          </p>
        </div>

        <button
          onClick={cargarProveedores}
          disabled={cargando}
          className="self-start md:self-auto flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
          Refrescar Cartera
        </button>
      </div>

      {/* Barra de Filtros y Busqueda */}
      <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200 space-y-4">
        {/* Selector de Chips de Categoria */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 mr-1">Categoria:</span>
          {categorias.map((cat) => (
            <button
              key={cat.clave}
              onClick={() => setFiltroCategoria(cat.clave)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                filtroCategoria === cat.clave
                  ? 'bg-sky-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.etiqueta}
            </button>
          ))}
        </div>

        {/* Busqueda y Filtro de Estado */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-slate-100">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por razon social o RIF..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white text-slate-900"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Estado:</span>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 text-slate-800"
            >
              {estados.map((est) => (
                <option key={est.clave} value={est.clave}>
                  {est.etiqueta}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Alerta de Error */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabla de Proveedores */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50/80 font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3">Proveedor / RIF</th>
                <th scope="col" className="px-4 py-3">Categoria</th>
                <th scope="col" className="px-4 py-3 text-center">Plazo / Frecuencia</th>
                <th scope="col" className="px-4 py-3 text-center">SKUs Aptos</th>
                <th scope="col" className="px-4 py-3 text-right">Monto Sugerido</th>
                <th scope="col" className="px-4 py-3 text-center">Estado Asignacion</th>
                <th scope="col" className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
              {cargando ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <div className="inline-block w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Cargando cartera de proveedores...</p>
                  </td>
                </tr>
              ) : proveedores.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    No se encontraron proveedores que coincidan con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                proveedores.map((prov) => {
                  const estaAsignadoAMi = prov.analistaAsignadaId === usuario?.identificadorUsuario;
                  const estaOcupadoPorOtro = prov.analistaAsignadaId && !estaAsignadoAMi;
                  const puedeLiberar = estaAsignadoAMi || esAdmin || esGerente;

                  return (
                    <tr 
                      key={prov.identificadorProveedor} 
                      className={`hover:bg-slate-50/70 transition-colors ${
                        estaAsignadoAMi ? 'bg-sky-50/30' : ''
                      }`}
                    >
                      {/* Proveedor y RIF */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-slate-400 shrink-0" />
                          <div>
                            <div className="font-semibold text-slate-900 line-clamp-1">
                              {prov.nombreRazonSocial}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {prov.registroInformacionFiscal || 'Sin RIF registrado'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {(prov.categoriaCompradora || 'NACIONAL_1').replace('_', ' ')}
                        </span>
                      </td>

                      {/* Plazo / Frecuencia */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span className="font-medium text-slate-800">{prov.plazoEntregaDias ?? 0}d</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="font-medium text-slate-800">{prov.frecuenciaCompraDias ?? 0}d</span>
                      </td>

                      {/* SKUs Aptos */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap font-medium text-slate-800">
                        {prov.totalSkusAptos ?? 0}
                      </td>

                      {/* Monto Sugerido */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap font-semibold text-slate-900">
                        {formatearMonto(prov.montoSugeridoTotalUSD || 0)}
                      </td>

                      {/* Estado Asignacion */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {prov.estadoAsignacion === 'DISPONIBLE' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Disponible
                          </span>
                        )}

                        {prov.estadoAsignacion === 'EN_PROCESO_TRABAJO' && (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3" />
                              En Proceso
                            </span>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {prov.nombreAnalistaAsignada || 'Analista'}
                            </div>
                          </div>
                        )}

                        {prov.estadoAsignacion === 'EN_REVISION_WHATSAPP' && (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                              Revision WhatsApp
                            </span>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {prov.nombreAnalistaAsignada || 'Analista'}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-1">
                        {/* Autoasignar */}
                        {prov.estadoAsignacion === 'DISPONIBLE' && (
                          <button
                            onClick={() => manejarAutoasignar(prov)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors"
                            title="Autoasignarse proveedor"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Tomar
                          </button>
                        )}

                        {/* Liberar */}
                        {prov.estadoAsignacion !== 'DISPONIBLE' && puedeLiberar && (
                          <button
                            onClick={() => manejarLiberar(prov)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                            title={estaOcupadoPorOtro ? 'Forzar liberacion' : 'Liberar proveedor'}
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            Liberar
                          </button>
                        )}

                        {/* Editar Proveedor (Analistas, Gerentes y Administradores) */}
                        {puedeEditarProveedor && (
                          <button
                            onClick={() => abrirEdicion(prov)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors"
                            title="Editar proveedor y categoria"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Editar
                          </button>
                        )}

                        {/* Trabajar Propuesta */}
                        <button
                          onClick={() => alSeleccionarProveedorParaPropuesta(prov)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg shadow-2xs transition-colors"
                          title="Abrir propuesta R10 de este proveedor"
                        >
                          Propuesta
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Edicion de Proveedor */}
      <ModalEditarProveedor
        estaAbierto={modalEdicionAbierto}
        alCerrar={() => setModalEdicionAbierto(false)}
        proveedor={proveedorAEditar}
        alGuardarExitoso={manejarGuardadoExitoso}
      />
    </div>
  );
};
