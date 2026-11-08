const $ = id => document.getElementById(id);
const state = { key: sessionStorage.getItem('aihackr-native-key') ?? '', operation: 'scrape', response: null, view: 'content', ready: false, cap: null, busy: false, job: null, next: null };
const config = {
  scrape: { title: 'Scrape a webpage', run: 'Scrape page', options: {}, note: 'Render a public page with Cloudflare Browser Run. One browser operation per request.' },
  crawl: { title: 'Crawl a website', run: 'Start crawl', options: { render: true, depth: 2 }, note: 'Start a managed Cloudflare crawl. Public pages only; robots rules and your page limit apply.' },
  map: { title: 'Map a website', run: 'Map website', options: {}, note: 'Discover same-origin links on this page. Use Crawl for recursive discovery.' },
  search: { title: 'Search the web', run: 'Search web', options: { limit: 5 }, note: 'Web search is not enabled in this deployment.' },
  extract: { title: 'Extract structured data', run: 'Extract data', options: { prompt: 'Extract the name and description of this website.' }, note: 'Extract structured data using Browser Run and Workers AI. This operation uses AI inference.' },
};
function updateRun() { $('run-request').disabled = !state.key || !state.ready || state.busy || (['search', 'extract'].includes(state.operation) && !state.cap?.available[state.operation]); }
function openConnect() { $('connect-error').textContent = ''; $('connect-dialog').showModal(); $('api-key').focus(); }
$('connect-top').onclick = openConnect;
$('close-connect').onclick = () => $('connect-dialog').close();
$('disconnect').onclick = () => { state.key = ''; sessionStorage.removeItem('aihackr-native-key'); $('workspace-label').textContent = 'Workspace not connected'; $('connect-top').textContent = 'Connect workspace ↗'; $('api-key').value = ''; $('connect-dialog').close(); updateRun(); };
$('connect-form').onsubmit = async event => {
  event.preventDefault(); const key = $('api-key').value.trim();
  try {
    const response = await fetch('/api/session', { headers: { Authorization: 'Bearer ' + key } });
    if (!response.ok) throw new Error('The workspace key was not accepted.');
    state.key = key;
    if ($('remember-key').checked) sessionStorage.setItem('aihackr-native-key', key); else sessionStorage.removeItem('aihackr-native-key');
    $('api-key').value = ''; $('connect-dialog').close(); $('workspace-label').textContent = 'Operator workspace connected'; $('connect-top').textContent = 'Workspace connected ✓'; updateRun();
  } catch (error) { $('connect-error').textContent = error.message; }
};
document.querySelectorAll('[data-operation]').forEach(button => button.onclick = () => {
  state.operation = button.dataset.operation; const operation = config[state.operation];
  document.querySelectorAll('[data-operation]').forEach(tab => { const selected = tab === button; tab.classList.toggle('active', selected); tab.setAttribute('aria-selected', String(selected)); });
  $('operation-label').textContent = operation.title; $('route-label').textContent = 'POST /v2/' + state.operation;
  $('run-request').replaceChildren(document.createTextNode(operation.run + ' →'));
  $('options').value = JSON.stringify(operation.options, null, 2); $('operation-note').textContent = operation.note;
  $('target').type = state.operation === 'search' ? 'text' : 'url'; $('target').placeholder = state.operation === 'search' ? 'What are you researching?' : 'https://example.com';
  $('target-label').textContent = state.operation === 'search' ? 'Search query' : 'Public URL';
  $('limit-label').hidden = !['crawl', 'map'].includes(state.operation); $('format').disabled = !['scrape', 'crawl'].includes(state.operation); updateRun();
});
function showResult() {
  if (!state.response) return;
  const data = state.response.data ?? state.response;
  const content = (Array.isArray(data) ? data.map(record => [record.url, record.markdown ?? record.html ?? record.outcome ?? record.status].filter(Boolean).join('\n')).join('\n\n───\n\n') : null) ?? data.markdown ?? data.html ?? (Array.isArray(data.links) ? data.links.map(link => typeof link === 'string' ? link : link.url).join('\n') : null);
  $('result-content').textContent = state.view === 'content' && content ? content : JSON.stringify(state.response, null, 2);
  $('result-content').hidden = false; $('empty-result').hidden = true; $('copy-result').disabled = false;
  $('view-content').classList.toggle('active', state.view === 'content'); $('view-json').classList.toggle('active', state.view === 'json');
}
$('view-content').onclick = () => { state.view = 'content'; showResult(); };
$('view-json').onclick = () => { state.view = 'json'; showResult(); };
$('copy-result').onclick = () => navigator.clipboard.writeText($('result-content').textContent);
$('copy-example').onclick = () => navigator.clipboard.writeText($('sdk-example').textContent);
async function nativeRequest(path, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(path, { method, headers: { Authorization: 'Bearer ' + state.key, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok || data.success === false) throw new Error(typeof data.error === 'string' ? data.error : data.error?.message ?? data.message ?? 'Request failed.');
  return data;
}
$('request-form').onsubmit = async event => {
  event.preventDefault(); if (!state.key) { openConnect(); return; }
  $('error-banner').hidden = true;
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
  state.busy = true; updateRun(); const start = performance.now();
  $('result-meta').hidden = false; $('result-meta').textContent = 'Running Cloudflare Browser Run…';
  try {
    const operation = state.operation;
    state.response = await nativeRequest('/v2/' + operation, body); state.job = operation === 'crawl' ? state.response.id : null; state.next = state.response.next; showResult(); updateJobActions();
    const job = state.response.id;
    if (job && operation === 'crawl') {
      for (let i = 0; i < 60; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        state.response = await nativeRequest('/v2/' + operation + '/' + encodeURIComponent(job)); state.next = state.response.next; showResult(); updateJobActions();
        $('result-meta').textContent = 'Cloudflare job ' + job + ' · ' + (state.response.status ?? 'running');
        if (['completed', 'failed', 'cancelled', 'canceled'].includes(state.response.status)) break;
      }
    }
    $('result-meta').textContent = 'Cloudflare Browser Run · ' + ((performance.now() - start) / 1000).toFixed(1) + 's · ' + (state.response.status ?? 'completed');
  } catch (error) { $('error-banner').textContent = error.message; $('error-banner').hidden = false; $('result-meta').textContent = 'Request did not complete'; }
  finally { state.busy = false; updateRun(); updateJobActions(); }
};
async function initialize() {
  try {
    const [caps, health] = await Promise.all([fetch('/api/capabilities').then(r => r.json()), fetch('/health/ready').then(r => r.json())]);
    state.cap = caps; state.ready = health.ready; document.querySelector('[data-operation=search]').disabled = !caps.available.search;
    $('engine-status').classList.toggle('ready', health.ready);
    $('engine-status').replaceChildren(Object.assign(document.createElement('span'), { className: 'dot' }), document.createTextNode(health.ready ? 'Cloudflare engine ready' : 'Engine unavailable'));
    if (state.key) {
      const session = await fetch('/api/session', { headers: { Authorization: 'Bearer ' + state.key } });
      if (session.ok) { $('workspace-label').textContent = 'Operator workspace connected'; $('connect-top').textContent = 'Workspace connected ✓'; }
      else { state.key = ''; sessionStorage.removeItem('aihackr-native-key'); }
    }
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
  try { state.response = await nativeRequest(path, undefined, method); state.next = state.response.next; showResult(); $('result-meta').textContent = 'Cloudflare job ' + state.job + ' · ' + state.response.status; updateJobActions(); }
  catch(error) { $('error-banner').textContent = error.message; $('error-banner').hidden = false; }
}
$('refresh-job').onclick = () => jobAction('/v2/crawl/' + encodeURIComponent(state.job));
$('cancel-job').onclick = () => jobAction('/v2/crawl/' + encodeURIComponent(state.job), 'DELETE');
$('next-page').onclick = () => { if (state.next?.startsWith('/v2/crawl/')) jobAction(state.next); };
initialize();
