#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script Migrador Inicial desde MMC_R10_v1.1.xlsm
Extrae el maestro de Proveedores y Catalogo de SKUs respetando codigos
alfanumericos como texto estricto sin corromper ceros a la izquierda ni fechas.
"""

import os
import sys
import time
import openpyxl

def normalizar_texto(valor):
    if valor is None:
        return ''
    return str(valor).strip()

def normalizar_sku(valor):
    if valor is None:
        return ''
    if isinstance(valor, float):
        valor = int(valor)
    texto = str(valor).strip()
    # Si es puramente numerico y tiene menos de 7 caracteres, preservar ceros a la izquierda tipicos
    if texto.isdigit() and len(texto) == 6:
        texto = texto.zfill(7)
    return texto

def normalizar_entero(valor, predeterminado=1):
    if valor is None:
        return predeterminado
    try:
        val_float = float(valor)
        val_int = int(round(val_float))
        return val_int if val_int >= 0 else predeterminado
    except (ValueError, TypeError):
        return predeterminado

def normalizar_decimal(valor, predeterminado=0.0):
    if valor is None:
        return predeterminado
    try:
        return round(float(valor), 4)
    except (ValueError, TypeError):
        return predeterminado

def escapar_sql(texto):
    if texto is None:
        return 'NULL'
    cadena = str(texto).replace("'", "''")
    return f"'{cadena}'"

def main():
    inicio_tiempo = time.time()
    ruta_base = r'c:\Users\usuario\Desktop\Proyecto OC'
    ruta_excel = os.path.join(ruta_base, 'MMC_R10_v1.1.xlsm')
    ruta_salida_sql = os.path.join(ruta_base, 'base-de-datos', 'datos-migracion-catalogo-r10.sql')
    ruta_log = os.path.join(ruta_base, 'registros-ejecucion', 'migracion.log')

    os.makedirs(os.path.join(ruta_base, 'registros-ejecucion'), exist_ok=True)

    with open(ruta_log, 'w', encoding='utf-8') as log_file:
        log_file.write(f"Iniciando migracion: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")

        if not os.path.exists(ruta_excel):
            print(f"ERROR: No se encontro el archivo Excel en {ruta_excel}", file=sys.stderr)
            sys.exit(1)

        log_file.write(f"Cargando libro Excel: {ruta_excel}\n")
        wb = openpyxl.load_workbook(ruta_excel, data_only=True, read_only=True)

        # 1. MIGRACION DE PROVEEDORES
        ws_prov = wb['PROVEEDORES']
        proveedores_procesados = []
        nombres_proveedores = set()

        filas_prov = ws_prov.iter_rows(min_row=2, values_only=True)
        for num_fila, fila in enumerate(filas_prov, start=2):
            nombre = normalizar_texto(fila[0])
            if not nombre or nombre in nombres_proveedores:
                continue
            
            nombres_proveedores.add(nombre)
            rif = normalizar_texto(fila[1])
            credito_txt = normalizar_texto(fila[2])
            dias_credito = 0
            if 'DIA' in credito_txt.upper():
                partes = credito_txt.split()
                if partes and partes[0].isdigit():
                    dias_credito = int(partes[0])

            compradora_raw = normalizar_texto(fila[3]).upper()
            if 'NACIONAL 1' in compradora_raw:
                categoria = 'NACIONAL_1'
            elif 'NACIONAL 2' in compradora_raw:
                categoria = 'NACIONAL_2'
            elif 'NACIONAL 3' in compradora_raw:
                categoria = 'NACIONAL_3'
            elif 'INTERNACIONAL' in compradora_raw:
                categoria = 'INTERNACIONAL'
            else:
                categoria = 'NACIONAL_1'

            descuento = normalizar_texto(fila[4]) or '0%'
            forma_pago = normalizar_texto(fila[5]) or 'DIVISAS_TRANSFERENCIA'
            tipo_doc = 'FACTURA' if 'FACT' in normalizar_texto(fila[6]).upper() else 'NOTA_DE_ENTREGA'
            contacto = normalizar_texto(fila[7])
            celular = normalizar_texto(fila[8]) if len(fila) > 8 else ''
            
            plazo_entrega = normalizar_entero(fila[10] if len(fila) > 10 else 7, 7)
            frecuencia_oc = normalizar_entero(fila[12] if len(fila) > 12 else 15, 15)

            proveedores_procesados.append({
                'nombre': nombre,
                'rif': rif,
                'categoria': categoria,
                'plazo_entrega': plazo_entrega,
                'frecuencia_oc': frecuencia_oc,
                'dias_credito': dias_credito,
                'descuento': descuento,
                'forma_pago': forma_pago,
                'tipo_doc': tipo_doc,
                'contacto': contacto,
                'celular': celular
            })

        # 2. MIGRACION DE PRODUCTOS SKU
        ws_prod = wb['PRODUCTOS']
        productos_procesados = []
        skus_vistos = set()
        skus_duplicados = 0

        # En fila 3 estan los encabezados
        filas_prod = ws_prod.iter_rows(min_row=4, values_only=True)
        for num_fila, fila in enumerate(filas_prod, start=4):
            sku = normalizar_sku(fila[0])
            if not sku:
                continue

            if sku in skus_vistos:
                skus_duplicados += 1
                log_file.write(f"Fila {num_fila}: SKU duplicado omitido ({sku})\n")
                continue

            skus_vistos.add(sku)
            descripcion = normalizar_texto(fila[1])
            proveedor_nombre = normalizar_texto(fila[2])
            marca = normalizar_texto(fila[3])
            costo_usd = normalizar_decimal(fila[5])
            precio_usd = normalizar_decimal(fila[6])
            cantidad_a_mano = normalizar_decimal(fila[7])
            empaque = normalizar_entero(fila[9], 1)
            
            # Clasificacion comercial en col BL (indice 63) o col AZ (51)
            clasificacion = 'MEDIA ROTACION'
            if len(fila) > 63 and fila[63]:
                clase_raw = str(fila[63]).strip().upper()
                if 'ALTA' in clase_raw:
                    clasificacion = 'ALTA ROTACION'
                elif 'COMPLEMENTO' in clase_raw:
                    clasificacion = 'COMPLEMENTO'
                elif 'MEDIA' in clase_raw:
                    clasificacion = 'MEDIA ROTACION'

            productos_procesados.append({
                'sku': sku,
                'descripcion': descripcion,
                'proveedor': proveedor_nombre,
                'marca': marca,
                'costo_usd': costo_usd,
                'precio_usd': precio_usd,
                'empaque': empaque,
                'clasificacion': clasificacion
            })

        # 3. GENERAR ARCHIVO SQL
        with open(ruta_salida_sql, 'w', encoding='utf-8') as sql_file:
            sql_file.write("-- ============================================================================\n")
            sql_file.write("-- DATOS DE MIGRACION INICIAL DESDE MMC_R10_v1.1.xlsm\n")
            sql_file.write(f"-- Fecha de Generacion: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            sql_file.write(f"-- Total Proveedores: {len(proveedores_procesados)} | Total SKUs: {len(productos_procesados)}\n")
            sql_file.write("-- ============================================================================\n\n")

            sql_file.write("BEGIN;\n\n")
            sql_file.write("-- Insercion de Proveedores\n")
            for p in proveedores_procesados:
                sql = (
                    f"INSERT INTO proveedor ("
                    f"nombre_razon_social, registro_informacion_fiscal, categoria_compradora, "
                    f"plazo_entrega_dias, frecuencia_compra_dias, dias_credito, descuento_comercial_cadena, "
                    f"forma_pago_predeterminada, tipo_documento_predeterminado, nombre_contacto, telefono_contacto) "
                    f"VALUES ({escapar_sql(p['nombre'])}, {escapar_sql(p['rif'])}, {escapar_sql(p['categoria'])}, "
                    f"{p['plazo_entrega']}, {p['frecuencia_oc']}, {p['dias_credito']}, {escapar_sql(p['descuento'])}, "
                    f"{escapar_sql(p['forma_pago'])}, {escapar_sql(p['tipo_doc'])}, {escapar_sql(p['contacto'])}, {escapar_sql(p['celular'])}) "
                    f"ON CONFLICT DO NOTHING;\n"
                )
                sql_file.write(sql)

            sql_file.write("\n-- Inicializacion de Asignacion para cada Proveedor\n")
            sql_file.write("""
