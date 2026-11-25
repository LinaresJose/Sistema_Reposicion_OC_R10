@echo off
title Servidor Backend - Reposicion OC (Puerto 3000)
cd /d "%~dp0servidor"
echo ========================================================
echo Arrancando Backend Fastify API en http://localhost:3000
echo ========================================================
call "C:\Program Files\nodejs\npm.cmd" run dev
pause
