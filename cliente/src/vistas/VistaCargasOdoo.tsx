import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  FileCheck, 
  XCircle,
  FolderOpen
} from 'lucide-react';
import { servicioCargasOdoo, ResultadoProcesamientoCarga } from '../servicios/servicio-cargas-odoo.js';
import { RegistroCargaOdoo, HallazgoArchivo } from '../tipos/carga-odoo.js';

export const VistaCargasOdoo: React.FC = () => {
  const [archivos, setArchivos] = useState<{
    catalogoCostos?: File;
    inventarioMano?: File;
    comprasTransito?: File;
    historialVentasPrecios?: File;
  }>({});

  const [procesando, setProcesando] = useState<boolean>(false);
  const [resultado, setResultado] = useState<ResultadoProcesamientoCarga | null>(null);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [historial, setHistorial] = useState<RegistroCargaOdoo[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState<boolean>(true);
  const inputLoteRef = useRef<HTMLInputElement>(null);

  const cargarHistorial = async () => {
    setCargandoHistorial(true);
    try {
      const registros = await servicioCargasOdoo.consultarHistorial(20);
      setHistorial(registros);
    } catch {
      // Ignorar errores menores al cargar historial
    } finally {
      setCargandoHistorial(false);
    }
  };

  useEffect(() => {
    cargarHistorial();
  }, []);

  // ── Autodeteccion de archivos por nombre de archivo ──────────────────────
  const detectarCampo = (nombre: string): keyof typeof archivos | null => {
    const n = nombre.toLowerCase();
    if (n.includes('product.template') || n.includes('plantilla_de_producto') || n.includes('catalogo') || n.includes('product_template')) return 'catalogoCostos';
    if (n.includes('stock') || n.includes('inventario') || n.includes('quant')) return 'inventarioMano';
    if (n.includes('purchase') || n.includes('compra')) return 'comprasTransito';
    if (n.includes('sale') || n.includes('venta') || n.includes('multi.price') || n.includes('precio')) return 'historialVentasPrecios';
    return null;
  };

  // ── Selector individual por tarjeta ─────────────────────────────────────
  const manejarSeleccionArchivo = (campo: keyof typeof archivos, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setArchivos((prev) => ({ ...prev, [campo]: e.target.files![0] }));
    }
  };

  // ── Selector multiple de los 4 archivos en un clic ──────────────────────
  const manejarSeleccionLote = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const nuevosArchivos: typeof archivos = { ...archivos };
    const noReconocidos: string[] = [];

    Array.from(e.target.files).forEach((archivo) => {
      const campo = detectarCampo(archivo.name);
      if (campo) {
        nuevosArchivos[campo] = archivo;
      } else {
        noReconocidos.push(archivo.name);
      }
    });

    setArchivos(nuevosArchivos);
    if (noReconocidos.length > 0) {
      setErrorGlobal(`Archivo(s) no reconocido(s) por nombre: ${noReconocidos.join(', ')}. Asignelo manualmente con el boton correspondiente.`);
    } else {
      setErrorGlobal(null);
    }
  };

  const manejarProcesar = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalSeleccionados = Object.values(archivos).filter(Boolean).length;
    if (totalSeleccionados === 0) {
      alert('Por favor seleccione al menos un archivo .xlsx para procesar.');
      return;
    }

    setProcesando(true);
    setResultado(null);
    setErrorGlobal(null);

    try {
      const resp = await servicioCargasOdoo.procesarArchivos(archivos);
      setResultado(resp);
      await cargarHistorial();
    } catch (err: any) {
      // Mostrar el mensaje detallado del backend (422 con hallazgos fila x fila)
      setErrorGlobal(err.message || 'Error al procesar archivos de Odoo');
      // Si el error trae datos de hallazgos, mostrarlos como resultado parcial
      if (err.detalles?.hallazgos || err.detalles?.datos?.hallazgos) {
        const datosError = err.detalles?.datos || err.detalles;
        setResultado(datosError as ResultadoProcesamientoCarga);
      }
    } finally {
      setProcesando(false);
    }
  };

  const configuracionArchivos = [
    {
      campo: 'catalogoCostos' as const,
      titulo: '1. Catalogo de Productos y Costos',
      descripcion: 'Columnas: default_code (SKU), barcode, name, standard_price, uom_po_id',
      archivo: archivos.catalogoCostos
    },
    {
      campo: 'inventarioMano' as const,
      titulo: '2. Inventario a Mano Actual',
      descripcion: 'Columnas: default_code, qty_available (stock disponible)',
      archivo: archivos.inventarioMano
    },
    {
      campo: 'comprasTransito' as const,
      titulo: '3. Compras en Transito',
      descripcion: 'Columnas: default_code, product_qty, date_planned (ETA)',
      archivo: archivos.comprasTransito
    },
    {
      campo: 'historialVentasPrecios' as const,
      titulo: '4. Historial de Ventas y Precios',
      descripcion: 'Columnas: default_code, qty_sold, price_unit',
      archivo: archivos.historialVentasPrecios
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Cabecera */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <UploadCloud className="w-6 h-6 text-sky-700" />
          Ingesta, Validacion y Recalculo Odoo
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Carga de los 4 archivos maestros exportados de Odoo con validacion estricta fila por fila y disparo controlado del Motor R10.
        </p>
      </div>

      {/* Formulario de Carga */}
      <form onSubmit={manejarProcesar} className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-6">

        {/* Selector en lote — los 4 archivos de una sola vez */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-sky-50 border border-sky-200">
          <FolderOpen className="w-5 h-5 text-sky-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sky-900">Cargar los 4 archivos de una sola vez</p>
            <p className="text-[11px] text-sky-700 mt-0.5">El sistema los reconoce automaticamente por nombre de archivo (product.template, purchase.order, sale.order, multi.price).</p>
          </div>
          <label className="shrink-0 cursor-pointer px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 text-white hover:bg-sky-700 transition-colors">
            Seleccionar 4 archivos
            <input
              type="file"
              accept=".xlsx,.xls"
              multiple
              className="hidden"
              onChange={manejarSeleccionLote}
              ref={inputLoteRef}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {configuracionArchivos.map((cfg) => (
            <div
              key={cfg.campo}
              className={`p-4 rounded-xl border-2 border-dashed transition-all ${
                cfg.archivo
                  ? 'border-emerald-400 bg-emerald-50/30'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <FileSpreadsheet className={`w-4 h-4 ${cfg.archivo ? 'text-emerald-600' : 'text-slate-400'}`} />
                    {cfg.titulo}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1">{cfg.descripcion}</p>
                </div>

                {cfg.archivo && (
                  <span className="p-1 rounded-full bg-emerald-100 text-emerald-700">
                    <FileCheck className="w-4 h-4" />
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <input
                  type="file"
                  id={`input-${cfg.campo}`}
                  accept=".xlsx,.xls"
                  onChange={(e) => manejarSeleccionArchivo(cfg.campo, e)}
                  className="hidden"
                />
                <label
                  htmlFor={`input-${cfg.campo}`}
                  className="px-3 py-1.5 text-xs font-semibold text-sky-700 bg-white hover:bg-sky-50 border border-sky-300 rounded-lg cursor-pointer transition-colors shadow-2xs"
                >
                  {cfg.archivo ? 'Cambiar Archivo' : 'Seleccionar .xlsx'}
                </label>

                {cfg.archivo && (
                  <span className="text-[11px] text-slate-600 font-mono truncate max-w-[200px]" title={cfg.archivo.name}>
                    {cfg.archivo.name}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-400">
            Arquitectura desacoplada: valida SHA-256, estructura, integridad de SKUs y prepara conexion futura a API RPC.
          </p>

          <button
            type="submit"
            disabled={procesando}
            className="flex items-center gap-2 px-5 py-2.5 bg-sky-700 hover:bg-sky-800 text-white font-semibold text-xs rounded-lg shadow-sm disabled:opacity-50 transition-colors"
          >
            {procesando ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Validando y Recalculando...
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                Procesar Archivos Odoo
              </>
            )}
          </button>
        </div>
      </form>

      {/* Alerta de Error Global */}
      {errorGlobal && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs">
          <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorGlobal}</span>
        </div>
      )}

      {/* Panel de Resultado de la Carga */}
      {resultado && (
        <div className={`p-6 rounded-xl border shadow-xs space-y-4 ${
          resultado.estadoOperacion === 'RECHAZADO_CON_ERRORES'
            ? 'bg-rose-50/40 border-rose-200'
            : resultado.estadoOperacion === 'SIN_CAMBIOS'
            ? 'bg-slate-50 border-slate-200'
            : 'bg-emerald-50/40 border-emerald-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {resultado.estadoOperacion === 'EXITOSO' && (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              )}
              {resultado.estadoOperacion === 'RECHAZADO_CON_ERRORES' && (
                <XCircle className="w-5 h-5 text-rose-600" />
              )}
              {resultado.estadoOperacion === 'SIN_CAMBIOS' && (
                <CheckCircle2 className="w-5 h-5 text-slate-500" />
              )}
              <h3 className="text-sm font-bold text-slate-900">
                Resultado: {resultado.mensaje}
              </h3>
            </div>

            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
              {resultado.estadoOperacion}
            </span>
          </div>

          {/* Estadisticas de novedades */}
          {resultado.resumenNovedades && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs">
                <span className="text-slate-500">Filas Procesadas:</span>
                <div className="font-bold text-slate-900 text-base">{resultado.totalFilasProcesadas}</div>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs">
                <span className="text-slate-500">Novedades Detectadas:</span>
                <div className="font-bold text-sky-800 text-base">{resultado.totalNovedadesDetectadas}</div>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs">
                <span className="text-slate-500">SKUs Nuevos / Actualizados:</span>
                <div className="font-bold text-slate-900 text-base">
                  {resultado.resumenNovedades.skusNuevos || 0} / {resultado.resumenNovedades.skusActualizados || 0}
                </div>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs">
                <span className="text-slate-500">Recalculo Motor R10:</span>
                <div className="font-bold text-emerald-700 text-base">
                  {resultado.recalculoEjecutado ? 'EJECUTADO' : 'NO REQUERIDO'}
                </div>
              </div>
            </div>
          )}

          {/* Tabla de Hallazgos y Errores fila por fila si existen */}
          {resultado.totalFilasConErrores > 0 && resultado.hallazgos && (
            <div className="mt-4 pt-4 border-t border-rose-200">
              <h4 className="text-xs font-bold text-rose-900 mb-2">
                Reporte de Hallazgos y Errores de Validacion:
              </h4>
              <div className="max-h-60 overflow-y-auto rounded-lg border border-rose-200 bg-white">
                <table className="min-w-full divide-y divide-rose-100 text-left text-xs">
                  <thead className="bg-rose-50/60 font-semibold text-rose-800">
                    <tr>
                      <th className="px-3 py-2">Archivo</th>
                      <th className="px-3 py-2 text-center">Fila</th>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2">Tipo de Error</th>
                      <th className="px-3 py-2">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-50 text-slate-700">
                    {Object.entries(resultado.hallazgos).flatMap(([archivoNombre, lista]) =>
                      lista.map((hallazgo: HallazgoArchivo, idx: number) => (
                        <tr key={`${archivoNombre}-${idx}`} className="hover:bg-rose-50/30">
                          <td className="px-3 py-2 font-mono text-[11px] font-semibold">{archivoNombre}</td>
                          <td className="px-3 py-2 text-center font-bold text-slate-900">{hallazgo.fila}</td>
                          <td className="px-3 py-2 font-mono text-slate-800">{hallazgo.sku || '-'}</td>
                          <td className="px-3 py-2 text-rose-700 font-semibold">{hallazgo.tipoHallazgo}</td>
                          <td className="px-3 py-2 text-slate-600">{hallazgo.mensaje}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Historial de Cargas Anteriores */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            Historial de Cargas Odoo
          </h3>
          <button
            onClick={cargarHistorial}
            className="text-xs text-sky-600 hover:text-sky-800 font-medium"
          >
            Refrescar
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Fecha y Hora</th>
                <th className="px-4 py-3">Usuario Responsable</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-center">Filas Procesadas</th>
                <th className="px-4 py-3 text-center">Novedades</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-700">
              {cargandoHistorial ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Cargando historial de cargas...
                  </td>
                </tr>
              ) : historial.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No se registran cargas previas de Odoo en el sistema.
                  </td>
                </tr>
              ) : (
                historial.map((reg) => (
                  <tr key={reg.identificadorCarga} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-900">
                      {new Date(reg.fechaHoraCarga).toLocaleString('es-VE')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {reg.nombreUsuario || 'Administrador'}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        reg.estadoCarga === 'PROCESADO_EXITOSO'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : reg.estadoCarga === 'RECHAZADO_CON_ERRORES'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {reg.estadoCarga}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap font-semibold">
                      {reg.totalFilasProcesadas.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap font-semibold text-sky-800">
                      {reg.totalNovedadesDetectadas}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
