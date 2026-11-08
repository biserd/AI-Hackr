import { createServer } from 'node:http';
import { timingSafeEqual, createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import ipaddr from 'ipaddr.js';

const publicFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.mjs', ['app.mjs', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/docs', ['docs.html', 'text/html; charset=utf-8']],
]);
const knownRoutes = [
  ['POST', /^\/v2\/(scrape|map|search|extract|crawl|batch\/scrape)$/],
  ['GET', /^\/v2\/crawl\/ongoing$/],
  ['GET', /^\/v2\/(scrape|crawl|batch\/scrape|extract)\/[a-zA-Z0-9-]+(?:\/errors)?$/],
  ['DELETE', /^\/v2\/(crawl|batch\/scrape)\/[a-zA-Z0-9-]+$/],
];
const digest = value => createHash('sha256').update(value).digest();
export function credentialMatches(supplied, expected) {
  return Boolean(supplied && expected && timingSafeEqual(digest(supplied), digest(expected)));
}
export function bearer(headers) {
  return headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
}
function json(value, status = 200, extra = {}) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', ...extra } });
}
function fail(code, message, status) {
  return json({ success: false, error: { code, message } }, status);
}
function publicAddress(address) {
  try { return ipaddr.process(address).range() === 'unicast'; } catch { return false; }
}
export async function validatePublicUrl(raw, resolve = lookup) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('A valid public HTTP(S) URL is required.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Only public HTTP(S) URLs without credentials are allowed.');
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!host.includes('.') || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host))
    throw new Error('Private and internal target hosts are not allowed.');
  const addresses = ipaddr.isValid(host) ? [{ address: host }] : await resolve(host, { all: true });
  if (!addresses.length || addresses.some(item => !publicAddress(item.address)))
    throw new Error('Private and internal target addresses are not allowed.');
  return url;
}

