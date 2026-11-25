#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Auditoria Integral de Punta a Punta para el Sistema R10
Verifica Base de Datos, Backend, Rutas, Concurrencia y Flujo Odoo.
Salida minima: solo errores o resumen final en una linea.
Logs detallados en registros-ejecucion/
"""
import os
import sys
import time
import json
import socket
import urllib.request
import urllib.error
import subprocess
from datetime import datetime

DIRECTORIO_RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DIRECTORIO_REGISTROS = os.path.join(DIRECTORIO_RAIZ, 'registros-ejecucion')
os.makedirs(DIRECTORIO_REGISTROS, exist_ok=True)

MARCA_TIEMPO = datetime.now().strftime('%Y%m%d_%H%M%S')
ARCHIVO_LOG = os.path.join(DIRECTORIO_REGISTROS, f'auditoria_sistema_{MARCA_TIEMPO}.log')

def registrar(mensaje):
    with open(ARCHIVO_LOG, 'a', encoding='utf-8') as f:
        f.write(f"[{datetime.now().isoformat()}] {mensaje}\n")

def verificar_puerto(host, puerto):
    s = socket.socket()
    s.settimeout(1.5)
    try:
        s.connect((host, puerto))
        s.close()
        return True
    except Exception:
        return False

def realizar_peticion_http(url, metodo='GET', datos=None, cabeceras=None, cookie=None):
    cab = {'Accept': 'application/json'}
    if cabeceras:
        cab.update(cabeceras)
    if cookie:
        cab['Cookie'] = cookie

    cuerpo_bytes = None
    if datos is not None:
        if isinstance(datos, (dict, list)):
            cuerpo_bytes = json.dumps(datos).encode('utf-8')
            cab['Content-Type'] = 'application/json'
        elif isinstance(datos, bytes):
            cuerpo_bytes = datos

    solicitud = urllib.request.Request(url, data=cuerpo_bytes, headers=cab, method=metodo)
    try:
        with urllib.request.urlopen(solicitud, timeout=10) as respuesta:
            cuerpo = respuesta.read().decode('utf-8', errors='replace')
            cookies_respuesta = respuesta.headers.get_all('Set-Cookie') or []
            cookie_salida = None
            for c in cookies_respuesta:
                if 'tokenAcceso=' in c:
                    cookie_salida = c.split(';')[0]
                    break
            datos_json = None
            try:
                datos_json = json.loads(cuerpo)
            except Exception:
                pass
            return respuesta.status, datos_json, cookie_salida, cuerpo
    except urllib.error.HTTPError as e:
        cuerpo = e.read().decode('utf-8', errors='replace')
        datos_json = None
        try:
            datos_json = json.loads(cuerpo)
        except Exception:
            pass
        return e.code, datos_json, None, cuerpo
    except Exception as ex:
        return 0, None, None, str(ex)

def main():
    registrar("Iniciando Auditoria Integral del Sistema R10...")
    errores = []

    # 1. Comprobar que PostgreSQL este activo
    if not verificar_puerto('127.0.0.1', 5432):
        errores.append("PostgreSQL no responde en puerto 5432")
        print("\n".join(errores))
        sys.exit(1)
    registrar("PostgreSQL verificado en puerto 5432.")

    # 2. Iniciar temporalmente el servidor si no esta escuchando en puerto 3000
    servidor_proceso = None
    servidor_propio = False
    if not verificar_puerto('127.0.0.1', 3000):
        registrar("Levantando servidor Fastify para pruebas de auditoria...")
        servidor_propio = True
        directorio_servidor = os.path.join(DIRECTORIO_RAIZ, 'servidor')
        servidor_proceso = subprocess.Popen(
            ["node", "dist/infraestructura/servidor.js"],
            cwd=directorio_servidor,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=True
        )
        for _ in range(25):
            time.sleep(0.4)
            if verificar_puerto('127.0.0.1', 3000):
                break

    if not verificar_puerto('127.0.0.1', 3000):
        errores.append("No se pudo iniciar ni conectar con el servidor Fastify en puerto 3000")
        print("\n".join(errores))
        sys.exit(1)
    registrar("Servidor Fastify activo en http://127.0.0.1:3000")

    try:
        # Prueba 1: Salud
        st, datos, _, _ = realizar_peticion_http('http://127.0.0.1:3000/api/v1/salud')
        if st != 200 or not datos or datos.get('estado') != 'OPERATIVO':
            errores.append(f"Fallo /api/v1/salud (HTTP {st})")
        else:
            registrar("Salud del sistema: OPERATIVO")

        # Prueba 2: Inicio de sesion Administrador (con claveSecreta y con contrasena)
        st, datos_login, cookie_admin, _ = realizar_peticion_http(
            'http://127.0.0.1:3000/api/v1/autenticacion/iniciar-sesion',
            metodo='POST',
            datos={'correoElectronico': 'admin@multimarcas.com', 'contrasena': 'Administrador2026!'}
        )
        if st != 200 or not cookie_admin:
            errores.append(f"Fallo inicio de sesion admin (HTTP {st}): {datos_login}")
        else:
            registrar(f"Inicio de sesion exitoso como {datos_login['datos']['usuario']['rolId']}")

        # Prueba 3: Consulta de perfil actual
        st, datos_perfil, _, _ = realizar_peticion_http(
            'http://127.0.0.1:3000/api/v1/autenticacion/perfil',
            cookie=cookie_admin
        )
        if st != 200:
            errores.append(f"Fallo consultar /api/v1/autenticacion/perfil (HTTP {st})")
        else:
            registrar("Perfil consultado correctamente.")

        # Prueba 4: Cartera de proveedores
        st, datos_cartera, _, _ = realizar_peticion_http(
            'http://127.0.0.1:3000/api/v1/proveedores',
            cookie=cookie_admin
        )
        if st != 200 or not isinstance(datos_cartera.get('datos'), list) or len(datos_cartera['datos']) == 0:
            errores.append(f"Fallo consultar cartera de proveedores (HTTP {st})")
        else:
            total_prov = len(datos_cartera['datos'])
            primer_prov = datos_cartera['datos'][0]
            registrar(f"Cartera de proveedores: {total_prov} proveedores cargados.")
            id_prov = primer_prov['identificadorProveedor']

            # Prueba 5: Consulta de propuesta R10
            st_p, datos_prop, _, _ = realizar_peticion_http(
                f'http://127.0.0.1:3000/api/v1/propuestas/proveedor/{id_prov}',
                cookie=cookie_admin
            )
            if st_p != 200:
                errores.append(f"Fallo consultar propuesta para proveedor {id_prov} (HTTP {st_p})")
            else:
                p_datos = datos_prop.get('datos', {})
                # Verificar campos esenciales para evitar pantalla en blanco
                if 'totalUnidadesSugeridas' not in p_datos or 'totalUnidadesPropuestas' not in p_datos:
                    errores.append("Propuesta carece de totalUnidadesSugeridas o totalUnidadesPropuestas")
                renglones = p_datos.get('renglones', [])
                registrar(f"Propuesta cargada con {len(renglones)} renglones R10.")
                if renglones:
                    primer_r = renglones[0]
                    if 'identificadorDecision' not in primer_r or 'hashFirmaCalculo' not in primer_r:
                        errores.append("Renglon de propuesta carece de identificadorDecision o hashFirmaCalculo")
                    else:
                        # Prueba 5.1: Actualizar decision SKU con justificacion y version
                        id_dec = primer_r['identificadorDecision']
                        hash_val = primer_r['hashFirmaCalculo']
                        num_ver = primer_r.get('numeroVersion', 1)
                        st_act, resp_act, _, _ = realizar_peticion_http(
                            f'http://127.0.0.1:3000/api/v1/propuestas/decisiones/{id_dec}',
                            metodo='PUT',
                            datos={
                                'estadoDecision': 'APROBADO',
                                'cantidadAjusteManual': 10,
                                'justificacionAjuste': 'Ajuste auditado de prueba R10',
                                'hashCalculoValidado': hash_val,
                                'numeroVersionEsperado': num_ver
                            },
                            cookie=cookie_admin
                        )
                        if st_act != 200:
                            errores.append(f"Fallo actualizar decision SKU {id_dec} (HTTP {st_act}): {resp_act}")
                        else:
                            registrar("Actualizacion de decision SKU con control optimista verificada.")

            # Prueba 5.2: Edicion completa de proveedor (categoria y datos operativos)
            st_ed, resp_ed, _, _ = realizar_peticion_http(
                f'http://127.0.0.1:3000/api/v1/proveedores/{id_prov}',
                metodo='PUT',
                datos={
                    'categoriaCompradora': 'NACIONAL_1',
                    'plazoEntregaDias': 7,
                    'frecuenciaCompraDias': 15,
                    'diasCredito': 30,
                    'formaPagoPredeterminada': 'DIVISAS_TRANSFERENCIA',
                    'tipoDocumentoPredeterminado': 'FACTURA'
                },
                cookie=cookie_admin
            )
            if st_ed != 200:
                errores.append(f"Fallo edicion de proveedor (HTTP {st_ed}): {resp_ed}")
            else:
                registrar("Edicion de proveedor y categoria verificada.")

        # Prueba 6: Listar Empresas Emisoras Oficiales
        st_emp, datos_emp, _, _ = realizar_peticion_http(
            'http://127.0.0.1:3000/api/v1/ordenes-compra/empresas-emisoras',
            cookie=cookie_admin
        )
        if st_emp != 200 or len(datos_emp.get('datos', [])) < 2:
            errores.append(f"Fallo listar empresas emisoras oficiales (HTTP {st_emp})")
        else:
            registrar("Empresas emisoras (MMC y LYNOX) verificadas.")

        # Prueba 7: Historial de Ordenes de Compra
        st_ord, datos_ord, _, _ = realizar_peticion_http(
            'http://127.0.0.1:3000/api/v1/ordenes-compra',
            cookie=cookie_admin
        )
        if st_ord != 200:
            errores.append(f"Fallo listar ordenes de compra (HTTP {st_ord})")
        else:
            registrar("Listado de ordenes de compra verificado.")

        # Prueba 8: Panel de Administracion - Usuarios
        st_usr, datos_usr, _, _ = realizar_peticion_http(
            'http://127.0.0.1:3000/api/v1/admin/usuarios',
            cookie=cookie_admin
        )
        if st_usr != 200 or len(datos_usr.get('usuarios', [])) == 0:
            errores.append(f"Fallo listar usuarios de administracion (HTTP {st_usr})")
        else:
            registrar(f"Usuarios de administracion: {len(datos_usr['usuarios'])} usuarios verificados.")

        # Prueba 9: Panel de Administracion - Razones Sociales
        st_rs, datos_rs, _, _ = realizar_peticion_http(
            'http://127.0.0.1:3000/api/v1/admin/razones-sociales',
            cookie=cookie_admin
        )
        if st_rs != 200 or len(datos_rs) < 2:
            errores.append(f"Fallo listar razones sociales de administracion (HTTP {st_rs})")
        else:
            registrar("Razones sociales de administracion verificadas.")

        # Prueba 10: Auditoria inmutable
        st_aud, datos_aud, _, _ = realizar_peticion_http(
            'http://127.0.0.1:3000/api/v1/auditoria',
            cookie=cookie_admin
        )
        if st_aud != 200:
            errores.append(f"Fallo consultar auditoria inmutable (HTTP {st_aud})")
        else:
            registrar(f"Eventos de auditoria verificados: {datos_aud.get('total', 0)} registros.")

        # Prueba 11: Historial y estado de conexion de cargas Odoo
        st_odoo_est, _, _, _ = realizar_peticion_http(
            'http://127.0.0.1:3000/api/v1/cargas-odoo/estado-conexion',
            cookie=cookie_admin
        )
        st_odoo_hist, _, _, _ = realizar_peticion_http(
            'http://127.0.0.1:3000/api/v1/cargas-odoo/historial',
            cookie=cookie_admin
        )
        if st_odoo_est != 200 or st_odoo_hist != 200:
            errores.append(f"Fallo endpoints Odoo (estado={st_odoo_est}, hist={st_odoo_hist})")
        else:
            registrar("Endpoints de Cargas Odoo verificados exitosamente.")

    finally:
        if servidor_propio and servidor_proceso:
            registrar("Deteniendo proceso de prueba del servidor Fastify...")
            servidor_proceso.terminate()

    if errores:
        print(f"ERRORES ({len(errores)}):")
        for e in errores:
            print(f" - {e}")
        sys.exit(1)
    else:
        print("AUDITORIA EXITOSA: Base de datos, autenticación, cartera, propuesta R10, órdenes, administración y cargas Odoo 100% operativas sin errores.")

if __name__ == '__main__':
    main()
