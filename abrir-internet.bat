@echo off
title EcoCiudadano Iraca - Internet global (tunel)
cd /d "%~dp0"
echo ========================================
echo 1) Asegura que el servidor este en :3000
echo    (usa iniciar.bat si no esta corriendo)
echo 2) Este tunel crea un enlace PUBLICO mundial
echo    Mientras esta ventana este ABIERTA.
echo ========================================
echo.
if not exist "tools\cloudflared.exe" (
  echo Falta tools\cloudflared.exe
  pause
  exit /b 1
)
tools\cloudflared.exe tunnel --url http://127.0.0.1:3000
pause
