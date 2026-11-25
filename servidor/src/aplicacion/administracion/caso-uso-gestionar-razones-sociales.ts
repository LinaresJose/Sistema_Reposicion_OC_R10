// Caso de Uso: Gestionar Razones Sociales (Empresas Emisoras)
// ADMINISTRADOR_SISTEMA puede actualizar datos fiscales y logo de razones sociales
import { baseDeDatos } from '../../infraestructura/base-de-datos/cliente-postgresql.js';
import { PuertoRepositorioAuditoria } from '../../dominio/puertos/puerto-repositorio-auditoria.js';

export interface RazonSocialRegistrada {
  id: string;
  codigoIdentificador: string;
  nombreLegal: string;
  rif: string;
  direccionFiscal: string;
  telefonos: string | null;
  correoContacto: string | null;
  tieneLogoConfigurado: boolean;
  fechaActualizacion: Date;
}

export interface DatosActualizacionRazonSocial {
  nombreLegal?: string;
  rif?: string;
  direccionFiscal?: string;
  telefonos?: string;
  correoContacto?: string;
  urlLogoBase64?: string; // PNG/JPG en base64
}

export class CasoUsoGestionarRazonesSociales {
  constructor(private readonly repoAuditoria: PuertoRepositorioAuditoria) {}

  async listar(): Promise<RazonSocialRegistrada[]> {
    const resultado = await baseDeDatos.ejecutarConsulta(
      `SELECT identificador_empresa AS id,
              codigo_identificador,
              nombre_razon_social AS nombre_legal,
              registro_fiscal AS rif,
              direccion_fiscal,
              telefono_contacto AS telefonos,
              correo_contacto,
              (logo_datos_base64 IS NOT NULL AND logo_datos_base64 != '') AS tiene_logo_configurado,
              actualizado_en AS fecha_actualizacion
       FROM empresa_razon_social
       ORDER BY codigo_identificador ASC`,
      []
    );
    return resultado.rows.map(r => ({
      id: r.id as string,
      codigoIdentificador: r.codigo_identificador as string,
      nombreLegal: r.nombre_legal as string,
      rif: r.rif as string,
      direccionFiscal: r.direccion_fiscal as string,
      telefonos: (r.telefonos as string | null) ?? null,
      correoContacto: (r.correo_contacto as string | null) ?? null,
      tieneLogoConfigurado: Boolean(r.tiene_logo_configurado),
      fechaActualizacion: new Date(r.fecha_actualizacion as string)
    }));
  }

  async obtenerConLogo(id: string): Promise<(RazonSocialRegistrada & { urlLogoBase64: string | null }) | null> {
    const resultado = await baseDeDatos.ejecutarConsulta(
      `SELECT identificador_empresa AS id,
              codigo_identificador,
              nombre_razon_social AS nombre_legal,
              registro_fiscal AS rif,
              direccion_fiscal,
              telefono_contacto AS telefonos,
              correo_contacto,
              logo_datos_base64 AS url_logo_base64,
              (logo_datos_base64 IS NOT NULL AND logo_datos_base64 != '') AS tiene_logo_configurado,
              actualizado_en AS fecha_actualizacion
       FROM empresa_razon_social WHERE identificador_empresa = $1 OR codigo_identificador = $1`,
      [id]
    );
    if (resultado.rows.length === 0) return null;
    const r = resultado.rows[0];
    return {
      id: r.id as string,
      codigoIdentificador: r.codigo_identificador as string,
      nombreLegal: r.nombre_legal as string,
      rif: r.rif as string,
      direccionFiscal: r.direccion_fiscal as string,
      telefonos: (r.telefonos as string | null) ?? null,
      correoContacto: (r.correo_contacto as string | null) ?? null,
      urlLogoBase64: (r.url_logo_base64 as string | null) ?? null,
      tieneLogoConfigurado: Boolean(r.tiene_logo_configurado),
      fechaActualizacion: new Date(r.fecha_actualizacion as string)
    };
  }

  async actualizar(id: string, datos: DatosActualizacionRazonSocial, idAdmin: string): Promise<void> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (datos.nombreLegal !== undefined) { setClauses.push(`nombre_razon_social = $${idx++}`); params.push(datos.nombreLegal.trim()); }
    if (datos.rif !== undefined) { setClauses.push(`registro_fiscal = $${idx++}`); params.push(datos.rif.trim()); }
    if (datos.direccionFiscal !== undefined) { setClauses.push(`direccion_fiscal = $${idx++}`); params.push(datos.direccionFiscal.trim()); }
    if (datos.telefonos !== undefined) { setClauses.push(`telefono_contacto = $${idx++}`); params.push(datos.telefonos.trim() || null); }
    if (datos.correoContacto !== undefined) { setClauses.push(`correo_contacto = $${idx++}`); params.push(datos.correoContacto.trim().toLowerCase() || null); }
    if (datos.urlLogoBase64 !== undefined) { setClauses.push(`logo_datos_base64 = $${idx++}`); params.push(datos.urlLogoBase64 || null); }

    if (setClauses.length === 0) return;

    setClauses.push(`actualizado_en = CURRENT_TIMESTAMP`);
    params.push(id);

    await baseDeDatos.ejecutarConsulta(
      `UPDATE empresa_razon_social SET ${setClauses.join(', ')} WHERE identificador_empresa = $${idx} OR codigo_identificador = $${idx}`,
      params
    );

    await this.repoAuditoria.registrarEvento({
      usuarioId: idAdmin,
      tipoEvento: 'ACTUALIZAR_RAZON_SOCIAL',
      nombreEntidad: 'empresa_razon_social',
      identificadorEntidad: id,
      estadoNuevo: {
        camposActualizados: Object.keys(datos).filter(k => k !== 'urlLogoBase64'),
        actualizoLogo: 'urlLogoBase64' in datos
      }
    });
  }
}
