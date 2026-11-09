export class Storage{
  data=new Map();queue=Promise.resolve();
  async get(key){return structuredClone(this.data.get(key));}
  async put(key,value){if(typeof key==='object')for(const[k,v]of Object.entries(key))this.data.set(k,structuredClone(v));else this.data.set(key,structuredClone(value));}
  async delete(key){return this.data.delete(key);}
  async list({prefix='',startAfter='',end,limit=1000,reverse=false}={}){let rows=[...this.data].filter(([k])=>k.startsWith(prefix)&&k>startAfter&&(!end||k<end)).sort(([a],[b])=>a<b?-1:a>b?1:0);if(reverse)rows.reverse();return new Map(rows.slice(0,limit).map(([k,v])=>[k,structuredClone(v)]));}
  async setAlarm(time){this.alarm=time;}
  transaction(action){const next=this.queue.then(async()=>{const snapshot=structuredClone(this.data);try{return await action(this);}catch(error){this.data=snapshot;throw error;}});this.queue=next.catch(()=>{});return next;}
}
