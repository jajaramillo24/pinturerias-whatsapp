const $ = id => document.getElementById(id);
const storageKey = 'pej-pinturerias-envios-manuales-v1';
let contacts = [], originalTemplate = '', selected = new Set(), prepared = [], sent = {};

function notice(message) {
  $('notice').textContent = message;
  $('notice').hidden = !message;
}
function readSent() {
  try { return JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; }
  catch { return {}; }
}
function saveSent() {
  try { localStorage.setItem(storageKey, JSON.stringify(sent)); }
  catch { notice('El navegador no pudo guardar el seguimiento. Podés continuar, pero el avance se perderá al cerrar la página.'); }
}
function isSent(item) {
  const saved = sent[item.id];
  return saved?.telefono === item.telefono && saved?.text === item.text;
}
function itemFor(id) { return prepared.find(item => item.id === id); }
function renderContacts() {
  $('contacts').replaceChildren();
  for (const contact of contacts) {
    const row = document.createElement('label');
    row.className = 'contact';
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = selected.has(contact.id);
    check.setAttribute('aria-label', 'Seleccionar a ' + contact.nombre);
    check.addEventListener('change', () => {
      check.checked ? selected.add(contact.id) : selected.delete(contact.id);
      invalidate();
      renderContacts();
    });
    const name = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = contact.nombre;
    name.append(strong);
    row.append(check, name);
    const item = itemFor(contact.id);
    if (item && isSent(item)) {
      row.classList.add('is-sent');
      const status = document.createElement('span');
      status.className = 'sent-indicator';
      status.textContent = 'Marcado enviado';
      row.append(status);
    }
    const phone = document.createElement('span');
    phone.className = 'phone';
    phone.textContent = '+' + contact.telefono;
    row.append(phone);
    $('contacts').append(row);
  }
  $('count').textContent = selected.size;
  $('select-all').checked = selected.size === contacts.length;
  $('select-all').indeterminate = selected.size > 0 && selected.size < contacts.length;
}
function invalidate() {
  prepared = [];
  $('preview-info').textContent = 'Los datos cambiaron. Prepará los mensajes otra vez.';
  for (const id of ['preview-label', 'preview-select', 'message', 'preview-actions']) $(id).hidden = true;
  $('progress').textContent = 'Todavía no hay mensajes preparados.';
}
function updateProgress() {
  const done = prepared.filter(isSent).length;
  $('progress').textContent = `${done} de ${prepared.length} marcados como enviados · ${prepared.length - done} pendientes`;
  for (const [index, item] of prepared.entries()) {
    $('preview-select').options[index].textContent = `${isSent(item) ? '✓ ' : ''}${item.nombre}`;
  }
}
function renderPreview() {
  const item = prepared[Number($('preview-select').value)];
  if (!item) return;
  $('message').textContent = item.text;
  const params = `phone=${item.telefono}&text=${encodeURIComponent(item.text)}`;
  $('open-web').href = `https://web.whatsapp.com/send?${params}`;
  $('open-mobile').href = `https://wa.me/${item.telefono}?text=${encodeURIComponent(item.text)}`;
  $('mark-sent').hidden = isSent(item);
  $('mark-pending').hidden = !isSent(item);
}
function prepare(event) {
  event.preventDefault();
  notice('');
  const template = $('template').value.trim();
  if (!template.includes('{nombre}')) return notice('El texto debe incluir {nombre} para personalizar cada mensaje.');
  if (!selected.size) return notice('Seleccioná al menos un contacto.');
  const items = [];
  for (const contact of contacts.filter(c => selected.has(c.id))) {
    const text = template.replace(/\{([^{}]+)\}/g, (_, key) => {
      if (key !== 'nombre') throw Error(`Variable desconocida: {${key}}.`);
      return contact.nombre;
    }).replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n');
    if (/[{}]/.test(text)) throw Error('Hay variables sin completar o llaves sueltas en el mensaje.');
    if (text.length > 4000) throw Error(`El mensaje para ${contact.nombre} supera los 4000 caracteres.`);
    items.push({ ...contact, text });
  }
  prepared = items;
  $('preview-select').replaceChildren();
  for (const [index, item] of prepared.entries()) {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = item.nombre;
    $('preview-select').append(option);
  }
  const firstPending = prepared.findIndex(item => !isSent(item));
  $('preview-select').value = String(Math.max(firstPending, 0));
  for (const id of ['preview-label', 'preview-select', 'message', 'preview-actions']) $(id).hidden = false;
  $('preview-info').textContent = `${prepared.length} mensajes preparados. Abrí cada chat, enviá el mensaje en WhatsApp y confirmalo acá.`;
  updateProgress();
  renderPreview();
  renderContacts();
}

async function init() {
  try {
    const response = await fetch('./data.json', { cache: 'no-cache' });
    if (!response.ok) throw Error('No se pudieron cargar los contactos.');
    const data = await response.json();
    if (!Array.isArray(data.contacts) || !data.contacts.length || typeof data.template !== 'string') throw Error('Los datos publicados son inválidos.');
    contacts = data.contacts;
    originalTemplate = data.template;
    selected = new Set(contacts.map(c => c.id));
    sent = readSent();
    $('template').value = originalTemplate;
    renderContacts();
  } catch (error) { notice(error.message); }
}

$('form').addEventListener('submit', event => { try { prepare(event); } catch (error) { invalidate(); notice(error.message); } });
$('template').addEventListener('input', invalidate);
$('restore').addEventListener('click', () => { $('template').value = originalTemplate; invalidate(); });
$('select-all').addEventListener('change', () => {
  selected = new Set($('select-all').checked ? contacts.map(c => c.id) : []);
  invalidate();
  renderContacts();
});
$('preview-select').addEventListener('change', renderPreview);
$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('message').textContent); notice('Mensaje copiado.'); }
  catch { notice('No se pudo copiar. Podés seleccionar el texto de la vista previa.'); }
});
$('mark-sent').addEventListener('click', () => {
  const item = prepared[Number($('preview-select').value)];
  if (!item) return;
  sent[item.id] = { telefono: item.telefono, text: item.text };
  saveSent();
  updateProgress();
  renderContacts();
  const next = prepared.findIndex(other => !isSent(other));
  if (next >= 0) $('preview-select').value = String(next);
  renderPreview();
});
$('mark-pending').addEventListener('click', () => {
  const item = prepared[Number($('preview-select').value)];
  if (!item) return;
  delete sent[item.id];
  saveSent();
  updateProgress();
  renderContacts();
  renderPreview();
});
void init();
