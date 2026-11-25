#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Verificacion Integral del Bloque 6:
- Modulo de Administracion (Usuarios y Razones Sociales)
- Modulo de Auditoria Inmutable
- Modulo de Historial de Ordenes de Compra
- Vistas Frontend en React + Vite + Tailwind CSS
- Regresion Completa Bloques 1 al 5
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
    ruta_log = os.path.join(ruta_base, 'registros-ejecucion', 'probar-bloque-6.log')
    ruta_npx = r'C:\Program Files\nodejs\npx.cmd'
    ruta_npm = r'C:\Program Files\nodejs\npm.cmd'

    os.makedirs(os.path.join(ruta_base, 'registros-ejecucion'), exist_ok=True)

    env = os.environ.copy()
    env['PATH'] = r'C:\Program Files\nodejs;' + env.get('PATH', '')

    with open(ruta_log, 'w', encoding='utf-8') as log_file:
        log_file.write(f"INICIO DE PRUEBAS BLOQUE 6: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")

        pasos = [
            ("Verificacion TypeScript Servidor", [ruta_npx, 'tsc', '--noEmit'], ruta_servidor),
            ("Compilacion y Empaquetado Frontend Vite", [ruta_npm, 'run', 'build'], ruta_cliente),
            ("Pruebas Unitarias Bloque 6 - Administracion y Auditoria", [ruta_npx, 'tsx', 'test/probar-bloque-6.ts'], ruta_servidor),
            ("Regresion Bloque 5 - Edicion Proveedor y RBAC", [ruta_npx, 'tsx', 'test/probar-edicion-proveedor.ts'], ruta_servidor),
            ("Regresion Bloque 1 - Autenticacion y RBAC", [ruta_npx, 'tsx', 'test/probar-autenticacion.ts'], ruta_servidor),
            ("Regresion Bloque 2 - Motor R10 y Concurrencia", [ruta_npx, 'tsx', 'test/probar-bloque-2.ts'], ruta_servidor),
            ("Regresion Bloque 3 - Generacion Documental y Emision", [ruta_npx, 'tsx', 'test/probar-bloque-3.ts'], ruta_servidor),
            ("Regresion Bloque 4 - Cargas Odoo, Recalculo y Notificaciones", [ruta_npx, 'tsx', 'test/probar-bloque-4.ts'], ruta_servidor)
        ]

        for nombre_paso, comando, directorio in pasos:
            codigo = ejecutar_comando(comando, directorio, log_file, env)
            if codigo != 0:
                print(f"FALLO_BLOQUE_6: Fallo en '{nombre_paso}'. Ver detalle en: {ruta_log}", file=sys.stderr)
                sys.exit(codigo)

    duracion = time.time() - inicio
    print(f"BLOQUE_6_VERIFICACION_EXITOSA: Panel Admin, Razones Sociales, Auditoria, Historial OC y Regresion Total 100% OK ({duracion:.2f}s)")
    sys.exit(0)

if __name__ == '__main__':
    main()
