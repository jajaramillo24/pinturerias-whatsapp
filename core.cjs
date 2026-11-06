const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_TEMPLATE = `Estimado equipo de {nombre}:

Somos *PEJ – Punto de Encuentro Juvenil* y estamos organizando una jornada solidaria para colaborar con la remodelación de la *sala cuna Pico Picotero*, en La Calera.

Este espacio acompaña a madres adolescentes y brinda sus servicios de manera gratuita. Actualmente, cuenta con recursos limitados para mantener sus instalaciones en óptimas condiciones, por lo que buscamos ayudar a renovar el lugar y ofrecer un ambiente más cuidado y acogedor.

Nos comunicamos con ustedes para consultar si podrían acompañarnos con la donación de alguno de los siguientes materiales:

• 1 balde de pintura blanca de 20 litros.
• 1 tarro de pintura azul de 4 litros.
• 1 tarro de pintura naranja de 4 litros.
• 1 tarro de pintura amarilla de 4 litros.
• 10 rodillos y 10 brochas para pintar.
• 2 envases de enduido.
• 2 botellas de aguarrás.
• 6 bandejas para pintura.

*Cualquier aporte, aunque sea de una parte de los materiales, será de gran ayuda.* Entendemos que la colaboración dependerá de sus posibilidades y agradeceremos mucho lo que puedan brindarnos.

Pueden conocer más sobre nosotros en https://pej.lat. Quedamos a disposición para ampliar la información sobre la iniciativa y coordinar el retiro de los materiales que puedan donar.

Muchas gracias por su tiempo y por considerar acompañarnos en este proyecto. Esperamos contar con su respuesta.

Saludos cordiales,

Equipo de PEJ
Punto de Encuentro Juvenil`;
const clean = value => typeof value === 'string' ? value.trim() : '';
function validateContacts(contacts) {
  if (!Array.isArray(contacts) || !contacts.length || contacts.length > 100) throw Error('La lista de contactos no es válida.');
  const ids = new Set(), phones = new Set();
  return contacts.map(c => {
    if (!c || typeof c !== 'object') throw Error('Contacto inválido.');
    const n = Object.fromEntries(['id','nombre','telefono'].map(k => [k, clean(c[k])]));
    n.nombreCompleto = n.nombre;
    n.telefono = n.telefono.replace(/[+\s()-]/g, '');
    if (!n.id || !n.nombre || !/^549\d{10}$/.test(n.telefono)) throw Error(`Revisá el nombre y el teléfono de ${n.nombre || n.id || 'un contacto'}.`);
    if (ids.has(n.id) || phones.has(n.telefono)) throw Error('Hay identificadores o teléfonos duplicados.');
    ids.add(n.id); phones.add(n.telefono);
    return n;
  });
}
function makePreview(body, contacts) {
  if (!body || typeof body !== 'object') throw Error('Escribí el mensaje.');
  const template = clean(body.template);
  if (!template || !template.includes('{nombre}')) throw Error('El texto debe incluir {nombre} para personalizar cada mensaje.');
  if (!Array.isArray(body.selected) || !body.selected.length) throw Error('Seleccioná al menos un contacto.');
  const selected = new Set(body.selected);
  if (selected.size !== body.selected.length || [...selected].some(id => !contacts.some(c => c.id === id))) throw Error('La selección de contactos no es válida.');
  return contacts.filter(c => selected.has(c.id)).map(c => {
    const vars = {nombre:c.nombre};
    const text = template.replace(/\{([^{}]+)\}/g, (_, key) => {
      if (!Object.hasOwn(vars, key)) throw Error(`Variable desconocida: {${key}}.`);
      return vars[key];
    }).replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n');
    if (/[{}]/.test(text)) throw Error('Hay variables sin completar o llaves sueltas en el mensaje.');
    if (text.length > 4000) throw Error(`El mensaje para ${c.nombre} supera los 4000 caracteres.`);
    return {...c, text, key:crypto.createHash('sha256').update(c.telefono+'\n'+text).digest('hex')};
  });
}

