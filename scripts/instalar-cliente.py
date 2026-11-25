#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Instalacion de Dependencias Frontend (cliente/)
Guarda logs detallados en registros-ejecucion/instalacion-cliente-npm.log
y muestra solo una linea de resultado.
"""

import os
import subprocess
import sys
import time

def main():
    inicio = time.time()
    ruta_base = r'c:\Users\usuario\Desktop\Proyecto OC'
    ruta_cliente = os.path.join(ruta_base, 'cliente')
    ruta_log = os.path.join(ruta_base, 'registros-ejecucion', 'instalacion-cliente-npm.log')
    ruta_npm = r'C:\Program Files\nodejs\npm.cmd'

    os.makedirs(os.path.join(ruta_base, 'registros-ejecucion'), exist_ok=True)

    env = os.environ.copy()
    env['PATH'] = r'C:\Program Files\nodejs;' + env.get('PATH', '')

    with open(ruta_log, 'w', encoding='utf-8') as log_file:
        log_file.write(f"Iniciando npm install en cliente/: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        try:
            proceso = subprocess.run(
                [ruta_npm, 'install'],
                cwd=ruta_cliente,
                stdout=log_file,
                stderr=subprocess.STDOUT,
                text=True,
                env=env,
                check=False
            )

            duracion = round(time.time() - inicio, 2)
            if proceso.returncode == 0:
                print(f"INSTALACION_CLIENTE_OK: Dependencias frontend instaladas en {duracion}s (logs en registros-ejecucion/instalacion-cliente-npm.log)")
            else:
                print(f"ERROR_INSTALACION_CLIENTE: Codigo {proceso.returncode}. Ver registros-ejecucion/instalacion-cliente-npm.log", file=sys.stderr)
                sys.exit(proceso.returncode)
        except Exception as e:
            print(f"ERROR_EXCEPCION: {str(e)}", file=sys.stderr)
            sys.exit(1)

if __name__ == '__main__':
    main()
