export interface RegistroAuditoria {
  identificadorAuditoria: string;
  usuarioId: string | null;
  tipoEvento: string;
  nombreEntidad: string;
  identificadorEntidad: string;
  estadoAnterior: Record<string, any> | null;
  estadoNuevo: Record<string, any> | null;
  direccionIP?: string;
  marcaTiempo: Date;
}
