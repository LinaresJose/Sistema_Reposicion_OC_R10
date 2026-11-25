import React, { useState, useEffect } from 'react';
import { Save, AlertCircle } from 'lucide-react';
import { Modal } from '../componentes/comunes/Modal.js';
import { Proveedor, FormularioEdicionProveedor, CategoriaCompradora } from '../tipos/proveedor.js';
import { servicioProveedores } from '../servicios/servicio-proveedores.js';

interface ModalEditarProveedorProps {
  estaAbierto: boolean;
  alCerrar: () => void;
  proveedor: Proveedor | null;
  alGuardarExitoso: (proveedorActualizado: Proveedor) => void;
}

export const ModalEditarProveedor: React.FC<ModalEditarProveedorProps> = ({
  estaAbierto,
  alCerrar,
  proveedor,
  alGuardarExitoso
}) => {
  const [formulario, setFormulario] = useState<FormularioEdicionProveedor>({
    nombreRazonSocial: '',
    codigoProveedorOdoo: '',
    registroInformacionFiscal: '',
    categoriaCompradora: 'NACIONAL_1',
    plazoEntregaDias: 7,
    frecuenciaCompraDias: 15,
    diasCredito: 0,
    descuentoComercialCadena: '0%',
    formaPagoPredeterminada: 'DIVISAS_TRANSFERENCIA',
    tipoDocumentoPredeterminado: 'FACTURA',
    nombreContacto: '',
    telefonoContacto: '',
    correoContacto: '',
    estaActivo: true
  });

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (proveedor) {
      setFormulario({
        nombreRazonSocial: proveedor.nombreRazonSocial || '',
        codigoProveedorOdoo: proveedor.codigoProveedorOdoo || '',
        registroInformacionFiscal: proveedor.registroInformacionFiscal || '',
        categoriaCompradora: proveedor.categoriaCompradora || 'NACIONAL_1',
        plazoEntregaDias: proveedor.plazoEntregaDias ?? 7,
        frecuenciaCompraDias: proveedor.frecuenciaCompraDias ?? 15,
        diasCredito: proveedor.diasCredito ?? 0,
        descuentoComercialCadena: proveedor.descuentoComercialCadena || '0%',
        formaPagoPredeterminada: proveedor.formaPagoPredeterminada || 'DIVISAS_TRANSFERENCIA',
        tipoDocumentoPredeterminado: proveedor.tipoDocumentoPredeterminado || 'FACTURA',
        nombreContacto: proveedor.nombreContacto || '',
        telefonoContacto: proveedor.telefonoContacto || '',
        correoContacto: proveedor.correoContacto || '',
        estaActivo: proveedor.estaActivo ?? true
      });
      setError(null);
    }
  }, [proveedor]);

  if (!proveedor) return null;

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setGuardando(true);

    try {
      const actualizado = await servicioProveedores.actualizarProveedor(
        proveedor.identificadorProveedor,
        formulario
      );
      alGuardarExitoso(actualizado);
      alCerrar();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar el proveedor');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      estaAbierto={estaAbierto}
      alCerrar={alCerrar}
      titulo={`Editar Proveedor: ${proveedor.nombreRazonSocial}`}
      tamano="xl"
    >
      <form onSubmit={manejarEnvio} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Categoria Compradora y Estado Activo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-sky-50/60 rounded-lg border border-sky-100">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Categoria Compradora *
            </label>
            <select
              value={formulario.categoriaCompradora}
              onChange={(e) =>
                setFormulario({ ...formulario, categoriaCompradora: e.target.value as CategoriaCompradora })
              }
              className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:outline-none font-semibold text-sky-800"
            >
              <option value="NACIONAL_1">NACIONAL 1</option>
              <option value="NACIONAL_2">NACIONAL 2</option>
              <option value="NACIONAL_3">NACIONAL 3</option>
              <option value="INTERNACIONAL">INTERNACIONAL</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Determina la cartera y prioridad de reposicion.
            </p>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-3 pt-4">
            <label className="text-xs font-semibold text-slate-700">
              Estado Activo:
            </label>
            <button
              type="button"
              onClick={() => setFormulario({ ...formulario, estaActivo: !formulario.estaActivo })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                formulario.estaActivo
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {formulario.estaActivo ? 'ACTIVO' : 'INACTIVO'}
            </button>
          </div>
        </div>

        {/* Nombre / Razon Social y RIF */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nombre o Razon Social *
            </label>
            <input
              type="text"
              required
              value={formulario.nombreRazonSocial}
              onChange={(e) => setFormulario({ ...formulario, nombreRazonSocial: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Registro de Informacion Fiscal (RIF)
            </label>
            <input
              type="text"
              value={formulario.registroInformacionFiscal || ''}
              onChange={(e) => setFormulario({ ...formulario, registroInformacionFiscal: e.target.value })}
              placeholder="J-12345678-9"
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Codigo Odoo */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Codigo de Proveedor en Odoo
          </label>
          <input
            type="text"
            value={formulario.codigoProveedorOdoo || ''}
            onChange={(e) => setFormulario({ ...formulario, codigoProveedorOdoo: e.target.value })}
            placeholder="PROV-00123"
            className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:outline-none"
          />
        </div>

        {/* Parametros Operativos R10 (Plazo, Frecuencia, Credito) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Plazo de Entrega (Dias) *
            </label>
            <input
              type="number"
              min="0"
              required
              value={formulario.plazoEntregaDias}
              onChange={(e) => setFormulario({ ...formulario, plazoEntregaDias: parseInt(e.target.value, 10) || 0 })}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Frecuencia Compra (Dias) *
            </label>
            <input
              type="number"
              min="1"
              required
              value={formulario.frecuenciaCompraDias}
              onChange={(e) => setFormulario({ ...formulario, frecuenciaCompraDias: parseInt(e.target.value, 10) || 1 })}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Dias de Credito *
            </label>
            <input
              type="number"
              min="0"
              required
              value={formulario.diasCredito}
              onChange={(e) => setFormulario({ ...formulario, diasCredito: parseInt(e.target.value, 10) || 0 })}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Descuentos Comerciales y Formas de Pago */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cadena de Descuentos
            </label>
            <input
              type="text"
              value={formulario.descuentoComercialCadena}
              onChange={(e) => setFormulario({ ...formulario, descuentoComercialCadena: e.target.value })}
              placeholder="10% + 5%"
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Forma de Pago Predeterminada
            </label>
            <input
              type="text"
              value={formulario.formaPagoPredeterminada}
              onChange={(e) => setFormulario({ ...formulario, formaPagoPredeterminada: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tipo Documento
            </label>
            <input
              type="text"
              value={formulario.tipoDocumentoPredeterminado}
              onChange={(e) => setFormulario({ ...formulario, tipoDocumentoPredeterminado: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Contacto, Telefono y Correo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nombre de Contacto
            </label>
            <input
              type="text"
              value={formulario.nombreContacto || ''}
              onChange={(e) => setFormulario({ ...formulario, nombreContacto: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Telefono de Contacto
            </label>
            <input
              type="text"
              value={formulario.telefonoContacto || ''}
              onChange={(e) => setFormulario({ ...formulario, telefonoContacto: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Correo Electronico
            </label>
            <input
              type="email"
              value={formulario.correoContacto || ''}
              onChange={(e) => setFormulario({ ...formulario, correoContacto: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={alCerrar}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="flex items-center gap-2 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {guardando ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
