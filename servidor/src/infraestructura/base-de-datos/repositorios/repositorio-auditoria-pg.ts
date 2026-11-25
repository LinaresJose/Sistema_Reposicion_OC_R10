import { PuertoRepositorioAuditoria } from '../../../dominio/puertos/puerto-repositorio-auditoria.js';
import { RegistroAuditoria } from '../../../dominio/entidades/registro-auditoria.js';
import { baseDeDatos } from '../cliente-postgresql.js';

export class RepositorioAuditoriaPg implements PuertoRepositorioAuditoria {
  async registrarEvento(evento: {
    usuarioId: string | null;
    tipoEvento: string;
    nombreEntidad: string;
    identificadorEntidad: string;
    estadoAnterior?: Record<string, any> | null;
    estadoNuevo?: Record<string, any> | null;
    direccionIP?: string;
  }): Promise<void> {
    const consulta = `
      INSERT INTO registro_auditoria (
        usuario_id,
        tipo_evento,
        nombre_entidad,
        identificador_entidad,
        estado_anterior,
        estado_nuevo,
        direccion_ip,
        marca_tiempo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP);
    `;
    await baseDeDatos.ejecutarConsulta(consulta, [
      evento.usuarioId,
      evento.tipoEvento,
      evento.nombreEntidad,
      evento.identificadorEntidad,
      evento.estadoAnterior ? JSON.stringify(evento.estadoAnterior) : null,
      evento.estadoNuevo ? JSON.stringify(evento.estadoNuevo) : null,
      evento.direccionIP || null
    ]);
  }

  async consultarEventos(filtros?: {
    nombreEntidad?: string;
    identificadorEntidad?: string;
    usuarioId?: string;
    limite?: number;
  }): Promise<RegistroAuditoria[]> {
    const condiciones: string[] = ['1=1'];
    const parametros: any[] = [];
    let indice = 1;

    if (filtros?.nombreEntidad) {
      condiciones.push(`nombre_entidad = $${indice++}`);
      parametros.push(filtros.nombreEntidad);
    }

    if (filtros?.identificadorEntidad) {
      condiciones.push(`identificador_entidad = $${indice++}`);
      parametros.push(filtros.identificadorEntidad);
    }

    if (filtros?.usuarioId) {
      condiciones.push(`usuario_id = $${indice++}`);
      parametros.push(filtros.usuarioId);
    }

    const limite = Math.min(filtros?.limite || 100, 500);

    const consulta = `
      SELECT 
        identificador_auditoria,
        usuario_id,
        tipo_evento,
        nombre_entidad,
        identificador_entidad,
        estado_anterior,
        estado_nuevo,
        direccion_ip,
        marca_tiempo
      FROM registro_auditoria
      WHERE ${condiciones.join(' AND ')}
      ORDER BY marca_tiempo DESC
      LIMIT ${limite};
    `;

    const resultado = await baseDeDatos.ejecutarConsulta(consulta, parametros);
    return resultado.rows.map((r: any) => ({
      identificadorAuditoria: r.identificador_auditoria,
      usuarioId: r.usuario_id,
      tipoEvento: r.tipo_evento,
      nombreEntidad: r.nombre_entidad,
      identificadorEntidad: r.identificador_entidad,
      estadoAnterior: r.estado_anterior,
      estadoNuevo: r.estado_nuevo,
      direccionIP: r.direccion_ip,
      marcaTiempo: new Date(r.marca_tiempo)
    }));
  }
}
