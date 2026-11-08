import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountService,authenticate,authRoute,digest,rpcResult,SESSION_COOKIE,SESSION_TTL} from '../accounts.mjs';
import {customerGateway} from '../customer-gateway.mjs';
import {BrowserService} from '../browser-service.mjs';
import {routeGateway} from '../gateway.mjs';

class Storage{
  data=new Map();queue=Promise.resolve();
  async get(key){return structuredClone(this.data.get(key));}
  async put(key,value){if(typeof key==='object'){for(const[k,v]of Object.entries(key))this.data.set(k,structuredClone(v));}else this.data.set(key,structuredClone(value));}
  async delete(key){this.data.delete(key);}
  async list({prefix,startAfter='',limit=1000}){return new Map([...this.data].filter(([k])=>k.startsWith(prefix)&&k>startAfter).sort(([a],[b])=>a.localeCompare(b)).slice(0,limit).map(([k,v])=>[k,structuredClone(v)]));}
  async setAlarm(){}
  transaction(action){const run=this.queue.then(async()=>{const before=structuredClone(this.data);try{return await action(this);}catch(error){this.data=before;throw error;}});this.queue=run.catch(()=>{});return run;}
}
function setup(){let now=Date.now();const messages=[],storage=new Storage();const service=new AccountService(storage,{send:async message=>messages.push(message),now:()=>now});const binding=new Proxy({},{get:(_,method)=>(...args)=>rpcResult(()=>service[method](...args))});return {service,storage,messages,advance:ms=>now+=ms,env:{ACCOUNT_DIRECTORY:{getByName:()=>binding}}};}
const code=messages=>messages.at(-1).text.match(/code is (\d{8})/)[1];
async function signIn(s,email='customer@example.com',ip='203.0.113.1'){const challenge=await s.service.start(email,ip);return s.service.verify(challenge,code(s.messages));}

