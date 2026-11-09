import {DurableObject,WorkerEntrypoint} from 'cloudflare:workers';
import {BrowserService,engineName} from './browser-service.mjs';
import {capabilities,routeGateway} from './gateway.mjs';
import {handleMcp} from './mcp.mjs';
import {errorResponse,json,reject} from './policy.mjs';
import {AccountService,authRoute,rpcResult} from './accounts.mjs';
import {customerGateway} from './customer-gateway.mjs';
import {OAuthService} from './oauth-service.mjs';
import {resourceMetadata,oauthChallenge,oauthIssuer} from './oauth-config.mjs';

const csp="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
export class BrowserWorkspace extends DurableObject {
  constructor(ctx,env){super(ctx,env);this.active=0;}
  serviceFor(identity){
    const customerId=identity.operator?null:identity.id;
    if(!this.service){this.customerId=customerId;this.service=new BrowserService({...this.env,DAILY_PAGE_LIMIT:identity.operator?this.env.DAILY_PAGE_LIMIT:'20',CUSTOMER_ID:customerId},this.ctx.storage);}
    if(this.customerId!==customerId)reject('AUTH_REQUIRED','Workspace identity mismatch.',403);
    return this.service;
  }
  async profile(identity){
    this.serviceFor(identity);const budget=await this.ctx.storage.get('budget');const today=new Date().toISOString().slice(0,10);
    return {dailyReserved:budget?.day===today?budget.pages:0,dailyLimit:identity.operator?Number(this.env.DAILY_PAGE_LIMIT??1000):20};
  }
  async run(request,identity){
    if(this.active>=3)return json({success:false,error:{code:'RATE_LIMITED',message:'Workspace concurrency limit reached.'}},429,{'Retry-After':'10'});
    this.active++;
    try{const service=this.serviceFor(identity);return await routeGateway(request,this.env,service,{authenticated:true,mcp:req=>handleMcp(req,this.env,this.ctx,service,identity)});}
    finally{this.active--;}
  }
  async alarm(){await new BrowserService(this.env,this.ctx.storage).cleanup();}
}
export class AccountDirectory extends DurableObject {
  constructor(ctx,env){super(ctx,env);this.accounts=new AccountService(ctx.storage,{send:message=>env.EMAIL.send(message),globalLimit:Number(env.DAILY_PAGE_LIMIT??1000)});this.oauth=new OAuthService(ctx.storage,this.accounts,env);}
  async start(email,ip){return rpcResult(()=>this.accounts.start(email,ip));}
  async verify(challenge,code){return rpcResult(()=>this.accounts.verify(challenge,code));}
  async authenticate(token,kind){return rpcResult(()=>this.accounts.authenticate(token,kind));}
  async logout(token){return rpcResult(()=>this.accounts.logout(token));}
  async keys(userId){return rpcResult(()=>this.accounts.keys(userId));}
  async createKey(userId,name){return rpcResult(()=>this.accounts.createKey(userId,name));}
  async revokeKey(userId,id){return rpcResult(()=>this.accounts.revokeKey(userId,id));}
  async reserve(pages,userId){return rpcResult(()=>this.accounts.reserve(pages,userId));}
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
      if(request.method==='GET'&&url.pathname==='/__version')return json({release:'cloudflare-browser-run-0.6.0',engine:engineName,upstreamCommit:'a21972e219289337731a066befb5c66886b9ce7b'});
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
      if(url.pathname.startsWith('/auth/'))return await authRoute(request,env);
      if(url.pathname.startsWith('/api/keys')||url.pathname==='/api/session'||url.pathname==='/mcp'||url.pathname.startsWith('/v2/')){
        const response=await customerGateway(request,env);if(url.pathname==='/mcp'&&response.status===401)response.headers.set('WWW-Authenticate',oauthChallenge(env,{error:'invalid_token',scope:'account:read web:read'}));return response;
      }
      if(['/','/app.mjs','/account.mjs','/style.css','/oauth.mjs','/oauth.css','/connections','/connections.mjs','/aihackr-plugin.zip','/docs','/docs/'].includes(url.pathname)&&['GET','HEAD'].includes(request.method)){
        if(url.pathname==='/')url.pathname='/index.html';
        if(url.pathname==='/connections')url.pathname='/connections.html';
        if(url.pathname==='/docs'||url.pathname==='/docs/')url.pathname='/docs.html';
        const asset=await env.ASSETS.fetch(new Request(url,request));const headers=new Headers(asset.headers);
        headers.set('Content-Security-Policy',csp);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');
        return new Response(asset.body,{status:asset.status,headers});
      }
      reject('NOT_FOUND','Unknown route.',404);
    }catch(error){const response=errorResponse(error);if(new URL(request.url).pathname==='/mcp'&&response.status===401){response.headers.set('WWW-Authenticate',oauthChallenge(env,{error:request.headers.has('authorization')?'invalid_token':undefined,scope:'account:read web:read'}));response.headers.set('Access-Control-Allow-Origin','*');response.headers.set('Access-Control-Expose-Headers','WWW-Authenticate');}return response;}
  }
};
