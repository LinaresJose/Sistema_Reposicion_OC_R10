import React, { useState } from 'react';
import { ProveedorAutenticacion, usarAutenticacion } from './contextos/contexto-autenticacion.js';
import { BarraNavegacion, PestanaNavegacion } from './componentes/comunes/BarraNavegacion.js';
import { VistaIniciarSesion } from './vistas/VistaIniciarSesion.js';
import { VistaCarteraProveedores } from './vistas/VistaCarteraProveedores.js';
import { VistaPropuestaR10 } from './vistas/VistaPropuestaR10.js';
import { VistaCargasOdoo } from './vistas/VistaCargasOdoo.js';
import { VistaHistorialOrdenes } from './vistas/VistaHistorialOrdenes.js';
import { VistaAuditoria } from './vistas/VistaAuditoria.js';
import { VistaAdministracion } from './vistas/VistaAdministracion.js';
import { Proveedor } from './tipos/proveedor.js';
import { Layers, AlertCircle } from 'lucide-react';

interface EstadoCapturadorErrores {
  tieneError: boolean;
  mensajeError: string;
}

class CapturadorErrores extends React.Component<{ children: React.ReactNode }, EstadoCapturadorErrores> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { tieneError: false, mensajeError: '' };
  }

  static getDerivedStateFromError(error: any): EstadoCapturadorErrores {
    return { tieneError: true, mensajeError: error?.message || 'Error inesperado al renderizar interfaz' };
  }

  componentDidCatch(error: any, info: any) {
    console.error('CapturadorErrores detecto un error:', error, info);
  }

  render() {
    if (this.state.tieneError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Se produjo un error visual</h3>
            <p className="text-xs text-slate-500">{this.state.mensajeError}</p>
            <button
              onClick={() => {
                this.setState({ tieneError: false, mensajeError: '' });
                window.location.reload();
              }}
              className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              Recargar Aplicacion
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const ContenedorPrincipal: React.FC = () => {
  const { usuario, cargando, esAdmin, esGerente, esAuditor } = usarAutenticacion();
  const [pestanaActiva, setPestanaActiva] = useState<PestanaNavegacion>('CARTERA');
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<Proveedor | null>(null);

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-500">Iniciando sesion segura...</p>
        </div>
      </div>
    );
  }

  if (!usuario) {
    return <VistaIniciarSesion />;
  }

  const manejarSeleccionarProveedorParaPropuesta = (prov: Proveedor) => {
    setProveedorSeleccionado(prov);
    setPestanaActiva('PROPUESTA');
  };

  const manejarCambiarPestana = (pestana: PestanaNavegacion) => {
    // Validaciones de acceso por rol
    if (pestana === 'CARGAS_ODOO' && !esAdmin && !esGerente) {
      alert('Solo los roles Gerente de Compras y Administrador tienen acceso a las cargas de Odoo.');
      return;
    }
    if (pestana === 'AUDITORIA' && !esAdmin && !esGerente && !esAuditor) {
      alert('Solo Administrador, Gerente y Auditor pueden ver el historial de auditoria.');
      return;
    }
    if (pestana === 'ADMINISTRACION' && !esAdmin) {
      alert('Solo el Administrador del Sistema puede acceder al panel de administracion.');
      return;
    }
    setPestanaActiva(pestana);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <BarraNavegacion
        pestanaActiva={pestanaActiva}
        alCambiarPestana={manejarCambiarPestana}
        nombreProveedorActivo={proveedorSeleccionado?.nombreRazonSocial}
      />

      <main className="flex-1">
        {pestanaActiva === 'CARTERA' && (
          <VistaCarteraProveedores
            alSeleccionarProveedorParaPropuesta={manejarSeleccionarProveedorParaPropuesta}
          />
        )}

        {pestanaActiva === 'PROPUESTA' && (
          proveedorSeleccionado ? (
            <VistaPropuestaR10
              proveedor={proveedorSeleccionado}
              alVolverACartera={() => setPestanaActiva('CARTERA')}
            />
          ) : (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center mx-auto mb-4 border border-sky-200">
                <Layers className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Ningun Proveedor Seleccionado
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Seleccione un proveedor de la cartera para cargar su matriz de calculo y propuesta de reposicion R10.
              </p>
              <button
                onClick={() => setPestanaActiva('CARTERA')}
                className="mt-4 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
              >
                Ir a Cartera de Proveedores
              </button>
            </div>
          )
        )}

        {pestanaActiva === 'CARGAS_ODOO' && (esAdmin || esGerente) && (
          <VistaCargasOdoo />
        )}

        {pestanaActiva === 'HISTORIAL_ORDENES' && (
          <VistaHistorialOrdenes />
        )}

        {pestanaActiva === 'AUDITORIA' && (esAdmin || esGerente || esAuditor) && (
          <VistaAuditoria />
        )}

        {pestanaActiva === 'ADMINISTRACION' && esAdmin && (
          <VistaAdministracion />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-[11px] text-slate-400">
        Plataforma Multi-usuario de Reposicion y Ordenes de Compra R10 &bull; Multimarcas del Centro, C.A. &amp; Grupo Ferretero Lynox, C.A.
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <CapturadorErrores>
      <ProveedorAutenticacion>
        <ContenedorPrincipal />
      </ProveedorAutenticacion>
    </CapturadorErrores>
  );
};

export default App;
