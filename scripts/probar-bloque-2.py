#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Verificacion del Bloque 2
Valida compilacion TypeScript y ejecuta la suite de pruebas del Motor R10,
Hashing SHA-256, Autoasignacion y Concurrencia, Bloqueo Optimista en Decisiones SKU,
Auditoria Inmutable e Integracion en Fastify.
Emite salida minima en consola y guarda los detalles en registros-ejecucion/.
"""

import os
import subprocess
import sys
import time

def main():
    inicio = time.time()
    ruta_base = r'c:\Users\usuario\Desktop\Proyecto OC'
    ruta_servidor = os.path.join(ruta_base, 'servidor')
    ruta_log = os.path.join(ruta_base, 'registros-ejecucion', 'probar-bloque-2.log')
    ruta_npx = r'C:\Program Files\nodejs\npx.cmd'

    env = os.environ.copy()
    env['PATH'] = r'C:\Program Files\nodejs;' + env.get('PATH', '')

    os.makedirs(os.path.join(ruta_base, 'registros-ejecucion'), exist_ok=True)

    with open(ruta_log, 'w', encoding='utf-8') as log_file:
        log_file.write(f"Iniciando verificacion del Bloque 2: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")

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

        # 2. Ejecucion de Pruebas Unitarias del Bloque 2
        log_file.write("\n--- PASO 2: Pruebas del Motor R10, Concurrencia, Decisiones y Auditoria ---\n")
        paso_pruebas = subprocess.run(
            [ruta_npx, 'tsx', 'test/probar-bloque-2.ts'],
            cwd=ruta_servidor,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            text=True,
            env=env,
            check=False
        )

        if paso_pruebas.returncode != 0:
            print(f"ERROR_PRUEBAS_UNITARIAS_BLOQUE_2: Revise {ruta_log}", file=sys.stderr)
            sys.exit(paso_pruebas.returncode)

        duracion = round(time.time() - inicio, 2)
        log_file.write(f"\nVerificacion completada con exito en {duracion}s\n")

    # Salida minima en consola
    print(f"BLOQUE_2_VERIFICACION_EXITOSA: TypeScript OK | Motor R10 OK | SHA-256 OK | Concurrencia Proveedores OK | Bloqueo Optimista SKU OK | Auditoria OK ({duracion}s)")

if __name__ == '__main__':
    main()
