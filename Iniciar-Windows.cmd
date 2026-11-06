@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instala Node.js 22 o posterior desde https://nodejs.org y vuelve a abrir este archivo.
  pause
  exit /b 1
)
if not exist "node_modules\whatsapp-web.js\package.json" goto install
if not exist "node_modules\qrcode\package.json" goto install
goto start
:install
echo Instalando dependencias y Chromium. La primera vez puede tardar unos minutos...
call npm install
if errorlevel 1 (
  pause
  exit /b 1
)
:start
echo Abre http://127.0.0.1:3487 en tu navegador.
call npm start
pause
