@echo off
title Iniciar Base de Datos PostgreSQL - Reposicion OC
echo ========================================================
echo Iniciando PostgreSQL para Sistema de Reposicion y OC...
echo ========================================================
"C:\Program Files\PostgreSQL\12\bin\pg_ctl.exe" start -D "%~dp0..\base-de-datos\pgdata" -l "%~dp0..\registros-ejecucion\postgres-local.log"
echo.
echo PostgreSQL iniciado en el puerto 5432 (Base de datos: reposicion_oc)
echo Puedes cerrar esta ventana.
pause
