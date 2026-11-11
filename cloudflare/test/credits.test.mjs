import test from 'node:test';
import assert from 'node:assert/strict';
import {CreditLedger} from '../credits.mjs';
import {AccountService,rpcResult} from '../accounts.mjs';
import {BrowserService} from '../browser-service.mjs';
import {operationContext} from '../operations.mjs';
import {Storage} from './storage.mjs';
import {FREE_MONTHLY_CREDITS} from '../plans.mjs';

test('free credits reset at the UTC month boundary without duplicating grants or moving old holds',async()=>{
  const storage=new Storage();
  await storage.put('user:u',{id:'u',trialLimit:20,trialReserved:14});
  let now=Date.UTC(2026,10,30,23,59,59);
  const ledger=new CreditLedger(storage,()=>now,FREE_MONTHLY_CREDITS);
  const initial=await Promise.all([ledger.summary('u'),ledger.summary('u')]);
  for(const summary of initial)assert.equal(summary.available,1206);
  await ledger.reserve('u','old-month',5);
  now=Date.UTC(2026,11,1);
  const renewed=await ledger.summary('u');
  assert.equal(renewed.available,1206);
  assert.equal(renewed.held,5);
  assert.equal(renewed.freeRenewsAt,Date.UTC(2027,0,1));
  await ledger.settle('u','old-month',2);
  assert.equal((await ledger.summary('u')).available,1206);
  assert.equal((await ledger.entries('u')).items.filter(entry=>entry.type==='grant').length,2);
});

