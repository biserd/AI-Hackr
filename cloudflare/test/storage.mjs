export class Storage{
  data=new Map();queue=Promise.resolve();
  async get(key){return structuredClone(this.data.get(key));}
  async put(key,value){if(typeof key==='object'){for(const[k,v]of Object.entries(key))this.data.set(k,structuredClone(v));}else this.data.set(key,structuredClone(value));}
  async delete(key){return this.data.delete(key);}
  async list({prefix='',startAfter='',end,limit=1000,reverse=false}={}){let items=[...this.data].filter(([k])=>k.startsWith(prefix)&&k>startAfter&&(!end||k<end)).sort(([a],[b])=>a<b?-1:a>b?1:0);if(reverse)items.reverse();return new Map(items.slice(0,limit).map(([k,v])=>[k,structuredClone(v)]));}
  async setAlarm(time){this.alarm=time;}
  transaction(action){const run=this.queue.then(async()=>{const before=structuredClone(this.data);try{return await action(this);}catch(error){this.data=before;throw error;}});this.queue=run.catch(()=>{});return run;}
}
