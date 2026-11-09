import {OAuthAuthorizationServer,AuthorizationError,CimdFetchError,OAuthError} from '@cloudflare/workers-oauth-provider';
import {cookie,SESSION_COOKIE,sameOrigin,digest} from './accounts.mjs';
import {boundedText,errorResponse,json,reject} from './policy.mjs';
import {OAUTH_SCOPES,oauthIssuer,oauthResource} from './oauth-config.mjs';
import {OAuthStorage} from './oauth-storage.mjs';
import {consentPage} from './oauth-page.mjs';

const csp="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
const safeHeaders={'Cache-Control':'no-store',Pragma:'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Security-Policy':csp};
export class OAuthService {
  constructor(storage,accounts,env){
    this.storage=storage;this.accounts=accounts;this.issuer=oauthIssuer(env);this.resource=oauthResource(env);this.queue=Promise.resolve();
    this.kv=new OAuthStorage(storage,{prefix:'oauth-kv:'+new URL(this.issuer).host+':'});this.env={OAUTH_KV:this.kv};
    this.server=new OAuthAuthorizationServer({issuer:this.issuer,resources:[this.resource],authorizeEndpoint:'/oauth/authorize',tokenEndpoint:'/oauth/token',clientRegistrationEndpoint:'/oauth/register',scopesSupported:Object.keys(OAUTH_SCOPES),accessTokenTTL:900,refreshTokenTTL:30*86400,clientRegistrationTTL:90*86400,clientIdMetadataDocumentEnabled:true,
      clientRegistrationCallback:()=>undefined,
      tokenExchangeCallback:options=>({refreshTokenTTL:options.scope.includes('offline_access')?30*86400:0}),
      onError:()=>undefined,
    });
    this.api=this.server.getOAuthApi(this.env);
  }
  exclusive(action){const result=this.queue.then(action);this.queue=result.catch(()=>{});return result;}
  async throttle(request,kind){
    const ip=await digest(request.headers.get('cf-connecting-ip')??'unknown'),registration=kind==='register',authorize=kind==='authorize';
    await this.storage.transaction(async tx=>{await this.accounts.throttle(tx,'rate:oauth:'+kind+':'+ip,registration?10:authorize?60:60,registration||authorize?3600000:60000);await this.accounts.throttle(tx,'rate:oauth:global:'+kind,registration?100:authorize?2000:600,registration||authorize?86400000:60000);});
    await this.storage.setAlarm(Date.now()+3600000);
  }
  clientPolicy(clientId){
    if(!clientId||clientId.length>1024)reject('invalid_client','A registered OAuth client is required.');
    if(/^https?:/i.test(clientId)){let u;try{u=new URL(clientId);}catch{reject('invalid_client','Invalid client identifier.');}if(u.origin!=='https://chatgpt.com'||!/^\/oauth\/(?:[A-Za-z0-9_-]{1,128}\/)?client\.json$/.test(u.pathname)||u.search||u.hash)reject('invalid_client','This metadata client is not trusted. Other clients can use dynamic registration.');}
  }
  async session(request){const session=await this.accounts.authenticate(cookie(request,SESSION_COOKIE),'session');if(!session)reject('AUTH_REQUIRED','Sign in to your AIHackr account.',401);return session;}
  async begin(request){
    const url=new URL(request.url);this.clientPolicy(url.searchParams.get('client_id'));
    const parsed=await this.api.parseAuthRequest(request);
    if(parsed.codeChallengeMethod!=='S256'||!/^[-_A-Za-z0-9]{43}$/.test(parsed.codeChallenge??''))reject('invalid_request','S256 PKCE is required for every application.');
    if(!parsed.scope.length)parsed.scope=['account:read','web:read'];parsed.scope=[...new Set(parsed.scope)];
    if(parsed.scope.some(s=>!Object.hasOwn(OAUTH_SCOPES,s)))reject('invalid_scope','An unsupported permission was requested.');
    const details=await this.api.describeConsent(parsed),consent=await this.api.beginConsent(parsed);
    await this.storage.put('oauth-ui:'+await digest(consent.handle),{scopes:parsed.scope,expiresAt:Date.now()+600000});
    const headers=new Headers(consent.headers);for(const [key,value]of Object.entries(safeHeaders))headers.set(key,value);headers.set('Content-Type','text/html; charset=utf-8');
    return new Response(consentPage(details,consent.handle),{headers});
  }
  async decide(request){
    sameOrigin(request,true);const form=await request.formData();
    const handle=String(form.get('handle')??''),key='oauth-ui:'+await digest(handle),pending=await this.storage.get(key);
    if(!pending||pending.expiresAt<=Date.now())reject('invalid_request','This connection request expired. Start again from the application.');
    let redirectTo,headers;
    if(form.get('decision')==='deny'){const denied=await this.api.denyConsent(request,handle);({redirectTo,headers}=denied);}
    else{
      const user=await this.session(request);if(form.get('userId')!==user.id)reject('ACCOUNT_CHANGED','Your signed-in account changed. Refresh this page before connecting.',409);
      if(form.get('decision')!=='approve')reject('invalid_request','Choose Allow or Cancel.');
      const scope=form.getAll('scope').map(String);if(!scope.length||scope.some(s=>!pending.scopes.includes(s)))reject('invalid_scope','Approve only the displayed permissions.');
      const grants=await this.api.listUserGrants(user.id,{limit:50});if(grants.items.filter(g=>!g.expiresAt||g.expiresAt>Date.now()/1000).length>=20)reject('LIMIT_EXCEEDED','Disconnect an application before adding another.');
      const approved=await this.api.approveConsent(request,handle,{scope}),details=await this.api.describeConsent(approved.request);
      ({redirectTo}=await this.api.completeAuthorization({request:approved.request,userId:user.id,metadata:{name:details.clientName.slice(0,100),domain:details.clientDomain??null,redirectHost:details.redirectHost},scope,props:{userId:user.id,clientOrigin:new URL(approved.request.redirectUri).origin}}));headers=approved.headers;
    }
    await this.storage.delete(key);for(const [key,value]of Object.entries(safeHeaders))headers.set(key,value);
    if(request.headers.get('accept')?.includes('application/json')){headers.delete('Location');headers.set('Content-Type','application/json');return new Response(JSON.stringify({redirectTo}),{headers});}
    headers.set('Location',redirectTo);return new Response(null,{status:302,headers});
  }
  async connections(request){
    const user=await this.session(request),url=new URL(request.url);
    if(request.method==='GET'&&url.pathname==='/oauth/connections'){
      const cursor=url.searchParams.get('cursor');if(cursor&&(cursor.length>4000||!/^[A-Za-z0-9_-]+$/.test(cursor)))reject('INVALID_INPUT','Invalid connection cursor.');
      const result=await this.api.listUserGrants(user.id,{limit:50,...(cursor?{cursor}:{})});
      return json({items:result.items.map(g=>({id:g.id,name:g.metadata?.name??'Application',domain:g.metadata?.domain??null,redirectHost:g.metadata?.redirectHost??null,scopes:g.scope,createdAt:g.createdAt*1000,expiresAt:g.expiresAt?g.expiresAt*1000:null})),next:result.cursor??null});
    }
    sameOrigin(request,true);const match=url.pathname.match(/^\/oauth\/connections\/([A-Za-z0-9_-]{8,128})$/);
    if(request.method!=='DELETE'||!match)reject('NOT_FOUND','Unknown connection route.',404);
    if(!await this.kv.get('grant:'+user.id+':'+match[1]))reject('NOT_FOUND','Unknown application connection.',404);
    await this.api.revokeGrant(match[1],user.id);return json({success:true});
  }
  async handle(request){
    try{
      const url=new URL(request.url);if(url.origin!==this.issuer)reject('invalid_request','Use the canonical AIHackr authorization server.');
      const path=url.pathname;
      if(path.startsWith('/oauth/connections'))return await this.exclusive(()=>this.connections(request));
      if(request.method==='OPTIONS'&&path!=='/oauth/authorize')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'content-type, authorization','Cache-Control':'public, max-age=300'}});
      let clientId=path==='/oauth/authorize'&&request.method==='GET'?url.searchParams.get('client_id'):null;
      if(request.method==='POST'){
        const raw=await boundedText(request,32768);request=new Request(request,{body:raw});
        if(path==='/oauth/token'){
          const form=new URLSearchParams(raw);clientId=form.get('client_id');
          if(form.get('client_assertion')){let asserted;try{asserted=JSON.parse(atob(form.get('client_assertion').split('.')[1].replaceAll('-','+').replaceAll('_','/'))).iss;}catch{reject('invalid_client','Invalid client assertion.');}this.clientPolicy(asserted);if(clientId&&clientId!==asserted)reject('invalid_client','Client assertion mismatch.');clientId=asserted;}
          const basic=request.headers.get('authorization');if(basic?.startsWith('Basic ')){let presented;try{presented=decodeURIComponent(atob(basic.slice(6)).split(':')[0]);}catch{reject('invalid_client','Invalid client authentication.');}this.clientPolicy(presented);if(clientId&&clientId!==presented)reject('invalid_client','Client authentication mismatch.');clientId=presented;}
        }
      }
      if(path==='/oauth/authorize')await this.throttle(request,'authorize');else if(request.method==='POST')await this.throttle(request,path==='/oauth/register'?'register':'token');
      // Fetch public CIMD metadata before the mutation queue. A slow/unavailable
      // client document must not hold up token validation or disconnects.
      if(clientId){this.clientPolicy(clientId);if(clientId.startsWith('https:'))await this.api.lookupClient(clientId);}
      return await this.exclusive(async()=>{
      if(path==='/oauth/authorize'){if(request.method==='GET')return this.begin(request);if(request.method==='POST')return this.decide(request);reject('invalid_request','Use an OAuth authorization request.');}
      const tasks=[],ctx={waitUntil:task=>tasks.push(Promise.resolve(task)),passThroughOnException(){}};
      const response=await this.server.fetch(request,this.env,ctx);await Promise.all(tasks);
      const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('Referrer-Policy','no-referrer');headers.set('X-Content-Type-Options','nosniff');
      headers.set('Access-Control-Allow-Origin','*');
      return new Response(response.body,{status:response.status,headers});
      });
    }catch(error){
      if(error.code==='RATE_LIMITED')return json({error:'temporarily_unavailable',error_description:'Too many OAuth requests. Please try again later.'},429,{'Retry-After':'60'});
      if(error instanceof AuthorizationError||error instanceof CimdFetchError||error instanceof OAuthError)return json({error:error.code??'invalid_client',error_description:error instanceof CimdFetchError?'The application metadata could not be verified.':error.description??'The OAuth request could not be completed.'},error.statusCode??400);
      if(error.code?.match(/^(invalid_|unsupported_|access_denied)/))return json({error:error.code,error_description:error.message},error.status??400);
      return errorResponse(error);
    }
  }
  async validate(token,resource){return this.exclusive(async()=>{
    if(resource!==this.resource||typeof token!=='string'||token.length>2048)return null;
    const valid=await this.server.validateToken(resource,token,this.env);if(!valid||valid.props?.userId!==valid.userId||valid.expiresAt<=Date.now()/1000)return null;
    const user=await this.storage.get('user:'+valid.userId);if(!user)return null;
    return {id:user.id,email:user.email,trialLimit:user.trialLimit,trialReserved:user.trialReserved,kind:'oauth',scopes:valid.scope,clientId:valid.clientId,oauthOrigin:valid.props.clientOrigin??this.issuer};
  });}
  async cleanup(){return this.exclusive(async()=>{await this.kv.cleanup();const entries=await this.storage.list({prefix:'oauth-ui:',limit:200});for(const[key,value]of entries)if(value.expiresAt<=Date.now())await this.storage.delete(key);});}
}