INSERT INTO asignacion_proveedor (proveedor_id, estado_asignacion)
SELECT identificador_proveedor, 'DISPONIBLE'
FROM proveedor
ON CONFLICT (proveedor_id) DO NOTHING;
\n""")

            sql_file.write("-- Insercion de Productos SKU\n")
            for prod in productos_procesados:
                sql = (
                    f"INSERT INTO producto_sku ("
                    f"codigo_sku, descripcion_producto, marca, proveedor_id, "
                    f"costo_unitario_usd, precio_venta_usd, unidad_minima_empaque, clasificacion_comercial) "
                    f"VALUES ({escapar_sql(prod['sku'])}, {escapar_sql(prod['descripcion'])}, {escapar_sql(prod['marca'])}, "
                    f"(SELECT identificador_proveedor FROM proveedor WHERE nombre_razon_social = {escapar_sql(prod['proveedor'])} LIMIT 1), "
                    f"{prod['costo_usd']}, {prod['precio_usd']}, {prod['empaque']}, {escapar_sql(prod['clasificacion'])}) "
                    f"ON CONFLICT (codigo_sku) DO UPDATE SET "
                    f"costo_unitario_usd = EXCLUDED.costo_unitario_usd, "
                    f"precio_venta_usd = EXCLUDED.precio_venta_usd, "
                    f"unidad_minima_empaque = EXCLUDED.unidad_minima_empaque, "
                    f"clasificacion_comercial = EXCLUDED.clasificacion_comercial;\n"
                )
                sql_file.write(sql)

            sql_file.write("\nCOMMIT;\n")

        duracion = round(time.time() - inicio_tiempo, 2)
        log_file.write(f"Migracion finalizada con exito en {duracion} segundos.\n")

    # Salida minima en consola
    print(f"MIGRACION_OK: Proveedores={len(proveedores_procesados)}, SKUs={len(productos_procesados)}, Duplicados={skus_duplicados}, Tiempo={duracion}s")

if __name__ == '__main__':
    main()
