@echo off
title Detener Base de Datos PostgreSQL - Reposicion OC
echo ========================================================
echo Deteniendo PostgreSQL de Reposicion y OC...
echo ========================================================
"C:\Program Files\PostgreSQL\12\bin\pg_ctl.exe" stop -D "%~dp0..\base-de-datos\pgdata" -m fast
echo.
echo Servidor PostgreSQL detenido correctamente.
pause
