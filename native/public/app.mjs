const $ = id => document.getElementById(id);
const state = { key: sessionStorage.getItem('aihackr-native-key') ?? '', operation: 'scrape', response: null, view: 'content', ready: false, cap: null, busy: false };
const config = {
  scrape: { title: 'Scrape a webpage', run: 'Scrape page', options: { onlyMainContent: true, maxAge: 0 }, note: 'Retrieve a public page through Firecrawl’s own engine and content pipeline.' },
  crawl: { title: 'Crawl a website', run: 'Start crawl', options: { scrapeOptions: { formats: ['markdown'], onlyMainContent: true } }, note: 'Create a native Firecrawl crawl job. The page limit bounds collection.' },
  map: { title: 'Map a website', run: 'Map website', options: {}, note: 'Discover public site URLs with Firecrawl’s native map endpoint.' },
  search: { title: 'Search the web', run: 'Search web', options: { limit: 5 }, note: 'Search is available only when a self-hosted search provider is configured.' },
  extract: { title: 'Extract structured data', run: 'Extract data', options: { prompt: 'Extract the name and description of this website.' }, note: 'Extraction is available only when an LLM provider is configured.' },
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
  const content = data.markdown ?? data.html ?? (Array.isArray(data.links) ? data.links.map(link => typeof link === 'string' ? link : link.url).join('\n') : null);
  $('result-content').textContent = state.view === 'content' && content ? content : JSON.stringify(state.response, null, 2);
  $('result-content').hidden = false; $('empty-result').hidden = true; $('copy-result').disabled = false;
  $('view-content').classList.toggle('active', state.view === 'content'); $('view-json').classList.toggle('active', state.view === 'json');
}
$('view-content').onclick = () => { state.view = 'content'; showResult(); };
$('view-json').onclick = () => { state.view = 'json'; showResult(); };
$('copy-result').onclick = () => navigator.clipboard.writeText($('result-content').textContent);
$('copy-example').onclick = () => navigator.clipboard.writeText($('sdk-example').textContent);
async function nativeRequest(path, body) {
  const response = await fetch(path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + state.key, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
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
    if (state.operation === 'crawl') body.scrapeOptions = { ...body.scrapeOptions, formats: [$('format').value] };
  } catch (error) { $('error-banner').textContent = error.message; $('error-banner').hidden = false; return; }
  state.busy = true; updateRun(); const start = performance.now();
  $('result-meta').hidden = false; $('result-meta').textContent = 'Running the native Firecrawl pipeline…';
  try {
    const operation = state.operation;
    state.response = await nativeRequest('/v2/' + operation, body); showResult();
    const job = state.response.id;
    if (job && ['crawl', 'extract'].includes(operation)) {
      for (let i = 0; i < 60; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        state.response = await nativeRequest('/v2/' + operation + '/' + encodeURIComponent(job)); showResult();
        $('result-meta').textContent = 'Native job ' + job + ' · ' + (state.response.status ?? 'running');
        if (['completed', 'failed', 'cancelled', 'canceled'].includes(state.response.status)) break;
      }
    }
    $('result-meta').textContent = 'Firecrawl OSS · ' + ((performance.now() - start) / 1000).toFixed(1) + 's · ' + (state.response.status ?? 'completed');
  } catch (error) { $('error-banner').textContent = error.message; $('error-banner').hidden = false; $('result-meta').textContent = 'Request did not complete'; }
  finally { state.busy = false; updateRun(); }
};
async function initialize() {
  try {
    const [caps, health] = await Promise.all([fetch('/api/capabilities').then(r => r.json()), fetch('/health/ready').then(r => r.json())]);
    state.cap = caps; state.ready = health.ready;
    $('engine-status').classList.toggle('ready', health.ready);
    $('engine-status').replaceChildren(Object.assign(document.createElement('span'), { className: 'dot' }), document.createTextNode(health.ready ? 'Native engine ready' : 'Engine unavailable'));
    if (state.key) {
      const session = await fetch('/api/session', { headers: { Authorization: 'Bearer ' + state.key } });
      if (session.ok) { $('workspace-label').textContent = 'Operator workspace connected'; $('connect-top').textContent = 'Workspace connected ✓'; }
      else { state.key = ''; sessionStorage.removeItem('aihackr-native-key'); }
    }
  } catch { $('engine-status').textContent = 'Engine unavailable'; }
  updateRun();
}
initialize();
