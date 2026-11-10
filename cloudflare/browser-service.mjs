import robotsParser from 'robots-parser';
import {directoryCall} from './accounts.mjs';
import {digest} from './accounts.mjs';
import {operationContext} from './operations.mjs';
import { ServiceError, reject, integer, validatePublicUrl, boundedText, onlyKeys } from './policy.mjs';

const userAgent = 'AIHackr/0.3 (+https://aihackr.com/docs)';
const origin = 'https://api.cloudflare.com/client/v4';
export const engineName = 'cloudflare-browser-run';
const terminal = status => ['completed', 'errored', 'cancelled_by_user', 'cancelled_due_to_timeout', 'cancelled_due_to_limits'].includes(status);
export class BrowserService {
  constructor(env, storage, { fetcher = (...args) => fetch(...args), validateUrl = validatePublicUrl } = {}) {
    this.env = env; this.storage = storage; this.fetcher = fetcher; this.validateUrl = validateUrl; this.robots = new Map();
  }
  async indexJobs(){
    if(await this.storage.get('jobs-index-v1'))return;
    let after;for(;;){const rows=await this.storage.list({prefix:'job:',limit:100,...(after?{startAfter:after}:{})});for(const [,job]of rows){if(!job.cached&&!terminal(job.status))await this.storage.put('active-crawl:'+job.id,job.id);await this.storage.put('jobexpiry:'+String(job.expiresAt).padStart(13,'0')+':'+job.id,job.id);}if(rows.size<100)break;after=[...rows.keys()].at(-1);}
    await this.storage.put('jobs-index-v1',true);
  }
  async reserve(pages = 1) {
    const day = new Date().toISOString().slice(0,10), minute = Math.floor(Date.now()/60000);
    await this.storage.transaction(async txn => {
      const budget = await txn.get('budget') ?? { day, pages: 0 };
      if (budget.day !== day) { budget.day = day; budget.pages = 0; }
      const rate = await txn.get('rate') ?? { minute, requests: 0 };
      if (rate.minute !== minute) { rate.minute = minute; rate.requests = 0; }
      if (rate.requests >= 30) reject('RATE_LIMITED', 'Workspace limit: 30 engine operations per minute. Retry later.', 429);
      if (budget.pages + pages > Number(this.env.DAILY_PAGE_LIMIT ?? 1000)) reject('DAILY_LIMIT', 'The workspace daily page allowance has been reached.', 429);
      budget.pages += pages; rate.requests++;
      await txn.put({ budget, rate });
    });
    if(this.env.ACCOUNT_DIRECTORY&&pages)await directoryCall(this.env,'reserve',pages,null);
  }
  async begin(operation,payload,units){
    const id=operationContext.getStore()??crypto.randomUUID(),fingerprint=await digest(JSON.stringify({operation,payload}));
    const previous=await this.storage.transaction(async tx=>{
      const previous=await tx.get('operation:'+id);
      if(previous){if(previous.fingerprint!==fingerprint)reject('IDEMPOTENCY_CONFLICT','This idempotency key was used for another request.',409);return previous;}
      await tx.put('operation:'+id,{id,operation,url:payload.url,fingerprint,customerId:this.env.CUSTOMER_ID??null,status:'running',reserved:units,createdAt:Date.now(),expiresAt:Date.now()+7*86400000});
      await tx.put('history:'+String(Date.now()).padStart(13,'0')+':'+id,id);
      await tx.put('pending:'+id,id);
    });
    if(previous){
      if(previous.operation==='crawl'&&['scraping','completed'].includes(previous.status)){if(previous.expiresAt<=Date.now())reject('RESULT_EXPIRED','Result expired. Submit a new idempotency key.',410);return {id,cached:{success:true,id,url:`/v2/crawl/${id}`,engine:engineName}};}
      if(previous.status==='completed'){if(previous.expiresAt<=Date.now())reject('RESULT_EXPIRED','Result expired. Submit a new idempotency key.',410);await this.finishCredits(previous);return {id,cached:await this.readOutput(id)};}
      if(previous.status==='failed')reject('PREVIOUS_REQUEST_FAILED','This request failed. Use a new idempotency key to retry.',409);
      reject('REQUEST_IN_PROGRESS','This request is already running. Check job history before retrying.',409);
    }
    await this.storage.setAlarm(Date.now()+15000);
    try{await this.reserve(operation==='crawl'?units:1);if(this.env.CUSTOMER_ID)await directoryCall(this.env,'creditReserve',this.env.CUSTOMER_ID,id,units,{operation,url:payload.url});}
    catch(error){await this.failOperation(id,error);throw error;}
    return {id};
  }
  async finishCredits(op){
    if(op.customerId&&!op.settled){await directoryCall(this.env,'creditSettle',op.customerId,op.id,op.charged??0);op.settled=true;await this.storage.put('operation:'+op.id,op);}
    await this.storage.delete('pending:'+op.id);
  }
  async completeOperation(id,result,charged){
    const encoded=JSON.stringify(result),chunks=Math.ceil(encoded.length/16000);
    for(let i=0;i<chunks;i++)await this.storage.put(`output:${id}:${i}`,encoded.slice(i*16000,(i+1)*16000));
    const op=await this.storage.get('operation:'+id);Object.assign(op,{status:'completed',charged,chunks,finishedAt:Date.now()});await this.storage.put('operation:'+id,op);
    await this.storage.put('expiry:'+String(op.expiresAt).padStart(13,'0')+':'+id,id);
    await this.finishCredits(op);
    return result;
  }
  async failOperation(id,error){
    const op=await this.storage.get('operation:'+id);if(!op||op.status==='completed')return;
    Object.assign(op,{status:'failed',charged:0,error:error?.code??'ENGINE_UNAVAILABLE',finishedAt:Date.now()});
    await this.storage.put('operation:'+id,op);
    try{await this.finishCredits(op);}catch(e){if(e.code==='NOT_FOUND'){op.settled=true;await this.storage.put('operation:'+id,op);await this.storage.delete('pending:'+id);}else throw e;}
  }
  async readOutput(id){const op=await this.storage.get('operation:'+id);let text='';for(let i=0;i<(op?.chunks??0);i++)text+=await this.storage.get(`output:${id}:${i}`);return text?JSON.parse(text):null;}
  async history(cursor){
    if(cursor&&!/^\d{13}:([a-f0-9-]{36}|[a-f0-9]{64})$/.test(cursor))reject('INVALID_INPUT','Invalid jobs cursor.');
    const rows=await this.storage.list({prefix:'history:',reverse:true,limit:51,...(cursor?{end:'history:'+cursor}:{})});
    const entries=[...rows],items=[];for(const [,id]of entries.slice(0,50)){const op=await this.storage.get('operation:'+id);if(op){const {fingerprint,customerId,chunks,...item}=op;items.push({...item,download:op.expiresAt>Date.now()&&op.status==='completed'?'/api/jobs/'+op.id:null});}}
    return {items,next:entries.length>50?entries[49][0].slice(8):null};
  }
  async result(id){if(!/^[a-f0-9-]{36}$|^[a-f0-9]{64}$/.test(id))reject('NOT_FOUND','Unknown job.',404);const op=await this.storage.get('operation:'+id);if(!op||op.expiresAt<=Date.now())reject('NOT_FOUND','Unknown or expired result.',404);if(op.operation==='crawl')return this.getCrawl(id);if(op.status!=='completed')reject('RESULT_PENDING','Result is not available.',409);return {job:op.id,operation:op.operation,url:op.url,credits:op.charged,result:await this.readOutput(id)};}
  async provider(action, method = 'POST', body, query = '') {
    let response;
    const isCrawl = action === 'crawl' || action.startsWith('crawl/');
    if (!isCrawl && this.env.BROWSER?.quickAction && !query) {
      response = await this.env.BROWSER.quickAction(action, body);
    } else {
      if (!this.env.CLOUDFLARE_BROWSER_TOKEN) reject('CAPABILITY_UNAVAILABLE', 'Managed crawl requires the operator Browser Run credential.', 503);
      response = await this.fetcher(`${origin}/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/browser-run/${action}${query}`, {
        method, headers: { Authorization: `Bearer ${this.env.CLOUDFLARE_BROWSER_TOKEN}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(55000), redirect: 'manual',
      });
    }
    if (response.status >= 300 && response.status < 400) reject('ENGINE_UNAVAILABLE','Browser Run redirected an authenticated request; the redirect was refused.',503);
    const text = await boundedText(response, 2 * 1024 * 1024);
    let data; try { data = JSON.parse(text); } catch { reject('ENGINE_UNAVAILABLE', 'Browser Run returned an invalid response.', 503); }
    if (!response.ok || data.success === false) {
      const status = response.status === 429 ? 429 : response.status === 400 || response.status === 422 ? 400 : 503;
      reject(status === 429 ? 'RATE_LIMITED' : 'ENGINE_UNAVAILABLE', status === 429 ? 'Cloudflare browser quota reached. Retry later.' : 'Cloudflare could not complete this operation. Check the target, workspace configuration and provider limits.', status);
    }
    return data;
  }
  async checkRobots(url) {
    const cached = this.robots.get(url.origin);
    let text;
    if (cached && cached.until > Date.now()) text = cached.text;
    else {
      let target = new URL('/robots.txt', url); let response;
      for (let i = 0; i < 4; i++) {
        await this.validateUrl(target.href);
        response = await this.fetcher(target, { redirect: 'manual', headers: { 'User-Agent': userAgent }, signal: AbortSignal.timeout(8000) });
        if (![301,302,303,307,308].includes(response.status)) break;
        const location = response.headers.get('location'); await response.body?.cancel();
        if (!location || i === 3) reject('ROBOTS_UNAVAILABLE', 'Unable to verify target robots rules.', 503);
        target = new URL(location, target);
      }
      if ([401,403].includes(response.status)) reject('ROBOTS_DISALLOWED', 'The target denies crawler access.', 403);
      if (response.status >= 500 || response.status === 429) reject('ROBOTS_UNAVAILABLE', 'Target robots rules are temporarily unavailable.', 503);
      text = response.ok ? await boundedText(response, 65536) : '';
      if (this.robots.size > 100) this.robots.clear();
      this.robots.set(url.origin, { text, until: Date.now() + 60000 });
    }
    const rules = robotsParser(new URL('/robots.txt', url).href, text);
    if (rules.isAllowed(url.href, userAgent) === false) reject('ROBOTS_DISALLOWED', 'The target robots rules disallow this page.', 403);
    const delay = rules.getCrawlDelay(userAgent);
    // Do not ignore an origin's requested delay or keep requests asleep indefinitely.
    if (delay > 0) reject('CRAWL_DELAY_REQUIRED', 'Use the managed crawl endpoint for sites that declare a crawl delay.', 403);
  }
  async page(action, body, {operation:operationName}={}) {
    onlyKeys(body, ['url','prompt','response_format','elements','visibleLinksOnly','gotoOptions','waitForSelector','browser']);
    if (!['markdown','content','links','json','scrape'].includes(action)) reject('CAPABILITY_UNAVAILABLE', 'This page operation is not exposed.', 404);
    if (body.browser) reject('UNSUPPORTED_OPTION', 'This workspace uses the default Chrome engine.');
    const url = await this.validateUrl(body.url); await this.checkRobots(url);
    if (action === 'json') {
      if (typeof body.prompt !== 'string' && !body.response_format) reject('INVALID_INPUT', 'Supply an extraction prompt or JSON schema.');
      if ((body.prompt?.length ?? 0) > 4000 || JSON.stringify(body.response_format ?? {}).length > 12000) reject('LIMIT_EXCEEDED', 'Extraction prompt or schema exceeds the workspace limit.');
      const walk = (value, depth=0) => { if (depth > 12) reject('INVALID_INPUT', 'The extraction schema is too deeply nested.'); if (value && typeof value === 'object') for (const [key,item] of Object.entries(value)) { if (key === '$ref' || key === 'custom_ai') reject('UNSUPPORTED_OPTION', 'External schema references and custom AI providers are not accepted.'); walk(item,depth+1); } };
      walk(body.response_format);
    }
    if (body.elements && (!Array.isArray(body.elements) || body.elements.length < 1 || body.elements.length > 10 || body.elements.some(item => typeof item.selector !== 'string' || item.selector.length > 250))) reject('INVALID_INPUT', 'Supply 1–10 bounded CSS selectors.');
    const options = { timeout: 30000, waitUntil: 'networkidle2' };
    if (body.gotoOptions) { onlyKeys(body.gotoOptions, ['waitUntil','timeout']); if (!['load','domcontentloaded','networkidle0','networkidle2'].includes(body.gotoOptions.waitUntil ?? 'networkidle2')) reject('INVALID_INPUT','Unsupported page wait condition.'); options.waitUntil = body.gotoOptions.waitUntil ?? 'networkidle2'; options.timeout = integer(body.gotoOptions.timeout,30000,45000,'Page timeout',1000); }
    const payload = { ...body, url: url.href, gotoOptions: options, rejectResourceTypes: ['image','media','font'], userAgent };
    delete payload.browser;
    if (body.waitForSelector && (typeof body.waitForSelector !== 'string' || body.waitForSelector.length > 200)) reject('INVALID_INPUT','Use a bounded CSS wait selector.');
    const units=action==='json'?5:1,operation=operationName??(action==='json'?'extract':action==='links'?'map':'scrape');
    const started=await this.begin(operation,payload,units);if(started.cached)return started.cached;
    let result;
    try{result = await this.provider(action, 'POST', payload);
    const final = result.meta?.finalUrl ?? url.href;
    await this.validateUrl(final);
    if (result.meta?.status >= 400) reject('TARGET_ERROR', `Target returned HTTP ${result.meta.status}.`, 422);
    if(result.result==null||result.result==='')reject('EMPTY_RESULT','The page returned no usable result.',422);
    }catch(error){await this.failOperation(started.id,error);throw error;}
    return this.completeOperation(started.id,result,units);
  }
  async createCrawl(body) {
    if (this.creatingCrawl) reject('RATE_LIMITED','Another crawl submission is in progress. Retry after it returns.',429);
    this.creatingCrawl = true;
    try { return await this.submitCrawl(body); }
    finally { this.creatingCrawl = false; }
  }
  async submitCrawl(body) {
    onlyKeys(body,['url','limit','depth','render','formats','source','maxAge','modifiedSince','options','browser']);
    const url = await this.validateUrl(body.url);
    if (!this.env.CLOUDFLARE_BROWSER_TOKEN) reject('CAPABILITY_UNAVAILABLE', 'Managed crawl requires the operator Browser Run credential.', 503);
    const limit = integer(body.limit,20,100,'Page limit'); const depth = integer(body.depth,2,5,'Crawl depth',0);
    if (body.render != null && typeof body.render !== 'boolean') reject('INVALID_INPUT','render must be true or false.');
    if (body.browser) reject('UNSUPPORTED_OPTION','This workspace uses the default Chrome engine.');
    const formats = body.formats ?? ['markdown'];
    if (!Array.isArray(formats) || !formats.length || formats.length > 2 || formats.some(format => !['markdown','html'].includes(format))) reject('UNSUPPORTED_OPTION','Crawls support markdown and html formats.');
    if (body.source && !['all','links','sitemaps'].includes(body.source)) reject('INVALID_INPUT','Invalid page discovery source.');
    const options = body.options ?? {};
    if (!options || typeof options !== 'object' || Array.isArray(options)) reject('INVALID_INPUT','Invalid crawl options.');
    onlyKeys(options,['includePatterns','excludePatterns']);
    for (const patterns of Object.values(options)) if (!Array.isArray(patterns) || patterns.length > 20 || patterns.some(pattern => typeof pattern !== 'string' || pattern.length > 200)) reject('INVALID_INPUT','Use at most 20 bounded URL patterns.');
    const payload = { url:url.href,limit,depth,render:body.render ?? true,formats,source:body.source ?? 'all',maxAge:integer(body.maxAge,0,604800,'Cache age',0),options:{...options,includeExternalLinks:false,includeSubdomains:false},crawlPurposes:['search','ai-input'],contentUse:'reference' };
    if (body.modifiedSince != null) payload.modifiedSince = integer(body.modifiedSince,0,Math.floor(Date.now()/1000),'Modified timestamp',0);
    if (payload.render) Object.assign(payload,{gotoOptions:{waitUntil:'networkidle2',timeout:30000},rejectResourceTypes:['image','media','font']});
    const replayId=operationContext.getStore();if(replayId&&await this.storage.get('operation:'+replayId))return (await this.begin('crawl',payload,limit)).cached;
    await this.indexJobs();const jobs = await this.storage.list({ prefix:'active-crawl:',limit:100 });
    let active = 0;
    for (const [,jobId] of jobs) {const job=await this.storage.get('job:'+jobId);if(job&&job.expiresAt > Date.now()) {
      const update=await this.getCrawl(job.id);if(!terminal(update.providerStatus))active++;
    }}
    if (active >= 2) reject('RATE_LIMITED','At most two managed crawl jobs may run at once.',429);
    const started=await this.begin('crawl',payload,limit);if(started.cached)return started.cached;
    let response;
    try{response = await this.provider('crawl','POST',payload);
    if (typeof response.result !== 'string' || !/^[a-zA-Z0-9-]{10,80}$/.test(response.result)) reject('ENGINE_UNAVAILABLE','Cloudflare returned an invalid crawl identifier.',503);
    }catch(error){await this.failOperation(started.id,error);throw error;}
    const id=started.id; const job={id,customerId:this.env.CUSTOMER_ID??null,providerId:response.result,status:'running',limit,url:url.href,createdAt:Date.now(),expiresAt:Date.now()+7*86400000,recordCount:0,cached:false};
    await this.storage.put('job:'+id,job);
    await this.storage.put('active-crawl:'+id,id);await this.storage.put('jobexpiry:'+String(job.expiresAt).padStart(13,'0')+':'+id,id);
    await this.storage.setAlarm(Date.now()+15000);
    const op=await this.storage.get('operation:'+id);op.status='scraping';await this.storage.put('operation:'+id,op);
    return {success:true,id,url:`/v2/crawl/${id}`,engine:engineName};
  }
  async getCrawl(id, offset=0) {
    if (!/^[a-zA-Z0-9-]{10,80}$/.test(id)) reject('NOT_FOUND','Unknown workspace crawl.',404);
    let job = await this.storage.get('job:'+id);
    if (!job || job.expiresAt <= Date.now()) reject('NOT_FOUND','Unknown or expired workspace crawl.',404);
    if (!job.cached) {
      await this.reserve(0);
      let cursor; let records=[]; let result;
      for (let page=0;page<10;page++) {
        const query='?limit=10'+(cursor?'&cursor='+encodeURIComponent(cursor):'');
        const r=await this.provider('crawl/'+job.providerId,'GET',undefined,query); result=r.result;
        if (!result || typeof result.status !== 'string') reject('ENGINE_UNAVAILABLE','Cloudflare returned an invalid crawl result.',503);
        records.push(...(result.records ?? [])); cursor=result.cursor;
        if (!terminal(result.status) || !cursor) break;
      }
      job.status=result.status; job.total=result.total; job.finished=result.finished; job.browserSecondsUsed=result.browserSecondsUsed;
      if (terminal(result.status) && !cursor) {
        if (records.length > job.limit) reject('ENGINE_UNAVAILABLE','Crawl exceeded its configured result bound.',503);
        records=records.map(record=>this.compactRecord(record));
        for (let i=0;i<records.length;i++) await this.storeRecord(id,i,records[i]);
        job.recordCount=records.length; job.cached=true;job.charged=records.filter(r=>this.successfulRecord(r)).length;
        job.retainedAt=Date.now(); job.expiresAt=job.retainedAt+7*86400000;
      }
      job=await this.storage.transaction(async tx=>{const current=await tx.get('job:'+id);if(current?.cached)return current;await tx.put('job:'+id,job);return job;});
      if (!job.cached) return this.crawlEnvelope(job,records.map(record=>this.compactRecord(record)),null);
    }
    const op=await this.storage.get('operation:'+id);
    if(op){Object.assign(op,{status:'completed',charged:job.charged??0,expiresAt:job.expiresAt,finishedAt:job.retainedAt,providerStatus:job.status});await this.storage.put('operation:'+id,op);await this.finishCredits(op);}
    await this.storage.delete('active-crawl:'+id);await this.storage.put('jobexpiry:'+String(job.expiresAt).padStart(13,'0')+':'+id,id);
    const records=[]; for(let i=offset;i<Math.min(offset+10,job.recordCount);i++) records.push(await this.readRecord(id,i));
    return this.crawlEnvelope(job,records,offset+10<job.recordCount?offset+10:null);
  }
  async storeRecord(id,index,record){const key=`record:${id}:${index}`,encoded=JSON.stringify(record),chunks=Math.ceil(encoded.length/16000);for(let i=0;i<chunks;i++)await this.storage.put(`${key}:chunk:${i}`,encoded.slice(i*16000,(i+1)*16000));await this.storage.put(key,{__aihackrChunks:chunks});}
  async readRecord(id,index){const key=`record:${id}:${index}`,item=await this.storage.get(key);if(!item?.__aihackrChunks)return item;let encoded='';for(let i=0;i<item.__aihackrChunks;i++)encoded+=await this.storage.get(`${key}:chunk:${i}`);return JSON.parse(encoded);}
  async deleteRecord(id,index){const key=`record:${id}:${index}`,item=await this.storage.get(key);for(let i=0;i<(item?.__aihackrChunks??0);i++)await this.storage.delete(`${key}:chunk:${i}`);await this.storage.delete(key);}
  compactRecord(record) {
    const output={url:record.url,status:record.status,outcome:record.outcome,metadata:record.metadata};
    for(const key of ['markdown','html']) if(typeof record[key]==='string') {output[key]=record[key].slice(0,60000); if(record[key].length>60000) output.truncated=true;}
    if(output.truncated) output.warnings=['Page content limited to 60000 characters per format.'];
    return output;
  }
  successfulRecord(record){const http=record.metadata?.status??record.metadata?.statusCode;if(http>=400||!record.markdown&&!record.html)return false;return ['completed','success','succeeded'].includes(record.status??record.outcome)||!(record.status||record.outcome);}
  crawlEnvelope(job,records,next) {
    const status = job.status==='completed'?'completed':job.status==='cancelled_by_user'?'cancelled':terminal(job.status)?'failed':'scraping';
    return {success:true,id:job.id,status,providerStatus:job.status,total:job.total??0,completed:job.finished??0,data:records,records, next:next==null?null:`/v2/crawl/${job.id}?cursor=${next}`,expiresAt:new Date(job.expiresAt).toISOString(),usage:{browserSecondsUsed:job.browserSecondsUsed??null},engine:engineName};
  }
  async cancelCrawl(id) {
    const job=await this.storage.get('job:'+id); if(!job || job.expiresAt<=Date.now()) reject('NOT_FOUND','Unknown workspace crawl.',404);
    if(!terminal(job.status)) await this.provider('crawl/'+job.providerId,'DELETE');
    job.cancelRequested=true;await this.storage.put('job:'+id,job);await this.storage.setAlarm(Date.now()+15000);
    // Keep the hold until the provider reports terminal records, including partial results.
    await this.getCrawl(id);
    return {success:true,id,status:job.status==='completed'?'completed':'cancelled',engine:engineName};
  }
  async cleanup() {
    await this.indexJobs();
    const jobs=await this.storage.list({prefix:'active-crawl:',limit:100});
    let pending=false;
    for(const [,id] of jobs){const job=await this.storage.get('job:'+id);if(job&&job.expiresAt>Date.now()){pending=true;try{await this.getCrawl(job.id);}catch{/* Transient failures keep the hold; a later alarm retries. */}}}
    const operations=await this.storage.list({prefix:'pending:',limit:100});
    for(const [,id]of operations){const op=await this.storage.get('operation:'+id);if(!op){await this.storage.delete('pending:'+id);continue;}
      if(op.status==='running'&&op.createdAt<Date.now()-120000)await this.failOperation(op.id,{code:'INTERRUPTED'});
      if(['completed','failed'].includes(op.status)&&!op.settled&&op.customerId){try{await this.finishCredits(op);}catch{pending=true;}}
      if(op.status==='running')pending=true;
    }
    for(const [key,id]of await this.storage.list({prefix:'expiry:',limit:100})){const op=await this.storage.get('operation:'+id);if(op?.expiresAt>Date.now())break;if(op?.chunks){for(let i=0;i<op.chunks;i++)await this.storage.delete(`output:${id}:${i}`);delete op.chunks;await this.storage.put('operation:'+id,op);}await this.storage.delete(key);}
    for(const [key,id]of await this.storage.list({prefix:'jobexpiry:',limit:100})){if(Number(key.split(':')[1])>Date.now())break;const job=await this.storage.get('job:'+id);if(job?.expiresAt<=Date.now()){if(!job.cached)await this.failOperation(job.id,{code:'RESULT_EXPIRED'});await this.storage.delete('job:'+id);await this.storage.delete('active-crawl:'+id);for(let i=0;i<job.recordCount;i++)await this.deleteRecord(job.id,i);}await this.storage.delete(key);}
    await this.storage.setAlarm(Date.now()+(pending?15000:3600000));
  }
}
