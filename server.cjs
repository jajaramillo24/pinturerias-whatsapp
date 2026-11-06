const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {DEFAULT_TEMPLATE,makePreview,validateContacts,Campaign}=require('./core.cjs');
const demo=process.argv.includes('--demo');
const PORT=Number(process.env.PORT||3487);
if(!Number.isInteger(PORT)||PORT<1024||PORT>65535) throw Error('PORT debe ser un puerto válido entre 1024 y 65535.');
const origin=`http://127.0.0.1:${PORT}`;
const publicOrigin='https://jajaramillo24.github.io';
const allowedOrigins=new Set([origin,publicOrigin]);
const token=crypto.randomBytes(32).toString('hex');
let contacts=validateContacts(JSON.parse(fs.readFileSync(path.join(__dirname,'contactos.json'),'utf8')));
let connection={status:demo?'demo':'idle',qr:'',error:'',account:''},client=null,connecting=false,plan=null;
const campaign=new Campaign({
  file:path.join(__dirname,'app-data',demo?'historial-demo.json':'historial.json'),
  isReady:()=>connection.status==='ready'&&!demo,
  send:async item=>{
    const id=await client.getNumberId(item.telefono);
    if(!id){const error=Error('Este número no está registrado en WhatsApp.');error.definitelyNotSent=true;throw error;}
    return client.sendMessage(id._serialized,item.text,{sendSeen:false});
  }
});
async function connect(){
  if(demo) throw Error('El modo demo no vincula ni envía mensajes. Iniciá con npm start.');
  if(connecting||connection.status==='ready') return;
  connecting=true;connection={status:'connecting',qr:'',error:'',account:''};
  try{
    if(client){await client.destroy().catch(()=>{});client=null;}
    const {Client,LocalAuth}=require('whatsapp-web.js');
    const QRCode=require('qrcode');
    const current=new Client({authStrategy:new LocalAuth({dataPath:path.join(__dirname,'app-data','sesion')}),puppeteer:{headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})}});
    client=current;
    const present=()=>client===current;
    current.on('qr',async qr=>{try{const image=await QRCode.toDataURL(qr,{width:280,margin:2});if(present()) connection={status:'qr',qr:image,error:'',account:''};}catch(e){if(present())connection={status:'error',qr:'',error:e.message,account:''};}});
    current.on('authenticated',()=>{if(present())connection={status:'connecting',qr:'',error:'',account:''};});
    current.on('ready',()=>{if(present())connection={status:'ready',qr:'',error:'',account:current.info?.wid?.user||''};});
    current.on('auth_failure',message=>{if(present()){connection={status:'error',qr:'',error:String(message),account:''};campaign.stop();}});
    current.on('disconnected',reason=>{if(present()){connection={status:'disconnected',qr:'',error:String(reason),account:''};campaign.stop();}});
    await current.initialize();
  }catch(error){connection={status:'error',qr:'',error:error.message,account:''};}
  finally{connecting=false;}
}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
async function body(req){
  if(!req.headers['content-type']?.startsWith('application/json')) throw Error('Se requiere JSON.');
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>256000)throw Error('La solicitud es demasiado grande.');chunks.push(chunk);}
  return JSON.parse(Buffer.concat(chunks).toString()||'{}');
}
const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  if(req.headers.host!==`127.0.0.1:${PORT}`)return json(res,403,{error:'Abrí el panel desde '+origin});
  if(req.headers.origin && !allowedOrigins.has(req.headers.origin))return json(res,403,{error:'Origen no autorizado.'});
  if(req.headers.origin===publicOrigin){
    res.setHeader('Access-Control-Allow-Origin',publicOrigin);
    res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Private-Network','true');
  }
  if(req.method==='OPTIONS'){
    res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-App-Token','Access-Control-Max-Age':'600'});
    return res.end();
  }
  const url=new URL(req.url,origin);
  try{
    if(req.method==='GET'&&url.pathname==='/api/state')return json(res,200,{token,demo,connection,contacts,template:DEFAULT_TEMPLATE,campaign:campaign.state()});
    if(req.method==='POST'){
      if(!allowedOrigins.has(req.headers.origin)||req.headers['x-app-token']!==token)return json(res,403,{error:'Recargá el panel para validar la sesión local.'});
      const data=await body(req);
      if(url.pathname==='/api/connect'){if(demo)throw Error('El modo demo no permite vincular WhatsApp.');void connect();return json(res,200,{ok:true});}
      if(url.pathname==='/api/preview'){
        const items=campaign.reviewedItems(makePreview(data,contacts));
        plan={id:crypto.randomUUID(),items,expires:Date.now()+30*60*1000};
        return json(res,200,plan);
      }
      if(url.pathname==='/api/send'){
        if(!plan||data.planId!==plan.id||Date.now()>plan.expires)throw Error('Actualizá la vista previa antes de enviar.');
        if(data.confirmed!==true)throw Error('Revisá y confirmá los mensajes primero.');
        campaign.start(plan.items);plan=null;return json(res,200,{ok:true});
      }
      if(url.pathname==='/api/stop'){campaign.stop();return json(res,200,{ok:true});}
      if(url.pathname==='/api/resolve'){campaign.resolve(data.key,data.status);plan=null;return json(res,200,{ok:true});}
      return json(res,404,{error:'Ruta no encontrada.'});
    }
    if(req.method==='GET'){
      const assets={'/':['local.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8'],'/theme.css':['theme.css','text/css; charset=utf-8']};
      const entry=assets[url.pathname];
      if(entry){res.writeHead(200,{'Content-Type':entry[1]});return res.end(fs.readFileSync(path.join(__dirname,'docs',entry[0])));}
    }
    json(res,404,{error:'Ruta no encontrada.'});
  }catch(error){json(res,400,{error:error.message});}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'El programa ya está abierto o el puerto 3487 está ocupado.':error.message);process.exitCode=1;});
server.listen(PORT,'127.0.0.1',()=>console.log(`\nPEJ · Pinturerías${demo?' · DEMO (sin envíos)':''}\nAbrí ${origin}\nDejá esta terminal abierta. Ctrl+C para cerrar.\n`));
process.once('SIGINT',()=>{campaign.stop();console.log('\nCerrando. Si un envío estaba en curso, revisá su chat antes de reintentar.');void(async()=>{await client?.destroy().catch(()=>{});server.close();process.exit(0);})();setTimeout(()=>process.exit(0),3000).unref();});
