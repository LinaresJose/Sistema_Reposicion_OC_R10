import { RegistroAuditoria } from '../entidades/registro-auditoria.js';

export interface PuertoRepositorioAuditoria {
  registrarEvento(evento: {
    usuarioId: string | null;
    tipoEvento: string;
    nombreEntidad: string;
    identificadorEntidad: string;
    estadoAnterior?: Record<string, any> | null;
    estadoNuevo?: Record<string, any> | null;
    direccionIP?: string;
  }): Promise<void>;

  consultarEventos(filtros?: {
    nombreEntidad?: string;
    identificadorEntidad?: string;
    usuarioId?: string;
    limite?: number;
  }): Promise<RegistroAuditoria[]>;
}
