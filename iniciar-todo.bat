@echo off
title Sistema Reposicion OC - Lanzador Completo
echo ========================================================
echo Iniciando Sistema Multi-Usuario de Reposicion y OC
echo ========================================================

:: 1. Iniciar PostgreSQL si no esta corriendo
echo Verificando Base de Datos PostgreSQL...
"C:\Program Files\PostgreSQL\12\bin\pg_ctl.exe" status -D "%~dp0base-de-datos\pgdata" >nul 2>&1
if errorlevel 1 (
    echo Encendiendo motor PostgreSQL en puerto 5432...
    "C:\Program Files\PostgreSQL\12\bin\pg_ctl.exe" start -D "%~dp0base-de-datos\pgdata" -l "%~dp0registros-ejecucion\postgres-local.log"
) else (
    echo Base de datos PostgreSQL ya se encuentra activa.
)

:: 2. Abrir Backend en nueva ventana
start "Servidor Backend API (Puerto 3000)" cmd /k "cd /d "%~dp0servidor" && "C:\Program Files\nodejs\npm.cmd" run dev"

:: 3. Abrir Frontend en nueva ventana
start "Cliente Frontend Web (Puerto 5173)" cmd /k "cd /d "%~dp0cliente" && "C:\Program Files\nodejs\npm.cmd" run dev"

echo.
echo ========================================================
echo Backend y Frontend arrancados en ventanas separadas.
echo Abre tu navegador en: http://localhost:5173
echo ========================================================
timeout /t 5
