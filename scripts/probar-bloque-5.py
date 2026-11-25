#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Verificacion Integral del Bloque 5 (Frontend Web React + Vite + Tailwind y Edicion de Proveedores)
Ejecuta la verificacion completa de backend y frontend guardando registros detallados en:
registros-ejecucion/probar-bloque-5.log
y mostrando en consola unicamente una linea de resumen o los errores si fallara.
"""

import os
import subprocess
import sys
import time

def ejecutar_comando(comando, cwd, archivo_log, env):
    archivo_log.write(f"\n====================================================================\n")
    archivo_log.write(f"EJECUTANDO: {' '.join(comando)} (en {cwd})\n")
    archivo_log.write(f"====================================================================\n")
    archivo_log.flush()

    proceso = subprocess.run(
        comando,
        cwd=cwd,
        stdout=archivo_log,
        stderr=subprocess.STDOUT,
        text=True,
        env=env,
        check=False
    )
    return proceso.returncode

def main():
    inicio = time.time()
    ruta_base = r'c:\Users\usuario\Desktop\Proyecto OC'
    ruta_servidor = os.path.join(ruta_base, 'servidor')
    ruta_cliente = os.path.join(ruta_base, 'cliente')
    ruta_log = os.path.join(ruta_base, 'registros-ejecucion', 'probar-bloque-5.log')
    ruta_npx = r'C:\Program Files\nodejs\npx.cmd'
    ruta_npm = r'C:\Program Files\nodejs\npm.cmd'

    os.makedirs(os.path.join(ruta_base, 'registros-ejecucion'), exist_ok=True)

    env = os.environ.copy()
    env['PATH'] = r'C:\Program Files\nodejs;' + env.get('PATH', '')

    with open(ruta_log, 'w', encoding='utf-8') as log_file:
        log_file.write(f"INICIO DE PRUEBAS BLOQUE 5: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")

        pasos = [
            ("Verificacion TypeScript Servidor", [ruta_npx, 'tsc', '--noEmit'], ruta_servidor),
            ("Compilacion y Empaquetado Frontend Vite", [ruta_npm, 'run', 'build'], ruta_cliente),
            ("Pruebas Unitarias Edicion Proveedor y Permisos", [ruta_npx, 'tsx', 'test/probar-edicion-proveedor.ts'], ruta_servidor),
            ("Regresion Bloque 1 - Autenticacion y RBAC", [ruta_npx, 'tsx', 'test/probar-autenticacion.ts'], ruta_servidor),
            ("Regresion Bloque 2 - Motor R10 y Concurrencia", [ruta_npx, 'tsx', 'test/probar-bloque-2.ts'], ruta_servidor),
            ("Regresion Bloque 3 - Generacion Documental y Emision", [ruta_npx, 'tsx', 'test/probar-bloque-3.ts'], ruta_servidor),
            ("Regresion Bloque 4 - Cargas Odoo, Recalculo y Notificaciones", [ruta_npx, 'tsx', 'test/probar-bloque-4.ts'], ruta_servidor)
        ]

        for nombre_paso, comando, directorio in pasos:
            codigo = ejecutar_comando(comando, directorio, log_file, env)
            if codigo != 0:
                print(f"ERROR_BLOQUE_5: Fallo en '{nombre_paso}'. Codigo {codigo}. Ver detalles en registros-ejecucion/probar-bloque-5.log", file=sys.stderr)
                sys.exit(codigo)

    duracion = round(time.time() - inicio, 2)
    print(f"BLOQUE_5_VERIFICACION_EXITOSA: Frontend React+Vite, Edicion Proveedores, RBAC y Regresion Total 100% OK ({duracion}s)")

if __name__ == '__main__':
    main()