class Campaign {
  constructor({file,send,isReady,delay=5000,onChange=()=>{}}) {
    this.file=file; this.send=send; this.isReady=isReady; this.delay=delay; this.onChange=onChange;
    this.active=false; this.stopRequested=false; this.items=[]; this.lastError=''; this.waitResolve=null;
    this.history=[];
    if (fs.existsSync(file)) {
      this.history=JSON.parse(fs.readFileSync(file,'utf8'));
      if (!Array.isArray(this.history) || this.history.some(h=>!h || typeof h.key!=='string')) throw Error('El historial no es válido. Revisá app-data/historial.json antes de iniciar.');
      for(const h of this.history) if(h.status==='sending') {h.status='uncertain'; h.error='El programa se cerró durante el envío. Revisá el chat antes de marcarlo o reintentar.';}
      this.persist();
    }
  }
  persist() {fs.mkdirSync(path.dirname(this.file),{recursive:true}); const temp=this.file+'.tmp';fs.writeFileSync(temp,JSON.stringify(this.history,null,2),{mode:0o600});fs.renameSync(temp,this.file);}
  notify() {this.onChange();}
  state() {return {active:this.active,stopping:this.stopRequested,items:this.items,history:this.history,lastError:this.lastError};}
  reviewedItems(items) {
    return items.map(i=>({...i,blocked:this.history.some(h=>h.key===i.key&&['sent','sending','uncertain'].includes(h.status))}));
  }
  start(items) {
    if(this.active) throw Error('Ya hay un envío en curso.');
    if(!this.isReady()) throw Error('Primero vinculá WhatsApp y esperá a que esté conectado.');
    this.items=this.reviewedItems(items).map(i=>({...i,status:i.blocked?'skipped':'pending',error:''}));
    if(!this.items.some(i=>i.status==='pending')) throw Error('Todos estos mensajes ya se enviaron o necesitan revisión en el historial.');
    this.active=true;this.stopRequested=false;this.lastError='';this.notify();
    this.done=this.run().catch(error=>{
      this.lastError='La tanda se detuvo: '+error.message;
      for(const item of this.items) if(item.status==='pending') item.status='cancelled';
    }).finally(()=>{this.active=false;this.stopRequested=false;this.notify();});
  }
  async run() {
    for(const item of this.items) {
      if(item.status!=='pending') continue;
      if(this.stopRequested || !this.isReady()) {item.status='cancelled';continue;}
      // Persistir ANTES de la operación remota: ante un cierre no se reenvía a ciegas.
      const record={key:item.key,nombre:item.nombreCompleto,telefono:item.telefono,text:item.text,status:'sending',date:new Date().toISOString()};
      this.history.push(record);
      try {this.persist();} catch(error) {this.history.pop();throw error;}
      item.status='sending';this.notify();
      try {
        const result=await this.send(item);
        item.status='sent';record.status='sent';record.messageId=result?.id?._serialized||'';
      } catch(error) {
        // Un timeout no prueba que el mensaje no haya salido: no reintentar automáticamente.
        item.status=error.definitelyNotSent?'error':'uncertain';
        record.status=item.status;record.error=item.error=error.message;
        if(!error.definitelyNotSent) this.stopRequested=true;
      }
      this.persist();this.notify();
      if(this.items.some(i=>i.status==='pending') && !this.stopRequested) {
        await new Promise(resolve=>{const timer=setTimeout(()=>{this.waitResolve=null;resolve();},this.delay);this.waitResolve=()=>{clearTimeout(timer);this.waitResolve=null;resolve();};});
      }
    }
  }
  stop() {this.stopRequested=true;this.waitResolve?.();this.notify();}
  resolve(key,status) {
    if(this.active) throw Error('Esperá a que termine la tanda.');
    const item=[...this.history].reverse().find(h=>h.key===key&&h.status==='uncertain');
    if(!item || !['sent','not_sent'].includes(status)) throw Error('Revisión inválida.');
    const previous={...item};Object.assign(item,{status,reviewedAt:new Date().toISOString()});
    try{this.persist();}catch(error){Object.assign(item,previous);throw error;}
    this.notify();
  }
}
module.exports={DEFAULT_TEMPLATE,makePreview,validateContacts,Campaign};
