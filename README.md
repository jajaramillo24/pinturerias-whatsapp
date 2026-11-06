# PEJ · Contacto con pinturerías

Panel para preparar el pedido solidario de PEJ a 22 pinturerías.

## Usar la página publicada, sin instalar este programa

1. Abrí [la página de PEJ](https://jajaramillo24.github.io/pinturerias-whatsapp/) en una computadora.
2. Pulsá **Abrir WhatsApp Web**. Si aparece un QR, escanealo desde WhatsApp en el teléfono: **Dispositivos vinculados → Vincular un dispositivo**.
3. Revisá el texto y los números. Elegí los contactos y pulsá **Preparar mensajes**.
4. Para cada contacto, pulsá **Abrir chat en WhatsApp Web**, comprobá el destinatario y pulsá **Enviar** en WhatsApp. Al volver a la página, pulsá **Ya lo envié en WhatsApp**.

La página abre cada chat con el mensaje preparado. No envía mensajes por sí sola ni puede verificar su entrega. El seguimiento manual se guarda en el navegador donde lo marcaste. En el teléfono también podés usar **Abrir en el teléfono**.

Los números proporcionados se interpretaron como celulares argentinos y se normalizaron a `+54 9`. Revisalos antes de enviar. Para cambiar un número en la página publicada, editá `contactos.json`, ejecutá `npm run build:pages` y publicá la actualización.

## Envío automático con el programa local

La interfaz original sigue disponible cuando ejecutás el programa en tu computadora. Este modo muestra un QR dentro del panel y puede enviar la tanda automáticamente. Requiere Node.js 22 o posterior.

1. Descargá el ZIP del repositorio y descomprimilo, o cloná el repositorio.
2. Ejecutá `npm install` y `npm start`. En Mac también podés usar `./Iniciar-Mac.command`; en Windows, `Iniciar-Windows.cmd`.
3. Abrí `http://127.0.0.1:3487`. Revisá el mensaje y los contactos, generá las vistas previas y pulsá **Mostrar QR**.
4. Escaneá el QR con WhatsApp en el teléfono, confirmá la revisión y pulsá **Enviar tanda**.

El programa local envía un mensaje cada cinco segundos. Su historial se guarda en `app-data/historial.json`; la sesión de WhatsApp queda en `app-data/sesion/`. Ambas rutas se excluyen de Git. `npm run demo` permite revisar el panel sin vincular WhatsApp ni enviar. `npm test` ejecuta las pruebas.

## Publicación

GitHub Pages publica `docs/` desde la rama `main`. Antes de publicar cambios de `contactos.json` o del texto predeterminado en `core.cjs`, ejecutá `npm run build:pages` para actualizar `docs/data.json`.

GitHub Pages solo sirve archivos estáticos y no puede mantener una sesión de WhatsApp ni enviar una tanda automáticamente. El modo automático usa `whatsapp-web.js`, una integración no oficial que puede romperse con cambios de WhatsApp o causar restricciones de la cuenta.
