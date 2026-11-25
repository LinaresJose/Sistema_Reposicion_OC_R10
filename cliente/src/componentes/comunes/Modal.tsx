import React, { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  estaAbierto: boolean;
  alCerrar: () => void;
  titulo: string;
  tamano?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  children: ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  estaAbierto,
  alCerrar,
  titulo,
  tamano = 'lg',
  children
}) => {
  if (!estaAbierto) return null;

  const mapaTamano = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    '2xl': 'max-w-4xl'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div
        className={`relative w-full ${mapaTamano[tamano]} bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <h3 className="text-lg font-semibold text-slate-800">{titulo}</h3>
          <button
            onClick={alCerrar}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
