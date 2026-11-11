/* GitHub-hosted workspace; authentication stays on Apps Script. */
(()=>{
'use strict';
const app='https://script.google.com/macros/s/AKfycbx-Q3g0ev2g4mJhYpI_ttSn_zwuywMl9lW1zYtH8a05VGALtx7BtKKbY8gaW5bTbnkE/exec';
const storageKey='fnb-hub-session-v1',requestTimeout=25000;
let token='',expires=0,adminToken='',generation=0;
const el=id=>document.getElementById(id);
function help(message){if(message&&el('hubError'))el('hubError').textContent=message;}
async function request(action,body={}){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),requestTimeout);
 try{
  const response=await fetch(app,{
   method:'POST',mode:'cors',credentials:'omit',redirect:'follow',cache:'no-store',
   headers:{'Content-Type':'text/plain;charset=UTF-8'},
   body:JSON.stringify({channel:'fnb-auth-api-v1',action,...body}),signal:controller.signal
  });
  if(!response.ok)throw Error('인증 서버 응답 오류 ('+response.status+')');
  const result=await response.json();
  if(!result||typeof result.ok!=='boolean')throw Error('인증 응답을 확인할 수 없습니다.');
  if(!result.ok)throw Error(result.error||'요청 실패');
  return result.value;
 }catch(error){
  if(controller.signal.aborted)throw Error('인증 응답이 지연됩니다. 로그인 버튼을 다시 눌러 주세요.');
  if(error instanceof TypeError)throw Error('인증 서버에 연결할 수 없습니다. 네트워크 연결을 확인한 뒤 다시 시도하세요.');
  throw error;
 }finally{clearTimeout(timer);}
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
