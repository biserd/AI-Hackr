import {DurableObject,WorkerEntrypoint} from 'cloudflare:workers';
import {BrowserService,engineName} from './browser-service.mjs';
import {capabilities,routeGateway} from './gateway.mjs';
import {handleMcp} from './mcp.mjs';
import {errorResponse,json,reject} from './policy.mjs';
import {AccountService,authRoute,rpcResult} from './accounts.mjs';
import {customerGateway} from './customer-gateway.mjs';
import {operationContext} from './operations.mjs';
import {digest} from './accounts.mjs';
import {billingWebhook,billingConfig} from './billing.mjs';
import {PLANS} from './plans.mjs';

const csp="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
export class BrowserWorkspace extends DurableObject {
  constructor(ctx,env){super(ctx,env);this.active=0;}
  serviceFor(identity){
    const customerId=identity.operator?null:identity.id;
    if(!this.service){this.customerId=customerId;this.service=new BrowserService({...this.env,DAILY_PAGE_LIMIT:identity.operator?this.env.DAILY_PAGE_LIMIT:'20000',CUSTOMER_ID:customerId},this.ctx.storage);}
    if(this.customerId!==customerId)reject('AUTH_REQUIRED','Workspace identity mismatch.',403);
    return this.service;
  }
  async profile(identity){
    this.serviceFor(identity);const budget=await this.ctx.storage.get('budget');const today=new Date().toISOString().slice(0,10);
    return {dailyReserved:budget?.day===today?budget.pages:0,dailyLimit:identity.operator?Number(this.env.DAILY_PAGE_LIMIT??1000):20000};
  }
  async jobs(identity,cursor){return rpcResult(()=>this.serviceFor(identity).history(cursor));}
  async result(identity,id){if(this.active>=3)return {ok:false,error:{code:'RATE_LIMITED',message:'Workspace concurrency limit reached.',status:429}};this.active++;try{return await rpcResult(()=>this.serviceFor(identity).result(id));}finally{this.active--;}}
  async run(request,identity){
    if(this.active>=3)return json({success:false,error:{code:'RATE_LIMITED',message:'Workspace concurrency limit reached.'}},429,{'Retry-After':'10'});
    this.active++;
    try{const service=this.serviceFor(identity);let id;
      const key=request.headers.get('Idempotency-Key');
      if(key){if(!/^[A-Za-z0-9_-]{16,128}$/.test(key))reject('INVALID_INPUT','Use an idempotency key of 16–128 letters, digits, underscores or hyphens.');id=await digest(key);}
      return await operationContext.run(id,()=>routeGateway(request,this.env,service,{authenticated:true,mcp:req=>handleMcp(req,this.env,this.ctx,service)}));}
    finally{this.active--;}
  }
  async alarm(){await (this.service??new BrowserService(this.env,this.ctx.storage)).cleanup();}
}
export class AccountDirectory extends DurableObject {
  constructor(ctx,env){super(ctx,env);this.accounts=new AccountService(ctx.storage,{send:message=>env.EMAIL.send(message),globalLimit:Number(env.DAILY_PAGE_LIMIT??1000)});}
  async start(email,ip){return rpcResult(()=>this.accounts.start(email,ip));}
  async verify(challenge,code){return rpcResult(()=>this.accounts.verify(challenge,code));}
  async authenticate(token,kind){return rpcResult(()=>this.accounts.authenticate(token,kind));}
  async logout(token){return rpcResult(()=>this.accounts.logout(token));}
  async keys(userId){return rpcResult(()=>this.accounts.keys(userId));}
  async createKey(userId,name){return rpcResult(()=>this.accounts.createKey(userId,name));}
  async revokeKey(userId,id){return rpcResult(()=>this.accounts.revokeKey(userId,id));}
  async reserve(pages,userId){return rpcResult(()=>this.accounts.reserve(pages,userId));}
  async creditSummary(userId){return rpcResult(()=>this.accounts.creditSummary(userId));}
  async creditReserve(...args){return rpcResult(()=>this.accounts.creditReserve(...args));}
  async creditSettle(...args){return rpcResult(()=>this.accounts.creditSettle(...args));}
  async creditGrant(...args){return rpcResult(()=>this.accounts.creditGrant(...args));}
  async creditEntries(...args){return rpcResult(()=>this.accounts.creditEntries(...args));}
  async creditDaily(...args){return rpcResult(()=>this.accounts.creditDaily(...args));}
  async billingUpdate(...args){return rpcResult(()=>this.accounts.billingUpdate(...args));}
  async billingRisk(...args){return rpcResult(()=>this.accounts.billingRisk(...args));}
  async billingCustomer(...args){return rpcResult(()=>this.accounts.billingCustomer(...args));}
  async customerOwner(...args){return rpcResult(()=>this.accounts.customerOwner(...args));}
  async billingEvent(...args){return rpcResult(()=>this.accounts.billingEvent(...args));}
  async billingThrottle(...args){return rpcResult(()=>this.accounts.billingThrottle(...args));}
  async checkoutAttempt(...args){return rpcResult(()=>this.accounts.checkoutAttempt(...args));}
  async checkoutPending(...args){return rpcResult(()=>this.accounts.checkoutPending(...args));}
  async alarm(){await this.accounts.cleanup();}
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
      if(request.method==='GET'&&url.pathname==='/__version')return json({release:'cloudflare-browser-run-0.5.0',engine:engineName,upstreamCommit:'a21972e219289337731a066befb5c66886b9ce7b'});
      if(request.method==='GET'&&url.pathname==='/health/live')return json({live:true,engine:engineName});
      if(request.method==='GET'&&url.pathname==='/health/ready'){
        const ready=Boolean(env.BROWSER&&env.BROWSER_WORKSPACE&&env.ACCOUNT_DIRECTORY&&env.EMAIL&&env.AIHACKR_API_KEY?.length>=32&&env.CLOUDFLARE_BROWSER_TOKEN);
        return json({ready,engine:engineName,note:'Configuration readiness; live functional checks verify browser and crawl execution.'},ready?200:503);
      }
      if(url.pathname==='/sse')return json({error:'Use the Streamable HTTP endpoint /mcp.'},410);
      if(url.pathname==='/api/plans'&&request.method==='GET')return json({plans:PLANS,ready:billingConfig(env).ready,freeCredits:20,taxCollection:false});
      if(url.pathname==='/stripe/webhook')return await billingWebhook(request,env);
      if(url.pathname.startsWith('/auth/'))return await authRoute(request,env);
      if(url.pathname.startsWith('/api/keys')||url.pathname.startsWith('/api/jobs')||url.pathname==='/api/usage'||url.pathname.startsWith('/api/billing/')||url.pathname==='/api/session'||url.pathname==='/mcp'||url.pathname.startsWith('/v2/')){
        return await customerGateway(request,env);
      }
      if(['/','/app.mjs','/account.mjs','/style.css','/dashboard','/dashboard/','/dashboard.mjs','/dashboard.css','/aihackr-plugin.zip','/docs','/docs/'].includes(url.pathname)&&['GET','HEAD'].includes(request.method)){
        if(url.pathname==='/docs'||url.pathname==='/docs/')url.pathname='/docs.html';
        if(url.pathname==='/dashboard'||url.pathname==='/dashboard/')url.pathname='/dashboard.html';
        const asset=await env.ASSETS.fetch(new Request(url,request));const headers=new Headers(asset.headers);
        headers.set('Content-Security-Policy',csp);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');
        return new Response(asset.body,{status:asset.status,headers});
      }
      reject('NOT_FOUND','Unknown route.',404);
    }catch(error){return errorResponse(error);}
  }
};
