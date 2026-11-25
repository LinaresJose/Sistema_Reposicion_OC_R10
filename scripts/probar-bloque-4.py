#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Verificacion del Bloque 4:
Valida compilacion TypeScript y ejecuta la suite de pruebas de:
1. Ingesta, Validacion Fila por Fila y Hashes SHA-256 de los 4 Archivos Odoo.
2. Deteccion de Cargas sin Cambios.
3. Conciliacion de Novedades y Recalculo con Motor R10.
4. Marcado de Desactualizacion de Propuestas (esCalculoVigente = false).
5. Modulo de Notificaciones por Polling Ligero.
6. Integracion de Rutas Fastify y Seguridad RBAC.
7. Regresion completa de los Bloques 1, 2 y 3.

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
    ruta_log = os.path.join(ruta_base, 'registros-ejecucion', 'probar-bloque-4.log')
    ruta_npx = r'C:\Program Files\nodejs\npx.cmd'

    env = os.environ.copy()
    env['PATH'] = r'C:\Program Files\nodejs;' + env.get('PATH', '')

    os.makedirs(os.path.join(ruta_base, 'registros-ejecucion'), exist_ok=True)

    with open(ruta_log, 'w', encoding='utf-8') as log_file:
        log_file.write(f"Iniciando verificacion del Bloque 4: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")

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

        # 2. Ejecucion de Pruebas Unitarias del Bloque 4
        log_file.write("\n--- PASO 2: Pruebas de Cargas Odoo, Validacion, Recalculo y Notificaciones ---\n")
        paso_pruebas = subprocess.run(
            [ruta_npx, 'tsx', 'test/probar-bloque-4.ts'],
            cwd=ruta_servidor,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            text=True,
            env=env,
            check=False
        )

        if paso_pruebas.returncode != 0:
            print(f"ERROR_PRUEBAS_UNITARIAS_BLOQUE_4: Revise {ruta_log}", file=sys.stderr)
            sys.exit(paso_pruebas.returncode)

        # 3. Regresion Bloque 1 (Autenticacion y RBAC)
        log_file.write("\n--- PASO 3: Regresion Bloque 1 (Autenticacion y RBAC) ---\n")
        paso_reg_1 = subprocess.run(
            [ruta_npx, 'tsx', 'test/probar-autenticacion.ts'],
            cwd=ruta_servidor,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            text=True,
            env=env,
            check=False
        )
        if paso_reg_1.returncode != 0:
            print(f"ERROR_REGRESION_BLOQUE_1: Revise {ruta_log}", file=sys.stderr)
            sys.exit(paso_reg_1.returncode)

        # 4. Regresion Bloque 2 (Motor R10, Concurrencia y Auditoria)
        log_file.write("\n--- PASO 4: Regresion Bloque 2 (Motor R10, Concurrencia y Auditoria) ---\n")
        paso_reg_2 = subprocess.run(
            [ruta_npx, 'tsx', 'test/probar-bloque-2.ts'],
            cwd=ruta_servidor,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            text=True,
            env=env,
            check=False
        )
        if paso_reg_2.returncode != 0:
            print(f"ERROR_REGRESION_BLOQUE_2: Revise {ruta_log}", file=sys.stderr)
            sys.exit(paso_reg_2.returncode)

        # 5. Regresion Bloque 3 (Documentos, Correlativos, Estados y Excel)
        log_file.write("\n--- PASO 5: Regresion Bloque 3 (Documentos, Correlativos, Estados y Excel) ---\n")
        paso_reg_3 = subprocess.run(
            [ruta_npx, 'tsx', 'test/probar-bloque-3.ts'],
            cwd=ruta_servidor,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            text=True,
            env=env,
            check=False
        )
        if paso_reg_3.returncode != 0:
            print(f"ERROR_REGRESION_BLOQUE_3: Revise {ruta_log}", file=sys.stderr)
            sys.exit(paso_reg_3.returncode)

    duracion = round(time.time() - inicio, 2)
    print(f"BLOQUE_4_VERIFICACION_EXITOSA: Cargas Odoo, Validacion, Recalculo, Notificaciones y Regresion OK ({duracion}s)")

if __name__ == '__main__':
    main()
