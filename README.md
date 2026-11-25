# Sistema de Reposicion y Ordenes de Compra R10

> **Stack:** Node.js + TypeScript · Express · PostgreSQL · React + Vite · TailwindCSS

Sistema interno de gestion de reposicion de inventario y emision de Ordenes de Compra (OC) oficiales para **MMC** y **LYNOX**, con flujo de aprobacion via WhatsApp, integracion con archivos Odoo y exportacion Excel R10.

---

## Tabla de Contenidos

- [Requisitos Previos](#requisitos-previos)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Instalacion](#instalacion)
- [Variables de Entorno](#variables-de-entorno)
- [Base de Datos](#base-de-datos)
- [Ejecucion en Desarrollo](#ejecucion-en-desarrollo)
- [Credenciales de Prueba](#credenciales-de-prueba)
- [Modulos del Sistema](#modulos-del-sistema)
- [Carga de Archivos Odoo](#carga-de-archivos-odoo)
- [Flujo de Emision de OC](#flujo-de-emision-de-oc)
- [Scripts de Auditoria](#scripts-de-auditoria)

---

## Requisitos Previos

| Herramienta | Version minima |
|---|---|
| Node.js | 18.x o superior |
| npm | 9.x o superior |
| PostgreSQL | 12.x o superior |

---

## Estructura del Proyecto

```
Proyecto OC/
├── servidor/          # Backend (Node.js + TypeScript + Express)
│   ├── src/
│   │   ├── dominio/           # Entidades y contratos de negocio
│   │   ├── aplicacion/        # Casos de uso y servicios
│   │   ├── infraestructura/   # Rutas HTTP, BD, servidor
│   │   └── compartido/        # Utilitarios y middlewares
│   ├── .env.ejemplo           # Plantilla de variables de entorno
│   └── package.json
├── cliente/           # Frontend (React + Vite + TailwindCSS)
│   ├── src/
│   │   ├── components/        # Componentes reutilizables
│   │   ├── pages/             # Vistas principales
│   │   ├── hooks/             # Custom hooks
│   │   └── lib/               # Cliente API y utilidades
│   └── package.json
├── base-de-datos/     # Esquemas SQL y semillas
│   ├── esquemas/              # DDL de tablas y restricciones
│   └── semillas/              # Datos iniciales de prueba
├── scripts/           # Scripts de auditoria y mantenimiento
├── recursos/          # Logos y recursos graficos
└── .gitignore
```

---

## Instalacion

### 1. Clonar el repositorio

```bash
git clone https://github.com/LinaresJose/Sistema_Reposicion_OC_R10.git
cd Sistema_Reposicion_OC_R10
```

### 2. Instalar dependencias del Backend

```bash
cd servidor
npm install
```

### 3. Instalar dependencias del Frontend

```bash
cd ../cliente
npm install
```

---

## Variables de Entorno

Copia el archivo de ejemplo y ajusta los valores:

```bash
cd servidor
copy .env.ejemplo .env
```

Contenido de referencia (`.env.ejemplo`):

```env
# Puerto HTTP
PUERTO=3000
HOST=0.0.0.0

# Base de datos PostgreSQL
URL_BASE_DATOS=postgresql://postgres:TU_PASSWORD@localhost:5432/reposicion_oc

# Seguridad JWT
CLAVE_SECRETA_JWT=clave_secreta_super_segura_cambiar_en_produccion!
TIEMPO_EXPIRACION_TOKEN_ACCESO=15m
TIEMPO_EXPIRACION_TOKEN_REFRESCO=7d
ENTORNO=desarrollo

# Politicas de Bloqueo
MAXIMO_INTENTOS_FALLIDOS_LOGIN=5
MINUTOS_BLOQUEO_CUENTA=15
MINUTOS_INACTIVIDAD_PROVEEDOR=45
```

> **Importante:** Nunca subas el archivo `.env` real al repositorio. Esta excluido por `.gitignore`.

---

## Base de Datos

### Crear la base de datos

```bash
psql -U postgres -c "CREATE DATABASE reposicion_oc;"
```

### Aplicar esquemas

```bash
psql -U postgres -d reposicion_oc -f base-de-datos/esquemas/01_tablas.sql
psql -U postgres -d reposicion_oc -f base-de-datos/esquemas/02_indices.sql
psql -U postgres -d reposicion_oc -f base-de-datos/esquemas/03_funciones.sql
```

### Cargar semillas (datos iniciales)

```bash
psql -U postgres -d reposicion_oc -f base-de-datos/semillas/01_usuarios.sql
psql -U postgres -d reposicion_oc -f base-de-datos/semillas/02_proveedores.sql
psql -U postgres -d reposicion_oc -f base-de-datos/semillas/03_productos.sql
```

---

## Ejecucion en Desarrollo

### Habilitar scripts en PowerShell (solo primera vez)

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Iniciar el Backend

```bash
cd servidor
npm run dev
```

> El servidor queda disponible en `http://localhost:3000`

### Iniciar el Frontend

```bash
cd cliente
npm run dev
```

> La aplicacion queda disponible en `http://localhost:5173`

---

## Credenciales de Prueba

| Rol | Usuario | Contrasena |
|---|---|---|
| Analista de Compras | `analista1` | `analista123` |
| Gerente de Compras | `gerente1` | `gerente123` |
| Administrador del Sistema | `admin1` | `admin123` |

> `ADMINISTRADOR_SISTEMA` tiene los mismos privilegios operativos que `GERENTE_COMPRAS` mas la gestion de usuarios y razones sociales.

---

## Modulos del Sistema

| Modulo | Descripcion |
|---|---|
| **Inicio de Sesion** | Autenticacion JWT con refresh token, bloqueo por intentos fallidos |
| **Cartera de Proveedores** | Filtro por categoria, bloqueo de edicion concurrente, autoasignacion |
| **Propuesta R10** | Metricas de reposicion, ajuste de cantidades por SKU con justificacion |
| **Carga Odoo** | Subida de los 4 archivos Excel de Odoo en lote o individual |
| **Flujo WhatsApp** | Revision, aprobacion y descarga de PDF/PNG sin membrete empresarial |
| **Emision de OC** | OC oficial con membrete MMC o LYNOX, correlativo, logo y datos de analista |
| **Notificaciones** | Polling de alertas en tiempo real |
| **Administracion** | Gestion de usuarios, razones sociales y logos |
| **Auditoria** | Registro de eventos del sistema con filtros |
| **Historial de OC** | Consulta y exportacion Excel R10 de ordenes emitidas |

---

## Carga de Archivos Odoo

El sistema acepta los siguientes 4 archivos Excel exportados desde Odoo:

| Archivo | Contenido |
|---|---|
| `stock_quant` | Inventario actual (cantidad disponible por SKU) |
| `product_template` | Catalogo de productos (descripcion, precio, proveedor) |
| `sale_order_line` | Lineas de ventas historicas |
| `purchase_order_line` | Lineas de compras historicas |

- Se pueden subir los **4 archivos en un solo envio** o de forma individual.
- Si se reenvian archivos sin cambios, el sistema marca el resultado como `SIN_CAMBIOS`.
- Si una recarga modifica calculos previos, se marca `es_calculo_vigente = false`.

---

## Flujo de Emision de OC

```
BORRADOR
  → EN_REVISION_WHATSAPP  (descarga PDF/PNG para aprobacion)
  → APROBADA              (registro de aprobacion con nota)
  → OC_EMITIDA            (emision oficial MMC o LYNOX con correlativo)
```

---

## Scripts de Auditoria

```bash
cd scripts
python auditar-todo-sistema.py
```

Verifica conectividad, esquemas de BD, rutas del backend y coherencia de datos. Salida minima: solo errores o resumen final en una linea.

---

## Licencia

Uso interno — Multimarcas de Venezuela / LYNOX. Todos los derechos reservados.
