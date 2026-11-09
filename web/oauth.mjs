const $=id=>document.getElementById(id);
export let currentSession=null;
let challenge=false;
export async function request(path,{body,method=body?'POST':'GET',headers={}}={}){
  const response=await fetch(path,{method,credentials:'same-origin',headers:{...(body&&typeof body!=='string'?{'Content-Type':'application/json'}:{}),...headers},body:body?(typeof body==='string'?body:JSON.stringify(body)):undefined});
  const data=await response.json();if(!response.ok)throw new Error(data.error?.message??data.error_description??'Please try again.');return data;
}
export async function refreshSession(){
  try{currentSession=await request('/api/session');}catch{currentSession=null;}
  $('oauth-login').hidden=Boolean(currentSession);$('oauth-consent').hidden=!currentSession;
  if(currentSession){$('oauth-user-email').textContent=currentSession.user.email;$('oauth-user-id').value=currentSession.user.id;}
  window.dispatchEvent(new Event('aihackr-oauth-session'));return currentSession;
}
function showError(error){$('oauth-error').textContent=error.message;}
function resetLogin(){challenge=false;$('oauth-email').disabled=false;$('oauth-code').value='';$('oauth-code').required=false;$('oauth-code-step').hidden=true;$('oauth-change-email').hidden=true;$('oauth-login-submit').textContent='Continue with email →';}
$('oauth-change-email').onclick=resetLogin;
$('oauth-login-form').onsubmit=async event=>{
  event.preventDefault();$('oauth-login-submit').disabled=true;$('oauth-error').textContent='';
  try{if(!challenge){await request('/auth/start',{body:{email:$('oauth-email').value.trim()}});challenge=true;$('oauth-email').disabled=true;$('oauth-code-step').hidden=false;$('oauth-code').required=true;$('oauth-change-email').hidden=false;$('oauth-login-submit').textContent='Verify and continue →';$('oauth-code').focus();}
    else{await request('/auth/verify',{body:{code:$('oauth-code').value.trim()}});resetLogin();await refreshSession();}
  }catch(error){showError(error);}finally{$('oauth-login-submit').disabled=false;}
};
$('oauth-switch-account').onclick=async()=>{try{await request('/auth/logout',{body:{}});await refreshSession();}catch(error){showError(error);}};
async function submitConsent(decision){
  if(!['approve','deny'].includes(decision))return;
  $('oauth-allow').disabled=true;$('oauth-deny').disabled=true;$('oauth-error').textContent='';
  try{const form=new FormData($('oauth-consent-form'));form.set('decision',decision);const data=await request('/oauth/authorize',{body:new URLSearchParams(form).toString(),headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'}});location.assign(data.redirectTo);}
  catch(error){showError(error);$('oauth-allow').disabled=false;$('oauth-deny').disabled=false;}
}
if($('oauth-consent-form'))$('oauth-consent-form').onsubmit=event=>{event.preventDefault();submitConsent(event.submitter?.value);};
if($('oauth-cancel-unauthed'))$('oauth-cancel-unauthed').onclick=()=>submitConsent('deny');
window.addEventListener('pageshow',event=>{if(event.persisted)refreshSession();});
await refreshSession();
