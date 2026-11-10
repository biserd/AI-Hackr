import {reject} from './policy.mjs';

// All balances and holds live in the account directory, shared by REST and MCP.
// Monetary billing is fixed-price. These are application entitlements, not charges.
export class CreditLedger {
  constructor(storage,now=()=>Date.now()){this.storage=storage;this.now=now;}
  async state(tx,userId){
    let state=await tx.get('credits:'+userId);
    if(!state){
      const user=await tx.get('user:'+userId);if(!user)reject('AUTH_REQUIRED','Unknown account.',401);
      const total=user.trialLimit??20,used=Math.min(total,user.trialReserved??0);
      state={grants:[{id:'trial',label:'Free trial',total,spent:used,held:0,expiresAt:null}],billing:null};
      await tx.put('credits:'+userId,state);
    }
    return state;
  }
  valid(g){return !g.revoked&&(!g.startsAt||g.startsAt<=this.now())&&(!g.expiresAt||g.expiresAt>this.now());}
  async entry(tx,userId,item){const id=String(this.now()).padStart(13,'0')+':'+crypto.randomUUID();await tx.put('ledger:'+userId+':'+id,{id,at:this.now(),...item});if(item.type==='settle'){const key='daily-usage:'+userId+':'+new Date(this.now()).toISOString().slice(0,10);await tx.put(key,(await tx.get(key)??0)+item.units);}}
  async daily(userId){const days=[];for(let i=13;i>=0;i--){const day=new Date(this.now()-i*86400000).toISOString().slice(0,10);days.push({day,units:await this.storage.get('daily-usage:'+userId+':'+day)??0});}return days;}
  async summary(userId){return this.storage.transaction(async tx=>{
    const s=await this.state(tx,userId),active=s.grants.filter(g=>this.valid(g));
    return {available:s.billing?.hold?0:active.reduce((n,g)=>n+Math.max(0,g.total-g.spent-g.held),0),held:s.grants.reduce((n,g)=>n+g.held,0),used:active.reduce((n,g)=>n+g.spent,0),allowance:active.reduce((n,g)=>n+g.total,0),billing:s.billing??{plan:'free',status:'free'},costs:{scrape:1,map:1,extract:5,crawl:1}};
  });}
  async reserve(userId,id,units,details={}){
    if(!Number.isInteger(units)||units<1||units>100)reject('INVALID_INPUT','Invalid credit reservation.');
    return this.storage.transaction(async tx=>{
      const key='hold:'+userId+':'+id,previous=await tx.get(key);
      if(previous){if(previous.units!==units)reject('IDEMPOTENCY_CONFLICT','Reservation already exists.',409);return previous;}
      const s=await this.state(tx,userId);if(s.billing?.hold)reject('BILLING_REVIEW','Billing requires review. Please contact support.',402);
      const grants=s.grants.filter(g=>this.valid(g)).sort((a,b)=>(a.expiresAt??Infinity)-(b.expiresAt??Infinity));
      if(grants.reduce((n,g)=>n+Math.max(0,g.total-g.spent-g.held),0)<units)reject('CREDITS_EXHAUSTED','Not enough credits. Choose a plan from your dashboard or lower the crawl page limit.',402);
      let remaining=units;const allocations=[];
      for(const g of grants){const take=Math.min(remaining,Math.max(0,g.total-g.spent-g.held));if(take){g.held+=take;allocations.push({grant:g.id,units:take});remaining-=take;}if(!remaining)break;}
      const hold={id,userId,units,allocations,status:'held',createdAt:this.now(),...details};
      await tx.put(key,hold);await tx.put('credits:'+userId,s);await this.entry(tx,userId,{type:'reserve',operationId:id,units,operation:details.operation,url:details.url});return hold;
    });
  }
  async settle(userId,id,units){return this.storage.transaction(async tx=>{
    const key='hold:'+userId+':'+id,h=await tx.get(key);if(!h)reject('NOT_FOUND','Unknown credit reservation.',404);
    if(h.status!=='held')return h;
    if(!Number.isInteger(units)||units<0||units>h.units)reject('INVALID_INPUT','Invalid credit settlement.');
    const s=await this.state(tx,userId);let remaining=units;
    for(const a of h.allocations){const g=s.grants.find(g=>g.id===a.grant);if(!g)throw new Error('Missing credit grant');const charged=Math.min(remaining,a.units);g.held-=a.units;g.spent+=charged;remaining-=charged;}
    Object.assign(h,{status:'settled',charged:units,released:h.units-units,settledAt:this.now()});
    await tx.put(key,h);await tx.put('credits:'+userId,s);await this.entry(tx,userId,{type:'settle',operationId:id,units,returned:h.released,operation:h.operation,url:h.url});return h;
  });}
  async grant(userId,grant){return this.storage.transaction(async tx=>{
    const s=await this.state(tx,userId),marker='grant:'+userId+':'+grant.id;if(await tx.get(marker))return {duplicate:true};
    if(!Number.isSafeInteger(grant.total)||grant.total<0||!grant.expiresAt)throw new Error('Invalid paid grant');
    s.grants=s.grants.filter(g=>g.id==='trial'||this.valid(g)||g.held||g.expiresAt>this.now()-366*86400000);
    s.grants.push({...grant,held:0,spent:0});await tx.put('credits:'+userId,s);await tx.put(marker,{at:this.now()});
    await this.entry(tx,userId,{type:'grant',units:grant.total,label:grant.label,expiresAt:grant.expiresAt,invoice:grant.invoice});return {duplicate:false};
  });}
  async billing(userId,update){return this.storage.transaction(async tx=>{
    const s=await this.state(tx,userId);if((s.billing?.updated??0)>(update.updated??0))return s.billing;
    s.billing={...s.billing,...update};await tx.put('credits:'+userId,s);return s.billing;
  });}
  async risk(userId,invoice,reason){return this.storage.transaction(async tx=>{
    const s=await this.state(tx,userId);s.billing={...s.billing,hold:true,reviewReason:reason};
    for(const g of s.grants)if(g.invoice===invoice)g.revoked=true;
    await tx.put('credits:'+userId,s);await this.entry(tx,userId,{type:'review',units:0,label:reason,invoice});return {review:true};
  });}
  async entries(userId,cursor){
    if(cursor&&(!/^[0-9]{13}:[a-f0-9-]{36}$/.test(cursor)))reject('INVALID_INPUT','Invalid usage cursor.');
    const prefix='ledger:'+userId+':',rows=await this.storage.list({prefix,reverse:true,limit:51,...(cursor?{end:prefix+cursor}:{})});
    const items=[...rows.values()];return {items:items.slice(0,50),next:items.length>50?items[49].id:null};
  }
}
