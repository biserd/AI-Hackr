import test from 'node:test';
import assert from 'node:assert/strict';
import {BrowserService} from '../browser-service.mjs';
import {routeGateway} from '../gateway.mjs';
import {validatePublicUrl,credentialMatches,boundedJson} from '../policy.mjs';

const key='test-only-workspace-key-with-at-least-32-characters';
class Storage {
  constructor(){this.data=new Map();}
  async get(key){return structuredClone(this.data.get(key));}
  async put(key,value){if(typeof key==='object')for(const [k,v]of Object.entries(key))this.data.set(k,structuredClone(v));else this.data.set(key,structuredClone(value));}
  async list({prefix}){return new Map([...this.data].filter(([key])=>key.startsWith(prefix)).map(([k,v])=>[k,structuredClone(v)]));}
  async delete(key){this.data.delete(key);}
  async transaction(callback){return callback(this);}
  async setAlarm(){}
}
const publicUrl=raw=>validatePublicUrl(raw,async()=>['93.184.215.14']);
const env={AIHACKR_API_KEY:key,CLOUDFLARE_ACCOUNT_ID:'testaccount',CLOUDFLARE_BROWSER_TOKEN:'test-provider-token',DAILY_PAGE_LIMIT:'1000'};
function setup(overrides={}){
  const requests=[];const store=new Storage();let jobStatus='completed';
  const service=new BrowserService({...env,...overrides},store,{validateUrl:publicUrl,fetcher:async(url,init={})=>{
    requests.push({url:String(url),init});
    if(String(url).endsWith('/robots.txt'))return new Response('User-agent: *\nAllow: /');
    if(init.method==='POST'&&String(url).includes('/crawl'))return Response.json({success:true,result:'provider-job-1234567890'});
    if(init.method==='DELETE')return Response.json({success:true,result:null});
    return Response.json({success:true,result:{status:jobStatus,total:2,finished:2,browserSecondsUsed:2,records:[{url:'https://example.com/',status:'completed',markdown:'# First'},{url:'https://example.com/second',status:'completed',markdown:'# Second'}]}});
  }});
  return{service,store,requests,setStatus:value=>jobStatus=value};
}
function request(path,body,token=key){return new Request('https://aihackr.com'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});}

