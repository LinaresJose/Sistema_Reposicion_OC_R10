import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, MessageSquare } from 'lucide-react';
import { Modal } from '../componentes/comunes/Modal.js';
import { servicioOrdenes } from '../servicios/servicio-ordenes.js';

interface ModalAprobarOrdenProps {
  estaAbierto: boolean;
  alCerrar: () => void;
  ordenId: string;
  proveedorNombre: string;
  alAprobarExitoso: () => void;
}

export const ModalAprobarOrden: React.FC<ModalAprobarOrdenProps> = ({
  estaAbierto,
  alCerrar,
  ordenId,
  proveedorNombre,
  alAprobarExitoso
}) => {
  const [canal, setCanal] = useState<'SISTEMA' | 'WHATSAPP'>('SISTEMA');
  const [notaRespaldo, setNotaRespaldo] = useState<string>('');
  const [guardando, setGuardando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const manejarAprobacion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (canal === 'WHATSAPP' && (!notaRespaldo || notaRespaldo.trim().length < 10)) {
      setError('Para aprobaciones por WhatsApp es obligatorio registrar una nota de respaldo detallada (minimo 10 caracteres).');
      return;
    }

    setGuardando(true);
    try {
      await servicioOrdenes.registrarAprobacion(
        ordenId,
        canal,
        canal === 'WHATSAPP' ? notaRespaldo.trim() : undefined
      );
      alAprobarExitoso();
      alCerrar();
    } catch (err: any) {
      setError(err.message || 'Error al aprobar la propuesta');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      estaAbierto={estaAbierto}
      alCerrar={alCerrar}
      titulo="Aprobar Propuesta de Compra"
      tamano="md"
    >
      <form onSubmit={manejarAprobacion} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
          <p className="font-semibold text-slate-900">{proveedorNombre}</p>
          <p className="text-slate-500 mt-0.5">
            Esta accion cambiara el estado de la propuesta a <b>APROBADA_PARA_EMISION</b>, permitiendo seleccionar la razon social emisora oficial (MMC o LYNOX).
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Canal de Aprobacion *
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setCanal('SISTEMA')}
              className={`p-3 text-left rounded-lg border text-xs transition-all ${
                canal === 'SISTEMA'
                  ? 'border-sky-600 bg-sky-50/70 text-sky-900 font-semibold ring-1 ring-sky-600'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-sky-700" />
                <span>Sistema Web</span>
              </div>
              <p className="text-[11px] text-slate-500 font-normal">
                Revision y validacion directa en la plataforma interna.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setCanal('WHATSAPP')}
              className={`p-3 text-left rounded-lg border text-xs transition-all ${
                canal === 'WHATSAPP'
                  ? 'border-purple-600 bg-purple-50/70 text-purple-900 font-semibold ring-1 ring-purple-600'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="w-4 h-4 text-purple-700" />
                <span>WhatsApp / Verbal</span>
              </div>
              <p className="text-[11px] text-slate-500 font-normal">
                Instruccion recibida via chat o llamada por la Gerencia.
              </p>
            </button>
          </div>
        </div>

        {canal === 'WHATSAPP' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nota de Respaldo de Aprobacion * (Minimo 10 caracteres)
            </label>
            <textarea
              required
              rows={3}
              value={notaRespaldo}
              onChange={(e) => setNotaRespaldo(e.target.value)}
              placeholder="Ejemplo: Aprobado por Gerencia de Compras via WhatsApp el 24/11/2026 10:45 AM tras revision de cantidades solicitadas."
              className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Auditoria inmutable: este texto quedara registrado permanentemente como constancia legal y operativa.
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={alCerrar}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            {guardando ? 'Aprobando...' : 'Confirmar Aprobacion'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
