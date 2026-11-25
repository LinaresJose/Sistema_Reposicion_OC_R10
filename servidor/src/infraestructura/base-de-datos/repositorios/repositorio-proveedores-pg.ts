import { PuertoRepositorioProveedores } from '../../../dominio/puertos/puerto-repositorio-proveedores.js';
import { ProveedorConAsignacion, AsignacionProveedor, DatosActualizacionProveedor } from '../../../dominio/entidades/proveedor.js';
import { CategoriaCompradora, EstadoAsignacionProveedor } from '../../../configuracion/constantes-negocio.js';
import { baseDeDatos } from '../cliente-postgresql.js';

export class RepositorioProveedoresPg implements PuertoRepositorioProveedores {
  async listarProveedores(filtros?: {
    categoria?: CategoriaCompradora;
    estadoAsignacion?: EstadoAsignacionProveedor;
    analistaUsuarioId?: string;
    busqueda?: string;
  }): Promise<ProveedorConAsignacion[]> {
    const condiciones: string[] = ['p.esta_activo = TRUE'];
    const parametros: any[] = [];
    let indice = 1;

    if (filtros?.categoria) {
      condiciones.push(`p.categoria_compradora = $${indice++}`);
      parametros.push(filtros.categoria);
    }

    if (filtros?.estadoAsignacion) {
      condiciones.push(`COALESCE(a.estado_asignacion, 'DISPONIBLE') = $${indice++}`);
      parametros.push(filtros.estadoAsignacion);
    }

    if (filtros?.analistaUsuarioId) {
      condiciones.push(`a.analista_usuario_id = $${indice++}`);
      parametros.push(filtros.analistaUsuarioId);
    }

    if (filtros?.busqueda) {
      condiciones.push(`(p.nombre_razon_social ILIKE $${indice} OR p.registro_informacion_fiscal ILIKE $${indice})`);
      parametros.push(`%${filtros.busqueda}%`);
      indice++;
    }

    const consulta = `
      SELECT 
        p.identificador_proveedor,
        p.codigo_proveedor_odoo,
        p.nombre_razon_social,
        p.registro_informacion_fiscal,
        p.categoria_compradora,
        p.plazo_entrega_dias,
        p.frecuencia_compra_dias,
        p.dias_credito,
        p.descuento_comercial_cadena,
        p.forma_pago_predeterminada,
        p.tipo_documento_predeterminado,
        p.nombre_contacto,
        p.telefono_contacto,
        p.correo_contacto,
        p.esta_activo,
        p.creado_en,
        p.actualizado_en,
        COALESCE(a.estado_asignacion, 'DISPONIBLE') AS estado_asignacion,
        a.analista_usuario_id,
        u.nombre_completo AS nombre_analista_asignada,
        u.correo_electronico AS correo_analista_asignada,
        COALESCE(a.bloqueo_suspendido_por_revision, FALSE) AS bloqueo_suspendido_por_revision,
        a.fecha_hora_expiracion_bloqueo,
        COUNT(ps.identificador_producto)::INT AS total_skus_aptos,
        COALESCE(SUM(c.inversion_sugerida_usd), 0.00)::FLOAT AS monto_sugerido_total_usd
      FROM proveedor p
      LEFT JOIN asignacion_proveedor a ON p.identificador_proveedor = a.proveedor_id
      LEFT JOIN usuario u ON a.analista_usuario_id = u.identificador_usuario
      LEFT JOIN producto_sku ps ON p.identificador_proveedor = ps.proveedor_id
      LEFT JOIN calculo_reposicion_sku c ON ps.identificador_producto = c.producto_id
      WHERE ${condiciones.join(' AND ')}
      GROUP BY 
        p.identificador_proveedor,
        a.estado_asignacion,
        a.analista_usuario_id,
        u.nombre_completo,
        u.correo_electronico,
        a.bloqueo_suspendido_por_revision,
        a.fecha_hora_expiracion_bloqueo
      ORDER BY p.nombre_razon_social ASC;
    `;

    const resultado = await baseDeDatos.ejecutarConsulta(consulta, parametros);
    return resultado.rows.map(this.mapearFilaAProveedorConAsignacion);
  }

