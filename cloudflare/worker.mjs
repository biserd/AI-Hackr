import {DurableObject,WorkerEntrypoint} from 'cloudflare:workers';
import {BrowserService,engineName} from './browser-service.mjs';
import {capabilities,routeGateway,authorized} from './gateway.mjs';
import {handleMcp} from './mcp.mjs';
import {errorResponse,json,reject} from './policy.mjs';

const csp="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
export class BrowserWorkspace extends DurableObject {
  constructor(ctx,env){super(ctx,env);this.service=new BrowserService(env,ctx.storage);this.active=0;}
  async fetch(request){
    if(this.active>=3)return json({success:false,error:{code:'RATE_LIMITED',message:'Workspace concurrency limit reached.'}},429,{'Retry-After':'10'});
    this.active++;
    try{return await routeGateway(request,this.env,this.service,{mcp:req=>handleMcp(req,this.env,this.ctx,this.service)});}
    finally{this.active--;}
  }
  async alarm(){await this.service.cleanup();}
}
// Keep the former class identities/data inert until a separate retirement.
export class AIHackrContainer extends DurableObject {async fetch(){return new Response('Retired application',{status:410});}}
export class WebDataStore extends DurableObject {async fetch(){return new Response('Retired application',{status:410});}}
export class ContainerProxy extends WorkerEntrypoint {async fetch(){return new Response('Retired application',{status:410});}}

export default {
  async fetch(request,env){
    try{
      const url=new URL(request.url);
      if(url.hostname==='www.aihackr.com'){url.hostname='aihackr.com';return Response.redirect(url.href,308);}
      if(url.pathname==='/web-data'||url.pathname==='/web-data/'){url.pathname='/';url.search='';return Response.redirect(url.href,308);}
      if(request.method==='GET'&&['/api/capabilities','/v1/capabilities'].includes(url.pathname))return json(capabilities(env));
      if(request.method==='GET'&&url.pathname==='/__version')return json({release:'cloudflare-browser-run-0.3.0',engine:engineName,upstreamCommit:'a21972e219289337731a066befb5c66886b9ce7b'});
      if(request.method==='GET'&&url.pathname==='/health/live')return json({live:true,engine:engineName});
      if(request.method==='GET'&&url.pathname==='/health/ready'){
        const ready=Boolean(env.BROWSER&&env.BROWSER_WORKSPACE&&env.AIHACKR_API_KEY?.length>=32&&env.CLOUDFLARE_BROWSER_TOKEN);
        return json({ready,engine:engineName,note:'Configuration readiness; live functional checks verify browser and crawl execution.'},ready?200:503);
      }
      if(url.pathname==='/sse')return json({error:'Use the Streamable HTTP endpoint /mcp.'},410);
      if(url.pathname==='/api/session'||url.pathname==='/mcp'||url.pathname.startsWith('/v2/')){
        await authorized(request,env);
        const id=env.BROWSER_WORKSPACE.idFromName('operator-workspace-v1');
        return await env.BROWSER_WORKSPACE.get(id).fetch(request);
      }
      if(['/','/app.mjs','/style.css','/docs','/docs/'].includes(url.pathname)&&['GET','HEAD'].includes(request.method)){
        if(url.pathname==='/docs'||url.pathname==='/docs/')url.pathname='/docs.html';
        const asset=await env.ASSETS.fetch(new Request(url,request));const headers=new Headers(asset.headers);
        headers.set('Content-Security-Policy',csp);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');
        return new Response(asset.body,{status:asset.status,headers});
      }
      reject('NOT_FOUND','Unknown route.',404);
    }catch(error){return errorResponse(error);}
  }
};
