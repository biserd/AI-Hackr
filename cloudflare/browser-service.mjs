import robotsParser from 'robots-parser';
import { ServiceError, reject, integer, validatePublicUrl, boundedText, onlyKeys } from './policy.mjs';

const userAgent = 'AIHackr/0.3 (+https://aihackr.com/docs)';
const origin = 'https://api.cloudflare.com/client/v4';
export const engineName = 'cloudflare-browser-run';
const terminal = status => ['completed', 'errored', 'cancelled_by_user', 'cancelled_due_to_timeout', 'cancelled_due_to_limits'].includes(status);
export class BrowserService {
  constructor(env, storage, { fetcher = (...args) => fetch(...args), validateUrl = validatePublicUrl } = {}) {
    this.env = env; this.storage = storage; this.fetcher = fetcher; this.validateUrl = validateUrl; this.robots = new Map();
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
  }
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
  async page(action, body) {
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
    await this.reserve(1);
    const result = await this.provider(action, 'POST', payload);
    const final = result.meta?.finalUrl ?? url.href;
    await this.validateUrl(final);
    if (result.meta?.status >= 400) reject('TARGET_ERROR', `Target returned HTTP ${result.meta.status}.`, 422);
    return result;
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
    const jobs = await this.storage.list({ prefix:'job:' });
    let active = 0;
    for (const [key,job] of jobs) if (job.expiresAt > Date.now() && !terminal(job.status)) {
      const update = await this.provider('crawl/'+job.providerId,'GET',undefined,'?limit=1');
      job.status = update.result.status; await this.storage.put(key,job); if (!terminal(job.status)) active++;
    }
    if (active >= 2) reject('RATE_LIMITED','At most two managed crawl jobs may run at once.',429);
    await this.reserve(limit);
    const payload = { url:url.href,limit,depth,render:body.render ?? true,formats,source:body.source ?? 'all',maxAge:integer(body.maxAge,0,604800,'Cache age',0),options:{...options,includeExternalLinks:false,includeSubdomains:false},crawlPurposes:['search','ai-input'],contentUse:'reference' };
    if (body.modifiedSince != null) payload.modifiedSince = integer(body.modifiedSince,0,Math.floor(Date.now()/1000),'Modified timestamp',0);
    if (payload.render) Object.assign(payload,{gotoOptions:{waitUntil:'networkidle2',timeout:30000},rejectResourceTypes:['image','media','font']});
    const response = await this.provider('crawl','POST',payload);
    if (typeof response.result !== 'string' || !/^[a-zA-Z0-9-]{10,80}$/.test(response.result)) reject('ENGINE_UNAVAILABLE','Cloudflare returned an invalid crawl identifier.',503);
    const id=crypto.randomUUID(); const job={id,providerId:response.result,status:'running',limit,url:url.href,createdAt:Date.now(),expiresAt:Date.now()+7*86400000,recordCount:0,cached:false};
    await this.storage.put('job:'+id,job);
    await this.storage.setAlarm(Date.now()+3600000);
    return {success:true,id,url:`/v2/crawl/${id}`,engine:engineName};
  }
  async getCrawl(id, offset=0) {
    if (!/^[a-zA-Z0-9-]{10,80}$/.test(id)) reject('NOT_FOUND','Unknown workspace crawl.',404);
    const job = await this.storage.get('job:'+id);
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
        for (let i=0;i<records.length;i++) await this.storage.put(`record:${id}:${i}`,records[i]);
        job.recordCount=records.length; job.cached=true;
        job.retainedAt=Date.now(); job.expiresAt=job.retainedAt+7*86400000;
      }
      await this.storage.put('job:'+id,job);
      if (!job.cached) return this.crawlEnvelope(job,records.map(record=>this.compactRecord(record)),null);
    }
    const records=[]; for(let i=offset;i<Math.min(offset+10,job.recordCount);i++) records.push(await this.storage.get(`record:${id}:${i}`));
    return this.crawlEnvelope(job,records,offset+10<job.recordCount?offset+10:null);
  }
  compactRecord(record) {
    const output={url:record.url,status:record.status,outcome:record.outcome,metadata:record.metadata};
    for(const key of ['markdown','html']) if(typeof record[key]==='string') {output[key]=record[key].slice(0,60000); if(record[key].length>60000) output.truncated=true;}
    if(output.truncated) output.warnings=['Page content limited to 60000 characters per format.'];
    return output;
  }
  crawlEnvelope(job,records,next) {
    const status = job.status==='completed'?'completed':job.status==='cancelled_by_user'?'cancelled':terminal(job.status)?'failed':'scraping';
    return {success:true,id:job.id,status,providerStatus:job.status,total:job.total??0,completed:job.finished??0,data:records,records, next:next==null?null:`/v2/crawl/${job.id}?cursor=${next}`,expiresAt:new Date(job.expiresAt).toISOString(),usage:{browserSecondsUsed:job.browserSecondsUsed??null},engine:engineName};
  }
  async cancelCrawl(id) {
    const job=await this.storage.get('job:'+id); if(!job || job.expiresAt<=Date.now()) reject('NOT_FOUND','Unknown workspace crawl.',404);
    if(!terminal(job.status)) await this.provider('crawl/'+job.providerId,'DELETE');
    if(!terminal(job.status)) job.status='cancelled_by_user'; await this.storage.put('job:'+id,job);
    return {success:true,id,status:job.status==='completed'?'completed':'cancelled',engine:engineName};
  }
  async cleanup() {
    const jobs=await this.storage.list({prefix:'job:'});
    for(const [key,job] of jobs) if(job.expiresAt<=Date.now()) {await this.storage.delete(key);for(let i=0;i<job.recordCount;i++)await this.storage.delete(`record:${job.id}:${i}`);}
    if(jobs.size) await this.storage.setAlarm(Date.now()+3600000);
  }
}
