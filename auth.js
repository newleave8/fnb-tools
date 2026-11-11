/* GitHub-hosted workspace; authentication stays on Apps Script. */
(()=>{
'use strict';
const app='https://script.google.com/macros/s/AKfycbx-Q3g0ev2g4mJhYpI_ttSn_zwuywMl9lW1zYtH8a05VGALtx7BtKKbY8gaW5bTbnkE/exec';
const channel='fnb-auth-v1',storageKey='fnb-hub-session-v1';
const connectTimeout=15000,requestTimeout=25000;
let bridge=null,token='',expires=0,adminToken='',generation=0;
const pending=new Map();
const el=id=>document.getElementById(id);
function randomId(){return Array.from(crypto.getRandomValues(new Uint8Array(24)),x=>x.toString(16).padStart(2,'0')).join('');}
function permitted(origin){try{const u=new URL(origin);return u.protocol==='https:'&&(u.hostname==='script.google.com'||u.hostname.endsWith('-script.googleusercontent.com'));}catch{return false;}}
function help(message){
 if(message&&el('hubError'))el('hubError').textContent=message;
}
function resetBridge(){
 const old=bridge;bridge=null;
 if(old){clearTimeout(old.timer);old.reject(Error('인증 연결을 다시 시작했습니다.'));old.frame.remove();}
 for(const [id,p] of pending){clearTimeout(p.timer);p.reject(Error('인증 연결을 다시 시작했습니다.'));pending.delete(id);}
}
function connect(){
 if(bridge&&!bridge.failed)return bridge.ready;
 resetBridge();
 const current={nonce:randomId(),peer:null,origin:'',failed:false,frame:document.createElement('iframe')};
 current.ready=new Promise((resolve,reject)=>{current.resolve=resolve;current.reject=reject;});
 current.ready.catch(()=>{});
 current.frame.className='auth-frame';current.frame.title='로그인 검증';current.frame.setAttribute('aria-hidden','true');current.frame.tabIndex=-1;current.frame.referrerPolicy='no-referrer';
 const fail=()=>{if(bridge!==current||current.peer)return;current.failed=true;clearTimeout(current.timer);current.reject(Error('브라우저 안의 인증 연결이 지연됩니다. 로그인 버튼을 다시 눌러 주세요.'));help('인증 연결이 지연됩니다. 로그인 버튼을 다시 눌러 연결을 다시 시도하세요.');};
 current.frame.onerror=fail;
 current.timer=setTimeout(fail,connectTimeout);
 current.frame.src=app+'?view=auth&nonce='+current.nonce;
 bridge=current;document.body.appendChild(current.frame);
 return current.ready;
}
window.addEventListener('message',event=>{
 const current=bridge,m=event.data;
 if(!current||current.failed||!m||m.channel!==channel||m.nonce!==current.nonce||!permitted(event.origin))return;
 // Apps Script nests its sandbox, so READY comes from the inner frame.
 if(m.ready&&!current.peer){current.peer=event.source;current.origin=event.origin;clearTimeout(current.timer);current.resolve();return;}
 if(event.source!==current.peer||event.origin!==current.origin)return;
 const item=pending.get(m.id);if(!item)return;
 clearTimeout(item.timer);pending.delete(m.id);m.ok?item.resolve(m.value):item.reject(Error(m.error||'요청 실패'));
});
async function request(action,body={}){
 const ready=connect(),current=bridge;await ready;
 if(bridge!==current||current.failed)throw Error('인증 연결을 다시 시도해 주세요.');
 return new Promise((resolve,reject)=>{
  const id=randomId(),timer=setTimeout(()=>{pending.delete(id);current.failed=true;help();reject(Error('인증 응답이 지연됩니다. 로그인 버튼을 다시 눌러 주세요.'));},requestTimeout);
  pending.set(id,{resolve,reject,timer});
  try{current.peer.postMessage({channel,nonce:current.nonce,id,action,...body},current.origin);}
  catch(error){clearTimeout(timer);pending.delete(id);reject(error);}
 });
}
window.FNBHubAdmin={
 async login(username,password){let result;try{result=await request('login',{username,password});const data=await request('adminState',{token:result.token});if(adminToken)request('logout',{token:adminToken}).catch(()=>{});adminToken=result.token;return data;}catch(e){if(result?.token)request('logout',{token:result.token}).catch(()=>{});throw e;}},
 state:()=>request('adminState',{token:adminToken}),
 save:payload=>request('adminSave',{token:adminToken,payload}),
 logout(){const old=adminToken;adminToken='';if(old)request('logout',{token:old}).catch(()=>{});},
 refresh:()=>request('state',{token})
};
window.addEventListener('DOMContentLoaded',()=>{
 const forget=()=>{token='';expires=0;try{sessionStorage.removeItem(storageKey);}catch{}};
 const lock=message=>{generation++;window.FNBHubAdmin.logout();window.dispatchEvent(new Event('fnb-hub-locked'));forget();window.FNB_TOOLS=[];el('cards').innerHTML='';el('hubWorkspace').hidden=true;el('hubLogin').hidden=false;el('hubError').textContent=message||'';};
 const show=tools=>{if(!Array.isArray(tools))throw Error('도구 목록 응답을 확인할 수 없습니다.');window.FNB_TOOLS=tools;render();el('hubLogin').hidden=true;el('hubWorkspace').hidden=false;el('hubError').textContent='';};
 const save=()=>{try{sessionStorage.setItem(storageKey,JSON.stringify({token,expires}));}catch{}};
 el('hubLoginForm').onsubmit=async event=>{
  event.preventDefault();const attempt=++generation;el('hubSubmit').disabled=true;
  el('hubError').textContent='로그인 확인 중입니다.';
  let password=el('hubPassword').value;el('hubPassword').value='';
  try{
   const result=await request('login',{username:el('hubId').value.trim(),password});password='';
   if(attempt!==generation){request('logout',{token:result.token}).catch(()=>{});return;}
   if(typeof result?.token!=='string'||!Number.isFinite(result.expires)||result.expires<=Date.now())throw Error('로그인 응답을 확인할 수 없습니다.');
   token=result.token;expires=result.expires;
   el('hubError').textContent='로그인 완료 · 도구 목록을 불러오는 중입니다.';
   const tools=await request('state',{token});
   if(attempt!==generation)return;
   show(tools);save();
  }catch(e){password='';if(attempt===generation){const old=token;lock(e.message);if(old)request('logout',{token:old}).catch(()=>{});help();}}
  finally{if(attempt===generation||el('hubWorkspace').hidden)el('hubSubmit').disabled=false;}
 };
 el('hubLogout').onclick=()=>{const old=token;lock('로그아웃했습니다.');if(old)request('logout',{token:old}).catch(()=>{});};
 connect().catch(()=>{});
 (async()=>{let saved;try{saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');}catch{}
  if(typeof saved?.token!=='string'||!Number.isFinite(saved.expires)||saved.expires<=Date.now())return;
  const attempt=++generation;token=saved.token;expires=saved.expires;el('hubError').textContent='로그인 상태를 확인 중입니다.';
  try{const tools=await request('state',{token});if(attempt===generation)show(tools);}catch(e){if(attempt===generation){lock(e.message);help();}}
 })();
 setInterval(()=>{if(token&&Date.now()>=expires)lock('로그인이 만료됐습니다. 다시 로그인하세요.');},15000);
 window.addEventListener('focus',()=>{if(token&&Date.now()<expires&&!el('hubWorkspace').hidden){const attempt=generation;request('state',{token}).then(tools=>{if(attempt===generation)show(tools);}).catch(e=>{if(attempt===generation&&e.message.includes('AUTH_REQUIRED'))lock(e.message);});}});
 window.addEventListener('pageshow',()=>{if(token&&Date.now()>=expires)lock('로그인이 만료됐습니다. 다시 로그인하세요.');});
});
})();
