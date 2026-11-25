import { realizarPeticion } from './cliente-api.js';
import { Proveedor, FormularioEdicionProveedor, CategoriaCompradora, EstadoAsignacionProveedor } from '../tipos/proveedor.js';

interface RespuestaListadoProveedores {
  estadoOperacion: string;
  totalProveedores: number;
  datos: Proveedor[];
}

interface RespuestaProveedorIndividual {
  estadoOperacion: string;
  datos: Proveedor;
}

export const servicioProveedores = {
  async listarProveedores(filtros?: {
    categoria?: CategoriaCompradora;
    estadoAsignacion?: EstadoAsignacionProveedor;
    analistaUsuarioId?: string;
    busqueda?: string;
  }): Promise<Proveedor[]> {
    const parametros = new URLSearchParams();
    if (filtros?.categoria) parametros.append('categoria', filtros.categoria);
    if (filtros?.estadoAsignacion) parametros.append('estadoAsignacion', filtros.estadoAsignacion);
    if (filtros?.analistaUsuarioId) parametros.append('analistaUsuarioId', filtros.analistaUsuarioId);
    if (filtros?.busqueda) parametros.append('busqueda', filtros.busqueda);

    const ruta = `/proveedores${parametros.toString() ? '?' + parametros.toString() : ''}`;
    const respuesta = await realizarPeticion<RespuestaListadoProveedores>(ruta);
    return respuesta.datos;
  },

  async obtenerProveedor(identificadorProveedor: string): Promise<Proveedor> {
    const respuesta = await realizarPeticion<RespuestaProveedorIndividual>(`/proveedores/${identificadorProveedor}`);
    return respuesta.datos;
  },

  async autoasignarProveedor(identificadorProveedor: string): Promise<any> {
    return realizarPeticion(`/proveedores/${identificadorProveedor}/autoasignar`, {
      method: 'POST'
    });
  },

  async liberarProveedor(identificadorProveedor: string, observacion?: string): Promise<any> {
    return realizarPeticion(`/proveedores/${identificadorProveedor}/liberar`, {
      method: 'POST',
      body: JSON.stringify({ observacion })
    });
  },

  async actualizarProveedor(
    identificadorProveedor: string,
    datos: Partial<FormularioEdicionProveedor>
  ): Promise<Proveedor> {
    const respuesta = await realizarPeticion<RespuestaProveedorIndividual>(`/proveedores/${identificadorProveedor}`, {
      method: 'PUT',
      body: JSON.stringify(datos)
    });
    return respuesta.datos;
  }
};
