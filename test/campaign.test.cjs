const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {Campaign,makePreview,validateContacts,DEFAULT_TEMPLATE}=require('../core.cjs');
const contacts=validateContacts(require('../contactos.json'));
const preview=(selected=contacts.map(c=>c.id))=>makePreview({template:DEFAULT_TEMPLATE,selected},contacts);
function setup(t,send,options={}){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pej-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return new Campaign({file:path.join(dir,'historial.json'),send,isReady:()=>true,delay:0,...options});}

test('conserva los 22 destinatarios y personaliza el saludo sin variables pendientes',()=>{
  assert.equal(contacts.length,22);
  assert.equal(new Set(contacts.map(c=>c.telefono)).size,22);
  assert.equal(contacts.find(c=>c.nombre==='Pintecord').telefono,'5493512195711');
  const items=preview();
  for(const item of items){
    assert.ok(item.text.startsWith(`Estimado equipo de ${item.nombre}:`));
    assert.ok(item.text.includes('https://pej.lat'));
    assert.ok(!item.text.includes('{nombre}'));
  }
});
test('rechaza destinatarios adulterados y variables desconocidas',()=>{
  assert.throws(()=>makePreview({template:DEFAULT_TEMPLATE,selected:['desconocido']},contacts),/selección/);
  assert.throws(()=>makePreview({template:'Hola {nombre} {otro}',selected:['c01']},contacts),/Variable desconocida/);
  assert.throws(()=>validateContacts([...contacts,contacts[0]]),/duplicados/);
});
test('no duplica un envío registrado y detiene la tanda ante resultado incierto',async t=>{
  const sent=[];let fail=false;
  const campaign=setup(t,async item=>{sent.push(item.id);if(fail)throw Error('Sin confirmación');return {id:{_serialized:item.id}};});
  campaign.start(preview(['c01']));await campaign.done;
  assert.deepEqual(sent,['c01']);
  assert.throws(()=>campaign.start(preview(['c01'])),/Todos estos mensajes/);
  fail=true;campaign.start(preview(['c01','c02','c03']));await campaign.done;
  assert.deepEqual(sent,['c01','c02']);
  assert.equal(campaign.items[1].status,'uncertain');
  assert.equal(campaign.items[2].status,'cancelled');
});
