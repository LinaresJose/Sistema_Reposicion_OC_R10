import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Image, 
  CheckCircle2, 
  Send, 
  Download, 
  AlertTriangle, 
  ArrowLeft, 
  MessageSquare, 
  Save 
} from 'lucide-react';
import { usarAutenticacion } from '../contextos/contexto-autenticacion.js';
import { servicioPropuestas } from '../servicios/servicio-propuestas.js';
import { servicioOrdenes } from '../servicios/servicio-ordenes.js';
import { ResumenPropuestaProveedor, RenglonPropuestaR10 } from '../tipos/propuesta.js';
import { Proveedor } from '../tipos/proveedor.js';
import { ModalAprobarOrden } from './ModalAprobarOrden.js';
import { ModalEmitirOrden } from './ModalEmitirOrden.js';

interface VistaPropuestaR10Props {
  proveedor: Proveedor;
  alVolverACartera: () => void;
}

export const VistaPropuestaR10: React.FC<VistaPropuestaR10Props> = ({
  proveedor,
  alVolverACartera
}) => {
  const { esAdmin, esGerente } = usarAutenticacion();
  const [propuesta, setPropuesta] = useState<ResumenPropuestaProveedor | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de modificacion local de renglones
  const [cantidadesEditadas, setCantidadesEditadas] = useState<Record<string, number>>({});
  const [justificacionesEditadas, setJustificacionesEditadas] = useState<Record<string, string>>({});
  const [guardandoRenglonId, setGuardandoRenglonId] = useState<string | null>(null);

  // Modales
  const [modalAprobarAbierto, setModalAprobarAbierto] = useState<boolean>(false);
  const [modalEmitirAbierto, setModalEmitirAbierto] = useState<boolean>(false);
  const [ordenCompraActivaId, setOrdenCompraActivaId] = useState<string | null>(null);
  const [descargando, setDescargando] = useState<string | null>(null);

  const cargarPropuesta = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const datos = await servicioPropuestas.consultarPropuestaPorProveedor(proveedor.identificadorProveedor);
      setPropuesta(datos);

      // Si existe una orden borrador asociada o si necesitamos crearla para descargar/aprobar
      if (datos.ordenCompraId) {
        setOrdenCompraActivaId(datos.ordenCompraId);
      }

      // Inicializar estados de edicion
      const cant: Record<string, number> = {};
      const just: Record<string, string> = {};
      (datos.renglones || []).forEach((r) => {
        const cantFinal = r.cantidadFinalPropuesta ?? (r as any).cantidadFinalAprobada ?? 0;
        cant[r.identificadorProducto] = cantFinal;
        just[r.identificadorProducto] = r.justificacionAjuste || '';
      });
      setCantidadesEditadas(cant);
      setJustificacionesEditadas(just);
    } catch (err: any) {
      setError(err.message || 'Error al cargar la propuesta de reposicion');
    } finally {
      setCargando(false);
    }
  }, [proveedor.identificadorProveedor]);

  useEffect(() => {
    cargarPropuesta();
  }, [cargarPropuesta]);

  const asegurarOrdenBorrador = async (): Promise<string> => {
    if (ordenCompraActivaId) return ordenCompraActivaId;
    const orden = await servicioOrdenes.crearBorrador(proveedor.identificadorProveedor);
    setOrdenCompraActivaId(orden.identificadorOrden);
    return orden.identificadorOrden;
  };

  const manejarGuardarAjusteSKU = async (renglon: RenglonPropuestaR10) => {
    const cantFinalActual = renglon.cantidadFinalPropuesta ?? (renglon as any).cantidadFinalAprobada ?? 0;
    const sugEmpaque = renglon.sugeridoAjustadoEmpaque ?? (renglon as any).cantidadSugeridaMotor ?? 0;
    const nuevaCantidad = cantidadesEditadas[renglon.identificadorProducto] ?? cantFinalActual;
    const nuevaJustificacion = justificacionesEditadas[renglon.identificadorProducto] ?? '';

    // Si la cantidad difiere de la sugerida ajustada por empaque, la justificacion es obligatoria
    if (nuevaCantidad !== sugEmpaque && (!nuevaJustificacion || nuevaJustificacion.trim().length < 5)) {
      alert('La justificacion del ajuste es obligatoria cuando la cantidad propuesta difiere del sugerido matematico (minimo 5 caracteres).');
      return;
    }

    const decisionId = renglon.identificadorDecision || (renglon as any).identificadorDecision;
    if (!decisionId) {
      alert('Identificador de decision no encontrado para este renglon.');
      return;
    }

    const hashCalculo = renglon.hashFirmaCalculo || (renglon as any).hashCalculoVigente;
    const versionEsperada = (renglon as any).numeroVersion || propuesta?.numeroVersionPropuesta || 1;

    setGuardandoRenglonId(renglon.identificadorProducto);
    try {
      await servicioPropuestas.actualizarDecisionSKU(decisionId, {
        estadoDecision: nuevaCantidad > 0 ? 'APROBADO' : 'EXCLUIDO',
        cantidadAjusteManual: nuevaCantidad,
        justificacionAjuste: nuevaJustificacion.trim() || null,
        hashCalculoValidado: hashCalculo,
        numeroVersionEsperado: versionEsperada
      });
      await cargarPropuesta();
    } catch (err: any) {
      alert(err.message || 'Error al guardar el ajuste de compra');
    } finally {
      setGuardandoRenglonId(null);
    }
  };

  const manejarAlternarRevisionWhatsApp = async () => {
    const estadoActualEsRevision = proveedor.estadoAsignacion === 'EN_REVISION_WHATSAPP';
    const nuevoEstado = !estadoActualEsRevision;

    try {
      await servicioPropuestas.cambiarEstadoRevisionWhatsApp(proveedor.identificadorProveedor, nuevoEstado);
      proveedor.estadoAsignacion = nuevoEstado ? 'EN_REVISION_WHATSAPP' : 'EN_PROCESO_TRABAJO';
      await cargarPropuesta();
    } catch (err: any) {
      alert(err.message || 'Error al actualizar estado de revision');
    }
  };

  const manejarDescargarPropuestaPDF = async () => {
    setDescargando('PDF');
    try {
      const ordenId = await asegurarOrdenBorrador();
      await servicioOrdenes.descargarPropuesta(
        ordenId,
        'PDF',
        `propuesta-${proveedor.nombreRazonSocial.replace(/\s+/g, '_')}.pdf`
      );
    } catch (err: any) {
      alert(err.message || 'Error al generar documento PDF de propuesta');
    } finally {
      setDescargando(null);
    }
  };

  const manejarDescargarPropuestaPNG = async () => {
    setDescargando('PNG');
    try {
      const ordenId = await asegurarOrdenBorrador();
      await servicioOrdenes.descargarPropuesta(
        ordenId,
        'PNG',
        `propuesta-${proveedor.nombreRazonSocial.replace(/\s+/g, '_')}.png`
      );
    } catch (err: any) {
      alert(err.message || 'Error al generar imagen PNG para WhatsApp');
    } finally {
      setDescargando(null);
    }
  };

  const manejarDescargarOrdenOficial = async () => {
    if (!ordenCompraActivaId) return;
    setDescargando('OFICIAL');
    try {
      await servicioOrdenes.descargarOrdenOficial(ordenCompraActivaId);
    } catch (err: any) {
      alert(err.message || 'Error al descargar la orden oficial');
    } finally {
      setDescargando(null);
    }
  };

  const formatearMonto = (monto: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(monto);
  };

  const insigniaUrgencia = (urgencia: string) => {
    const mapa: Record<string, string> = {
      URGENTE: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
      'COMPRAR AHORA': 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
      POSTERGAR: 'bg-slate-100 text-slate-700 border-slate-200',
      'EVALUAR MARGEN': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      'REVISAR EMPAQUE': 'bg-purple-100 text-purple-800 border-purple-200',
      'SIN DEMANDA': 'bg-slate-100 text-slate-400 border-slate-200'
    };
    return mapa[urgencia] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const esRevisionWhatsApp = proveedor.estadoAsignacion === 'EN_REVISION_WHATSAPP';
  const ordenEmitida = propuesta?.estadoOrdenCompra === 'OC_EMITIDA';
  const ordenAprobada = propuesta?.estadoOrdenCompra === 'APROBADA_PARA_EMISION';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Boton Volver y Titulo */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={alVolverACartera}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
            title="Volver a la cartera"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">
                {proveedor.nombreRazonSocial}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-200">
                {proveedor.categoriaCompradora.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Plazo Entrega: <b className="text-slate-700">{proveedor.plazoEntregaDias}d</b> &bull; Frecuencia Compra: <b className="text-slate-700">{proveedor.frecuenciaCompraDias}d</b> &bull; Credito: <b className="text-slate-700">{proveedor.diasCredito}d</b>
            </p>
          </div>
        </div>

        {/* Acciones Superiores de Descarga y Aprobacion */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Alternar Revision WhatsApp */}
          <button
            onClick={manejarAlternarRevisionWhatsApp}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              esRevisionWhatsApp
                ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            {esRevisionWhatsApp ? 'En Revision WhatsApp (Bloqueo Suspendido)' : 'Pasar a WhatsApp'}
          </button>

          {/* Descargar Propuesta PDF (Neutral) */}
          <button
            onClick={manejarDescargarPropuestaPDF}
            disabled={descargando === 'PDF'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
            title="Descargar documento PDF neutral para revision de propuesta"
          >
            <FileText className="w-4 h-4 text-rose-600" />
            {descargando === 'PDF' ? 'Generando...' : 'PDF Propuesta'}
          </button>

          {/* Descargar Propuesta PNG (WhatsApp Ultra-rapido) */}
          <button
            onClick={manejarDescargarPropuestaPNG}
            disabled={descargando === 'PNG'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
            title="Descargar imagen PNG en memoria para enviar al chat de WhatsApp"
          >
            <Image className="w-4 h-4 text-emerald-600" />
            {descargando === 'PNG' ? 'Generando...' : 'PNG WhatsApp'}
          </button>

          {/* Boton Aprobar (Gerente o Administrador) */}
          {(esAdmin || esGerente) && !ordenEmitida && (
            <button
              onClick={async () => {
                const id = await asegurarOrdenBorrador();
                setOrdenCompraActivaId(id);
                setModalAprobarAbierto(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Aprobar
            </button>
          )}

          {/* Boton Emitir Orden Oficial (Gerente o Administrador) */}
          {(esAdmin || esGerente) && (ordenAprobada || esAdmin) && !ordenEmitida && (
            <button
              onClick={async () => {
                const id = await asegurarOrdenBorrador();
                setOrdenCompraActivaId(id);
                setModalEmitirAbierto(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg shadow-xs transition-colors"
            >
              <Send className="w-4 h-4" />
              Emitir Orden Oficial
            </button>
          )}

          {/* Descargar Orden Oficial PDF si ya fue emitida */}
          {ordenEmitida && (
            <button
              onClick={manejarDescargarOrdenOficial}
              disabled={descargando === 'OFICIAL'}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              {descargando === 'OFICIAL' ? 'Descargando...' : 'Descargar OC Oficial'}
            </button>
          )}
        </div>
      </div>

      {/* Alerta de Error */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Alerta de Calculo Desactualizado (Recalculo de Odoo) */}
      {propuesta && !propuesta.esCalculoVigente && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3 text-amber-900 text-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Advertencia de Recalculo del Motor R10:</h4>
            <p className="mt-0.5">
              Los archivos base exportados de Odoo cambiaron recientemente (stock, transito o costos). El calculo actual requiere ser validado y aprobado nuevamente para confirmar las cantidades propuestas.
            </p>
          </div>
        </div>
      )}

      {/* Tarjetas de Resumen Metrico */}
      {propuesta && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs text-slate-500 font-medium">Total SKUs Evaluados</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{propuesta.totalSkus}</div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs text-slate-500 font-medium">Unidades Sugeridas vs Propuestas</span>
            <div className="text-lg font-bold text-slate-900 mt-1">
              {(propuesta.totalUnidadesSugeridas || 0).toLocaleString()} <span className="text-xs text-slate-400">/</span> {(propuesta.totalUnidadesPropuestas || 0).toLocaleString()}
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs text-slate-500 font-medium">Inversion Sugerida R10</span>
            <div className="text-lg font-bold text-slate-800 mt-1">
              {formatearMonto(propuesta.totalInversionSugeridaUSD || 0)}
            </div>
          </div>

          <div className="p-4 bg-sky-50/70 rounded-xl border border-sky-200 shadow-2xs">
            <span className="text-xs text-sky-800 font-semibold">Inversion Final Propuesta</span>
            <div className="text-xl font-black text-sky-950 mt-1">
              {formatearMonto(propuesta.totalInversionPropuestaUSD || (propuesta as any).totalInversionAprobadaUSD || 0)}
            </div>
          </div>
        </div>
      )}

      {/* Tabla Interactiva de Reposicion por SKU */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-900">
            Renglones de Compra y Diagnosticos R10
          </h3>
          <span className="text-xs text-slate-500">
            Ajuste con versionado concurrente optimista y auditoria
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-3 py-3">SKU / Descripcion</th>
                <th scope="col" className="px-3 py-3 text-center">Clase</th>
                <th scope="col" className="px-3 py-3 text-center">Demanda Mes</th>
                <th scope="col" className="px-3 py-3 text-center">Mano / Transito</th>
                <th scope="col" className="px-3 py-3 text-center">Inv. Efectivo</th>
                <th scope="col" className="px-3 py-3 text-center">Cobertura</th>
                <th scope="col" className="px-3 py-3 text-right">Costo USD</th>
                <th scope="col" className="px-3 py-3 text-center">Sugerido Emp.</th>
                <th scope="col" className="px-3 py-3 text-center">Diagnostico</th>
                <th scope="col" className="px-3 py-3 text-center">Propuesta Final</th>
                <th scope="col" className="px-3 py-3">Justificacion de Ajuste</th>
                <th scope="col" className="px-3 py-3 text-center">Accion</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
              {cargando ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-slate-400">
                    <div className="inline-block w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Calculando matriz de reposicion R10...</p>
                  </td>
                </tr>
              ) : propuesta?.renglones.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-slate-400">
                    Este proveedor no posee productos aptos en el catalogo.
                  </td>
                </tr>
              ) : (propuesta as any)?.sinCalculoOdoo ? (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-amber-600">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                      <p className="text-sm font-semibold">Calculo R10 pendiente</p>
                      <p className="text-xs text-slate-500 max-w-sm">
                        Los {propuesta?.totalSkus ?? 0} SKUs de este proveedor estan registrados pero aun no tienen calculo de reposicion.
                        Ve a <strong>Cargas Odoo</strong> y procesa los 4 archivos para generar la propuesta.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                propuesta?.renglones.map((renglon) => {
                  const cantFinalRenglon = renglon.cantidadFinalPropuesta ?? (renglon as any).cantidadFinalAprobada ?? 0;
                  const sugEmpaque = renglon.sugeridoAjustadoEmpaque ?? (renglon as any).cantidadSugeridaMotor ?? 0;
                  const cantActual = cantidadesEditadas[renglon.identificadorProducto] ?? cantFinalRenglon;
                  const justActual = justificacionesEditadas[renglon.identificadorProducto] ?? (renglon.justificacionAjuste || '');
                  const hayCambio = cantActual !== cantFinalRenglon || justActual !== (renglon.justificacionAjuste || '');
                  const difiereDeSugerido = cantActual !== sugEmpaque;
                  const codigoSku = renglon.codigoSku || (renglon as any).codigoSKU || '';
                  const demandaMes = (renglon.demandaOperativaMensual ?? 0).toFixed(1);
                  const coberturaDias = Number(renglon.diasCoberturaEfectiva ?? (renglon as any).diasCoberturaActual ?? 0);
                  const costoUnit = Number(renglon.costoUnitarioUSD || 0).toFixed(2);

                  return (
                    <tr 
                      key={renglon.identificadorProducto} 
                      className={`hover:bg-slate-50/70 transition-colors ${
                        difiereDeSugerido ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      {/* SKU y Descripcion */}
                      <td className="px-3 py-3">
                        <div className="font-mono font-bold text-slate-900">{codigoSku}</div>
                        <div className="text-slate-600 line-clamp-1 max-w-[220px]" title={renglon.descripcionProducto}>
                          {renglon.descripcionProducto}
                        </div>
                      </td>

                      {/* Clase Comercial */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {renglon.claseComercial || (renglon as any).clasificacionComercial || 'MEDIA ROTACION'}
                        </span>
                      </td>

                      {/* Demanda Mensual */}
                      <td className="px-3 py-3 text-center whitespace-nowrap font-medium text-slate-900">
                        {demandaMes}
                      </td>

                      {/* Stock a Mano / Transito */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span className="text-slate-800 font-semibold">{renglon.stockActualMano ?? (renglon as any).cantidadAMano ?? 0}</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-sky-700 font-medium">+{renglon.stockEnTransitoValido ?? (renglon as any).cantidadTransito ?? 0}</span>
                      </td>

                      {/* Inventario Efectivo */}
                      <td className="px-3 py-3 text-center whitespace-nowrap font-bold text-slate-900">
                        {renglon.inventarioEfectivo ?? 0}
                      </td>

                      {/* Dias Cobertura */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                          coberturaDias <= 15 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800'
                        }`}>
                          {coberturaDias.toFixed(0)}d
                        </span>
                      </td>

                      {/* Costo USD */}
                      <td className="px-3 py-3 text-right whitespace-nowrap font-mono text-slate-900">
                        ${costoUnit}
                      </td>

                      {/* Sugerido Ajustado Empaque */}
                      <td className="px-3 py-3 text-center whitespace-nowrap font-bold text-slate-900 bg-sky-50/50">
                        {sugEmpaque}
                      </td>

                      {/* Diagnostico Urgencia */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] border ${insigniaUrgencia(renglon.diagnosticoUrgencia)}`}>
                          {renglon.diagnosticoUrgencia || 'REVISAR'}
                        </span>
                      </td>

                      {/* Input Propuesta Final */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <input
                          type="number"
                          min="0"
                          value={cantActual}
                          onChange={(e) =>
                            setCantidadesEditadas({
                              ...cantidadesEditadas,
                              [renglon.identificadorProducto]: Math.max(0, parseInt(e.target.value, 10) || 0)
                            })
                          }
                          className="w-16 px-2 py-1 text-xs font-bold text-center border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-600 focus:outline-none"
                        />
                      </td>

                      {/* Input Justificacion Ajuste */}
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          placeholder={difiereDeSugerido ? 'Justificacion obligatoria...' : 'Opcional...'}
                          value={justActual}
                          onChange={(e) =>
                            setJustificacionesEditadas({
                              ...justificacionesEditadas,
                              [renglon.identificadorProducto]: e.target.value
                            })
                          }
                          className={`w-full px-2 py-1 text-xs border rounded-md focus:outline-none ${
                            difiereDeSugerido && (!justActual || justActual.trim().length < 5)
                              ? 'border-rose-400 bg-rose-50/40 focus:ring-2 focus:ring-rose-500'
                              : 'border-slate-300 focus:ring-2 focus:ring-sky-600'
                          }`}
                        />
                      </td>

                      {/* Boton Guardar Renglon */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => manejarGuardarAjusteSKU(renglon)}
                          disabled={!hayCambio || guardandoRenglonId === renglon.identificadorProducto}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-30 rounded-md transition-colors"
                          title="Guardar ajuste de este SKU"
                        >
                          <Save className="w-3 h-3" />
                          {guardandoRenglonId === renglon.identificadorProducto ? '...' : 'Fijar'}
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

      {/* Modales de Aprobacion y Emision */}
      {ordenCompraActivaId && (
        <>
          <ModalAprobarOrden
            estaAbierto={modalAprobarAbierto}
            alCerrar={() => setModalAprobarAbierto(false)}
            ordenId={ordenCompraActivaId}
            proveedorNombre={proveedor.nombreRazonSocial}
            alAprobarExitoso={cargarPropuesta}
          />

          <ModalEmitirOrden
            estaAbierto={modalEmitirAbierto}
            alCerrar={() => setModalEmitirAbierto(false)}
            ordenId={ordenCompraActivaId}
            proveedorNombre={proveedor.nombreRazonSocial}
            alEmitirExitoso={(correlativo) => {
              alert(`¡Orden de compra emitida exitosamente con correlativo oficial: ${correlativo}!`);
              cargarPropuesta();
            }}
          />
        </>
      )}
    </div>
  );
};
