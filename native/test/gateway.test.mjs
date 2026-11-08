import test from 'node:test';
import assert from 'node:assert/strict';
import { createGateway, validatePublicUrl, listenGateway } from '../src/gateway.mjs';
import Firecrawl from 'firecrawl';

const key = 'fc-' + 'a'.repeat(64);
const request = (path, body, credential = key) => new Request('https://aihackr.test' + path, {
  method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + credential, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
});
function harness(extra = {}) {
  const calls = [];
  const gateway = createGateway({ apiKey: key, publicOrigin: 'https://aihackr.test', validateUrl: async () => {}, fetcher: async (url, init) => {
    calls.push({ url, ...init });
    return Response.json({ success: true, data: { markdown: '# Native response', metadata: { statusCode: 200 } } });
  }, ...extra });
  return { ...gateway, calls };
}
test('rejects missing and invalid credentials before engine or MCP access', async () => {
  const gateway = harness();
  for (const path of ['/v2/scrape', '/mcp', '/api/session']) {
    for (const bad of ['', 'fc-invalid']) assert.equal((await gateway.handle(request(path, { url: 'https://example.com' }, bad))).status, 401);
  }
  assert.equal(gateway.calls.length, 0);
});
test('native SDK calls the native v2 route; options and result are preserved', async t => {
  const gateway = harness(); const server = await listenGateway(gateway, { port: 0 }); t.after(() => server.close());
  const client = new Firecrawl({ apiKey: key, apiUrl: `http://127.0.0.1:${server.address().port}` });
  const page = await client.scrape('https://example.com', { formats: ['markdown', 'html'], onlyMainContent: false, maxAge: 0, includeTags: ['main'], timeout: 45000 });
  assert.match(page.markdown, /Native response/);
  assert.equal(gateway.calls[0].url, 'http://127.0.0.1:3002/v2/scrape');
  const body = JSON.parse(Buffer.from(gateway.calls[0].body).toString());
  assert.deepEqual(body.formats, ['markdown', 'html']); assert.equal(body.onlyMainContent, false); assert.deepEqual(body.includeTags, ['main']);
  assert.equal(gateway.calls[0].headers.has('authorization'), false);
});
test('keeps unknown native options for upstream validation instead of reimplementing its schema', async () => {
  const gateway = harness();
  const body = { url: 'https://example.com', formats: ['markdown'], futureNativeOption: { supportedByUpstream: true } };
  assert.equal((await gateway.handle(request('/v2/scrape', body))).status, 200);
  assert.deepEqual(JSON.parse(Buffer.from(gateway.calls[0].body).toString()), body);
});
test('does not expose the private API, queue admin, cloud agent or obsolete application routes', async () => {
  const gateway = harness();
  for (const path of ['/admin/ops/redis-health', '/v0/health/readiness', '/api/scans', '/v1/scrape', '/v2/agent', '/v2/browser', '/dashboard']) {
    assert.equal((await gateway.handle(request(path, {}))).status, 404);
  }
  assert.equal(gateway.calls.length, 0);
});
test('fails unavailable provider operations before dispatch', async () => {
  const gateway = harness();
  for (const [path, body] of [['/v2/search', { query: 'example' }], ['/v2/extract', { urls: ['https://example.com'] }], ['/v2/scrape', { url: 'https://example.com', formats: [{ type: 'json', prompt: 'Extract name' }] }]])
    assert.equal((await gateway.handle(request(path, body))).status, 503);
  assert.equal(gateway.calls.length, 0);
});
test('authenticates browser origins and rejects target credentials/actions/webhooks', async () => {
  const gateway = harness();
  const foreign = request('/v2/scrape', { url: 'https://example.com' }); foreign.headers.set('Origin', 'https://evil.test');
  assert.equal((await gateway.handle(foreign)).status, 403);
  for (const options of [{ headers: { Cookie: 'secret' } }, { cookies: ['secret'] }, { actions: [{ type: 'executeJavascript' }] }, { webhook: 'https://example.com' }]) {
    assert.equal((await gateway.handle(request('/v2/scrape', { url: 'https://example.com', ...options }))).status, 400);
  }
  assert.equal(gateway.calls.length, 0);
});
test('private DNS, mixed public/private records, metadata and credentialed URLs are rejected', async () => {
  for (const url of ['http://127.0.0.1', 'http://169.254.169.254/latest', 'http://[::1]', 'http://user:password@example.com', 'file:///etc/passwd', 'http://redis.internal'])
    await assert.rejects(validatePublicUrl(url));
  await assert.rejects(validatePublicUrl('https://example.com', async () => [{ address: '93.184.216.34' }, { address: '10.0.0.1' }]));
  assert.equal((await validatePublicUrl('https://example.com', async () => [{ address: '93.184.216.34' }])).hostname, 'example.com');
});
test('public target failures do not dispatch to Firecrawl', async () => {
  const gateway = harness({ validateUrl: async () => { throw new Error('private'); } });
  assert.equal((await gateway.handle(request('/v2/scrape', { url: 'http://169.254.169.254' }))).status, 403);
  assert.equal(gateway.calls.length, 0);
});
test('bounds crawl pages and batch input while retaining native asynchronous results', async () => {
  const gateway = harness({ fetcher: async () => Response.json({ success: true, id: 'native-job', url: 'http://api:3002/v2/crawl/native-job', next: 'http://localhost:3002/v2/crawl/native-job?skip=10' }) });
  assert.equal((await gateway.handle(request('/v2/crawl', { url: 'https://example.com', limit: 101 }))).status, 400);
  assert.equal((await gateway.handle(request('/v2/batch/scrape', { urls: Array(101).fill('https://example.com') }))).status, 400);
  const response = await (await gateway.handle(request('/v2/crawl', { url: 'https://example.com' }))).json();
  assert.equal(response.id, 'native-job'); assert.equal(response.url, 'https://aihackr.test/v2/crawl/native-job'); assert.equal(response.next, 'https://aihackr.test/v2/crawl/native-job?skip=10');
});
test('concurrency limit is released after engine failure', async () => {
  let reject;
  const gateway = harness({ maxConcurrent: 1, fetcher: () => new Promise((_, fail) => { reject = fail; }) });
  const first = gateway.handle(request('/v2/scrape', { url: 'https://example.com' }));
  while (!reject) await new Promise(resolve => setImmediate(resolve));
  assert.equal((await gateway.handle(request('/v2/scrape', { url: 'https://example.com' }))).status, 429);
  reject(new Error('secret engine internals')); const failed = await first;
  assert.equal(failed.status, 503); assert.doesNotMatch(await failed.text(), /secret engine internals/);
});
test('fresh portal is independent of legacy scanner assets and never fabricates results', async () => {
  const html = await (await harness().handle(request('/'))).text();
  assert.match(html, /Native Firecrawl APIs/); assert.match(html, /No simulated results/); assert.doesNotMatch(html, new RegExp('watchlist|provider directory|react-root|/api/scans', 'i'));
});