export function createGateway({
  apiKey,
  origin = 'http://127.0.0.1:3002',
  mcpOrigin = 'http://127.0.0.1:4101',
  publicOrigin = 'http://localhost:8080',
  fetcher = fetch,
  validateUrl = validatePublicUrl,
  searchEnabled = false,
  extractionEnabled = false,
  requestTimeoutMs = 120000,
  maxConcurrent = 3,
}) {
  if (!apiKey || apiKey.length < 32) throw new Error('AIHACKR_API_KEY must contain at least 32 characters.');
  const backend = new URL(origin);
  if (backend.username || backend.password || !['http:', 'https:'].includes(backend.protocol))
    throw new Error('Invalid private Firecrawl origin.');
  let inflight = 0;
  const keyValid = key => credentialMatches(key, apiKey);
  const capabilities = () => ({
    release: 'firecrawl-native-0.2.0', upstream: { version: 'v2.11.162', commit: '7666c1f9ae8720a6bba271e0f60b6a217f8a5210', modified: false },
    api: '/v2', mcp: '/mcp', engine: 'firecrawl-oss',
    available: { scrape: true, browser: true, crawl: true, map: true, batchScrape: true, search: searchEnabled, extract: extractionEnabled, cloudAgent: false, interact: false, screenshots: false, checkout: false, oauth: false },
    access: 'Single operator workspace; no public signup or paid multi-tenant beta.',
    source: 'https://github.com/biserd/AI-Hackr/tree/codex/firecrawl-native',
  });
  async function proxy(request, destination) {
    const headers = new Headers();
    for (const name of ['content-type', 'accept', 'mcp-protocol-version', 'mcp-session-id', 'last-event-id', 'idempotency-key']) {
      const value = request.headers.get(name); if (value) headers.set(name, value);
    }
    // Firecrawl's private self-hosted API needs no customer/operator credential.
    // The official MCP instance sends this key back only to this gateway.
    if (destination.startsWith(mcpOrigin)) headers.set('Authorization', `Bearer ${apiKey}`);
    const response = await fetcher(destination, {
      method: request.method, headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
      signal: AbortSignal.timeout(requestTimeoutMs), redirect: 'error',
    });
    const output = new Headers({ 'Cache-Control': 'no-store', 'X-AIHackr-Engine': 'firecrawl-oss' });
    for (const name of ['content-type', 'mcp-session-id', 'retry-after', 'www-authenticate']) {
      const value = response.headers.get(name); if (value) output.set(name, value);
    }
    if (response.headers.get('content-type')?.includes('application/json')) {
      const data = await response.json();
      // Native asynchronous pagination must return through the authenticated gateway.
      for (const field of ['url', 'next']) {
        if (typeof data[field] === 'string') {
          try { const u = new URL(data[field]); if (u.origin === backend.origin || /^(api|localhost|127\.0\.0\.1)$/.test(u.hostname)) data[field] = publicOrigin + u.pathname + u.search; } catch { /* upstream owns validation */ }
        }
      }
      return new Response(JSON.stringify(data), { status: response.status, headers: output });
    }
    return new Response(response.body, { status: response.status, headers: output });
  }
  async function handle(request) {
    const url = new URL(request.url);
    if (['GET', 'HEAD'].includes(request.method) && publicFiles.has(url.pathname)) {
      const [file, type] = publicFiles.get(url.pathname);
      return new Response(request.method === 'HEAD' ? null : await readFile(new URL('../public/' + file, import.meta.url)), { headers: {
        'Content-Type': type, 'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      } });
    }
    if (request.method === 'GET' && url.pathname === '/api/capabilities') return json(capabilities());
    if (request.method === 'GET' && url.pathname === '/health/live') return json({ live: true });
    if (request.method === 'GET' && url.pathname === '/health/ready') {
      try {
        const r = await fetcher(backend.origin + '/v0/health/readiness', { signal: AbortSignal.timeout(5000) });
        return json({ ready: r.ok, engine: 'firecrawl-oss', note: 'Heartbeat only; functional stack tests exercise queue and browser.' }, r.ok ? 200 : 503);
      } catch { return json({ ready: false, engine: 'firecrawl-oss' }, 503); }
    }
    const permitted = url.pathname === '/mcp' || url.pathname === '/api/session' || knownRoutes.some(([method, path]) => method === request.method && path.test(url.pathname));
    if (!permitted) return fail('NOT_FOUND', 'This route is not exposed by this self-hosted deployment.', 404);
    if (!keyValid(bearer(request.headers))) return fail('AUTH_REQUIRED', 'A valid AIHackr workspace API key is required.', 401);
    const browserOrigin = request.headers.get('origin');
    if (browserOrigin && browserOrigin !== new URL(publicOrigin).origin) return fail('ORIGIN_RESTRICTED', 'Use the configured workspace origin.', 403);
    if (url.pathname === '/api/session') return json({ authenticated: true, workspace: 'Operator workspace', ...capabilities() });
    if (url.pathname === '/mcp') return proxy(request, mcpOrigin + '/mcp');
    if (inflight >= maxConcurrent) return fail('RATE_LIMITED', 'The workspace concurrency limit has been reached.', 429);
    let body;
    if (request.method === 'POST') {
      if (!request.headers.get('content-type')?.includes('application/json')) return fail('INVALID_INPUT', 'Send application/json.', 415);
      try { body = await request.clone().json(); } catch { return fail('INVALID_INPUT', 'Invalid JSON request.', 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('INVALID_INPUT', 'Send a JSON object.', 400);
      const targets = [...(typeof body.url === 'string' ? [body.url] : []), ...(Array.isArray(body.urls) ? body.urls : [])];
      if (targets.length > 100) return fail('LIMIT_EXCEEDED', 'At most 100 URLs per request.', 400);
      try { await Promise.all(targets.map(target => validateUrl(target))); } catch { return fail('TARGET_RESTRICTED', 'Targets must resolve to public HTTP(S) addresses.', 403); }
      if (url.pathname === '/v2/search' && !searchEnabled) return fail('CAPABILITY_UNAVAILABLE', 'Search requires a configured self-hosted search provider.', 503);
      const formats = body.formats ?? body.scrapeOptions?.formats ?? [];
      const hasJson = Array.isArray(formats) && formats.some(item => item && typeof item === 'object' && ['json', 'extract'].includes(item.type));
      if ((url.pathname === '/v2/extract' || hasJson) && !extractionEnabled) return fail('CAPABILITY_UNAVAILABLE', 'Configure an LLM provider before extraction.', 503);
      if (body.webhook || body.headers || body.cookies || body.actions || body.scrapeOptions?.headers || body.scrapeOptions?.actions)
        return fail('CAPABILITY_UNAVAILABLE', 'This public-page deployment does not accept target credentials, actions or webhooks.', 400);
      if (body.limit != null && (!Number.isInteger(body.limit) || body.limit < 1 || body.limit > 100))
        return fail('LIMIT_EXCEEDED', 'Page limit must be an integer from 1 to 100.', 400);
      if (url.pathname === '/v2/crawl' && body.limit == null) {
        body.limit = 20;
        request = new Request(request, { body: JSON.stringify(body) });
      }
    }
    inflight++;
    try { return await proxy(request, backend.origin + url.pathname + url.search); }
    catch { return fail('ENGINE_UNAVAILABLE', 'The private Firecrawl engine is unavailable or timed out.', 503); }
    finally { inflight--; }
  }
  return { handle, keyValid, capabilities };
}

export function listenGateway(gateway, { port = 8080, host = '127.0.0.1' } = {}) {
  const server = createServer(async (req, res) => {
    try {
      let size = 0; const parts = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 1024 * 1024) { res.writeHead(413, { 'Content-Type': 'application/json' }); res.end('{"success":false,"error":{"code":"REQUEST_TOO_LARGE"}}'); return; }
        parts.push(chunk);
      }
      const request = new Request('http://gateway.internal' + req.url, {
        method: req.method, headers: req.headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(parts),
      });
      const response = await gateway.handle(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) Readable.fromWeb(response.body).pipe(res); else res.end();
    } catch { if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' }); res.end('{"success":false,"error":{"code":"INTERNAL_ERROR"}}'); }
  });
  return new Promise(resolve => server.listen(port, host, () => resolve(server)));
}
