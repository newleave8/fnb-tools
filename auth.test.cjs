const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/auth.js','utf8');
function setup({blockedStorage=false}={}){
 const events={},timers=new Map(),sent=[],elements={},saved=new Map();let next=1;
 for(const id of ['hubError','hubSubmit','hubLoginForm','hubPassword','hubId','hubWorkspace','hubLogin','hubLogout','cards'])elements[id]={hidden:id==='hubWorkspace',value:'',textContent:'',innerHTML:'',disabled:false};
 const storage={getItem:k=>{if(blockedStorage)throw Error('blocked');return saved.get(k)},setItem:(k,v)=>{if(blockedStorage)throw Error('blocked');saved.set(k,v)},removeItem:k=>saved.delete(k)};
 const window={addEventListener:(k,f)=>(events[k]??=[]).push(f),dispatchEvent:e=>(events[e.type]||[]).forEach(f=>f(e))};
 const fetch=(url,options)=>new Promise((resolve,reject)=>{const r={url,...options,body:JSON.parse(options.body),resolve:value=>resolve({ok:true,json:async()=>value}),reject};sent.push(r);options.signal.addEventListener('abort',()=>reject(Error('aborted')))});
 const context=vm.createContext({window,document:{getElementById:id=>elements[id]},sessionStorage:storage,fetch,AbortController,Date,Number,Error,TypeError,Event:class{constructor(type){this.type=type}},setTimeout:f=>{const id=next++;timers.set(id,f);return id},clearTimeout:id=>timers.delete(id),setInterval(){},render(){}});
 vm.runInContext(source,context);events.DOMContentLoaded[0]();return {elements,sent,timers,events,window,saved};
}
const tick=()=>new Promise(setImmediate),submit=x=>x.elements.hubLoginForm.onsubmit({preventDefault(){}});
(async()=>{
 const x=setup({blockedStorage:true});x.elements.hubId.value='tester';x.elements.hubPassword.value='test-only';
 const login=submit(x);assert.equal(x.sent[0].body.action,'login');assert.equal(x.elements.hubPassword.value,'');assert.equal(x.sent[0].credentials,'omit');assert.equal(x.sent[0].headers['Content-Type'],'text/plain;charset=UTF-8');
 x.sent[0].resolve({ok:true,value:{token:'test-token',expires:Date.now()+100000}});await tick();assert.equal(x.sent[1].body.action,'state');assert.equal(x.elements.hubWorkspace.hidden,true);
 x.sent[1].resolve({ok:true,value:[]});await login;assert.equal(x.elements.hubWorkspace.hidden,false);
 const y=setup();const wait=submit(y);y.timers.values().next().value();await wait;assert.equal(y.elements.hubSubmit.disabled,false);assert.match(y.elements.hubError.textContent,/지연/);
 const retry=submit(y);y.sent.at(-1).resolve({ok:false,error:'ID 또는 비밀번호를 확인하세요.'});await retry;assert.equal(y.elements.hubSubmit.disabled,false);assert.match(y.elements.hubError.textContent,/비밀번호/);
 assert.ok(!source.includes('iframe'));assert.ok(!source.includes('postMessage'));assert.ok(!fs.readFileSync(__dirname+'/index.html','utf8').includes('hubDirectLogin'));
 const z=setup();const late=submit(z);z.sent[0].resolve({ok:true,value:{token:'old-token',expires:Date.now()+100000}});await tick();const state=z.sent[1];z.elements.hubLogout.onclick();state.resolve({ok:true,value:[]});await late;assert.equal(z.elements.hubWorkspace.hidden,true);
 console.log('PASS: cookie-free direct transport, login/state authorization gating, blocked storage, timeout/retry, no iframe or second route, stale login/logout protection.');
})().catch(e=>{console.error(e);process.exitCode=1});
