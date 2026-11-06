const $=id=>document.getElementById(id);
const form=$('form');
const apiBase=location.protocol==='https:'?'http://127.0.0.1:3487':'';
let state=null,selected=null,plan=null,token='',polling=false,resultsSignature='',historySignature='';
const labels={pending:'Pendiente',sending:'Enviando…',sent:'Enviado',error:'No enviado',uncertain:'Revisar chat',skipped:'Omitido',cancelled:'Cancelado',not_sent:'Reintento habilitado'};
function el(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
function notice(message){$('notice').textContent=message;$('notice').hidden=!message;}
async function api(url,data){
  const response=await fetch(apiBase+url,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':token},body:JSON.stringify(data)});
  const result=await response.json();if(!response.ok)throw Error(result.error||'No se pudo completar la operación.');return result;
}
function invalidate(){plan=null;$('confirmed').checked=false;$('confirmed').disabled=true;$('preview-info').textContent='Los datos cambiaron. Generá una nueva vista previa.';for(const id of ['preview-select','message','preview-actions'])$(id).hidden=true;syncButtons();}
function syncButtons(){
  const active=!!state?.campaign.active;
  const count=plan?.items.filter(i=>!i.blocked).length||0;
  $('confirmed').disabled=!plan||active||!count;
  $('send').disabled=!plan||!count||!$('confirmed').checked||state?.connection.status!=='ready'||active||state.demo;
  $('send').textContent=active?'Envío en curso…':`Enviar tanda${plan?' · '+count+' mensajes':''}`;
  $('stop').hidden=!active;$('stop').disabled=!!state?.campaign.stopping;
  $('stop').textContent=state?.campaign.stopping?'Deteniendo…':'Detener próximos envíos';
  for(const control of form.elements)control.disabled=active;
  for(const checkbox of $('contacts').querySelectorAll('input'))checkbox.disabled=active;
  $('select-all').disabled=active;
}
function renderContacts(){
  $('contacts').replaceChildren();
  for(const c of state.contacts){
    const row=el('label',undefined,'contact'),check=el('input');check.type='checkbox';check.checked=selected.has(c.id);check.setAttribute('aria-label','Seleccionar a '+c.nombreCompleto);
    check.addEventListener('change',()=>{check.checked?selected.add(c.id):selected.delete(c.id);updateSelection();invalidate();});
    const detail=el('span');detail.append(el('strong',c.nombreCompleto));
    row.append(check,detail,el('span','+'+c.telefono,'phone'));$('contacts').append(row);
  }
  updateSelection();
}
function updateSelection(){const count=selected.size;$('count').textContent=count;$('select-all').checked=count===state.contacts.length;$('select-all').indeterminate=count>0&&count<state.contacts.length;}
function renderPreview(){
  const item=plan?.items[Number($('preview-select').value)||0];if(!item)return;
  $('message').textContent=item.text;
  $('open-chat').href=`https://wa.me/${item.telefono}?text=${encodeURIComponent(item.text)}`;
}
function badge(status){return el('span',labels[status]||status,'badge '+status);}
function renderCampaign(){
  const campaign=state.campaign,signature=JSON.stringify(campaign.items);
  if(signature!==resultsSignature){
    resultsSignature=signature;$('results').replaceChildren();
    for(const item of campaign.items){const row=el('tr');const status=el('td');status.append(badge(item.status));row.append(el('td',item.nombreCompleto),el('td','+'+item.telefono),status,el('td',item.error||(item.status==='skipped'?'Mensaje idéntico ya registrado.':'')));$('results').append(row);}
  }
  const n=status=>campaign.items.filter(i=>i.status===status).length;
  $('campaign-summary').textContent=campaign.lastError||(campaign.items.length?`${campaign.active?'En curso':'Tanda terminada'} · ${n('sent')} enviados · ${n('pending')} pendientes · ${n('skipped')} omitidos · ${n('uncertain')} a revisar · ${n('error')} errores · ${n('cancelled')} cancelados`:'Todavía no se inició ninguna tanda.');
  const hs=JSON.stringify(campaign.history);
  if(hs!==historySignature){
    historySignature=hs;$('history').replaceChildren();
    for(const item of [...campaign.history].reverse()){
      const row=el('div',undefined,'history-item');row.append(el('strong',item.nombre+' · '),badge(item.status),el('p',new Date(item.date).toLocaleString('es-AR')+' · +'+item.telefono));
      if(item.error)row.append(el('p',item.error));
      const link=el('a','Abrir chat ↗');link.href='https://wa.me/'+item.telefono;link.target='_blank';link.rel='noopener noreferrer';row.append(link);
      if(item.status==='uncertain')for(const [status,label]of [['sent','Confirmar que se envió'],['not_sent','No salió: habilitar reintento']]){
        const button=el('button',label,'text-button');button.type='button';button.addEventListener('click',async()=>{
          const question=status==='sent'?'¿Revisaste el chat y confirmás que el mensaje se envió?':'¿Revisaste el chat y confirmás que el mensaje NO se envió? Esto permitirá reintentarlo en una nueva tanda.';
          if(!confirm(question))return;
          try{await api('/api/resolve',{key:item.key,status});invalidate();await poll();}catch(e){notice(e.message);}
        });row.append(el('br'),button);
      }
      const detail=el('details'),summary=el('summary','Ver mensaje');detail.append(summary,el('article',item.text,'message'));row.append(detail);$('history').append(row);
    }
    if(!campaign.history.length)$('history').append(el('p','Aún no hay mensajes en el historial.','hint'));
  }
}
function renderConnection(){
  const c=state.connection;
  const titles={idle:'Sin vincular',connecting:'Conectando…',qr:'Escaneá el código QR',ready:'WhatsApp conectado',error:'No se pudo conectar',disconnected:'Sesión desconectada',demo:'Modo demo · sin envíos'};
  $('connection-status').textContent=titles[c.status]||c.status;
  $('connection-help').textContent=c.error||(c.status==='ready'?'Cuenta vinculada: +'+c.account:state.demo?'Modo de prueba: podés revisar todo sin enviar. Para enviar, ejecutá npm start.':c.status==='connecting'?'La primera conexión puede tardar. Mantené abierto el programa local.':'Vinculá la cuenta desde la que querés enviar.');
  $('qr').hidden=!c.qr;if(c.qr)$('qr').src=c.qr;else $('qr').removeAttribute('src');
  $('connect').hidden=c.status==='ready'||state.demo;
  $('connect').disabled=['connecting','qr'].includes(c.status)||state.campaign.active;
  $('connect').textContent=c.status==='connecting'?'Conectando…':c.status==='qr'?'Esperando vinculación…':c.status==='idle'?'Mostrar QR':'Volver a conectar';
}
async function poll(){
  if(polling)return;polling=true;
  try{
    state=await api('/api/state');token=state.token;
    if(!selected){selected=new Set(state.contacts.map(c=>c.id));$('template').value=state.template;renderContacts();}
    renderConnection();renderCampaign();syncButtons();
  }catch(e){notice('No se pudo conectar con el programa local. Ejecutá npm start en la carpeta descargada y abrí http://127.0.0.1:3487 si el navegador bloquea la conexión desde GitHub Pages. '+e.message);$('send').disabled=true;}
  finally{polling=false;}
}
form.addEventListener('input',invalidate);
form.addEventListener('submit',async event=>{
  event.preventDefault();notice('');
  try{
    plan=await api('/api/preview',{template:$('template').value,selected:[...selected]});
    $('preview-select').replaceChildren();plan.items.forEach((item,index)=>{const option=el('option',item.nombreCompleto+(item.blocked?' (omitido)':''));option.value=index;$('preview-select').append(option);});
    for(const id of ['preview-select','message','preview-actions'])$(id).hidden=false;
    const blocked=plan.items.filter(i=>i.blocked).length;
    $('preview-info').textContent=`${plan.items.length} mensajes personalizados. Revisá cada uno con el selector.${blocked?' '+blocked+' se omitirán por estar ya registrados.':''}`;
    $('confirmed').checked=false;renderPreview();syncButtons();
  }catch(e){invalidate();notice(e.message);}
});
$('select-all').addEventListener('change',()=>{selected=new Set($('select-all').checked?state.contacts.map(c=>c.id):[]);renderContacts();invalidate();});
$('preview-select').addEventListener('change',renderPreview);
$('confirmed').addEventListener('change',syncButtons);
$('restore').addEventListener('click',()=>{$('template').value=state.template;invalidate();});
$('connect').addEventListener('click',async()=>{try{$('connect').disabled=true;notice('');await api('/api/connect',{});await poll();}catch(e){notice(e.message);}});
$('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('message').textContent);notice('Mensaje copiado.');}catch{notice('No se pudo copiar. Podés seleccionar el texto de la vista previa.');}});
$('send').addEventListener('click',async()=>{
  if(!plan||!$('confirmed').checked)return;
  $('send').disabled=true;
  try{await api('/api/send',{planId:plan.id,confirmed:true});notice('Tanda iniciada. Podés seguir los resultados abajo.');plan=null;$('confirmed').checked=false;await poll();}
  catch(e){notice(e.message);syncButtons();}
});
$('stop').addEventListener('click',async()=>{try{await api('/api/stop',{});await poll();}catch(e){notice(e.message);}});
$('export').addEventListener('click',()=>{
  if(!state)return;
  const cell=value=>{let text=String(value??'');if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
  const rows=[['Fecha','Nombre','Teléfono','Estado','Detalle','Mensaje'],...state.campaign.history.map(h=>[h.date,h.nombre,h.telefono,labels[h.status]||h.status,h.error||'',h.text])];
  const blob=new Blob(['\ufeff'+rows.map(r=>r.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const href=URL.createObjectURL(blob),a=el('a');a.href=href;a.download='historial-pinturerias-pej.csv';a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
});
void poll();setInterval(poll,1400);
