import {account,openSignIn,refreshAccount} from './account.mjs';
const $ = id => document.getElementById(id);
const state = { accountEpoch:0, operation: 'scrape', response: null, view: 'content', ready: false, cap: null, busy: false, job: null, next: null };
const toolViews = new Map();
const config = {
  scrape: { title: 'Scrape a webpage', run: 'Scrape page', options: {}, note: 'Render a public page with Cloudflare Browser Run. One browser operation per request.' },
  crawl: { title: 'Crawl a website', run: 'Start crawl', options: { render: true, depth: 2 }, note: 'Start a managed Cloudflare crawl. Public pages only; robots rules and your page limit apply.' },
  map: { title: 'Map a website', run: 'Map website', options: {}, note: 'Discover same-origin links on this page. Use Crawl for recursive discovery.' },
  search: { title: 'Search the web', run: 'Search web', options: { limit: 5 }, note: 'Web search is not enabled in this deployment.' },
  extract: { title: 'Extract structured data', run: 'Extract data', options: { prompt: 'Extract the name and description of this website.' }, note: 'Extract structured data using Browser Run and Workers AI. This operation uses AI inference.' },
};
function normalizeTarget(value) {
  const raw=value.trim();
  const candidate=raw.startsWith('//')?'https:'+raw:/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)?raw:'https://'+raw;
  let url;try{url=new URL(candidate);}catch{throw new Error('Enter a valid website, such as example.com or https://example.com.');}
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||!url.hostname)throw new Error('Use an HTTP or HTTPS website URL without a username or password.');
  return url.href;
}
function updateRun() {
  $('run-request').disabled = !state.ready || state.busy || (['search', 'extract'].includes(state.operation) && !state.cap?.available[state.operation]);
  $('run-request').textContent=account.session?config[state.operation].run+' →':'Sign in to try it →';
  document.querySelectorAll('[data-operation]').forEach(tab=>{tab.disabled=state.busy||tab.dataset.operation==='search'&&!state.cap?.available.search;});
}
window.addEventListener('aihackr-account',()=>{toolViews.clear();state.accountEpoch++;state.busy=false;state.response=null;state.job=null;state.next=null;$('result-content').textContent='';$('result-content').hidden=true;$('result-meta').hidden=true;$('error-banner').hidden=true;$('empty-result').hidden=false;$('copy-result').disabled=true;updateRun();updateJobActions();});
document.querySelectorAll('[data-operation]').forEach(button => button.onclick = () => {
  if(state.busy||state.operation===button.dataset.operation)return;
  toolViews.set(state.operation,{response:state.response,job:state.job,next:state.next,view:state.view,meta:$('result-meta').textContent,metaHidden:$('result-meta').hidden,error:$('error-banner').textContent,errorHidden:$('error-banner').hidden,options:$('options').value,limit:$('page-limit').value,format:$('format').value,target:$('target').value});
  state.operation = button.dataset.operation; const operation = config[state.operation];
  const saved=toolViews.get(state.operation);
  state.response=saved?.response??null;state.job=saved?.job??null;state.next=saved?.next??null;state.view=saved?.view??'content';
  $('result-meta').textContent=saved?.meta??'';$('result-meta').hidden=saved?.metaHidden??true;
  $('error-banner').textContent=saved?.error??'';$('error-banner').hidden=saved?.errorHidden??true;
  document.querySelectorAll('[data-operation]').forEach(tab => { const selected = tab === button; tab.classList.toggle('active', selected); tab.setAttribute('aria-selected', String(selected)); });
  $('operation-label').textContent = operation.title; $('route-label').textContent = 'POST /v2/' + state.operation;
  $('run-request').replaceChildren(document.createTextNode(operation.run + ' →'));
  $('options').value = saved?.options??JSON.stringify(operation.options, null, 2); $('operation-note').textContent = operation.note;
  $('page-limit').value=saved?.limit??(state.operation==='map'?'20':'5');$('format').value=saved?.format??'markdown';
  if(saved)$('target').value=saved.target;
  $('target').placeholder = state.operation === 'search' ? 'What are you researching?' : 'example.com or https://example.com';
  $('target').inputMode = state.operation === 'search' ? 'text' : 'url'; $('target-help').hidden = state.operation === 'search';
  $('target-label').textContent = state.operation === 'search' ? 'Search query' : 'Public URL';
  $('limit-title').textContent=state.operation==='map'?'Maximum links':'Maximum pages';
  $('limit-label').hidden = !['crawl', 'map'].includes(state.operation); $('format').disabled = !['scrape', 'crawl'].includes(state.operation);showResult();updateJobActions();updateRun();
});
function showResult() {
  $('view-content').classList.toggle('active', state.view === 'content'); $('view-json').classList.toggle('active', state.view === 'json');
  if (!state.response) {$('result-content').textContent='';$('result-content').hidden=true;$('empty-result').hidden=false;$('copy-result').disabled=true;return;}
  const data = state.response.data ?? state.response;
  const content = (Array.isArray(data) ? data.map(record => [record.url, record.markdown ?? record.html ?? record.outcome ?? record.status].filter(Boolean).join('\n')).join('\n\n───\n\n') : null) ?? data.markdown ?? data.html ?? (Array.isArray(data.links) ? data.links.map(link => typeof link === 'string' ? link : link.url).join('\n') : null);
  $('result-content').textContent = state.view === 'content' && content ? content : JSON.stringify(state.response, null, 2);
  $('result-content').hidden = false; $('empty-result').hidden = true; $('copy-result').disabled = false;
}
$('view-content').onclick = () => { state.view = 'content'; showResult(); };
$('view-json').onclick = () => { state.view = 'json'; showResult(); };
$('copy-result').onclick = () => navigator.clipboard.writeText($('result-content').textContent);
$('copy-example').onclick = () => navigator.clipboard.writeText($('sdk-example').textContent);
async function nativeRequest(path, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json',...(method==='POST'?{'Idempotency-Key':crypto.randomUUID()}:{}) }, credentials: 'same-origin', body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok || data.success === false) throw new Error(typeof data.error === 'string' ? data.error : data.error?.message ?? data.message ?? 'Request failed.');
  return data;
}
$('request-form').onsubmit = async event => {
  event.preventDefault();
  $('error-banner').hidden = true;
  try{if(state.operation!=='search')$('target').value=normalizeTarget($('target').value);}
  catch(error){$('error-banner').textContent=error.message;$('error-banner').hidden=false;return;}
  if (!account.session) { openSignIn(); return; }
  let body;
  try {
    const options = JSON.parse($('options').value || '{}'); if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('Request options must be a JSON object.');
    body = { ...options };
    if (state.operation === 'search') body.query = $('target').value;
    else if (state.operation === 'extract') body.urls = [$('target').value];
    else body.url = $('target').value;
    if (state.operation === 'scrape') body.formats = [$('format').value];
    if (['crawl', 'map'].includes(state.operation)) body.limit = Number($('page-limit').value);
    if (state.operation === 'crawl') body.formats = [$('format').value];
  } catch (error) { $('error-banner').textContent = error.message; $('error-banner').hidden = false; return; }
  const epoch=state.accountEpoch;state.busy = true; updateRun(); const start = performance.now();
  $('result-meta').hidden = false; $('result-meta').textContent = 'Running Cloudflare Browser Run…';
  try {
    const operation = state.operation;
    const response=await nativeRequest('/v2/' + operation, body);if(epoch!==state.accountEpoch)return;state.response=response; state.job = operation === 'crawl' ? state.response.id : null; state.next = state.response.next; showResult(); updateJobActions();
    const job = state.response.id;
    if (job && operation === 'crawl') {
      for (let i = 0; i < 60; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        if(epoch!==state.accountEpoch)return;const response=await nativeRequest('/v2/' + operation + '/' + encodeURIComponent(job));if(epoch!==state.accountEpoch)return;state.response=response; state.next = state.response.next; showResult(); updateJobActions();
        $('result-meta').textContent = 'Cloudflare job ' + job + ' · ' + (state.response.status ?? 'running');
        if (['completed', 'failed', 'cancelled', 'canceled'].includes(state.response.status)) break;
      }
    }
    $('result-meta').textContent = 'Cloudflare Browser Run · ' + ((performance.now() - start) / 1000).toFixed(1) + 's · ' + (state.response.status ?? 'completed');
  } catch (error) { if(epoch===state.accountEpoch){$('error-banner').textContent = error.message; $('error-banner').hidden = false; $('result-meta').textContent = 'Request did not complete';} }
  finally { if(epoch===state.accountEpoch){state.busy = false; updateRun(); updateJobActions(); await refreshAccount(false);} }
};
async function initialize() {
  try {
    const [caps, health] = await Promise.all([fetch('/api/capabilities').then(r => r.json()), fetch('/health/ready').then(r => r.json())]);
    state.cap = caps; state.ready = health.ready; document.querySelector('[data-operation=search]').disabled = !caps.available.search;
    $('engine-status').classList.toggle('ready', health.ready);
    $('engine-status').replaceChildren(Object.assign(document.createElement('span'), { className: 'dot' }), document.createTextNode(health.ready ? 'Cloudflare engine ready' : 'Engine unavailable'));
  } catch { $('engine-status').textContent = 'Engine unavailable'; }
  updateRun();
}
function updateJobActions() {
  const status = state.response?.status;
  $('refresh-job').hidden = !state.job;
  $('cancel-job').hidden = !state.job || ['completed','failed','cancelled'].includes(status);
  $('next-page').hidden = !state.next;
}
async function jobAction(path, method = 'GET') {
  const epoch=state.accountEpoch;
  try { const response=await nativeRequest(path, undefined, method);if(epoch!==state.accountEpoch)return;state.response=response; state.next = state.response.next; showResult(); $('result-meta').textContent = 'Cloudflare job ' + state.job + ' · ' + state.response.status; updateJobActions(); }
  catch(error) {if(epoch===state.accountEpoch){$('error-banner').textContent = error.message; $('error-banner').hidden = false;} }
}
$('refresh-job').onclick = () => jobAction('/v2/crawl/' + encodeURIComponent(state.job));
$('cancel-job').onclick = () => jobAction('/v2/crawl/' + encodeURIComponent(state.job), 'DELETE');
$('next-page').onclick = () => { if (state.next?.startsWith('/v2/crawl/')) jobAction(state.next); };
initialize();

try{const {plans}=await(await fetch('/api/plans')).json();const target=document.getElementById('public-plans');for(const plan of plans){const card=document.createElement('article');card.className='plan-card'+(plan.recommended?' recommended':'');const title=document.createElement('h3'),price=document.createElement('div'),credits=document.createElement('p'),description=document.createElement('p'),link=document.createElement('a');title.textContent=plan.name;price.className='plan-price';price.textContent='$'+plan.amount/100+' / month';credits.textContent=plan.credits.toLocaleString()+' credits per month';description.textContent=plan.description;link.className='button '+(plan.recommended?'primary':'');link.href='/dashboard#billing';link.textContent='Choose '+plan.name+' →';card.append(title,price,credits,description,link);target.append(card);}}catch{document.getElementById('public-plans').textContent='See your dashboard for current plans.';}
