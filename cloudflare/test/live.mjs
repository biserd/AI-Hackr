import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const base=process.env.AIHACKR_ORIGIN??'https://aihackr-browser-run-stage.biser-d.workers.dev';
const stage=new URL(base).hostname.includes('-stage.');
const keys=process.env.AIHACKR_API_KEY?null:JSON.parse(await readFile(new URL('../../.local/cloudflare-workspace.json',import.meta.url),'utf8'));
const key=process.env.AIHACKR_API_KEY??keys[stage?'staging':'production'];
const reports=new URL('../reports/',import.meta.url);await mkdir(reports,{recursive:true});
const evidence={checkedAt:new Date().toISOString(),origin:base,engine:'cloudflare-browser-run',checks:{},passed:false};
const fixture='https://fixtures.aihackr.com';
async function call(path,body,{method=body?'POST':'GET',auth=true,headers={}}={}){
  const r=await fetch(base+path,{method,headers:{...(auth?{Authorization:'Bearer '+key}:{}),'Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(65000)});
  return {status:r.status,data:await r.json()};
}
async function check(name,run){await run();evidence.checks[name]={passed:true};console.log('PASS '+name);}
let crawlId;
try{
  await check('authenticationAndPrivateTargets',async()=>{
    assert.equal((await call('/v2/scrape',{url:fixture},{auth:false})).status,401);
    assert.equal((await call('/v2/scrape',{url:'http://169.254.169.254/latest/meta-data'})).status,403);
    assert.equal((await call('/v2/scrape',{url:fixture},{headers:{Origin:'https://other.example'}})).status,403);
  });
  await check('realBrowserMarkdownAndJavaScript',async()=>{
    const r=await call('/v2/scrape',{url:fixture,formats:['markdown']});
    assert.equal(r.status,200,JSON.stringify(r.data));
    assert.match(r.data.data.markdown.replaceAll('\\',''),/BROWSER_EXECUTED_JAVASCRIPT_42/);
  });
  await check('sameOriginLinkDiscovery',async()=>{
    const r=await call('/v2/map',{url:fixture,limit:5});assert.equal(r.status,200,JSON.stringify(r.data));assert(r.data.links.some(link=>new URL(link.url).pathname==='/second'));
  });
  if(!process.argv.includes('--pages-only')){
    await check('managedCrawlAndDurableResults',async()=>{
      const start=await call('/v2/crawl',{url:fixture,limit:2,render:false,depth:1});assert.equal(start.status,200,JSON.stringify(start.data));crawlId=start.data.id;
      let result;
      for(let i=0;i<60;i++){
        const response=await call('/v2/crawl/'+crawlId);assert.equal(response.status,200,JSON.stringify(response.data));result=response.data;
        if(['completed','failed','cancelled'].includes(result.status))break;
        await new Promise(resolve=>setTimeout(resolve,5000));
      }
      assert.equal(result.status,'completed',JSON.stringify(result));assert.equal(result.data.length,2);assert(result.data.every(page=>page.status==='completed'));
      const retained=await call('/v2/crawl/'+crawlId);assert.equal(retained.status,200);assert.equal(retained.data.data.length,2);evidence.retainedCrawlId=crawlId;
    });
    await check('structuredExtraction',async()=>{
      const r=await call('/v2/extract',{url:fixture,prompt:'Extract the visible main heading into heading.',schema:{type:'object',properties:{heading:{type:'string'}},required:['heading']}});
      assert.equal(r.status,200,JSON.stringify(r.data));assert.match(r.data.data.heading,/Native engine fixture/i);
    });
    await check('managedCrawlPaginationAndCancellation',async()=>{
      const start=await call('/v2/crawl',{url:'https://aihackr-native-fixtures.biser-d.workers.dev/pagination',limit:12,source:'links',render:false,depth:2});assert.equal(start.status,200,JSON.stringify(start.data));
      let first;
      for(let i=0;i<60;i++){
        const response=await call('/v2/crawl/'+start.data.id);assert.equal(response.status,200,JSON.stringify(response.data));first=response.data;
        if(first.status==='completed')break;
        assert.notEqual(first.status,'failed',JSON.stringify(first));await new Promise(resolve=>setTimeout(resolve,5000));
      }
      assert.equal(first.status,'completed');assert.equal(first.data.length,10);assert(first.next?.startsWith('/v2/crawl/'));
      const second=await call(first.next);assert.equal(second.status,200);assert.equal(second.data.data.length,2);assert.equal(second.data.next,null);
      assert.equal(new Set([...first.data,...second.data.data].map(item=>item.url)).size,12);
      const slow=await call('/v2/crawl',{url:fixture+'/slow',limit:1,source:'links',render:true,depth:1});assert.equal(slow.status,200,JSON.stringify(slow.data));
      const cancelled=await call('/v2/crawl/'+slow.data.id,undefined,{method:'DELETE'});assert.equal(cancelled.status,200,JSON.stringify(cancelled.data));assert.equal(cancelled.data.status,'cancelled');
      evidence.paginationPages=12;evidence.cancellationVerified=true;
    });
  }
  await check('officialOssMcp',async()=>{
    const client=new Client({name:'AIHackr release verification',version:'0.3.0'});
    const transport=new StreamableHTTPClientTransport(new URL('/mcp',base),{requestInit:{headers:{Authorization:'Bearer '+key}}});
    try{
      await client.connect(transport);const tools=await client.listTools();const names=tools.tools.map(tool=>tool.name);assert(names.includes('get_url_markdown'));assert(!names.includes('kill_browser_session'));
      const result=await client.callTool({name:'get_url_markdown',arguments:{url:fixture}});assert(!result.isError,JSON.stringify(result));assert.match(result.content[0].text,/Native engine fixture/);
      const denied=await client.callTool({name:'get_url_markdown',arguments:{url:fixture+'/private-fixture'}});assert.equal(denied.isError,true);
      if(!process.argv.includes('--pages-only')){
        const started=await client.callTool({name:'start_crawl',arguments:{url:fixture,limit:1,render:false,depth:1}});assert(!started.isError,JSON.stringify(started));
        const job=JSON.parse(started.content[0].text).job_id;assert(job);
        const status=await client.callTool({name:'get_crawl_result',arguments:{job_id:job}});assert(!status.isError,JSON.stringify(status));
        const cancelled=await client.callTool({name:'cancel_crawl',arguments:{job_id:job}});assert(!cancelled.isError,JSON.stringify(cancelled));
        evidence.mcpCrawlLifecycleVerified=true;
      }
      evidence.mcpTools=names;
    }finally{await client.close();}
  });
  evidence.passed=true;
}catch(error){evidence.failure=String(error.message).replaceAll(key,'[redacted]');console.error(evidence.failure);process.exitCode=1;}
await writeFile(new URL(stage?'staging.json':'production.json',reports),JSON.stringify(evidence,null,2));
console.log(JSON.stringify({origin:base,passed:evidence.passed,checks:Object.keys(evidence.checks)}));
