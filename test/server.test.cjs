const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const http=require('node:http');

test('panel demo sirve la interfaz y limita el puente a GitHub Pages y localhost',async t=>{
  const port=38472,url=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,['server.cjs','--demo'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
  t.after(()=>child.kill('SIGTERM'));
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('El servidor no inició')),5000);child.stdout.on('data',data=>{if(data.toString().includes('Abrí')){clearTimeout(timer);resolve();}});child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);reject(Error('Servidor cerrado: '+code));});});
  const html=await fetch(url);assert.equal(html.status,200);assert.match(await html.text(),/22 conversaciones/);
  assert.equal((await fetch(url+'/theme.css')).status,200);
  const state=await(await fetch(url+'/api/state')).json();assert.equal(state.contacts.length,22);
  const publicOrigin='https://jajaramillo24.github.io';
  const options=await fetch(url+'/api/state',{method:'OPTIONS',headers:{Origin:publicOrigin,'Access-Control-Request-Private-Network':'true'}});
  assert.equal(options.status,204);assert.equal(options.headers.get('access-control-allow-origin'),publicOrigin);assert.equal(options.headers.get('access-control-allow-private-network'),'true');
  const post=(route,data,origin=url)=>fetch(url+route,{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':state.token,Origin:origin},body:JSON.stringify(data)});
  const response=await post('/api/preview',{selected:['c10'],template:state.template},publicOrigin);
  assert.equal(response.status,200);assert.match((await response.json()).items[0].text,/Pintecord/);
  assert.equal((await post('/api/connect',{},'https://otro.example')).status,403);
  const wrongHost=await new Promise((resolve,reject)=>{const req=http.get(url+'/api/state',{headers:{Host:'otro.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});
  assert.equal(wrongHost,403);
});