test('email verification creates an isolated account, hashes secrets and rejects code replay',async()=>{
  const s=setup(),challenge=await s.service.start('CUSTOMER@example.com','203.0.113.1');
  assert.equal(JSON.stringify([...s.storage.data]).includes(code(s.messages)),false);
  const result=await s.service.verify(challenge,code(s.messages));assert.equal(result.user.email,'customer@example.com');
  assert.equal((await s.service.authenticate(result.session)).id,result.user.id);
  assert.equal(JSON.stringify([...s.storage.data]).includes(result.session),false);
  await assert.rejects(()=>s.service.verify(challenge,code(s.messages)),{code:'INVALID_CODE'});
});
test('wrong codes lock after five attempts; expired codes cannot create accounts',async()=>{
  const s=setup(),challenge=await s.service.start('customer@example.com','203.0.113.1'),correct=code(s.messages),wrong=correct==='00000000'?'11111111':'00000000';
  for(let i=0;i<5;i++)await assert.rejects(()=>s.service.verify(challenge,wrong),{code:'INVALID_CODE'});
  await assert.rejects(()=>s.service.verify(challenge,correct),{code:'INVALID_CODE'});
  s.advance(60001);const next=await s.service.start('customer@example.com','203.0.113.1');s.advance(600001);await assert.rejects(()=>s.service.verify(next,code(s.messages)),{code:'INVALID_CODE'});
  assert.equal((await s.storage.list({prefix:'user:'})).size,0);
});
test('sessions expire and sign out revokes the server-side session',async()=>{
  const s=setup(),first=await signIn(s);await s.service.logout(first.session);assert.equal(await s.service.authenticate(first.session),null);
  s.advance(60001);const second=await signIn(s);assert.equal(second.user.id,first.user.id);s.advance(SESSION_TTL+1);assert.equal(await s.service.authenticate(second.session),null);
});
test('customer API keys are shown once, owned by their account, revocable and bounded',async()=>{
  const s=setup(),a=await signIn(s),b=await signIn(s,'another@example.com','203.0.113.2');
  const key=await s.service.createKey(a.user.id,'My application');assert.equal((await s.service.authenticate(key.key,'key')).id,a.user.id);
  const list=await s.service.keys(a.user.id);assert.equal(list.length,1);assert.equal(JSON.stringify(list).includes(key.key),false);assert.equal('hash' in list[0],false);assert.deepEqual(await s.service.keys(b.user.id),[]);
  await assert.rejects(()=>s.service.revokeKey(b.user.id,key.id),{code:'NOT_FOUND'});await s.service.revokeKey(a.user.id,key.id);assert.equal(await s.service.authenticate(key.key,'key'),null);
  for(let i=0;i<5;i++)await s.service.createKey(a.user.id,'Key '+i);await assert.rejects(()=>s.service.createKey(a.user.id,'Overflow'),{code:'LIMIT_EXCEEDED'});
});
test('global provider budgets span customers independently of refundable credit holds',async()=>{
  const s=setup(),a=await signIn(s),b=await signIn(s,'another@example.com','203.0.113.2');
  s.service.globalLimit=25;await s.service.reserve(15,a.user.id);await s.service.reserve(10,b.user.id);
  await assert.rejects(()=>s.service.reserve(1,a.user.id),{code:'DAILY_LIMIT'});
  s.advance(86400001);await s.service.reserve(5,a.user.id);await s.service.creditReserve(a.user.id,'request-a',20);await assert.rejects(()=>s.service.creditReserve(a.user.id,'request-b',1),{code:'CREDITS_EXHAUSTED'});
  const key=await s.service.createKey(a.user.id,'New key');assert.equal((await s.service.authenticate(key.key,'key')).id,a.user.id);
  assert.equal((await s.service.creditSummary(a.user.id)).held,20);assert.equal((await s.service.creditSummary(b.user.id)).available,20);
});
test('parallel reservations cannot exceed a customer allowance',async()=>{
  const s=setup(),a=await signIn(s);const results=await Promise.allSettled([s.service.creditReserve(a.user.id,'a',15),s.service.creditReserve(a.user.id,'b',15)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await s.service.creditSummary(a.user.id)).held,15);
});
test('cookie mutations require same-origin; API keys work without browser cookies',async()=>{
  const s=setup(),a=await signIn(s);const headers={cookie:SESSION_COOKIE+'='+a.session,'content-type':'application/json'};
  const req=(method,extra={})=>new Request('https://aihackr.com/v2/scrape',{method,headers:{...headers,...extra}});
  await assert.rejects(()=>authenticate(req('POST'),s.env),{code:'ORIGIN_RESTRICTED'});
  await assert.rejects(()=>authenticate(req('POST',{origin:'https://attacker.example'}),s.env),{code:'ORIGIN_RESTRICTED'});
  assert.equal((await authenticate(req('POST',{origin:'https://aihackr.com'}),s.env)).id,a.user.id);
  const key=await s.service.createKey(a.user.id,'API');assert.equal((await authenticate(new Request('https://aihackr.com/v2/scrape',{method:'POST',headers:{authorization:'Bearer '+key.key}}),s.env)).id,a.user.id);
  const logout=await authRoute(new Request('https://aihackr.com/auth/logout',{method:'POST',headers:{...headers,origin:'https://aihackr.com'}}),s.env);assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/HttpOnly; SameSite=Strict; Max-Age=0/);
});
test('auth attempts are throttled and mail failure never produces a usable challenge',async()=>{
  const s=setup();await s.service.start('customer@example.com','203.0.113.1');await assert.rejects(()=>s.service.start('customer@example.com','203.0.113.1'),{code:'RATE_LIMITED'});assert.equal(s.messages.length,1);
  s.service.send=async()=>{throw Error('Delivery failed');};await assert.rejects(()=>s.service.start('another@example.com','203.0.113.2'),{code:'EMAIL_UNAVAILABLE'});
  assert.equal((await s.storage.list({prefix:'challenge:'})).size,1);
});
test('real customer routing isolates jobs while session and API key share the same workspace',async()=>{
  const s=setup(),a=await signIn(s),b=await signIn(s,'another@example.com','203.0.113.2'),workspaces=new Map();
  const env={...s.env,CLOUDFLARE_BROWSER_TOKEN:'provider-secret',CLOUDFLARE_ACCOUNT_ID:'test-account',BROWSER_WORKSPACE:{getByName(name){
    if(!workspaces.has(name)){const storage=new Storage(),service=new BrowserService({...s.env,CLOUDFLARE_BROWSER_TOKEN:'provider-secret',CLOUDFLARE_ACCOUNT_ID:'test-account',DAILY_PAGE_LIMIT:'20'},{...storage,get:storage.get.bind(storage),delete:storage.delete.bind(storage),put:storage.put.bind(storage),list:storage.list.bind(storage),transaction:storage.transaction.bind(storage),setAlarm:storage.setAlarm.bind(storage)},{validateUrl:async raw=>new URL(raw),fetcher:async(url,init)=>Response.json({success:true,result:init.method==='POST'?'provider-job-1234567890':{status:'completed',total:1,finished:1,records:[{url:'https://example.com',markdown:'# Private customer result'}]}})});
      workspaces.set(name,{profile:async()=>({}),run:async(request,identity)=>{service.env.CUSTOMER_ID=identity.id;return routeGateway(request,env,service,{authenticated:true});}});}
    return workspaces.get(name);
  }}};
  const req=(path,session,body)=>new Request('https://aihackr.com'+path,{method:body?'POST':'GET',headers:{cookie:SESSION_COOKIE+'='+session,origin:'https://aihackr.com','content-type':'application/json'},body:body?JSON.stringify(body):undefined});
  const created=await (await customerGateway(req('/v2/crawl',a.session,{url:'https://example.com',limit:1}),env)).json();assert(created.id);
  const key=await (await customerGateway(req('/api/keys',a.session,{name:'Test application'}),env)).json();
  const bearerRequest=path=>new Request('https://aihackr.com'+path,{headers:{authorization:'Bearer '+key.key}});
  const own=await customerGateway(bearerRequest('/v2/crawl/'+created.id),env);assert.equal(own.status,200);assert.equal((await own.json()).data[0].markdown,'# Private customer result');
  assert.equal((await customerGateway(req('/v2/crawl/'+created.id,b.session),env)).status,404);
  await assert.rejects(()=>customerGateway(bearerRequest('/api/keys'),env),{status:403});
  const usage=await (await customerGateway(req('/api/session',a.session),env)).json();assert.equal(usage.usage.used,1);assert.equal(usage.usage.available,19);
  assert.equal(workspaces.size,2);
});
