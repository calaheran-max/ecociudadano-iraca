@echo off
title EcoCiudadano Iraca - Servidor
cd /d "%~dp0"
echo ========================================
echo EcoCiudadano Iraca - Iniciando...
echo ========================================
echo.
if not exist node_modules (
  echo Instalando dependencias...
  call npm install
)
echo.
echo Deja esta ventana abierta. Cierrala para detener el servidor.
echo Local: http://localhost:3000
echo Red:   http://192.168.101.75:3000
echo.
call npm run dev
pause
