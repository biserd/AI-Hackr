// The official provider consumes a KV-shaped interface. SQLite DO storage gives
// the existing account directory strongly consistent reads and immediate revoke.
// OAuthService serializes protocol mutations, including provider waitUntil work.
export class OAuthStorage {
  constructor(storage,{prefix='oauth-kv:',now=()=>Date.now()}={}){this.storage=storage;this.prefix=prefix;this.now=now;}
  async get(key,options={}){
    if(Array.isArray(key))return new Map(await Promise.all(key.map(async k=>[k,await this.get(k,options)])));
    const item=await this.storage.get(this.prefix+key);if(!item||item.expiration&&item.expiration*1000<=this.now())return null;
    const type=typeof options==='string'?options:options.type;
    if(type==='json')return JSON.parse(item.value);if(type==='arrayBuffer')return new TextEncoder().encode(item.value).buffer;
    return item.value;
  }
  async put(key,value,options={}){
    if(typeof key!=='string'||key.length>1800||typeof value!=='string')throw new TypeError('Invalid OAuth storage entry');
    const expiration=options.expiration??(options.expirationTtl?Math.floor(this.now()/1000)+options.expirationTtl:undefined),item={value,metadata:options.metadata,expiration};
    if(new TextEncoder().encode(JSON.stringify(item)).length>100000)throw new TypeError('OAuth storage entry too large');
    await this.storage.put({[this.prefix+key]:item,...(expiration?{['oauth-expiry:'+String(expiration).padStart(12,'0')+':'+this.prefix+key]:this.prefix+key}:{})});
  }
  async delete(key){await this.storage.delete(this.prefix+key);}
  async list({prefix='',cursor,limit=1000}={}){
    limit=Math.max(1,Math.min(999,limit));
    if(cursor&&(cursor.length>4000||!/^[A-Za-z0-9_-]+$/.test(cursor)))throw new TypeError('Invalid OAuth storage cursor');
    const after=cursor?new TextDecoder().decode(Uint8Array.from(atob(cursor.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))):null;
    if(after&&!after.startsWith(this.prefix+prefix))throw new TypeError('OAuth cursor outside namespace');
    const entries=await this.storage.list({prefix:this.prefix+prefix,...(after?{startAfter:after}:{}),limit:Math.min(1000,limit)+1});
    const rows=[...entries],hasMore=rows.length>limit,visible=rows.slice(0,limit),keys=[];
    for(const [key,item]of visible)if(!item.expiration||item.expiration*1000>this.now())keys.push({name:key.slice(this.prefix.length),expiration:item.expiration,metadata:item.metadata});
    const last=visible.at(-1)?.[0],next=hasMore&&last?btoa(String.fromCharCode(...new TextEncoder().encode(last))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,''):'';
    return {keys,list_complete:!hasMore,cursor:next};
  }
  async cleanup(){
    const rows=await this.storage.list({prefix:'oauth-expiry:',limit:200}),now=Math.floor(this.now()/1000);
    for(const [key,target]of rows){if(Number(key.split(':')[1])>now)break;const item=await this.storage.get(target);if(item?.expiration<=now)await this.storage.delete(target);await this.storage.delete(key);}
  }
}
