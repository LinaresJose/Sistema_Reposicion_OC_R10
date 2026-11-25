import { realizarPeticion } from './cliente-api.js';
import { OrdenCompraResumen, EstadoOrdenCompra } from '../tipos/orden-compra.js';

interface RespuestaCrearOrden {
  mensaje: string;
  orden: OrdenCompraResumen;
}

interface RespuestaListadoOrdenes {
  ordenes: OrdenCompraResumen[];
  total: number;
}

function dispararDescargaArchivo(blob: Blob, nombreArchivo: string): void {
  const url = window.URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  window.URL.revokeObjectURL(url);
}

export const servicioOrdenes = {
  async crearBorrador(proveedorId: string, idsDecisionesAprobadas?: string[]): Promise<OrdenCompraResumen> {
    const respuesta = await realizarPeticion<RespuestaCrearOrden>('/ordenes-compra', {
      method: 'POST',
      body: JSON.stringify({ proveedorId, idsDecisionesAprobadas })
    });
    return respuesta.orden;
  },

  async listarOrdenes(filtros?: {
    estadoOrden?: EstadoOrdenCompra;
    proveedorId?: string;
    analistaCreadoraId?: string;
  }): Promise<OrdenCompraResumen[]> {
    const params = new URLSearchParams();
    if (filtros?.estadoOrden) params.append('estadoOrden', filtros.estadoOrden);
    if (filtros?.proveedorId) params.append('proveedorId', filtros.proveedorId);
    if (filtros?.analistaCreadoraId) params.append('analistaCreadoraId', filtros.analistaCreadoraId);

    const ruta = `/ordenes-compra${params.toString() ? '?' + params.toString() : ''}`;
    const respuesta = await realizarPeticion<RespuestaListadoOrdenes>(ruta);
    return respuesta.ordenes;
  },

  async obtenerPorId(id: string): Promise<OrdenCompraResumen> {
    return realizarPeticion<OrdenCompraResumen>(`/ordenes-compra/${id}`);
  },

  async pasarARevisionWhatsApp(id: string): Promise<any> {
    return realizarPeticion(`/ordenes-compra/${id}/revision-whatsapp`, {
      method: 'POST'
    });
  },

  async registrarAprobacion(
    id: string,
    canalAprobacion: 'SISTEMA' | 'WHATSAPP',
    notaRespalodoAprobacion?: string
  ): Promise<any> {
    return realizarPeticion(`/ordenes-compra/${id}/registrar-aprobacion`, {
      method: 'POST',
      body: JSON.stringify({ canalAprobacion, notaRespalodoAprobacion })
    });
  },

  async emitirOrdenOficial(id: string, empresaEmisoraId: string): Promise<any> {
    return realizarPeticion(`/ordenes-compra/${id}/emitir`, {
      method: 'POST',
      body: JSON.stringify({ empresaEmisoraId })
    });
  },

  async descargarPropuesta(id: string, formato: 'PDF' | 'PNG', nombreSugerido?: string): Promise<void> {
    const blob = await realizarPeticion<Blob>(`/ordenes-compra/${id}/descargar-propuesta?formato=${formato}`, {
      method: 'GET'
    });
    const extension = formato.toLowerCase();
    dispararDescargaArchivo(blob, nombreSugerido || `propuesta-compra-${id}.${extension}`);
  },

  async descargarOrdenOficial(id: string, correlativo?: string): Promise<void> {
    const blob = await realizarPeticion<Blob>(`/ordenes-compra/${id}/descargar-orden-oficial`, {
      method: 'GET'
    });
    dispararDescargaArchivo(blob, `${correlativo || 'orden-compra-oficial'}.pdf`);
  },

  async exportarVistaControlR10(proveedorId?: string): Promise<void> {
    const ruta = proveedorId 
      ? `/reportes/vista-control-r10?proveedorId=${proveedorId}`
      : '/reportes/vista-control-r10';
    const blob = await realizarPeticion<Blob>(ruta, {
      method: 'GET'
    });
    dispararDescargaArchivo(blob, `vista-control-r10-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }
};
