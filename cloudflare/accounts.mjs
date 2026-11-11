import {ServiceError,bearer,boundedJson,credentialMatches,json,onlyKeys,reject} from './policy.mjs';
import {CreditLedger} from './credits.mjs';
import {POLICY_VERSION} from './policies.mjs';

export const SESSION_COOKIE='__Host-aihackr_session';
export const CHALLENGE_COOKIE='__Host-aihackr_challenge';
export const SESSION_TTL=7*86400000;
const CODE_TTL=10*60000;
export const opaque=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
export async function digest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');}
export function cookie(request,name){return request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);}
export const setCookie=(name,value,maxAge)=>`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
export async function rpcResult(action){try{return {ok:true,value:await action()};}catch(error){if(error instanceof ServiceError)return {ok:false,error:{code:error.code,message:error.message,status:error.status}};throw error;}}
export async function directoryCall(env,method,...args){const result=await env.ACCOUNT_DIRECTORY.getByName('accounts-v1')[method](...args);if(!result.ok)reject(result.error.code,result.error.message,result.error.status);return result.value;}
export function sameOrigin(request,required=false){const origin=request.headers.get('origin');if((required&&!origin)||(origin&&origin!==new URL(request.url).origin))reject('ORIGIN_RESTRICTED','Use this account from the AIHackr website.',403);}
function normalizeEmail(raw){const value=typeof raw==='string'?raw.trim().toLowerCase():'';if(value.length>254||!value.match(/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i)||value.includes('..'))reject('INVALID_INPUT','Enter a valid email address.');return value;}

// Only hashed challenge, session and API-key secrets are persisted. The directory
// also serializes account-wide reservations so new accounts cannot multiply spend.
export class AccountService {
  constructor(storage,{send,now=()=>Date.now(),globalLimit=1000,monthlyFreeCredits=0}={}){this.storage=storage;this.send=send;this.now=now;this.globalLimit=globalLimit;this.credits=new CreditLedger(storage,now,monthlyFreeCredits);}
  async throttle(txn,key,limit,windowMs){const now=this.now();let item=await txn.get(key);if(!item||item.expiresAt<=now)item={count:0,expiresAt:now+windowMs};if(item.count>=limit)reject('RATE_LIMITED','Too many attempts. Please try again later.',429);item.count++;await txn.put(key,item);}
  async start(raw,ip){
    const email=normalizeEmail(raw),emailId=await digest(email),ipId=await digest(ip),challenge=opaque();
    const number=crypto.getRandomValues(new Uint32Array(1))[0];const code=String(number%100000000).padStart(8,'0');
    const challengeId=await digest(challenge),codeHash=await digest(challenge+':'+code),now=this.now();
    await this.storage.transaction(async txn=>{
      await this.throttle(txn,'rate:ip:'+ipId,10,3600000);
      await this.throttle(txn,'rate:email:'+emailId,5,3600000);
      await this.throttle(txn,'rate:global',100,3600000);
      const previous=await txn.get('sent:'+emailId);if(previous?.expiresAt>now)reject('RATE_LIMITED','Please wait one minute before requesting another code.',429);
      await txn.put('sent:'+emailId,{expiresAt:now+60000});
      await txn.put('challenge:'+challengeId,{email,emailId,ipId,codeHash,attempts:0,expiresAt:now+CODE_TTL});
    });
    await this.storage.setAlarm(now+3600000);
    try{await this.send({to:email,from:'hello@aihackr.com',subject:'Your AIHackr sign-in code',text:`Your AIHackr sign-in code is ${code}.\n\nIt expires in 10 minutes and can only be used once. If you did not request this code, you can ignore this email.\n\nAIHackr\nhttps://aihackr.com`});}
    catch{await this.storage.delete('challenge:'+challengeId);reject('EMAIL_UNAVAILABLE','We could not send your code. Please try again shortly.',503);}
    return challenge;
  }
  async verify(challenge,code){
    if(!/^[a-f0-9]{64}$/.test(challenge??'')||!/^\d{8}$/.test(code??''))reject('INVALID_CODE','Enter the eight-digit code from your email.',401);
    const id=await digest(challenge),codeHash=await digest(challenge+':'+code),session=opaque(),sessionId=await digest(session),now=this.now();
    const result=await this.storage.transaction(async txn=>{
      const item=await txn.get('challenge:'+id);
      if(!item||item.expiresAt<=now||item.attempts>=5)return {error:true};
      if(item.codeHash!==codeHash){item.attempts++;await txn.put('challenge:'+id,item);return {error:true};}
      let userId=await txn.get('email:'+item.emailId),user=userId?await txn.get('user:'+userId):null;
      if(!user){
        await this.throttle(txn,'signup:ip:'+item.ipId,3,86400000);await this.throttle(txn,'signup:global',50,86400000);
        user={id:crypto.randomUUID(),email:item.email,createdAt:now,trialReserved:0,trialLimit:this.credits.monthlyFreeCredits?0:20};userId=user.id;
        await txn.put('email:'+item.emailId,userId);await txn.put('user:'+userId,user);
      }
      await txn.delete('challenge:'+id);
      await txn.put('session:'+sessionId,{userId,expiresAt:now+SESSION_TTL});
      return {user};
    });
    if(result.error)reject('INVALID_CODE','That code is invalid, expired or already used. Request another code if needed.',401);
    return {session,user:result.user};
  }
  async authenticate(token,kind='session'){
    if(typeof token!=='string'||token.length>128||token.length<32)return null;
    const record=await this.storage.get(kind+':'+await digest(token));
    if(!record||record.expiresAt&&record.expiresAt<=this.now())return null;
    const user=await this.storage.get('user:'+record.userId);return user?{id:user.id,email:user.email,trialReserved:user.trialReserved,trialLimit:user.trialLimit,kind}:null;
  }
  async logout(token){if(token)await this.storage.delete('session:'+await digest(token));}
  async keys(userId){return [...(await this.storage.list({prefix:'keymeta:'+userId+':'})).values()].map(({hash,...item})=>item);}
  async createKey(userId,name){
    if(typeof name!=='string'||!name.trim()||name.trim().length>60)reject('INVALID_INPUT','Give the key a name of up to 60 characters.');
    const token='ahk_live_'+opaque(),hash=await digest(token),id=crypto.randomUUID();
    await this.storage.transaction(async txn=>{
      if((await txn.list({prefix:'keymeta:'+userId+':'})).size>=5)reject('LIMIT_EXCEEDED','You can have up to five active API keys.');
      const item={id,name:name.trim(),suffix:token.slice(-4),createdAt:this.now(),hash};
      await txn.put('keymeta:'+userId+':'+id,item);await txn.put('key:'+hash,{userId});
    });
    return {id,key:token};
  }
  async revokeKey(userId,id){
    if(!/^[a-f0-9-]{36}$/.test(id))reject('NOT_FOUND','Unknown API key.',404);
    await this.storage.transaction(async txn=>{const key='keymeta:'+userId+':'+id,item=await txn.get(key);if(!item)reject('NOT_FOUND','Unknown API key.',404);await txn.delete('key:'+item.hash);await txn.delete(key);});
    return {success:true};
  }
  async reserve(pages,userId){
    if(!Number.isInteger(pages)||pages<0||pages>100)reject('INVALID_INPUT','Invalid reservation.');
    if(!pages)return;
    await this.storage.transaction(async txn=>{
      const day=new Date(this.now()).toISOString().slice(0,10);let budget=await txn.get('global:budget');if(!budget||budget.day!==day)budget={day,pages:0};
      if(budget.pages+pages>this.globalLimit)reject('DAILY_LIMIT','AIHackr has reached its daily service allowance. Please try again tomorrow.',429);
      budget.pages+=pages;await txn.put('global:budget',budget);
    });
  }
  async creditSummary(userId){return this.credits.summary(userId);}
  async recordBillingConsent(userId,version){if(version!==POLICY_VERSION)reject('INVALID_INPUT','Unknown policy version.');if(!await this.storage.get('user:'+userId))reject('AUTH_REQUIRED','Unknown account.',401);const consent={version,acceptedAt:this.now(),purpose:'subscription_checkout'};await this.storage.put('billing-consent:'+userId,consent);return consent;}
  async creditReserve(userId,id,units,details){return this.credits.reserve(userId,id,units,details);}
  async creditSettle(userId,id,units){return this.credits.settle(userId,id,units);}
  async creditGrant(userId,grant){return this.credits.grant(userId,grant);}
  async creditEntries(userId,cursor){return this.credits.entries(userId,cursor);}
  async creditDaily(userId){return this.credits.daily(userId);}
  async billingUpdate(userId,update){return this.credits.billing(userId,update);}
  async billingRisk(userId,invoice,reason){return this.credits.risk(userId,invoice,reason);}
  async billingCustomer(userId,customer){
    return this.storage.transaction(async tx=>{
      const user=await tx.get('user:'+userId);if(!user)reject('AUTH_REQUIRED','Unknown account.',401);
      if(customer){if(user.stripeCustomer&&user.stripeCustomer!==customer)reject('BILLING_CONFLICT','Account already linked.',409);user.stripeCustomer=customer;await tx.put('user:'+userId,user);await tx.put('customer:'+customer,userId);}
      return user.stripeCustomer??null;
    });
  }
  async customerOwner(customer){return await this.storage.get('customer:'+customer)??null;}
  async billingEvent(id,done=false){const key='stripe-event:'+id;if(done)await this.storage.put(key,{at:this.now()});return Boolean(await this.storage.get(key));}
  async billingThrottle(userId){return this.storage.transaction(tx=>this.throttle(tx,'rate:billing:'+userId,10,60000));}
  async checkoutAttempt(userId,plan,price){
    return this.storage.transaction(async tx=>{
      const key='checkout:'+userId;
      let attempt=await tx.get(key);
      if(attempt&&attempt.createdAt>this.now()-1920000){
        if(attempt.plan!==plan||attempt.price!==price)reject('CHECKOUT_PENDING','Close the unpaid checkout before choosing a different plan or price.',409);
        return attempt;
      }
      attempt={id:crypto.randomUUID(),suffix:Array.from(crypto.getRandomValues(new Uint8Array(8)),b=>String.fromCharCode(97+b%26)).join(''),plan,price,createdAt:this.now()};
      await tx.put(key,attempt);
      return attempt;
    });
  }
  async checkoutPending(userId,attemptId,session){return this.storage.transaction(async tx=>{const key='checkout:'+userId,attempt=await tx.get(key);if(attemptId){if(attempt?.id!==attemptId)reject('BILLING_CONFLICT','Checkout attempt changed. Refresh the dashboard.',409);if(session===null){await tx.delete(key);return null;}attempt.session=session;await tx.put(key,attempt);}return attempt??null;});}
  async cleanup(){
    for(const prefix of ['challenge:','session:','rate:','sent:','signup:']){let start;for(;;){const entries=await this.storage.list({prefix,...(start?{startAfter:start}:{}),limit:500});for(const[key,value]of entries)if(value.expiresAt<=this.now())await this.storage.delete(key);if(entries.size<500)break;start=[...entries.keys()].at(-1);}}
    await this.storage.setAlarm(this.now()+3600000);
  }
}