  async buscarPorId(identificadorProveedor: string): Promise<ProveedorConAsignacion | null> {
    const consulta = `
      SELECT 
        p.identificador_proveedor,
        p.codigo_proveedor_odoo,
        p.nombre_razon_social,
        p.registro_informacion_fiscal,
        p.categoria_compradora,
        p.plazo_entrega_dias,
        p.frecuencia_compra_dias,
        p.dias_credito,
        p.descuento_comercial_cadena,
        p.forma_pago_predeterminada,
        p.tipo_documento_predeterminado,
        p.nombre_contacto,
        p.telefono_contacto,
        p.correo_contacto,
        p.esta_activo,
        p.creado_en,
        p.actualizado_en,
        COALESCE(a.estado_asignacion, 'DISPONIBLE') AS estado_asignacion,
        a.analista_usuario_id,
        u.nombre_completo AS nombre_analista_asignada,
        u.correo_electronico AS correo_analista_asignada,
        COALESCE(a.bloqueo_suspendido_por_revision, FALSE) AS bloqueo_suspendido_por_revision,
        a.fecha_hora_expiracion_bloqueo,
        COUNT(ps.identificador_producto)::INT AS total_skus_aptos,
        COALESCE(SUM(c.inversion_sugerida_usd), 0.00)::FLOAT AS monto_sugerido_total_usd
      FROM proveedor p
      LEFT JOIN asignacion_proveedor a ON p.identificador_proveedor = a.proveedor_id
      LEFT JOIN usuario u ON a.analista_usuario_id = u.identificador_usuario
      LEFT JOIN producto_sku ps ON p.identificador_proveedor = ps.proveedor_id
      LEFT JOIN calculo_reposicion_sku c ON ps.identificador_producto = c.producto_id
      WHERE p.identificador_proveedor = $1
      GROUP BY 
        p.identificador_proveedor,
        a.estado_asignacion,
        a.analista_usuario_id,
        u.nombre_completo,
        u.correo_electronico,
        a.bloqueo_suspendido_por_revision,
        a.fecha_hora_expiracion_bloqueo
      LIMIT 1;
    `;

    const resultado = await baseDeDatos.ejecutarConsulta(consulta, [identificadorProveedor]);
    if (resultado.rows.length === 0) return null;
    return this.mapearFilaAProveedorConAsignacion(resultado.rows[0]);
  }

  async actualizarDatosProveedor(
    identificadorProveedor: string,
    datos: DatosActualizacionProveedor
  ): Promise<ProveedorConAsignacion | null> {
    const campos: string[] = ['actualizado_en = CURRENT_TIMESTAMP'];
    const parametros: any[] = [identificadorProveedor];
    let indice = 2;

    if (datos.nombreRazonSocial !== undefined) {
      campos.push(`nombre_razon_social = $${indice++}`);
      parametros.push(datos.nombreRazonSocial);
    }
    if (datos.codigoProveedorOdoo !== undefined) {
      campos.push(`codigo_proveedor_odoo = $${indice++}`);
      parametros.push(datos.codigoProveedorOdoo);
    }
    if (datos.registroInformacionFiscal !== undefined) {
      campos.push(`registro_informacion_fiscal = $${indice++}`);
      parametros.push(datos.registroInformacionFiscal);
    }
    if (datos.categoriaCompradora !== undefined) {
      campos.push(`categoria_compradora = $${indice++}`);
      parametros.push(datos.categoriaCompradora);
    }
    if (datos.plazoEntregaDias !== undefined) {
      campos.push(`plazo_entrega_dias = $${indice++}`);
      parametros.push(datos.plazoEntregaDias);
    }
    if (datos.frecuenciaCompraDias !== undefined) {
      campos.push(`frecuencia_compra_dias = $${indice++}`);
      parametros.push(datos.frecuenciaCompraDias);
    }
    if (datos.diasCredito !== undefined) {
      campos.push(`dias_credito = $${indice++}`);
      parametros.push(datos.diasCredito);
    }
    if (datos.descuentoComercialCadena !== undefined) {
      campos.push(`descuento_comercial_cadena = $${indice++}`);
      parametros.push(datos.descuentoComercialCadena);
    }
    if (datos.formaPagoPredeterminada !== undefined) {
      campos.push(`forma_pago_predeterminada = $${indice++}`);
      parametros.push(datos.formaPagoPredeterminada);
    }
    if (datos.tipoDocumentoPredeterminado !== undefined) {
      campos.push(`tipo_documento_predeterminado = $${indice++}`);
      parametros.push(datos.tipoDocumentoPredeterminado);
    }
    if (datos.nombreContacto !== undefined) {
      campos.push(`nombre_contacto = $${indice++}`);
      parametros.push(datos.nombreContacto);
    }
    if (datos.telefonoContacto !== undefined) {
      campos.push(`telefono_contacto = $${indice++}`);
      parametros.push(datos.telefonoContacto);
    }
    if (datos.correoContacto !== undefined) {
      campos.push(`correo_contacto = $${indice++}`);
      parametros.push(datos.correoContacto);
    }
    if (datos.estaActivo !== undefined) {
      campos.push(`esta_activo = $${indice++}`);
      parametros.push(datos.estaActivo);
    }

    const consulta = `
      UPDATE proveedor
      SET ${campos.join(', ')}
      WHERE identificador_proveedor = $1
      RETURNING identificador_proveedor;
    `;

    const resultado = await baseDeDatos.ejecutarConsulta(consulta, parametros);
    if (resultado.rows.length === 0) return null;

    return this.buscarPorId(identificadorProveedor);
  }

