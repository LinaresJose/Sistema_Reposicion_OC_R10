// Servicio de Auditoria
import { realizarPeticion } from './cliente-api.js';

export interface EventoAuditoria {
  identificadorAuditoria: string;
  usuarioId: string | null;
  tipoEvento: string;
  nombreEntidad: string;
  identificadorEntidad: string;
  estadoAnterior: Record<string, unknown> | null;
  estadoNuevo: Record<string, unknown> | null;
  direccionIP?: string;
  marcaTiempo: string;
}

export interface FiltrosAuditoria {
  entidad?: string;
  identificadorEntidad?: string;
  usuarioId?: string;
  limite?: number;
}

export const servicioAuditoria = {
  async consultar(filtros?: FiltrosAuditoria): Promise<{ eventos: EventoAuditoria[]; total: number }> {
    const params = new URLSearchParams();
    if (filtros?.entidad) params.set('entidad', filtros.entidad);
    if (filtros?.identificadorEntidad) params.set('identificadorEntidad', filtros.identificadorEntidad);
    if (filtros?.usuarioId) params.set('usuarioId', filtros.usuarioId);
    if (filtros?.limite) params.set('limite', String(filtros.limite));
    const qs = params.toString();
    return realizarPeticion(`/api/v1/auditoria${qs ? `?${qs}` : ''}`);
  }
};