export async function authenticate(request,env){
  sameOrigin(request);const token=bearer(request.headers);
  if(token&&await credentialMatches(token,env.AIHACKR_API_KEY))return {operator:true,kind:'operator'};
  const kind=token?'key':'session',value=token??cookie(request,SESSION_COOKIE);
  const user=value?await directoryCall(env,'authenticate',value,kind):null;
  if(!user)reject('AUTH_REQUIRED','Sign in to your AIHackr account or provide a valid API key.',401);
  if(kind==='session'&&!['GET','HEAD'].includes(request.method))sameOrigin(request,true);
  return user;
}
export async function authRoute(request,env){
  const path=new URL(request.url).pathname;sameOrigin(request,true);
  if(request.method!=='POST')reject('NOT_FOUND','Unknown account route.',404);
  if(path==='/auth/start'){
    const body=await boundedJson(request,2048);onlyKeys(body,['email']);const challenge=await directoryCall(env,'start',body.email,request.headers.get('cf-connecting-ip')??'unknown');
    return json({success:true,message:'Check your email for an eight-digit sign-in code.'},200,{'Set-Cookie':setCookie(CHALLENGE_COOKIE,challenge,600)});
  }
  if(path==='/auth/verify'){
    const body=await boundedJson(request,2048);onlyKeys(body,['code']);const result=await directoryCall(env,'verify',cookie(request,CHALLENGE_COOKIE),body.code);
    const response=json({success:true,user:{email:result.user.email}},200,{'Set-Cookie':setCookie(SESSION_COOKIE,result.session,SESSION_TTL/1000)});
    response.headers.append('Set-Cookie',setCookie(CHALLENGE_COOKIE,'',0));return response;
  }
  if(path==='/auth/logout'){await directoryCall(env,'logout',cookie(request,SESSION_COOKIE));return json({success:true},200,{'Set-Cookie':setCookie(SESSION_COOKIE,'',0)});}
  reject('NOT_FOUND','Unknown account route.',404);
}
