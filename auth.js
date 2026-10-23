/* GitHub-hosted workspace; authentication stays on Apps Script. */
(()=>{
'use strict';
const app='https://script.google.com/macros/s/AKfycbx-Q3g0ev2g4mJhYpI_ttSn_zwuywMl9lW1zYtH8a05VGALtx7BtKKbY8gaW5bTbnkE/exec';
const channel='fnb-auth-v1',storageKey='fnb-hub-session-v1';
const nonce=Array.from(crypto.getRandomValues(new Uint8Array(24)),x=>x.toString(16).padStart(2,'0')).join('');
let peer=null,peerOrigin='',token='',expires=0,frame,readyResolve,readyReject;
const pending=new Map();
const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
ready.catch(()=>{});
function permitted(origin){try{const u=new URL(origin);return u.protocol==='https:'&&(u.hostname==='script.google.com'||u.hostname.endsWith('-script.googleusercontent.com'));}catch{return false;}}
window.addEventListener('message',event=>{
 const m=event.data;
 if(!m||m.channel!==channel||m.nonce!==nonce||!permitted(event.origin))return;
 if(m.ready&&!peer){peer=event.source;peerOrigin=event.origin;readyResolve();return;}
 if(event.source!==peer||event.origin!==peerOrigin)return;
 const item=pending.get(m.id);if(!item)return;
 clearTimeout(item.timer);pending.delete(m.id);m.ok?item.resolve(m.value):item.reject(Error(m.error||'요청 실패'));
});
async function request(action,body={}){
 await ready;
 return new Promise((resolve,reject)=>{
  const id=crypto.randomUUID(),timer=setTimeout(()=>{pending.delete(id);reject(Error('응답이 지연됩니다. 잠시 후 다시 시도하세요.'));},45000);
  pending.set(id,{resolve,reject,timer});peer.postMessage({channel,nonce,id,action,...body},peerOrigin);
 });
}
window.addEventListener('DOMContentLoaded',()=>{
 const el=id=>document.getElementById(id);
 const forget=()=>{token='';expires=0;try{sessionStorage.removeItem(storageKey);}catch{}};
 const lock=message=>{forget();window.FNB_TOOLS=[];el('cards').innerHTML='';el('hubWorkspace').hidden=true;el('hubLogin').hidden=false;el('hubError').textContent=message||'';};
 const show=tools=>{window.FNB_TOOLS=tools;el('hubLogin').hidden=true;el('hubWorkspace').hidden=false;el('hubError').textContent='';render();};
 const save=()=>{try{sessionStorage.setItem(storageKey,JSON.stringify({token,expires}));}catch{}};
 el('hubLoginForm').onsubmit=async event=>{
  event.preventDefault();el('hubSubmit').disabled=true;el('hubError').textContent='로그인 확인 중입니다.';
  let password=el('hubPassword').value;el('hubPassword').value='';
  try{
   const result=await request('login',{username:el('hubId').value,password});password='';
   token=result.token;expires=result.expires;
   const tools=await request('state',{token});save();show(tools);
  }catch(e){password='';if(token)request('logout',{token}).catch(()=>{});lock(e.message);}
  finally{el('hubSubmit').disabled=false;}
 };
 el('hubLogout').onclick=()=>{const old=token;lock('로그아웃했습니다.');if(old)request('logout',{token:old}).catch(()=>{});};
 frame=document.createElement('iframe');frame.className='auth-frame';frame.title='로그인 검증';frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
 frame.referrerPolicy='no-referrer';frame.src=app+'?view=auth&nonce='+nonce;document.body.appendChild(frame);
 const startup=setTimeout(()=>{if(!peer)readyReject(Error('인증 서버를 연결할 수 없습니다. 새로고침 후 다시 시도하세요.'));},45000);
 ready.finally(()=>clearTimeout(startup)).catch(()=>{});
 (async()=>{let saved;try{saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');}catch{}
  if(!saved?.token||saved.expires<=Date.now())return;
  token=saved.token;expires=saved.expires;el('hubError').textContent='로그인 상태를 확인 중입니다.';
  try{show(await request('state',{token}));}catch(e){lock(e.message);}
 })();
 setInterval(()=>{if(token&&Date.now()>=expires)lock('로그인이 만료됐습니다. 다시 로그인하세요.');},15000);
 window.addEventListener('pageshow',()=>{if(token&&Date.now()>=expires)lock('로그인이 만료됐습니다. 다시 로그인하세요.');});
});
})();

