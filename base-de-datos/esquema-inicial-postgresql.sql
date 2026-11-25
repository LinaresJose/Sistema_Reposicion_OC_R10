-- ============================================================================
-- ESQUEMA INICIAL DE BASE DE DATOS POSTGRESQL - SISTEMA REPOSICION Y OC
-- Proyecto: Plataforma Multi-Usuario de Reposicion MMC R10
-- Version: 1.0.0
-- Reglas: Nombres tecnicos 100% en espanol, sin tildes ni caracteres especiales.
-- ============================================================================

-- Extension para generacion de identificadores UUID v4
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TABLA: rol
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rol (
    identificador_rol VARCHAR(50) PRIMARY KEY,
    nombre_rol VARCHAR(100) NOT NULL,
    descripcion_rol VARCHAR(255) NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ----------------------------------------------------------------------------
-- 2. TABLA: usuario
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario (
    identificador_usuario UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_completo VARCHAR(150) NOT NULL,
    correo_electronico VARCHAR(150) NOT NULL UNIQUE,
    clave_secreta_hash VARCHAR(255) NOT NULL,
    rol_id VARCHAR(50) NOT NULL REFERENCES rol(identificador_rol) ON DELETE RESTRICT,
    categoria_compradora VARCHAR(30) DEFAULT 'NINGUNA' NOT NULL,
    esta_activo BOOLEAN DEFAULT TRUE NOT NULL,
    intentos_fallidos_login INT DEFAULT 0 NOT NULL,
    bloqueado_hasta TIMESTAMPTZ,
    telefono_contacto VARCHAR(50),
    creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actualizado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_usuario_categoria CHECK (categoria_compradora IN ('NACIONAL_1', 'NACIONAL_2', 'NACIONAL_3', 'INTERNACIONAL', 'NINGUNA'))
);

CREATE INDEX IF NOT EXISTS idx_usuario_correo ON usuario(correo_electronico);
CREATE INDEX IF NOT EXISTS idx_usuario_rol ON usuario(rol_id);

-- ----------------------------------------------------------------------------
-- 3. TABLA: empresa_razon_social (2 Razones Sociales Oficiales)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empresa_razon_social (
    identificador_empresa UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_identificador VARCHAR(20) NOT NULL UNIQUE, -- 'MMC' o 'LYNOX'
    nombre_razon_social VARCHAR(200) NOT NULL,
    nombre_comercial VARCHAR(100) NOT NULL,
    registro_fiscal VARCHAR(30) NOT NULL UNIQUE,      -- RIF Venezolano
    direccion_fiscal TEXT NOT NULL,
    zona_postal VARCHAR(10),
    ciudad VARCHAR(100) DEFAULT 'Valencia' NOT NULL,
    estado_geografico VARCHAR(100) DEFAULT 'Carabobo' NOT NULL,
    telefono_contacto VARCHAR(100),
    correo_contacto VARCHAR(150),
    ruta_logo_archivo VARCHAR(255),
    logo_datos_base64 TEXT,
    texto_pie_pagina TEXT,
    esta_activa BOOLEAN DEFAULT TRUE NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actualizado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ----------------------------------------------------------------------------
-- 4. TABLA: proveedor
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proveedor (
    identificador_proveedor UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_proveedor_odoo VARCHAR(50),
    nombre_razon_social VARCHAR(200) NOT NULL,
    registro_informacion_fiscal VARCHAR(30),
    categoria_compradora VARCHAR(30) DEFAULT 'NACIONAL_1' NOT NULL,
    plazo_entrega_dias INT DEFAULT 7 NOT NULL,
    frecuencia_compra_dias INT DEFAULT 15 NOT NULL,
    dias_credito INT DEFAULT 0 NOT NULL,
    descuento_comercial_cadena VARCHAR(100) DEFAULT '0%' NOT NULL,
    forma_pago_predeterminada VARCHAR(150) DEFAULT 'DIVISAS_TRANSFERENCIA' NOT NULL,
    tipo_documento_predeterminado VARCHAR(100) DEFAULT 'FACTURA' NOT NULL,
    nombre_contacto VARCHAR(150),
    telefono_contacto VARCHAR(100),
    correo_contacto VARCHAR(150),
    esta_activo BOOLEAN DEFAULT TRUE NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actualizado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_proveedor_categoria CHECK (categoria_compradora IN ('NACIONAL_1', 'NACIONAL_2', 'NACIONAL_3', 'INTERNACIONAL'))
);

CREATE INDEX IF NOT EXISTS idx_proveedor_nombre ON proveedor(nombre_razon_social);
CREATE INDEX IF NOT EXISTS idx_proveedor_categoria ON proveedor(categoria_compradora);

-- ----------------------------------------------------------------------------
-- 5. TABLA: asignacion_proveedor (Concurrencia, Autoasignacion y Bloqueo Inteligente)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asignacion_proveedor (
    identificador_asignacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proveedor_id UUID NOT NULL UNIQUE REFERENCES proveedor(identificador_proveedor) ON DELETE CASCADE,
    analista_usuario_id UUID REFERENCES usuario(identificador_usuario) ON DELETE SET NULL,
    estado_asignacion VARCHAR(30) DEFAULT 'DISPONIBLE' NOT NULL,
    fecha_hora_toma TIMESTAMPTZ,
    fecha_hora_ultima_actividad TIMESTAMPTZ,
    fecha_hora_expiracion_bloqueo TIMESTAMPTZ,
    bloqueo_suspendido_por_revision BOOLEAN DEFAULT FALSE NOT NULL,
    observacion_bloqueo VARCHAR(255),
    creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actualizado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_asignacion_estado CHECK (estado_asignacion IN ('DISPONIBLE', 'EN_PROCESO_TRABAJO', 'EN_REVISION_WHATSAPP'))
);

CREATE INDEX IF NOT EXISTS idx_asignacion_analista ON asignacion_proveedor(analista_usuario_id);
CREATE INDEX IF NOT EXISTS idx_asignacion_estado ON asignacion_proveedor(estado_asignacion);

-- ----------------------------------------------------------------------------
-- 6. TABLA: producto_sku
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS producto_sku (
    identificador_producto UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_sku VARCHAR(50) NOT NULL UNIQUE,
    codigo_barras VARCHAR(100),
    descripcion_producto VARCHAR(255) NOT NULL,
    marca VARCHAR(100),
    proveedor_id UUID REFERENCES proveedor(identificador_proveedor) ON DELETE SET NULL,
    costo_unitario_usd NUMERIC(14, 4) DEFAULT 0.0000 NOT NULL,
    precio_venta_usd NUMERIC(14, 4) DEFAULT 0.0000 NOT NULL,
    unidad_minima_empaque INT DEFAULT 1 NOT NULL,
    clasificacion_comercial VARCHAR(30) DEFAULT 'MEDIA ROTACION' NOT NULL,
    estado_sku_odoo VARCHAR(50) DEFAULT 'ACTIVO' NOT NULL,
    cobertura_excepcion_dias INT,
    umbral_excepcion_dias INT,
    justificacion_excepcion VARCHAR(255),
    creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actualizado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_sku_empaque CHECK (unidad_minima_empaque >= 1),
    CONSTRAINT chk_sku_clasificacion CHECK (clasificacion_comercial IN ('ALTA ROTACION', 'MEDIA ROTACION', 'COMPLEMENTO'))
);

CREATE INDEX IF NOT EXISTS idx_sku_codigo ON producto_sku(codigo_sku);
CREATE INDEX IF NOT EXISTS idx_sku_proveedor ON producto_sku(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_sku_clasificacion ON producto_sku(clasificacion_comercial);

-- ----------------------------------------------------------------------------
-- 7. TABLAS DE PARAMETRIZACION: parametro_global y parametro_clase_sku
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parametro_global (
    clave_parametro VARCHAR(50) PRIMARY KEY,
    valor_numerico NUMERIC(14, 4),
    valor_texto VARCHAR(255),
    descripcion VARCHAR(255),
    actualizado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS parametro_clase_sku (
    clasificacion_comercial VARCHAR(30) PRIMARY KEY,
    usar_mayor_cobertura_proveedor BOOLEAN DEFAULT FALSE NOT NULL,
    exigir_demanda_facturada BOOLEAN DEFAULT FALSE NOT NULL,
    controlar_exceso_por_empaque BOOLEAN DEFAULT FALSE NOT NULL,
    factor_demanda NUMERIC(8, 4) DEFAULT 1.0000 NOT NULL,
    seguridad_adicional_dias INT DEFAULT 0 NOT NULL,
    actualizado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ----------------------------------------------------------------------------
-- 8. TABLAS DE INGESTA ODOO: carga_archivo_odoo y novedad_carga_odoo
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carga_archivo_odoo (
    identificador_carga UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES usuario(identificador_usuario) ON DELETE SET NULL,
    tipo_origen VARCHAR(50) DEFAULT 'ARCHIVOS_MANUALES_EXCEL' NOT NULL,
    hash_catalogo_costos VARCHAR(64),
    hash_inventario_a_mano VARCHAR(64),
    hash_compras_transito VARCHAR(64),
    hash_ventas_precios VARCHAR(64),
    total_registros_procesados INT DEFAULT 0 NOT NULL,
    total_novedades_detectadas INT DEFAULT 0 NOT NULL,
    estado_procesamiento VARCHAR(30) DEFAULT 'COMPLETADA_EXITOSA' NOT NULL,
    resumen_novedades JSONB,
    creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS novedad_carga_odoo (
    identificador_novedad UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carga_id UUID NOT NULL REFERENCES carga_archivo_odoo(identificador_carga) ON DELETE CASCADE,
    tipo_novedad VARCHAR(50) NOT NULL,
    codigo_sku VARCHAR(50) NOT NULL,
    valor_anterior VARCHAR(100),
    valor_nuevo VARCHAR(100),
    detalle_novedad TEXT,
    creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_novedad_carga ON novedad_carga_odoo(carga_id);
CREATE INDEX IF NOT EXISTS idx_novedad_sku ON novedad_carga_odoo(codigo_sku);

-- ----------------------------------------------------------------------------
-- 9. TABLA: calculo_reposicion_sku (Instantanea Inmutable del Motor R10)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calculo_reposicion_sku (
    identificador_calculo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID NOT NULL REFERENCES producto_sku(identificador_producto) ON DELETE CASCADE,
    periodo_mes VARCHAR(10) NOT NULL,
    cantidad_a_mano NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
    cantidad_transito_valido NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
    inventario_efectivo_disponible NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
    demanda_operativa_mensual NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
    demanda_diaria NUMERIC(14, 4) DEFAULT 0.0000 NOT NULL,
    dias_cobertura_actual NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
    cobertura_objetivo_dias INT DEFAULT 30 NOT NULL,
    umbral_compra_dias INT DEFAULT 15 NOT NULL,
    cantidad_sugerida_bruta INT DEFAULT 0 NOT NULL,
    cantidad_sugerida_empaque INT DEFAULT 0 NOT NULL,
    inversion_sugerida_usd NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
    diagnostico_urgencia VARCHAR(30) DEFAULT 'POSTERGAR' NOT NULL,
    es_apto_para_compra BOOLEAN DEFAULT TRUE NOT NULL,
    motivo_inaptitud VARCHAR(255),
    hash_instantanea_calculo VARCHAR(64) NOT NULL,
    fecha_calculo TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calculo_producto ON calculo_reposicion_sku(producto_id);
CREATE INDEX IF NOT EXISTS idx_calculo_periodo ON calculo_reposicion_sku(periodo_mes);
CREATE INDEX IF NOT EXISTS idx_calculo_urgencia ON calculo_reposicion_sku(diagnostico_urgencia);

-- ----------------------------------------------------------------------------
-- 10. TABLA: decision_compra_sku (Decisiones de Analistas por SKU)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decision_compra_sku (
    identificador_decision UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculo_id UUID NOT NULL REFERENCES calculo_reposicion_sku(identificador_calculo) ON DELETE CASCADE,
    proveedor_id UUID NOT NULL REFERENCES proveedor(identificador_proveedor) ON DELETE CASCADE,
    analista_usuario_id UUID REFERENCES usuario(identificador_usuario) ON DELETE SET NULL,
    estado_decision VARCHAR(20) DEFAULT 'PENDIENTE' NOT NULL,
    cantidad_sugerida_referencia INT DEFAULT 0 NOT NULL,
    cantidad_ajuste_manual INT,
    cantidad_final_propuesta INT DEFAULT 0 NOT NULL,
    justificacion_ajuste TEXT,
    hash_firma_aprobada VARCHAR(64),
    es_calculo_vigente BOOLEAN DEFAULT TRUE NOT NULL,
    numero_version INT DEFAULT 1 NOT NULL,
    actualizado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_decision_estado CHECK (estado_decision IN ('PENDIENTE', 'APROBADO', 'EXCLUIDO'))
);

CREATE INDEX IF NOT EXISTS idx_decision_proveedor ON decision_compra_sku(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_decision_calculo ON decision_compra_sku(calculo_id);

-- ----------------------------------------------------------------------------
-- 11. TABLAS DE ORDENES DE COMPRA: orden_compra y renglon_orden_compra
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orden_compra (
    identificador_orden UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_correlativo_oficial VARCHAR(50) UNIQUE,
    numero_correlativo_secuencial INT,
    empresa_emisora_id UUID REFERENCES empresa_razon_social(identificador_empresa) ON DELETE RESTRICT,
    proveedor_id UUID NOT NULL REFERENCES proveedor(identificador_proveedor) ON DELETE RESTRICT,
    analista_creadora_id UUID NOT NULL REFERENCES usuario(identificador_usuario) ON DELETE RESTRICT,
    estado_orden VARCHAR(30) DEFAULT 'BORRADOR' NOT NULL,
    canal_aprobacion VARCHAR(50),
    nota_respaldo_aprobacion TEXT,
    aprobado_por_id UUID REFERENCES usuario(identificador_usuario) ON DELETE SET NULL,
    aprobado_en TIMESTAMPTZ,
    emitido_en TIMESTAMPTZ,
    total_renglones INT DEFAULT 0 NOT NULL,
    total_inversion_usd NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
    condicion_pago VARCHAR(100),
    tipo_documento_legal VARCHAR(30) DEFAULT 'FACTURA' NOT NULL,
    plazo_entrega_dias INT DEFAULT 0 NOT NULL,
    frecuencia_compra_dias INT DEFAULT 0 NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actualizado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_orden_estado CHECK (estado_orden IN ('BORRADOR', 'EN_REVISION_WHATSAPP', 'APROBADA_PARA_EMISION', 'OC_EMITIDA', 'CANCELADA')),
    CONSTRAINT chk_orden_canal CHECK (canal_aprobacion IS NULL OR canal_aprobacion IN ('SISTEMA', 'WHATSAPP'))
);

CREATE INDEX IF NOT EXISTS idx_orden_proveedor ON orden_compra(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_orden_empresa ON orden_compra(empresa_emisora_id);
CREATE INDEX IF NOT EXISTS idx_orden_estado ON orden_compra(estado_orden);
CREATE INDEX IF NOT EXISTS idx_orden_correlativo ON orden_compra(numero_correlativo_oficial);

CREATE TABLE IF NOT EXISTS renglon_orden_compra (
    identificador_renglon UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orden_compra_id UUID NOT NULL REFERENCES orden_compra(identificador_orden) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES producto_sku(identificador_producto) ON DELETE RESTRICT,
    codigo_sku VARCHAR(50) NOT NULL,
    descripcion_producto VARCHAR(255) NOT NULL,
    marca VARCHAR(100),
    unidad_minima_empaque INT DEFAULT 1 NOT NULL,
    cantidad_ordenada INT NOT NULL,
    costo_unitario_usd NUMERIC(14, 4) NOT NULL,
    subtotal_usd NUMERIC(14, 2) NOT NULL,
    justificacion_ajuste TEXT,
    creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_renglon_orden ON renglon_orden_compra(orden_compra_id);
CREATE INDEX IF NOT EXISTS idx_renglon_sku ON renglon_orden_compra(codigo_sku);

-- ----------------------------------------------------------------------------
-- 12. TABLA: notificacion_analista (Polling Ligero para Free Tier)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificacion_analista (
    identificador_notificacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_destino_id UUID NOT NULL REFERENCES usuario(identificador_usuario) ON DELETE CASCADE,
    tipo_notificacion VARCHAR(50) NOT NULL,
    titulo_mensaje VARCHAR(100) NOT NULL,
    detalle_mensaje TEXT NOT NULL,
    proveedor_id UUID REFERENCES proveedor(identificador_proveedor) ON DELETE SET NULL,
    ha_sido_leida BOOLEAN DEFAULT FALSE NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notificacion_usuario_leida ON notificacion_analista(usuario_destino_id, ha_sido_leida);

-- ----------------------------------------------------------------------------
-- 13. TABLA: registro_auditoria (Bitacora Inmutable)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registro_auditoria (
    identificador_auditoria UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES usuario(identificador_usuario) ON DELETE SET NULL,
    tipo_evento VARCHAR(50) NOT NULL,
    nombre_entidad VARCHAR(50) NOT NULL,
    identificador_entidad VARCHAR(50) NOT NULL,
    estado_anterior JSONB,
    estado_nuevo JSONB,
    direccion_ip VARCHAR(50),
    marca_tiempo TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auditoria_entidad ON registro_auditoria(nombre_entidad, identificador_entidad);
CREATE INDEX IF NOT EXISTS idx_auditoria_tiempo ON registro_auditoria(marca_tiempo);

-- ============================================================================
-- DATOS SEMILLA (INICIALIZACION OBLIGATORIA)
-- ============================================================================

-- 1. Roles del Sistema
INSERT INTO rol (identificador_rol, nombre_rol, descripcion_rol) VALUES
('ADMINISTRADOR_SISTEMA', 'Administrador del Sistema', 'Acceso total y sin restricciones: permisos operativos de compra y aprobacion identicos al Gerente, mas administracion tecnica, de usuarios y parametros.'),
('GERENTE_COMPRAS', 'Gerente de Compras', 'Supervision y autorizacion de compras, emision formal de ordenes, configuracion de presupuestos y coberturas.'),
('ANALISTA_COMPRAS', 'Analista de Compras', 'Gestion de cartera de proveedores asignados, revision de propuestas, ajuste justificado de cantidades y emision bajo instruccion.'),
('AUDITOR_CONTROL', 'Auditor de Control', 'Acceso de solo lectura a maestros, calculos, bitacora de auditoria y reportes comparativos.')
ON CONFLICT (identificador_rol) DO UPDATE 
SET nombre_rol = EXCLUDED.nombre_rol, descripcion_rol = EXCLUDED.descripcion_rol;

-- 2. Parametros por Clase de SKU (Reglas exactas extraidas del R10)
INSERT INTO parametro_clase_sku (clasificacion_comercial, usar_mayor_cobertura_proveedor, exigir_demanda_facturada, controlar_exceso_por_empaque, factor_demanda, seguridad_adicional_dias) VALUES
('ALTA ROTACION', TRUE, FALSE, FALSE, 1.0000, 0),
('MEDIA ROTACION', FALSE, FALSE, FALSE, 1.0000, 0),
('COMPLEMENTO', FALSE, FALSE, TRUE, 1.0000, 0)
ON CONFLICT (clasificacion_comercial) DO NOTHING;

-- 3. Parametros Globales Iniciales
INSERT INTO parametro_global (clave_parametro, valor_numerico, valor_texto, descripcion) VALUES
('PESO_META_VENTAS', 0.5000, NULL, 'Ponderacion entre demanda historica y meta de ventas (0.50 = 50% / 50%)'),
('DIAS_ESTANDAR_MES', 30.0000, NULL, 'Dias base comerciales para el calculo de demanda diaria'),
('FACTOR_SOBRESTOCK', 1.2500, NULL, 'Multiplicador de tolerancia para alerta de capital en sobrestock (1.25 = 25%)'),
('DESCUENTO_COMERCIAL_MARGEN', 0.4000, NULL, 'Margen minimo comercial de referencia'),
('TIEMPO_EXPIRACION_BLOQUEO_MINUTOS', 45.0000, NULL, 'Minutos de inactividad antes de liberar automaticamente un proveedor'),
('MES_ACTIVO_CALCULO', NULL, '2026-11', 'Periodo mensual activo para el calculo del motor R10')
ON CONFLICT (clave_parametro) DO NOTHING;

-- 4. Insercion de las 2 Razones Sociales Oficiales
INSERT INTO empresa_razon_social (
    codigo_identificador,
    nombre_razon_social,
    nombre_comercial,
    registro_fiscal,
    direccion_fiscal,
    zona_postal,
    ciudad,
    estado_geografico,
    telefono_contacto,
    correo_contacto,
    ruta_logo_archivo,
    logo_datos_base64,
    texto_pie_pagina,
    esta_activa
) VALUES 
(
    'MMC',
    'MULTIMARCAS DEL CENTRO, C.A.',
    'MMC',
    'J-50330258-5',
    'AV PRINCIPAL LOCAL NRO L-17 URB PARQUE COMERCIO CIUDAD INDUSTRIAL CASTILLITO VALENCIA CARABOBO ZONA POSTAL 2006',
    '2006',
    'Valencia',
    'Carabobo',
    NULL,
    'compras@multimarcasdelcentro.com',
    'recursos/logos/logo-multimarcas-del-centro.png',
    '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',
    'MULTIMARCAS DEL CENTRO, C.A. · RIF: J-50330258-5 · Valencia, Carabobo, Venezuela',
    TRUE
),
(
    'LYNOX',
    'GRUPO FERRETERO LYNOX, C.A.',
    'LYNOX',
    'J-50053430-2',
    'CALLE 6TA TRANSVERSAL, AVENIDA 83 NORTE, N° N-J-1 LOCAL GALPON NRO 2 ZONA INDUSTRIAL CARABOBO VALENCIA CARABOBO ZONA POSTAL 2003',
    '2003',
    'Valencia',
    'Carabobo',
    NULL,
    'compras@grupoferreterolynox.com',
    'recursos/logos/logo-grupo-ferretero-lynox.png',
    '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',
    'GRUPO FERRETERO LYNOX, C.A. · RIF: J-50053430-2 · Valencia, Carabobo, Venezuela',
    TRUE
)
ON CONFLICT (codigo_identificador) DO UPDATE
SET nombre_razon_social = EXCLUDED.nombre_razon_social,
    registro_fiscal = EXCLUDED.registro_fiscal,
    direccion_fiscal = EXCLUDED.direccion_fiscal,
    actualizado_en = CURRENT_TIMESTAMP;

-- 5. Usuarios Iniciales del Sistema (Argon2id)
-- Administrador: admin@multimarcas.com / Administrador2026!
-- Gerente: gerente@multimarcas.com / Gerente2026!
-- Analista: analista@multimarcas.com / Analista2026!
INSERT INTO usuario (
    nombre_completo,
    correo_electronico,
    clave_secreta_hash,
    rol_id,
    categoria_compradora,
    esta_activo,
    telefono_contacto
) VALUES 
(
    'Administrador Principal',
    'admin@multimarcas.com',
    '$argon2id$v=19$m=65536,t=3,p=4$M9SZf8giJVU0GVa2Cs/Tiw$6KX19604e4v7HGKxWJL5Xs2C7s5xrM7sVeoI0QQ1/Mg',
    'ADMINISTRADOR_SISTEMA',
    'NINGUNA',
    TRUE,
    '+58-412-0000001'
),
(
    'Gerente de Compras',
    'gerente@multimarcas.com',
    '$argon2id$v=19$m=65536,t=3,p=4$etXf83mi1iZk0TxPvCtZ3g$rBP2o+d1E2TxiYGKsNI4ysWLbdHU+fE94PCDtRwFir0',
    'GERENTE_COMPRAS',
    'NINGUNA',
    TRUE,
    '+58-412-0000002'
),
(
    'Analista de Compras Principal',
    'analista@multimarcas.com',
    '$argon2id$v=19$m=65536,t=3,p=4$QelbhD0edSvYV01MIBuEFA$5jWWUFb6FJGsnhEQAi46/Y6iaU6FCcZz/DPFRHxfM7Q',
    'ANALISTA_COMPRAS',
    'NACIONAL_1',
    TRUE,
    '+58-412-0000003'
)
ON CONFLICT (correo_electronico) DO UPDATE 
SET clave_secreta_hash = EXCLUDED.clave_secreta_hash,
    rol_id = EXCLUDED.rol_id,
    esta_activo = TRUE;
