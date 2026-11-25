#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Instalacion de Dependencias Backend
Ejecuta npm install en servidor/ guardando logs detallados en registros-ejecucion/
y emitiendo solo salida minima en consola.
"""

import os
import subprocess
import sys
import time

def main():
    inicio = time.time()
    ruta_base = r'c:\Users\usuario\Desktop\Proyecto OC'
    ruta_servidor = os.path.join(ruta_base, 'servidor')
    ruta_log = os.path.join(ruta_base, 'registros-ejecucion', 'instalacion-npm.log')
    ruta_npm = r'C:\Program Files\nodejs\npm.cmd'

    os.makedirs(os.path.join(ruta_base, 'registros-ejecucion'), exist_ok=True)

    env = os.environ.copy()
    env['PATH'] = r'C:\Program Files\nodejs;' + env.get('PATH', '')

    with open(ruta_log, 'w', encoding='utf-8') as log_file:
        log_file.write(f"Iniciando npm install: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        try:
            proceso = subprocess.run(
                [ruta_npm, 'install'],
                cwd=ruta_servidor,
                stdout=log_file,
                stderr=subprocess.STDOUT,
                text=True,
                env=env,
                check=False
            )

            duracion = round(time.time() - inicio, 2)
            if proceso.returncode == 0:
                print(f"INSTALACION_OK: Dependencias de servidor instaladas exitosamente en {duracion}s (ver logs en registros-ejecucion/instalacion-npm.log)")
            else:
                print(f"ERROR_INSTALACION: Codigo de salida {proceso.returncode}. Revise registros-ejecucion/instalacion-npm.log", file=sys.stderr)
                sys.exit(proceso.returncode)
        except Exception as e:
            print(f"ERROR_EXCEPCION: {str(e)}", file=sys.stderr)
            sys.exit(1)

if __name__ == '__main__':
    main()
