import { bearer, boundedJson, credentialMatches, errorResponse, integer, json, onlyKeys, reject } from './policy.mjs';
import { engineName } from './browser-service.mjs';

export function capabilities(env) {
  return {release:'cloudflare-browser-run-0.4.1',engine:engineName,api:'/v2',mcp:'/mcp',
    available:{scrape:true,browser:true,crawl:Boolean(env.CLOUDFLARE_BROWSER_TOKEN),map:true,extract:true,search:false,batchScrape:false,oauth:false,checkout:false,signup:true,emailSignIn:true,customerApiKeys:true},
    access:'Email sign-in; private customer workspaces with a 20-page free trial. Paid billing is not enabled.',
    limits:{crawlPages:100,crawlDepth:5,activeCrawls:2,dailyPageAllowance:Number(env.DAILY_PAGE_LIMIT??1000),retentionDays:7},
    compatibility:'Documented Firecrawl-shaped REST subset; engine and MCP tools are Cloudflare Browser Run, not Firecrawl.',
    source:'https://github.com/biserd/AI-Hackr',
    upstream:{repository:'cloudflare/mcp-server-cloudflare',commit:'a21972e219289337731a066befb5c66886b9ce7b',toolSourceModified:false},
  };
}
export async function authorized(request,env) {
  if(!await credentialMatches(bearer(request.headers),env.AIHACKR_API_KEY)) reject('AUTH_REQUIRED','A valid AIHackr workspace API key is required.',401);
  const incoming=new URL(request.url); const header=request.headers.get('origin');
  if(header && header!==incoming.origin) reject('ORIGIN_RESTRICTED','Use this workspace origin.',403);
}
export async function routeGateway(request,env,service,{mcp,authenticated=false}={}) {
  try {
    if(!authenticated)await authorized(request,env);
    const url=new URL(request.url), path=url.pathname;
    if(path==='/api/session' && request.method==='GET')return json({authenticated:true,workspace:'Operator workspace',...capabilities(env)});
    if(path==='/mcp') {
      if(!['POST','GET','DELETE'].includes(request.method))return json({error:'Method not allowed'},405);
      if(request.method==='POST') {const body=await boundedJson(request);if(Array.isArray(body)||!body.jsonrpc)reject('INVALID_INPUT','Send one JSON-RPC 2.0 message.');request=new Request(request,{body:JSON.stringify(body)});}
      return mcp(request);
    }
    if(path==='/v2/search'||path==='/v2/batch/scrape') reject('CAPABILITY_UNAVAILABLE','This deployment does not expose web search or batch scraping.',503);
    const match=path.match(/^\/v2\/crawl\/([a-zA-Z0-9-]{10,80})$/);
    if(match && request.method==='GET')return json(await service.getCrawl(match[1],integer(Number(url.searchParams.get('cursor')??0),0,100,'Result cursor',0)));
    if(match && request.method==='DELETE')return json(await service.cancelCrawl(match[1]));
    if(request.method!=='POST')reject('NOT_FOUND','Unknown API route.',404);
    const body=await boundedJson(request);
    if(path==='/v2/crawl') {
      onlyKeys(body,['url','limit','depth','maxDiscoveryDepth','render','formats','scrapeOptions','source','maxAge','modifiedSince','options']);
      const scrapeOptions=body.scrapeOptions??{};onlyKeys(scrapeOptions,['formats']);
      const {scrapeOptions:_,maxDiscoveryDepth,...params}=body;
      if(maxDiscoveryDepth!=null)params.depth=maxDiscoveryDepth;
      if(scrapeOptions.formats)params.formats=scrapeOptions.formats;
      return json(await service.createCrawl(params));
    }
    if(path==='/v2/scrape') {
      onlyKeys(body,['url','formats','gotoOptions','waitForSelector']);
      const formats=body.formats??['markdown'];
      if(!Array.isArray(formats)||formats.length!==1||!['markdown','html','links'].includes(formats[0]))reject('UNSUPPORTED_OPTION','Choose one format: markdown, html or links.');
      const format=formats[0];const action={markdown:'markdown',html:'content',links:'links'}[format];
      const {formats:_,...params}=body;const result=await service.page(action,params);
      return json({success:true,data:{[format]:result.result,metadata:{sourceURL:body.url,url:result.meta?.finalUrl??body.url,title:result.meta?.title,statusCode:result.meta?.status??200,observedAt:new Date().toISOString(),engine:engineName}},engine:engineName});
    }
    if(path==='/v2/map') {
      onlyKeys(body,['url','limit']);const limit=integer(body.limit,20,100,'Link limit');
      const result=await service.page('links',{url:body.url});
      const raw=Array.isArray(result.result)?result.result:result.result?.links??[];
      const base=new URL(body.url);const links=[];const seen=new Set();
      for(const item of raw){try{const url=new URL(typeof item==='string'?item:item.href??item.url,base);url.hash='';if(url.origin===base.origin&&!seen.has(url.href)&&['https:','http:'].includes(url.protocol)){seen.add(url.href);links.push({url:url.href,text:typeof item==='string'?undefined:item.text});}}catch{}}
      return json({success:true,links:links.slice(0,limit),engine:engineName,scope:'Links discovered on the submitted page; use crawl for recursive discovery.',truncated:links.length>limit});
    }
    if(path==='/v2/extract') {
      onlyKeys(body,['url','urls','prompt','schema']);
      const urls=body.urls??(body.url?[body.url]:[]);
      if(!Array.isArray(urls)||urls.length!==1)reject('LIMIT_EXCEEDED','Extract from exactly one public URL per request.');
      const result=await service.page('json',{url:urls[0],...(body.prompt?{prompt:body.prompt}:{}),...(body.schema?{response_format:{type:'json_schema',json_schema:body.schema}}:{})});
      return json({success:true,data:result.result,engine:engineName,sources:[{url:urls[0],observedAt:new Date().toISOString()}]});
    }
    reject('NOT_FOUND','Unknown API route.',404);
  }catch(error){return errorResponse(error);}
}
