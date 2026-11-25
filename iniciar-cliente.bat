@echo off
title Cliente Frontend - Reposicion OC (Puerto 5173)
cd /d "%~dp0cliente"
echo ========================================================
echo Arrancando Frontend Vite React en http://localhost:5173
echo ========================================================
call "C:\Program Files\nodejs\npm.cmd" run dev
pause
