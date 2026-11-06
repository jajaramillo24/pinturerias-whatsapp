# PEJ · Contacto con pinturerías

Panel para preparar el pedido solidario de PEJ a 22 pinturerías. La interfaz se publica en GitHub Pages; el envío automático requiere ejecutar el programa local, que muestra el QR de WhatsApp y guarda la sesión y el historial **en tu computadora**.

## Empezar

1. Descargá el ZIP del repositorio y descomprimilo, o cloná el repositorio.
2. Instalá Node.js 22 o posterior.
3. En la carpeta del proyecto, ejecutá `npm install` (solo la primera vez, descarga Chromium) y luego `npm start`. En Mac también podés usar `./Iniciar-Mac.command`; en Windows, `Iniciar-Windows.cmd`.
4. Abrí `http://127.0.0.1:3487`. También podés usar la página pública de GitHub Pages mientras el programa local está abierto. Si el navegador bloquea la conexión desde la página pública, usá el enlace local.
5. Revisá el texto y los 22 números. Los números proporcionados se interpretaron como celulares argentinos y se normalizaron a `+54 9`; si alguno corresponde a otra línea, corregilo en `contactos.json` y reiniciá.
6. Generá las vistas previas y revisá el texto de cada destinatario.
7. Pulsá **Mostrar QR**. En el teléfono: WhatsApp → Dispositivos vinculados → Vincular un dispositivo. Escaneá el QR y esperá el estado **WhatsApp conectado**.
8. Marcá la casilla de revisión y pulsá **Enviar tanda**. El programa envía un mensaje cada cinco segundos.

El QR y la vista previa no envían nada. Solo **Enviar tanda** inicia el envío. **Detener próximos envíos** cancela los pendientes; uno que ya está en proceso puede salir.

## Qué se envía

El texto compartido por el usuario está precargado en `core.cjs`. La variable `{nombre}` personaliza el saludo de cada pinturería. Se adaptó el formato Markdown del enlace a una URL directa y se corrigieron los asteriscos de énfasis para WhatsApp.

## Resultados y reintentos

El historial se guarda en `app-data/historial.json` y se puede exportar como CSV. Un mensaje idéntico registrado como enviado o incierto se omite al repetir la tanda. Un resultado incierto detiene los siguientes envíos; hay que revisar el chat antes de marcarlo como enviado o habilitar un reintento. “Enviado” indica que WhatsApp Web aceptó el mensaje; no confirma entrega ni lectura.

`npm run demo` permite revisar el panel sin conectar WhatsApp ni enviar. `npm test` ejecuta pruebas con envíos simulados.

## Alcance técnico

GitHub Pages solo publica archivos estáticos y no puede mantener una sesión de WhatsApp por sí mismo. El programa local escucha únicamente en `127.0.0.1:3487`; acepta solicitudes de la página de este repositorio y del propio panel local. La carpeta `app-data/` está excluida de Git y **no debe compartirse**.

La automatización usa `whatsapp-web.js`, una integración no oficial. Puede romperse con cambios de WhatsApp o causar restricciones de la cuenta. Para una solución oficial alojada en un servidor se necesita WhatsApp Business Platform y sus requisitos de mensajes y plantillas.
