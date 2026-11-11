import {publicSite} from './public-site.mjs';
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
import {PLANS,FREE_MONTHLY_CREDITS} from './plans.mjs';
import {OAuthService} from './oauth-service.mjs';
import {resourceMetadata,oauthChallenge} from './oauth-config.mjs';

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
      return await operationContext.run(id,()=>routeGateway(request,this.env,service,{authenticated:true,mcp:req=>handleMcp(req,this.env,this.ctx,service,identity)}));}
    finally{this.active--;}
  }
  async alarm(){await (this.service??new BrowserService(this.env,this.ctx.storage)).cleanup();}
}
export class AccountDirectory extends DurableObject {
  constructor(ctx,env){super(ctx,env);this.accounts=new AccountService(ctx.storage,{send:message=>env.EMAIL.send(message),globalLimit:Number(env.DAILY_PAGE_LIMIT??1000),monthlyFreeCredits:FREE_MONTHLY_CREDITS});this.oauth=new OAuthService(ctx.storage,this.accounts,env);}
  async start(email,ip){return rpcResult(()=>this.accounts.start(email,ip));}
  async verify(challenge,code){return rpcResult(()=>this.accounts.verify(challenge,code));}
  async reviewerLogin(email,password,ip){return rpcResult(()=>this.accounts.reviewerLogin(email,password,ip,this.env.REVIEWER_LOGIN_HASH,this.env.REVIEWER_LOGIN_EXPIRES_AT));}
  async authenticate(token,kind){return rpcResult(()=>this.accounts.authenticate(token,kind));}
  async logout(token){return rpcResult(()=>this.accounts.logout(token));}
  async keys(userId){return rpcResult(()=>this.accounts.keys(userId));}
  async createKey(userId,name){return rpcResult(()=>this.accounts.createKey(userId,name));}
  async revokeKey(userId,id){return rpcResult(()=>this.accounts.revokeKey(userId,id));}
  async reserve(pages,userId){return rpcResult(()=>this.accounts.reserve(pages,userId));}
  async creditSummary(userId){return rpcResult(()=>this.accounts.creditSummary(userId));}
  async recordBillingConsent(userId,version){return rpcResult(()=>this.accounts.recordBillingConsent(userId,version));}
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
  async oauthHandle(request){return this.oauth.handle(request);}
  async oauthValidate(token,resource){return rpcResult(()=>this.oauth.validate(token,resource));}
  async alarm(){await this.accounts.cleanup();await this.oauth.cleanup();}
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
      if(request.method==='GET'&&url.pathname==='/__version')return json({release:'cloudflare-browser-run-0.7.0',engine:engineName,upstreamCommit:'a21972e219289337731a066befb5c66886b9ce7b'});
      if(request.method==='GET'&&url.pathname==='/health/live')return json({live:true,engine:engineName});
      if(request.method==='GET'&&url.pathname==='/health/ready'){
        const ready=Boolean(env.BROWSER&&env.BROWSER_WORKSPACE&&env.ACCOUNT_DIRECTORY&&env.EMAIL&&env.AIHACKR_API_KEY?.length>=32&&env.CLOUDFLARE_BROWSER_TOKEN);
        return json({ready,engine:engineName,note:'Configuration readiness; live functional checks verify browser and crawl execution.'},ready?200:503);
      }
      if(url.pathname==='/sse')return json({error:'Use the Streamable HTTP endpoint /mcp.'},410);
      if(url.pathname==='/mcp'&&request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS','Access-Control-Allow-Headers':'authorization, content-type, mcp-session-id, mcp-protocol-version, last-event-id','Access-Control-Max-Age':'300'}});
      if(url.pathname==='/mcp'&&request.headers.has('origin')&&request.headers.get('origin')!==url.origin&&!request.headers.has('authorization'))return json({error:'OAuth authorization required.'},401,{'WWW-Authenticate':oauthChallenge(env,{scope:'account:read web:read'}),'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'WWW-Authenticate'});
      if(['/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource/mcp'].includes(url.pathname)&&request.method==='GET')return json(resourceMetadata(env),200,{'Access-Control-Allow-Origin':'*'});
      if(url.pathname.startsWith('/oauth/')||url.pathname==='/.well-known/oauth-authorization-server')return await env.ACCOUNT_DIRECTORY.getByName('accounts-v1').oauthHandle(request);
      if(url.pathname==='/api/plans'&&request.method==='GET')return json({plans:PLANS,ready:billingConfig(env).ready,freeCredits:FREE_MONTHLY_CREDITS,freeInterval:'month',taxCollection:false});
      if(url.pathname==='/stripe/webhook')return await billingWebhook(request,env);
      if(url.pathname.startsWith('/auth/'))return await authRoute(request,env);
      if(url.pathname.startsWith('/api/keys')||url.pathname.startsWith('/api/jobs')||url.pathname==='/api/usage'||url.pathname.startsWith('/api/billing/')||url.pathname==='/api/session'||url.pathname==='/mcp'||url.pathname.startsWith('/v2/')){
        return await customerGateway(request,env);
      }
      const page=await publicSite(request,env);if(page)return page;
      reject('NOT_FOUND','Unknown route.',404);
    }catch(error){const response=errorResponse(error);if(new URL(request.url).pathname==='/mcp'&&response.status===401){response.headers.set('WWW-Authenticate',oauthChallenge(env,{error:request.headers.has('authorization')?'invalid_token':undefined,scope:'account:read web:read'}));response.headers.set('Access-Control-Allow-Origin','*');response.headers.set('Access-Control-Expose-Headers','WWW-Authenticate');}return response;}
  }
};
