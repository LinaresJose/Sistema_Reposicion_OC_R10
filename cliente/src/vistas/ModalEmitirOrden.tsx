import React, { useState } from 'react';
import { Send, AlertCircle, ShieldAlert } from 'lucide-react';
import { Modal } from '../componentes/comunes/Modal.js';
import { servicioOrdenes } from '../servicios/servicio-ordenes.js';

interface ModalEmitirOrdenProps {
  estaAbierto: boolean;
  alCerrar: () => void;
  ordenId: string;
  proveedorNombre: string;
  alEmitirExitoso: (correlativoGenerado: string) => void;
}

export const ModalEmitirOrden: React.FC<ModalEmitirOrdenProps> = ({
  estaAbierto,
  alCerrar,
  ordenId,
  proveedorNombre,
  alEmitirExitoso
}) => {
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState<'MMC' | 'LYNOX'>('MMC');
  const [guardando, setGuardando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const empresas = [
    {
      codigo: 'MMC' as const,
      nombre: 'MULTIMARCAS DEL CENTRO, C.A.',
      rif: 'J-50330258-5',
      direccion: 'Av. Principal Local L-17, Urb. Parque Comercio, Castillito, Valencia, Carabobo',
      prefijoCorrelativo: 'OC-MMC-2026-NNNN'
    },
    {
      codigo: 'LYNOX' as const,
      nombre: 'GRUPO FERRETERO LYNOX, C.A.',
      rif: 'J-50053430-2',
      direccion: 'Calle 6ta Transversal, Av. 83 Norte, Galpon N° 2, Zona Ind. Carabobo, Valencia',
      prefijoCorrelativo: 'OC-LYNOX-2026-NNNN'
    }
  ];

  const manejarEmision = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setGuardando(true);

    try {
      const respuesta = await servicioOrdenes.emitirOrdenOficial(ordenId, empresaSeleccionada);
      alEmitirExitoso(respuesta.numeroCorrelativoOficial);
      alCerrar();
    } catch (err: any) {
      setError(err.message || 'Error al emitir orden oficial');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      estaAbierto={estaAbierto}
      alCerrar={alCerrar}
      titulo={`Emitir Orden de Compra Oficial: ${proveedorNombre}`}
      tamano="lg"
    >
      <form onSubmit={manejarEmision} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Accion Legal Definitiva:</p>
            <p className="mt-0.5">
              Esta emision asignara de forma atomica el correlativo oficial definitivo e insertara el membrete con logo y datos fiscales de la razon social seleccionada.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Seleccione la Razon Social Emisora Oficial:
          </label>

          <div className="space-y-3">
            {empresas.map((emp) => {
              const estaSeleccionada = empresaSeleccionada === emp.codigo;
              return (
                <div
                  key={emp.codigo}
                  onClick={() => setEmpresaSeleccionada(emp.codigo)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    estaSeleccionada
                      ? 'border-sky-600 bg-sky-50/60 ring-2 ring-sky-600 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        emp.codigo === 'MMC' ? 'bg-slate-900 text-white' : 'bg-blue-700 text-white'
                      }`}>
                        {emp.codigo}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{emp.nombre}</h4>
                        <span className="text-[11px] font-mono text-slate-500 font-semibold">{emp.rif}</span>
                      </div>
                    </div>

                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 bg-white border border-slate-200 rounded-md text-slate-700">
                      {emp.prefijoCorrelativo}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 mt-2 pl-10">
                    {emp.direccion}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

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
            className="flex items-center gap-1.5 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
            {guardando ? 'Emitiendo...' : `Emitir Oficialmente con Membrete ${empresaSeleccionada}`}
          </button>
        </div>
      </form>
    </Modal>
  );
};
