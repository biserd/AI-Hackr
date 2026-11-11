const $=id=>document.getElementById(id);
export const account={session:null};
let challenge=false;
sessionStorage.removeItem('aihackr-native-key');
export function openSignIn(mode='signup'){
  if(account.session){location.assign('/dashboard');return;}
  $('auth-title').textContent=mode==='signin'?'Welcome back.':'Create your account.';
  $('auth-note').textContent=mode==='signin'?'Sign in with a code sent to your email. No password needed.':'Start with 1,200 free credits each month. Sign in securely with a code sent to your email. No password needed.';
  $('connect-error').textContent='';$('connect-dialog').showModal();$(challenge?'sign-in-code':'email').focus();
}
export async function call(path,body,method=body?'POST':'GET'){
  const r=await fetch(path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await r.json();
  if(!r.ok)throw new Error(data.error?.message??'Please try again.');return data;
}
export async function refreshAccount(notify=true){
  const previous=account.session?.user?.email;
  try{account.session=await call('/api/session');}catch{account.session=null;}
  const session=account.session;if($('account-summary'))$('account-summary').hidden=!session;
  if($('get-started'))$('get-started').textContent=session?'Open dashboard →':'Start free →';
  const empty=document.querySelector('.empty-result p');if(empty)empty.textContent=session?'Enter a public URL and run your first request.':'Create your account and run a request. Real responses come from Cloudflare Browser Run.';
  $('sign-in').hidden=Boolean(session);$('connect-top').textContent=session?'Your dashboard →':'Get started →';
  if($('workspace-label'))$('workspace-label').textContent=session?'Your private workspace':'Sign in to run your first request';
  if(session){$('account-email').textContent=session.user.email??'Operator account';const u=session.usage;$('account-usage').textContent=u.available!=null?`${u.available.toLocaleString()} credits available · ${u.held.toLocaleString()} held for running jobs`:`${u.dailyReserved} of ${u.dailyLimit} pages reserved today`;}
  if(notify||previous!==session?.user?.email)window.dispatchEvent(new Event('aihackr-account'));
  return session;
}
$('sign-in').onclick=()=>openSignIn('signin');if($('get-started'))$('get-started').onclick=()=>openSignIn();$('connect-top').onclick=()=>openSignIn();
$('close-connect').onclick=()=>$('connect-dialog').close();
function resetEmail(){challenge=false;$('email').disabled=false;$('code-step').hidden=true;$('sign-in-code').required=false;$('sign-in-code').value='';$('auth-submit').textContent='Continue with email →';$('change-email').hidden=true;$('connect-error').textContent='';$('email').focus();}
$('change-email').onclick=resetEmail;
$('connect-form').onsubmit=async event=>{
  event.preventDefault();$('auth-submit').disabled=true;$('connect-error').textContent='';
  try{
    if(!challenge){await call('/auth/start',{email:$('email').value.trim()});challenge=true;$('email').disabled=true;$('code-step').hidden=false;$('sign-in-code').required=true;$('change-email').hidden=false;$('auth-submit').textContent='Verify and continue →';$('sign-in-code').focus();}
    else{await call('/auth/verify',{code:$('sign-in-code').value.trim()});$('connect-dialog').close();resetEmail();await refreshAccount();$('workspace')?.scrollIntoView({behavior:'smooth'});}
  }catch(error){$('connect-error').textContent=error.message;}
  finally{$('auth-submit').disabled=false;}
};
$('sign-out').onclick=async()=>{try{await call('/auth/logout',{});await refreshAccount();}catch(error){$('account-usage').textContent=error.message;}};
function clearNewKey(){$('new-key').value='';$('created-key').hidden=true;}
async function renderKeys(){
  const {keys}=await call('/api/keys');$('key-list').replaceChildren();
  if(!keys.length){const p=document.createElement('p');p.textContent='No API keys yet. Create one when you connect an application.';$('key-list').append(p);}
  for(const key of keys){const row=document.createElement('div');row.className='key-row';const label=document.createElement('span');label.textContent=`${key.name} · …${key.suffix}`;const button=document.createElement('button');button.className='text-link';button.textContent='Revoke';button.onclick=async()=>{button.disabled=true;try{await call('/api/keys/'+key.id,undefined,'DELETE');clearNewKey();await renderKeys();}catch(error){$('key-error').textContent=error.message;button.disabled=false;}};row.append(label,button);$('key-list').append(row);}
}
$('manage-keys').onclick=async()=>{clearNewKey();$('key-error').textContent='';$('keys-dialog').showModal();try{await renderKeys();}catch(error){$('key-error').textContent=error.message;}};
$('close-keys').onclick=()=>$('keys-dialog').close();$('keys-dialog').addEventListener('close',clearNewKey);
$('create-key-form').onsubmit=async event=>{event.preventDefault();$('create-key').disabled=true;$('key-error').textContent='';try{const result=await call('/api/keys',{name:$('key-name').value.trim()});$('new-key').value=result.key;$('created-key').hidden=false;$('key-name').value='';$('copy-key').textContent='Copy key';await renderKeys();}catch(error){$('key-error').textContent=error.message;}finally{$('create-key').disabled=false;}};
$('copy-key').onclick=async()=>{try{await navigator.clipboard.writeText($('new-key').value);$('copy-key').textContent='Copied';}catch{$('new-key').select();$('key-error').textContent='Select and copy the key above.';}};
await refreshAccount(false);