test('target admission rejects credentials, alternate IP spellings and private DNS',async()=>{
  for(const url of ['http://127.1','http://0x7f000001','http://[::1]','http://[::ffff:127.0.0.1]','https://user:secret@example.com','https://example.com:8080','http://metadata.google.internal'])await assert.rejects(()=>publicUrl(url));
  await assert.rejects(()=>validatePublicUrl('https://public.example',async()=>['93.184.215.14','10.1.2.3']));
  assert.equal((await publicUrl('https://example.com/#section')).href,'https://example.com/');
});
test('workspace authentication cannot be bypassed by missing key or foreign Origin',async()=>{
  const{service}=setup();assert.equal(await credentialMatches(key,key),true);assert.equal(await credentialMatches('wrong',key),false);
  assert.equal((await routeGateway(request('/v2/crawl',{url:'https://example.com'},'wrong'),env,service)).status,401);
  const req=request('/v2/crawl',{url:'https://example.com'});req.headers.set('origin','https://other.example');assert.equal((await routeGateway(req,env,service)).status,403);
});
test('managed crawl enforces server bounds and retains completed results across new service instances',async()=>{
  const{service,requests,store}=setup();
  const created=await service.createCrawl({url:'https://example.com',limit:2,render:false});
  const sent=JSON.parse(requests[0].init.body);assert.equal(sent.limit,2);assert.equal(sent.options.includeExternalLinks,false);assert.equal(sent.maxAge,0);assert.equal(requests[0].init.redirect,'manual');
  const result=await service.getCrawl(created.id);assert.equal(result.status,'completed');assert.equal(result.data.length,2);
  const restored=new BrowserService(env,store,{fetcher:()=>assert.fail('Completed retained results must not require provider availability'),validateUrl:publicUrl});
  assert.equal((await restored.getCrawl(created.id)).data[1].markdown,'# Second');
  await assert.rejects(()=>restored.getCrawl('unknown-job-1234567890'),{code:'NOT_FOUND'});
  await assert.rejects(()=>service.createCrawl({url:'https://example.com',limit:101}),{code:'LIMIT_EXCEEDED'});
});
test('MCP client and REST share durable crawl ownership; caller cannot poll arbitrary provider IDs',async()=>{
  const{service}=setup();const response=await routeGateway(request('/v2/crawl',{url:'https://example.com',limit:2}),env,service);assert.equal(response.status,200);
  const{id}=await response.json();assert.equal((await routeGateway(request('/v2/crawl/'+id),env,service)).status,200);
  assert.equal((await routeGateway(request('/v2/crawl/provider-job-1234567890'),env,service)).status,404);
});
test('page binding never receives customer credentials, rejects robots denial and provider error pages',async()=>{
  let payload;const{service}=setup({BROWSER:{quickAction:async(action,body)=>{payload=body;return Response.json({success:true,result:'# Page',meta:{status:200,finalUrl:body.url}});}}});
  const response=await routeGateway(request('/v2/scrape',{url:'https://example.com',formats:['markdown']}),env,service);assert.equal(response.status,200);assert.equal((await response.json()).data.markdown,'# Page');assert.equal(JSON.stringify(payload).includes(key),false);
  await assert.rejects(()=>service.page('markdown',{url:'https://example.com',headers:{Cookie:'secret'}}),{code:'UNSUPPORTED_OPTION'});
  service.robots.set('https://example.com',{text:'User-agent: *\nDisallow: /',until:Date.now()+60000});await assert.rejects(()=>service.page('markdown',{url:'https://example.com'}),{code:'ROBOTS_DISALLOWED'});
});
test('daily page allowance survives service replacement and reserves full crawl bound',async()=>{
  const{service,store}=setup({DAILY_PAGE_LIMIT:'2'});await service.createCrawl({url:'https://example.com',limit:2});
  const restored=new BrowserService({...env,DAILY_PAGE_LIMIT:'2'},store);await assert.rejects(()=>restored.reserve(1),{code:'DAILY_LIMIT'});
});
test('active crawl limit and cancellation are enforced by stored workspace jobs',async()=>{
  const{service,setStatus}=setup();setStatus('running');const first=await service.createCrawl({url:'https://example.com',limit:1});await service.createCrawl({url:'https://example.com',limit:1});
  await assert.rejects(()=>service.createCrawl({url:'https://example.com',limit:1}),{code:'RATE_LIMITED'});
  assert.equal((await service.cancelCrawl(first.id)).status,'cancelled');
});
test('oversize and unsupported requests fail explicitly without launching browser work',async()=>{
  const{service,requests}=setup();assert.equal((await routeGateway(request('/v2/scrape',{url:'https://example.com',actions:[{type:'executeJavascript'}]}),env,service)).status,400);assert.equal(requests.length,0);
  await assert.rejects(()=>boundedJson(new Request('https://aihackr.com',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'x'.repeat(70000)})})),{status:413});
  assert.equal((await routeGateway(request('/v2/search',{query:'example'}),env,service)).status,503);
});
test('completed provider pages are fully retained before client pagination',async()=>{
  const{service,store}=setup();
  const created=await service.createCrawl({url:'https://example.com',limit:12});let calls=0;
  service.provider=async(action,method,body,query)=>{
    calls++;const start=query.includes('cursor=')?10:0;
    return{result:{status:'completed',total:12,finished:12,records:Array.from({length:start?2:10},(_,i)=>({url:'https://example.com/'+(start+i),status:'completed',markdown:'# '+(start+i)})),...(start?{}:{cursor:'next-page'})}};
  };
  const first=await service.getCrawl(created.id);assert.equal(first.data.length,10);assert(first.next);assert.equal(calls,2);
  const restored=new BrowserService(env,store,{fetcher:()=>assert.fail('Provider is not needed after retention')});
  const second=await restored.getCrawl(created.id,10);assert.equal(second.data.length,2);assert.equal(second.next,null);assert.equal(second.data[0].markdown,'# 10');
});
test('concurrent crawl submissions cannot exceed admission through async interleaving',async()=>{
  const{service}=setup();const original=service.submitCrawl.bind(service);let resume;
  service.submitCrawl=async body=>{await new Promise(resolve=>resume=resolve);return original(body);};
  const first=service.createCrawl({url:'https://example.com',limit:1});
  await assert.rejects(()=>service.createCrawl({url:'https://example.com',limit:1}),{code:'RATE_LIMITED'});
  resume();await first;
});
