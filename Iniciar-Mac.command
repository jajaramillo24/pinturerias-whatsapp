#!/bin/bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Instalá Node.js 22 o posterior desde https://nodejs.org y volvé a abrir este archivo."
  read -r -p "Enter para cerrar..."
  exit 1
fi
if [ ! -d node_modules/whatsapp-web.js ] || [ ! -d node_modules/qrcode ]; then
  echo "Instalando dependencias y Chromium. La primera vez puede tardar unos minutos..."
  npm install
fi
echo "Abrí http://127.0.0.1:3487 en tu navegador."
npm start
