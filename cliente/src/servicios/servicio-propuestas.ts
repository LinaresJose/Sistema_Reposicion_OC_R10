import { realizarPeticion } from './cliente-api.js';
import { ResumenPropuestaProveedor } from '../tipos/propuesta.js';

interface RespuestaPropuesta {
  estadoOperacion: string;
  datos: ResumenPropuestaProveedor;
}

export const servicioPropuestas = {
  async consultarPropuestaPorProveedor(identificadorProveedor: string): Promise<ResumenPropuestaProveedor> {
    const respuesta = await realizarPeticion<RespuestaPropuesta>(`/propuestas/proveedor/${identificadorProveedor}`);
    return respuesta.datos;
  },

  async actualizarDecisionSKU(
    identificadorDecision: string,
    datos: {
      estadoDecision: 'PENDIENTE' | 'APROBADO' | 'EXCLUIDO';
      cantidadAjusteManual: number | null;
      justificacionAjuste?: string | null;
      hashCalculoValidado: string;
      numeroVersionEsperado: number;
    }
  ): Promise<any> {
    return realizarPeticion(`/propuestas/decisiones/${identificadorDecision}`, {
      method: 'PUT',
      body: JSON.stringify(datos)
    });
  },

  async cambiarEstadoRevisionWhatsApp(
    identificadorProveedor: string,
    enRevision: boolean
  ): Promise<any> {
    return realizarPeticion(`/propuestas/proveedor/${identificadorProveedor}/revision-whatsapp`, {
      method: 'POST',
      body: JSON.stringify({ enRevision })
    });
  }
};
