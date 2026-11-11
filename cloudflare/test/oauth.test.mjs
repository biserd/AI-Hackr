import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {AccountService,digest,SESSION_COOKIE,authenticate,rpcResult} from '../accounts.mjs';
import {OAuthStorage} from '../oauth-storage.mjs';
import {Storage} from './storage.mjs';
import {hasToolScope,resourceMetadata,accountProfile} from '../oauth-config.mjs';
registerHooks({resolve(specifier,context,next){return specifier==='cloudflare:workers'?{url:'data:text/javascript,export class WorkerEntrypoint {}',shortCircuit:true}:next(specifier,context);}});
globalThis.Cloudflare={compatibilityFlags:{global_fetch_strictly_public:true}};
const {OAuthService}=await import('../oauth-service.mjs');
const issuer='https://aihackr.com',resource=issuer+'/mcp',redirect='https://client.example/callback';
const verifier='test-only-pkce-verifier-with-at-least-43-characters-123456789';
const challenge=async()=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))).toString('base64url');
const scopes='account:read web:read crawl:read crawl:write offline_access';
async function setup(){
  const storage=new Storage(),accounts=new AccountService(storage,{send:async()=>{}}),session='test-only-session-token-with-at-least-32-characters';
  await storage.put('user:customer-a',{id:'customer-a',email:'customer@example.com',trialLimit:20,trialReserved:3});await storage.put('user:customer-b',{id:'customer-b',email:'other@example.com',trialLimit:20,trialReserved:0});await storage.put('session:'+await digest(session),{userId:'customer-a',expiresAt:Date.now()+86400000});
  const oauth=new OAuthService(storage,accounts,{OAUTH_ISSUER:issuer});
  const request=(path,{body,method=body?'POST':'GET',cookie='',origin=issuer,contentType='application/x-www-form-urlencoded'}={})=>new Request(issuer+path,{method,headers:{...(body?{'Content-Type':contentType}:{}),Origin:origin,'cf-connecting-ip':'203.0.113.1',Cookie:cookie,Accept:'application/json'},body:body?typeof body==='string'?body:JSON.stringify(body):undefined});
  const registration=await oauth.handle(request('/oauth/register',{body:{client_name:'Test MCP client',redirect_uris:[redirect],token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code']},contentType:'application/json'}));assert.equal(registration.status,201,await registration.clone().text());const client=await registration.json();
  const start=async(extra={})=>{const params=new URLSearchParams({client_id:client.client_id,response_type:'code',redirect_uri:redirect,scope:scopes,state:'random-client-state-1234',code_challenge:await challenge(),code_challenge_method:'S256',resource,...extra});return oauth.handle(request('/oauth/authorize?'+params));};
  const begin=async()=>{const page=await start();assert.equal(page.status,200,await page.clone().text());const html=await page.text(),handle=html.match(/name="handle" value="([^"]+)"/)[1],cookies=page.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');return {handle,cookies:SESSION_COOKIE+'='+session+'; '+cookies,html};};
  const approve=async(pending,extra={})=>{const form=new URLSearchParams({handle:pending.handle,userId:'customer-a',decision:'approve',...extra});for(const scope of scopes.split(' '))form.append('scope',scope);return oauth.handle(request('/oauth/authorize',{body:form.toString(),cookie:pending.cookies}));};
  const exchange=body=>oauth.handle(request('/oauth/token',{body:new URLSearchParams({client_id:client.client_id,resource,...body}).toString()}));
  const issue=async()=>{const pending=await begin(),approved=await approve(pending);assert.equal(approved.status,200,await approved.clone().text());const callback=new URL((await approved.json()).redirectTo);assert.equal(callback.searchParams.get('state'),'random-client-state-1234');assert.equal(callback.searchParams.get('iss'),issuer);const code=callback.searchParams.get('code'),response=await exchange({grant_type:'authorization_code',code,redirect_uri:redirect,code_verifier:verifier});assert.equal(response.status,200,await response.clone().text());return {code,tokens:await response.json()};};
  return {storage,accounts,oauth,client,session,request,start,begin,approve,exchange,issue};
}
test('official provider completes S256 consent, issues audience-bound tokens, and stores no raw credentials',async()=>{
  const s=await setup(),{tokens}=await s.issue();assert.equal(tokens.expires_in,900);assert(tokens.refresh_token);const identity=await s.oauth.validate(tokens.access_token,resource);assert.equal(identity.id,'customer-a');assert.equal(identity.email,'customer@example.com');assert(identity.scopes.includes('web:read'));assert.equal(await s.oauth.validate(tokens.access_token,'https://other.example/mcp'),null);
  const stored=JSON.stringify([...s.storage.data]);assert(!stored.includes(tokens.access_token));assert(!stored.includes(tokens.refresh_token));assert(!stored.includes(verifier));
});
test('PKCE downgrade, resource substitution and code replay cannot produce usable extra tokens',async()=>{
  const s=await setup();assert.equal((await s.start({code_challenge_method:'plain'})).status,400);assert.equal((await s.start({resource:'https://other.example/mcp'})).status,400);
  const {code}=await s.issue(),replayed=await s.exchange({grant_type:'authorization_code',code,redirect_uri:redirect,code_verifier:verifier});assert.equal(replayed.status,400);
  const pending=await s.begin(),approved=await s.approve(pending),nextCode=new URL((await approved.json()).redirectTo).searchParams.get('code');assert.equal((await s.exchange({grant_type:'authorization_code',code:nextCode,redirect_uri:redirect,code_verifier:'x'.repeat(50)})).status,400);
});
test('consent requires its browser cookie, same origin and the displayed account; denial echoes state and issuer',async()=>{
  const s=await setup(),pending=await s.begin();assert.equal((await s.approve({...pending,cookies:SESSION_COOKIE+'='+s.session})).status,400);assert.equal((await s.approve(pending,{userId:'customer-b'})).status,409);
  const forged=s.request('/oauth/authorize',{body:new URLSearchParams({handle:pending.handle,userId:'customer-a',decision:'approve',scope:'web:read'}).toString(),cookie:pending.cookies,origin:'https://attacker.example'});assert.equal((await s.oauth.handle(forged)).status,403);
  const denied=await s.approve(pending,{decision:'deny'});assert.equal(denied.status,200);const url=new URL((await denied.json()).redirectTo);assert.equal(url.searchParams.get('error'),'access_denied');assert.equal(url.searchParams.get('state'),'random-client-state-1234');assert.equal(url.searchParams.get('iss'),issuer);
});
test('refresh rotation and disconnect preserve ownership and immediately reject revoked access',async()=>{
  const s=await setup(),{tokens}=await s.issue(),refreshed=await s.exchange({grant_type:'refresh_token',refresh_token:tokens.refresh_token});assert.equal(refreshed.status,200,await refreshed.clone().text());const next=await refreshed.json();assert.notEqual(next.refresh_token,tokens.refresh_token);assert(await s.oauth.validate(next.access_token,resource));
  const cookie=SESSION_COOKIE+'='+s.session,connections=await s.oauth.handle(s.request('/oauth/connections',{cookie})),{items}=await connections.json();assert.equal(items.length,1);assert.equal(items[0].name,'Test MCP client');const removed=await s.oauth.handle(s.request('/oauth/connections/'+items[0].id,{method:'DELETE',cookie}));assert.equal(removed.status,200,await removed.clone().text());assert.equal(await s.oauth.validate(tokens.access_token,resource),null);assert.equal(await s.oauth.validate(next.access_token,resource),null);assert.equal((await s.exchange({grant_type:'refresh_token',refresh_token:next.refresh_token})).status,400);
});
test('OAuth credentials cannot manage website sessions, API keys, billing or REST resources',async()=>{
  const s=await setup(),{tokens}=await s.issue(),env={OAUTH_ISSUER:issuer,ACCOUNT_DIRECTORY:{getByName:()=>({oauthValidate:(...args)=>rpcResult(()=>s.oauth.validate(...args))})}};
  assert.equal((await authenticate(new Request(resource,{headers:{Authorization:'Bearer '+tokens.access_token}}),env)).kind,'oauth');for(const path of ['/api/session','/api/keys','/v2/scrape','/api/billing/checkout'])await assert.rejects(()=>authenticate(new Request(issuer+path,{headers:{Authorization:'Bearer '+tokens.access_token}}),env),{code:'AUTH_REQUIRED'});
  assert.equal((await authenticate(new Request(resource,{headers:{Authorization:'Bearer '+tokens.access_token,Origin:'https://client.example'}}),env)).kind,'oauth');await assert.rejects(()=>authenticate(new Request(resource,{headers:{Authorization:'Bearer '+tokens.access_token,Origin:'https://attacker.example'}}),env),{code:'ORIGIN_RESTRICTED'});
});
test('unsupported metadata clients and unregistered redirects are rejected before consent',async()=>{
  const s=await setup();assert.equal((await s.start({client_id:'https://127.0.0.1/private.json'})).status,400);assert.equal((await s.start({redirect_uri:'https://attacker.example/callback'})).status,400);assert.equal((await s.start({scope:'billing:write'})).status,400);
});
test('OAuth storage expires values, preserves metadata and paginates without leaving its prefix',async()=>{
  const storage=new Storage();let now=Date.now();const kv=new OAuthStorage(storage,{now:()=>now});for(const key of ['a','b','c'])await kv.put('p:'+key,JSON.stringify({key}),{expirationTtl:60,metadata:{app:key}});const first=await kv.list({prefix:'p:',limit:2});assert.equal(first.keys.length,2);assert.equal(first.keys[0].metadata.app,'a');assert.equal(first.list_complete,false);assert.equal((await kv.list({prefix:'p:',limit:2,cursor:first.cursor})).keys[0].name,'p:c');await assert.rejects(()=>kv.list({prefix:'foreign:',cursor:first.cursor}));now+=61000;assert.equal(await kv.get('p:a','json'),null);await kv.cleanup();assert.equal((await kv.list({prefix:'p:'})).keys.length,0);
});
test('each MCP operation enforces its scope and offline access is never a resource requirement',()=>{
  const reader={kind:'oauth',scopes:['web:read']};for(const name of ['get_url_html_content','get_url_markdown','get_url_json','get_url_links','scrape_url_elements'])assert(hasToolScope(reader,name));for(const name of ['get_account','start_crawl','get_crawl_result','cancel_crawl','unknown_tool'])assert.equal(hasToolScope(reader,name),false);assert(hasToolScope({kind:'key'},'get_url_json'));assert(!resourceMetadata({OAUTH_ISSUER:issuer}).scopes_supported.includes('offline_access'));
});
test('discovery advertises real PKCE/CIMD endpoints; ChatGPT public metadata supports authorization',async t=>{
  const original=globalThis.fetch; t.mock.method(globalThis,'fetch',async(input,init)=>{const url=String(input instanceof Request?input.url:input);if(url==='https://chatgpt.com/oauth/client.json')return Response.json({client_id:url,client_name:'ChatGPT',redirect_uris:['https://chatgpt.com/connector_platform_oauth_redirect'],token_endpoint_auth_method:'private_key_jwt',token_endpoint_auth_methods_supported:['none','private_key_jwt'],grant_types:['authorization_code','refresh_token'],response_types:['code']});throw new Error('Unexpected network request in test');});
  const s=await setup(),response=await s.oauth.handle(s.request('/.well-known/oauth-authorization-server')),metadata=await response.json();assert.equal(metadata.issuer,issuer);assert.equal(metadata.authorization_endpoint,issuer+'/oauth/authorize');assert.equal(metadata.client_id_metadata_document_supported,true);assert.deepEqual(metadata.code_challenge_methods_supported,['S256']);assert.equal(metadata.authorization_response_iss_parameter_supported,true);assert.equal((await s.start({client_id:'https://chatgpt.com/oauth/client.json',redirect_uri:'https://chatgpt.com/connector_platform_oauth_redirect'})).status,200);assert.equal((await s.oauth.handle(s.request('/oauth/token',{method:'OPTIONS'}))).status,204);
});
test('access tokens expire and refresh is omitted without an explicit offline permission',async t=>{
  const s=await setup(),page=await s.start({scope:'web:read'});assert.equal(page.status,200);const html=await page.text(),handle=html.match(/name="handle" value="([^"]+)"/)[1],cookies=SESSION_COOKIE+'='+s.session+'; '+page.headers.getSetCookie().map(c=>c.split(';')[0]).join('; '),form=new URLSearchParams({handle,userId:'customer-a',decision:'approve',scope:'web:read'});const approved=await s.oauth.handle(s.request('/oauth/authorize',{body:form.toString(),cookie:cookies})),code=new URL((await approved.json()).redirectTo).searchParams.get('code'),response=await s.exchange({grant_type:'authorization_code',code,redirect_uri:redirect,code_verifier:verifier}),tokens=await response.json();assert.equal(response.status,200);assert.equal(tokens.refresh_token,undefined);assert(await s.oauth.validate(tokens.access_token,resource));const now=Date.now();t.mock.method(Date,'now',()=>now+901000);assert.equal(await s.oauth.validate(tokens.access_token,resource),null);
});
test('concurrent code exchanges cannot both succeed and other users cannot revoke a connection',async()=>{
  const s=await setup(),pending=await s.begin(),approval=await s.approve(pending),code=new URL((await approval.json()).redirectTo).searchParams.get('code'),params={grant_type:'authorization_code',code,redirect_uri:redirect,code_verifier:verifier};const responses=await Promise.all([s.exchange(params),s.exchange(params)]);assert.equal(responses.filter(r=>r.status===200).length,1);
  const fresh=await s.issue();await s.storage.put('session:'+await digest('test-other-session-with-at-least-32-characters'),{userId:'customer-b',expiresAt:Date.now()+100000});const list=await s.oauth.handle(s.request('/oauth/connections',{cookie:SESSION_COOKIE+'='+s.session})),id=(await list.json()).items[0].id;const forbidden=await s.oauth.handle(s.request('/oauth/connections/'+id,{method:'DELETE',cookie:SESSION_COOKIE+'=test-other-session-with-at-least-32-characters'}));assert.equal(forbidden.status,404);assert(await s.oauth.validate(fresh.tokens.access_token,resource));
});
test('denial does not require signing in and never grants access',async()=>{
  const s=await setup(),pending=await s.begin(),cookies=pending.cookies.split('; ').filter(c=>!c.startsWith(SESSION_COOKIE+'=')).join('; '),response=await s.approve({...pending,cookies},{decision:'deny',userId:''});assert.equal(response.status,200);assert.equal(new URL((await response.json()).redirectTo).searchParams.get('error'),'access_denied');assert.equal((await s.oauth.api.listUserGrants('customer-a')).items.length,0);
});
test('profile identity is stable, scoped to the authenticated account and contains only profile fields',async()=>{
  const storage=new Storage();assert.deepEqual(await accountProfile({id:'opaque-customer-id',email:'customer@example.com'},storage),{id:'opaque-customer-id',email:'customer@example.com'});const first=await accountProfile({operator:true},storage),second=await accountProfile({operator:true},storage);assert.equal(first.id,second.id);assert.match(first.id,/^[a-f0-9-]{36}$/);await assert.rejects(()=>accountProfile(null,storage));
});
