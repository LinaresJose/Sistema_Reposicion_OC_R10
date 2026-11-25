#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Verificacion del Bloque 3:
Valida compilacion TypeScript y ejecuta la suite de pruebas de:
1. Generador de Documentos Stateless (Propuesta PDF sin membrete, PNG WhatsApp, Orden Oficial con membrete/logo/contacto).
2. Maquina de Estados de Orden de Compra y Aprobacion Verbal con Respaldo Obligatorio.
3. Generacion de Correlativos Atomicos por Razon Social y Anio (OC-MMC-AAAA-NNNN / OC-LYNOX-AAAA-NNNN).
4. Exportador Excel de Vista de Control R10.
5. Integracion de Rutas Fastify y Seguridad RBAC.

Emite salida minima en consola (una linea) y redirige logs a registros-ejecucion/.
"""

import os
import subprocess
import sys
import time

def main():
    inicio = time.time()
    ruta_base = r'c:\Users\usuario\Desktop\Proyecto OC'
    ruta_servidor = os.path.join(ruta_base, 'servidor')
    ruta_log = os.path.join(ruta_base, 'registros-ejecucion', 'probar-bloque-3.log')
    ruta_npx = r'C:\Program Files\nodejs\npx.cmd'

    env = os.environ.copy()
    env['PATH'] = r'C:\Program Files\nodejs;' + env.get('PATH', '')

    os.makedirs(os.path.join(ruta_base, 'registros-ejecucion'), exist_ok=True)

    with open(ruta_log, 'w', encoding='utf-8') as log_file:
        log_file.write(f"Iniciando verificacion del Bloque 3: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")

        # 1. Validacion de Compilacion TypeScript
        log_file.write("\n--- PASO 1: Compilacion TypeScript (tsc --noEmit) ---\n")
        paso_tsc = subprocess.run(
            [ruta_npx, 'tsc', '--noEmit'],
            cwd=ruta_servidor,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            text=True,
            env=env,
            check=False
        )

        if paso_tsc.returncode != 0:
            print(f"ERROR_COMPILACION_TYPESCRIPT: Revise {ruta_log}", file=sys.stderr)
            sys.exit(paso_tsc.returncode)

        # 2. Ejecucion de Pruebas Unitarias del Bloque 3
        log_file.write("\n--- PASO 2: Pruebas de Documentos, Correlativos, Estados y Excel ---\n")
        paso_pruebas = subprocess.run(
            [ruta_npx, 'tsx', 'test/probar-bloque-3.ts'],
            cwd=ruta_servidor,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            text=True,
            env=env,
            check=False
        )

        if paso_pruebas.returncode != 0:
            print(f"ERROR_PRUEBAS_UNITARIAS_BLOQUE_3: Revise {ruta_log}", file=sys.stderr)
            sys.exit(paso_pruebas.returncode)

        # 3. Pruebas de Regresion (Bloque 1 y Bloque 2)
        log_file.write("\n--- PASO 3: Regresion Bloque 1 (Autenticacion y RBAC) ---\n")
        paso_regresion_1 = subprocess.run(
            [ruta_npx, 'tsx', 'test/probar-autenticacion.ts'],
            cwd=ruta_servidor,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            text=True,
            env=env,
            check=False
        )
        if paso_regresion_1.returncode != 0:
            print(f"ERROR_REGRESION_BLOQUE_1: Revise {ruta_log}", file=sys.stderr)
            sys.exit(paso_regresion_1.returncode)

        log_file.write("\n--- PASO 4: Regresion Bloque 2 (Motor R10, Concurrencia y Auditoria) ---\n")
        paso_regresion_2 = subprocess.run(
            [ruta_npx, 'tsx', 'test/probar-bloque-2.ts'],
            cwd=ruta_servidor,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            text=True,
            env=env,
            check=False
        )
        if paso_regresion_2.returncode != 0:
            print(f"ERROR_REGRESION_BLOQUE_2: Revise {ruta_log}", file=sys.stderr)
            sys.exit(paso_regresion_2.returncode)

    duracion = round(time.time() - inicio, 2)
    print(f"BLOQUE_3_VERIFICACION_EXITOSA: Documentos, Correlativos, Estados, Excel y Regresion OK ({duracion}s)")

if __name__ == '__main__':
    main()
