const fs = require('node:fs');
const path = require('node:path');
const { DEFAULT_TEMPLATE, validateContacts } = require('../core.cjs');

const root = path.join(__dirname, '..');
const contacts = validateContacts(JSON.parse(fs.readFileSync(path.join(root, 'contactos.json'), 'utf8')));
const data = {
  template: DEFAULT_TEMPLATE,
  contacts: contacts.map(({ id, nombre, telefono }) => ({ id, nombre, telefono }))
};
fs.writeFileSync(path.join(root, 'docs', 'data.json'), JSON.stringify(data, null, 2) + '\n');