  async obtenerAsignacionActual(identificadorProveedor: string): Promise<AsignacionProveedor | null> {
    const consulta = `
      SELECT 
        identificador_asignacion,
        proveedor_id,
        analista_usuario_id,
        estado_asignacion,
        fecha_hora_toma,
        fecha_hora_ultima_actividad,
        fecha_hora_expiracion_bloqueo,
        bloqueo_suspendido_por_revision,
        observacion_bloqueo
      FROM asignacion_proveedor
      WHERE proveedor_id = $1
      LIMIT 1;
    `;
    const resultado = await baseDeDatos.ejecutarConsulta(consulta, [identificadorProveedor]);
    if (resultado.rows.length === 0) return null;
    return this.mapearFilaAAsignacion(resultado.rows[0]);
  }

  async autoasignarProveedor(
    identificadorProveedor: string,
    analistaUsuarioId: string,
    minutosInactividad: number
  ): Promise<{ exito: boolean; asignacion?: AsignacionProveedor; conflictoConUsuarioId?: string }> {
    const cliente = await baseDeDatos.obtenerClienteTransaccion();
    try {
      await cliente.query('BEGIN');

      // Bloqueo de fila a nivel de base de datos para prevenir condicion de carrera
      const consultaBloqueo = `
        SELECT 
          identificador_asignacion,
          proveedor_id,
          analista_usuario_id,
          estado_asignacion,
          fecha_hora_expiracion_bloqueo,
          bloqueo_suspendido_por_revision
        FROM asignacion_proveedor
        WHERE proveedor_id = $1
        FOR UPDATE;
      `;
      const resActual = await cliente.query(consultaBloqueo, [identificadorProveedor]);

      if (resActual.rows.length > 0) {
        const actual = resActual.rows[0];
        const estaOcupadoPorOtro =
          actual.analista_usuario_id &&
          actual.analista_usuario_id !== analistaUsuarioId;

        const estaBloqueoVigente =
          actual.bloqueo_suspendido_por_revision === true ||
          (actual.fecha_hora_expiracion_bloqueo && new Date(actual.fecha_hora_expiracion_bloqueo) > new Date());

        if (estaOcupadoPorOtro && estaBloqueoVigente) {
          await cliente.query('ROLLBACK');
          return { exito: false, conflictoConUsuarioId: actual.analista_usuario_id };
        }
      }

      // Proceder con la autoasignacion
      const consultaUpsert = `
        INSERT INTO asignacion_proveedor (
          proveedor_id,
          analista_usuario_id,
          estado_asignacion,
          fecha_hora_toma,
          fecha_hora_ultima_actividad,
          fecha_hora_expiracion_bloqueo,
          bloqueo_suspendido_por_revision,
          observacion_bloqueo,
          actualizado_en
        ) VALUES (
          $1,
          $2,
          'EN_PROCESO_TRABAJO',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP + ($3 || ' minutes')::INTERVAL,
          FALSE,
          'Autoasignado por analista',
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (proveedor_id) DO UPDATE SET
          analista_usuario_id = EXCLUDED.analista_usuario_id,
          estado_asignacion = 'EN_PROCESO_TRABAJO',
          fecha_hora_toma = CURRENT_TIMESTAMP,
          fecha_hora_ultima_actividad = CURRENT_TIMESTAMP,
          fecha_hora_expiracion_bloqueo = CURRENT_TIMESTAMP + ($3 || ' minutes')::INTERVAL,
          bloqueo_suspendido_por_revision = FALSE,
          observacion_bloqueo = EXCLUDED.observacion_bloqueo,
          actualizado_en = CURRENT_TIMESTAMP
        RETURNING *;
      `;
      const resUpsert = await cliente.query(consultaUpsert, [identificadorProveedor, analistaUsuarioId, minutosInactividad.toString()]);
      await cliente.query('COMMIT');

      return {
        exito: true,
        asignacion: this.mapearFilaAAsignacion(resUpsert.rows[0])
      };
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  async liberarProveedor(identificadorProveedor: string, observacion?: string): Promise<boolean> {
    const consulta = `
      UPDATE asignacion_proveedor
      SET 
        analista_usuario_id = NULL,
        estado_asignacion = 'DISPONIBLE',
        fecha_hora_expiracion_bloqueo = NULL,
        bloqueo_suspendido_por_revision = FALSE,
        observacion_bloqueo = $2,
        actualizado_en = CURRENT_TIMESTAMP
      WHERE proveedor_id = $1;
    `;
    const resultado = await baseDeDatos.ejecutarConsulta(consulta, [identificadorProveedor, observacion || 'Proveedor liberado']);
    return (resultado.rowCount ?? 0) > 0;
  }

  async actualizarEstadoRevisionWhatsApp(identificadorProveedor: string, enRevision: boolean): Promise<void> {
    const consulta = `
      UPDATE asignacion_proveedor
      SET 
        estado_asignacion = CASE WHEN $2 = TRUE THEN 'EN_REVISION_WHATSAPP' ELSE 'EN_PROCESO_TRABAJO' END,
        bloqueo_suspendido_por_revision = $2,
        fecha_hora_ultima_actividad = CURRENT_TIMESTAMP,
        actualizado_en = CURRENT_TIMESTAMP
      WHERE proveedor_id = $1;
    `;
    await baseDeDatos.ejecutarConsulta(consulta, [identificadorProveedor, enRevision]);
  }

  async actualizarActividadProveedor(identificadorProveedor: string): Promise<void> {
    const consulta = `
      UPDATE asignacion_proveedor
      SET 
        fecha_hora_ultima_actividad = CURRENT_TIMESTAMP,
        actualizado_en = CURRENT_TIMESTAMP
      WHERE proveedor_id = $1;
    `;
    await baseDeDatos.ejecutarConsulta(consulta, [identificadorProveedor]);
  }

  private mapearFilaAProveedorConAsignacion(fila: any): ProveedorConAsignacion {
    return {
      identificadorProveedor: fila.identificador_proveedor,
      codigoProveedorOdoo: fila.codigo_proveedor_odoo,
      nombreRazonSocial: fila.nombre_razon_social,
      registroInformacionFiscal: fila.registro_informacion_fiscal,
      categoriaCompradora: fila.categoria_compradora,
      plazoEntregaDias: Number(fila.plazo_entrega_dias),
      frecuenciaCompraDias: Number(fila.frecuencia_compra_dias),
      diasCredito: Number(fila.dias_credito),
      descuentoComercialCadena: fila.descuento_comercial_cadena,
      formaPagoPredeterminada: fila.forma_pago_predeterminada,
      tipoDocumentoPredeterminado: fila.tipo_documento_predeterminado,
      nombreContacto: fila.nombre_contacto,
      telefonoContacto: fila.telefono_contacto,
      correoContacto: fila.correo_contacto,
      estaActivo: fila.esta_activo,
      creadoEn: new Date(fila.creado_en),
      actualizadoEn: new Date(fila.actualizado_en),
      estadoAsignacion: fila.estado_asignacion,
      analistaAsignadaId: fila.analista_usuario_id,
      nombreAnalistaAsignada: fila.nombre_analista_asignada,
      correoAnalistaAsignada: fila.correo_analista_asignada,
      bloqueoSuspendidoPorRevision: Boolean(fila.bloqueo_suspendido_por_revision),
      fechaHoraExpiracionBloqueo: fila.fecha_hora_expiracion_bloqueo ? new Date(fila.fecha_hora_expiracion_bloqueo) : null,
      totalSkusAptos: Number(fila.total_skus_aptos),
      montoSugeridoTotalUSD: Number(fila.monto_sugerido_total_usd)
    };
  }

  private mapearFilaAAsignacion(fila: any): AsignacionProveedor {
    return {
      identificadorAsignacion: fila.identificador_asignacion,
      proveedorId: fila.proveedor_id,
      analistaUsuarioId: fila.analista_usuario_id,
      estadoAsignacion: fila.estado_asignacion,
      fechaHoraToma: fila.fecha_hora_toma ? new Date(fila.fecha_hora_toma) : null,
      fechaHoraUltimaActividad: fila.fecha_hora_ultima_actividad ? new Date(fila.fecha_hora_ultima_actividad) : null,
      fechaHoraExpiracionBloqueo: fila.fecha_hora_expiracion_bloqueo ? new Date(fila.fecha_hora_expiracion_bloqueo) : null,
      bloqueoSuspendidoPorRevision: Boolean(fila.bloqueo_suspendido_por_revision),
      observacionBloqueo: fila.observacion_bloqueo
    };
  }
}