async function setup(){const storage=new Storage();let now=Date.now();await storage.put('user:u',{id:'u',trialLimit:20,trialReserved:0});const ledger=new CreditLedger(storage,()=>now);return {storage,ledger,advance:ms=>now+=ms};}
test('legacy trials retain spent usage; parallel holds never overdraw and settlement is replay safe',async()=>{
  const s=await setup();await s.storage.put('user:u',{id:'u',trialLimit:20,trialReserved:14});assert.equal((await s.ledger.summary('u')).available,6);
  const attempts=await Promise.allSettled([s.ledger.reserve('u','a',5),s.ledger.reserve('u','b',5)]);assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
  const id=attempts[0].status==='fulfilled'?'a':'b';await s.ledger.settle('u',id,2);await s.ledger.settle('u',id,5);
  const summary=await s.ledger.summary('u');assert.equal(summary.available,4);assert.equal(summary.held,0);assert.equal(summary.used,16);assert.equal((await s.ledger.daily('u')).at(-1).units,2);
});
test('expiry never converts an old reservation into new-period spending or rollover',async()=>{
  const s=await setup();await s.ledger.grant('u',{id:'in_1',invoice:'in_1',total:1000,expiresAt:Date.now()+1000});await s.ledger.reserve('u','old',100);
  s.advance(2000);await s.ledger.grant('u',{id:'in_2',invoice:'in_2',total:1000,expiresAt:Date.now()+86400000});await s.ledger.settle('u','old',3);
  const summary=await s.ledger.summary('u');assert.equal(summary.available,1020);assert.equal(summary.held,0);assert.equal(summary.used,0);
  assert.equal((await s.ledger.grant('u',{id:'in_2',total:1000,expiresAt:Date.now()+86400000})).duplicate,true);
  s.advance(400*86400000);await s.ledger.grant('u',{id:'in_3',total:1000,expiresAt:Date.now()+500*86400000});assert.equal((await s.ledger.grant('u',{id:'in_1',total:1000,expiresAt:Date.now()+500*86400000})).duplicate,true);
});
test('refund and risk holds revoke unused invoice credits and block all new admissions',async()=>{
  const s=await setup();await s.ledger.grant('u',{id:'in_paid',invoice:'in_paid',total:1000,expiresAt:Date.now()+86400000});await s.ledger.risk('u','in_paid','Payment refunded');assert.equal((await s.ledger.summary('u')).available,0);await assert.rejects(()=>s.ledger.reserve('u','risky',1),{code:'BILLING_REVIEW'});
});
test('a prepaid future period stays unavailable until its service period begins',async()=>{
  const s=await setup(),now=Date.now();await s.ledger.grant('u',{id:'future',total:1000,startsAt:now+86400000,expiresAt:now+31*86400000});assert.equal((await s.ledger.summary('u')).available,20);s.advance(86400001);assert.equal((await s.ledger.summary('u')).available,1020);
});
test('ledger pagination and daily totals include all settled requests, independently of visible entries',async()=>{
  const s=await setup();for(let i=0;i<60;i++){await s.ledger.reserve('u','op'+i,1);await s.ledger.settle('u','op'+i,0);}const first=await s.ledger.entries('u');assert.equal(first.items.length,50);const second=await s.ledger.entries('u',first.next);assert.equal(new Set([...first.items,...second.items].map(e=>e.id)).size,100);assert.equal((await s.ledger.summary('u')).available,20);
});
async function browserSetup(){
  const s=await setup(),accounts=new AccountService(s.storage),binding=new Proxy({},{get:(_,method)=>(...args)=>rpcResult(()=>accounts[method](...args))}),workspace=new Storage();let calls=0,fail=false,crawlStatus='running';
  const env={CUSTOMER_ID:'u',ACCOUNT_DIRECTORY:{getByName:()=>binding},CLOUDFLARE_BROWSER_TOKEN:'test-only-provider',CLOUDFLARE_ACCOUNT_ID:'test-account',BROWSER:{quickAction:async(action)=>{calls++;if(fail)return Response.json({success:false},{status:503});return Response.json({success:true,result:action==='json'?{name:'Example'}:'# Example',meta:{status:200}});}}};
  const service=new BrowserService(env,workspace,{validateUrl:async raw=>new URL(raw),fetcher:async(url,init={})=>{if(String(url).endsWith('/robots.txt'))return new Response('User-agent: *\nAllow: /');if(init.method==='POST')return Response.json({success:true,result:'provider-job-test-123'});if(init.method==='DELETE')crawlStatus='cancelled_by_user';return Response.json({success:true,result:{status:crawlStatus,total:3,finished:3,records:[{url:'https://example.com',status:'completed',markdown:'# One'},{url:'https://example.com/two',status:'completed',markdown:'# Two'},{url:'https://example.com/error',status:'errored'}]}});}});
  return {...s,accounts,workspace,env,service,get calls(){return calls;},fail:()=>fail=true};
}
test('successful extraction costs five once; failed page work returns its hold; REST retries reuse results',async()=>{
  const s=await browserSetup(),run=()=>operationContext.run('idempotent-extract-request',()=>s.service.page('json',{url:'https://example.com',prompt:'Name'}));await run();await run();assert.equal(s.calls,1);assert.equal((await s.accounts.creditSummary('u')).available,15);assert.equal((await s.accounts.creditSummary('u')).used,5);
  await assert.rejects(()=>operationContext.run('idempotent-extract-request',()=>s.service.page('json',{url:'https://example.com/different',prompt:'Name'})),{code:'IDEMPOTENCY_CONFLICT'});
  s.fail();await assert.rejects(()=>s.service.page('markdown',{url:'https://example.com'}),{code:'ENGINE_UNAVAILABLE'});assert.equal((await s.accounts.creditSummary('u')).available,15);assert.equal((await s.accounts.creditSummary('u')).held,0);
});
test('cancelled partial crawls charge successful pages and release the rest, including after service replacement',async()=>{
  const s=await browserSetup(),job=await s.service.createCrawl({url:'https://example.com',limit:5});assert.equal((await s.accounts.creditSummary('u')).held,5);await s.service.cancelCrawl(job.id);assert.equal((await s.accounts.creditSummary('u')).available,18);assert.equal((await s.accounts.creditSummary('u')).used,2);
  const restored=new BrowserService({...s.env,CUSTOMER_ID:undefined},s.workspace,{fetcher:()=>assert.fail('Retained results must not call provider')});await restored.cleanup();await restored.getCrawl(job.id);assert.equal((await s.accounts.creditSummary('u')).used,2);assert.equal((await s.accounts.creditSummary('u')).held,0);
});
test('an alarm refunds an interrupted page hold without requiring the customer to poll',async()=>{
  const s=await browserSetup();await s.accounts.creditReserve('u','interrupted',1,{operation:'scrape'});await s.workspace.put('operation:interrupted',{id:'interrupted',customerId:'u',status:'running',createdAt:Date.now()-180000});await s.workspace.put('pending:interrupted','interrupted');await s.service.cleanup();assert.equal((await s.accounts.creditSummary('u')).available,20);assert.equal((await s.accounts.creditSummary('u')).held,0);
});
test('a retained terminal crawl recovers settlement after a crash between result storage and ledger RPC',async()=>{
  const s=await browserSetup(),job=await s.service.createCrawl({url:'https://example.com',limit:5});const stored=await s.workspace.get('job:'+job.id);Object.assign(stored,{cached:true,status:'completed',charged:2,recordCount:0,retainedAt:Date.now()});await s.workspace.put('job:'+job.id,stored);
  const restored=new BrowserService({...s.env,CUSTOMER_ID:undefined},s.workspace);await restored.cleanup();assert.equal((await s.accounts.creditSummary('u')).available,18);assert.equal((await s.accounts.creditSummary('u')).held,0);assert.equal((await s.accounts.creditSummary('u')).used,2);
});
test('Unicode output is chunked below Durable Object value limits and reassembled losslessly',async()=>{
  const s=await browserSetup(),original=s.workspace.put.bind(s.workspace);s.workspace.put=async(key,value)=>{for(const v of typeof key==='object'?Object.values(key):[value])assert(Buffer.byteLength(JSON.stringify(v),'utf8')<128*1024,'DO values must fit 128 KiB');return original(key,value);};
  const content='😀'.repeat(60000);s.env.BROWSER.quickAction=async()=>Response.json({success:true,result:content,meta:{status:200}});let result=await operationContext.run('unicode-page',()=>s.service.page('markdown',{url:'https://example.com'}));assert.equal(result.result,content);result=await operationContext.run('unicode-page',()=>s.service.page('markdown',{url:'https://example.com'}));assert.equal(result.result,content);
  await s.service.storeRecord('unicode',0,{markdown:content,html:content});assert.equal((await s.service.readRecord('unicode',0)).html,content);
});
test('a crawl retry returns its original ID even when both active crawl slots are occupied',async()=>{
  const s=await browserSetup(),run=()=>operationContext.run('same-crawl-request',()=>s.service.createCrawl({url:'https://example.com',limit:5}));const first=await run();await s.service.createCrawl({url:'https://example.com/two',limit:5});const retry=await run();assert.equal(retry.id,first.id);assert.equal((await s.accounts.creditSummary('u')).held,10);
});
