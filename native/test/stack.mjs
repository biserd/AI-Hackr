import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import Firecrawl from 'firecrawl';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
let config = '';
try { config = await readFile(new URL('../.env', import.meta.url), 'utf8'); } catch { /* CI may supply environment directly. */ }
const key = process.env.AIHACKR_API_KEY ?? config.match(/^AIHACKR_API_KEY=(.+)$/m)?.[1].trim();
assert.ok(key, 'A test workspace key is required; it is never printed.');
const origin = process.env.TEST_ORIGIN ?? 'http://localhost:8080';
const fixture = process.env.NATIVE_FIXTURE_URL ?? 'https://aihackr-native-fixtures.biser-d.workers.dev';
const httpFixture = process.env.NATIVE_HTTP_FIXTURE_URL ?? 'https://fixtures.aihackr.com';
const headers = { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
const call = async (path, body, method = body ? 'POST' : 'GET') => {
  const r = await fetch(origin + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(125000) });
  const data = await r.json(); assert.ok(r.ok, path + ': ' + r.status + ' ' + JSON.stringify(data)); return data;
};
async function poll(path) {
  for (let i = 0; i < 90; i++) {
    const result = await call(path);
    if (result.status === 'completed') return result;
    if (['failed', 'cancelled'].includes(result.status)) throw new Error('Native job ended: ' + JSON.stringify(result));
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  throw new Error('Native job polling deadline exceeded.');
}
const reportPath = new URL('../reports/stack-smoke.json', import.meta.url);
await mkdir(new URL('../reports/', import.meta.url), { recursive: true });
if (process.argv.includes('--restore')) {
  const before = JSON.parse(await readFile(reportPath));
  const restored = await call('/v2/crawl/' + before.crawlId);
  assert.equal(restored.status, 'completed'); assert.ok(restored.data.length > 0);
  before.persistenceAcrossContainerReplacement = true;
  await writeFile(reportPath, JSON.stringify(before, null, 2));
  console.log(JSON.stringify({ persistenceAcrossContainerReplacement: true, crawlId: before.crawlId, restoredPages: restored.data.length }));
  process.exit(0);
}
const health = await call('/health/ready'); assert.equal(health.ready, true);
const sdk = new Firecrawl({ apiKey: key, apiUrl: origin });
const report = {
  checkedAt: new Date().toISOString(), engine: 'firecrawl-oss', release: 'v2.11.162',
  sourceCommit: '7666c1f9ae8720a6bba271e0f60b6a217f8a5210', checks: {},
  persistenceAcrossContainerReplacement: false,
};
const failures = [];
async function check(name, fn) {
  try {
    await fn(); report.checks[name] = { passed: true };
    console.log(JSON.stringify({ check: name, passed: true }));
  } catch (error) {
    const message = String(error.message).replaceAll(key, '[redacted]');
    report.checks[name] = { passed: false, error: message }; failures.push(name);
    console.error(JSON.stringify({ check: name, passed: false, error: message }));
  }
  await writeFile(reportPath, JSON.stringify(report, null, 2));
}
await check('authenticationAndPrivateTargetRejection', async () => {
  const invalid = await fetch(origin + '/v2/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer invalid' }, body: JSON.stringify({ url: httpFixture }) });
  assert.equal(invalid.status, 401);
  const restricted = await fetch(origin + '/v2/scrape', { method: 'POST', headers, body: JSON.stringify({ url: 'http://169.254.169.254' }) });
  assert.equal(restricted.status, 403);
});
await check('nativeSdkHttp', async () => {
  const http = await sdk.scrape(httpFixture, { formats: ['markdown', 'html', 'links'], maxAge: 0, timeout: 60000 });
  assert.match(http.markdown, /cooperative public test page/);
  assert.doesNotMatch(http.markdown.replaceAll('\\', ''), /BROWSER_EXECUTED_JAVASCRIPT_42/);
  assert.equal(http.metadata.statusCode, 200);
});
await check('nativeSdkBrowserJavaScript', async () => {
  const browser = await sdk.scrape(fixture, { formats: ['markdown'], maxAge: 0, timeout: 60000, waitFor: 500 });
  // Markdown legitimately escapes underscores; compare the rendered source text.
  assert.match(browser.markdown.replaceAll('\\', ''), /BROWSER_EXECUTED_JAVASCRIPT_42/);
});
await check('nativeMap', async () => {
  const map = await sdk.map(fixture, { limit: 5 });
  assert.ok(map.links.some(link => link.url.includes('/second')));
});
await check('nativeCrawl', async () => {
  const start = await call('/v2/crawl', { url: fixture, limit: 2, maxDiscoveryDepth: 1, scrapeOptions: { formats: ['markdown'], maxAge: 0 } });
  assert.ok(start.id); report.crawlId = start.id;
  const crawl = await poll('/v2/crawl/' + start.id);
  assert.ok(crawl.data.length > 0 && crawl.data.length <= 2); report.crawlPages = crawl.data.length;
});
await check('nativeBatchScrape', async () => {
  const start = await call('/v2/batch/scrape', { urls: [fixture, fixture + '/second'], formats: ['markdown'], maxAge: 0 });
  const batch = await poll('/v2/batch/scrape/' + start.id);
  assert.equal(batch.data.length, 2); report.batchPages = batch.data.length;
});
await check('officialMcp', async () => {
  const mcp = new Client({ name: 'aihackr-native-stack-check', version: '0.2.0' });
  try {
    await mcp.connect(new StreamableHTTPClientTransport(new URL(origin + '/mcp'), { requestInit: { headers: { Authorization: 'Bearer ' + key } } }));
    const tools = await mcp.listTools();
    assert.ok(tools.tools.some(tool => tool.name === 'firecrawl_scrape')); assert.ok(!tools.tools.some(tool => tool.name === 'firecrawl_agent'));
    report.officialMcpTools = tools.tools.map(tool => tool.name);
    const result = await mcp.callTool({ name: 'firecrawl_scrape', arguments: { url: httpFixture, formats: ['markdown'], maxAge: 0 } });
    assert.ok(!result.isError, JSON.stringify(result)); assert.match(JSON.stringify(result), /cooperative public test page/);
  } finally { await mcp.close(); }
});
report.passed = failures.length === 0;
await writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ stackPassed: report.passed, failures }));
if (failures.length) process.exitCode = 1;
