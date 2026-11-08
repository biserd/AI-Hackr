import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import Firecrawl from 'firecrawl';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
let config = '';
try { config = await readFile(new URL('../.env', import.meta.url), 'utf8'); } catch { /* CI may supply environment directly */ }
const key = process.env.AIHACKR_API_KEY ?? config.match(/^AIHACKR_API_KEY=(.+)$/m)?.[1].trim();
assert.ok(key, 'A test workspace key is required; it is never printed.');
const origin = process.env.TEST_ORIGIN ?? 'http://localhost:8080';
const fixture = process.env.NATIVE_FIXTURE_URL ?? 'https://aihackr-native-fixtures.biser-d.workers.dev';
const headers = { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
const call = async (path, body, method = body ? 'POST' : 'GET') => {
  const r = await fetch(origin + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(125000) });
  const data = await r.json(); assert.ok(r.ok, `${path}: ${r.status} ${JSON.stringify(data)}`); return data;
};
async function poll(path) {
  for (let i = 0; i < 90; i++) { const result = await call(path); if (result.status === 'completed') return result; if (['failed', 'cancelled'].includes(result.status)) throw new Error('Native job ended: ' + JSON.stringify(result)); await new Promise(resolve => setTimeout(resolve, 1500)); }
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
const invalid = await fetch(origin + '/v2/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer invalid' }, body: JSON.stringify({ url: 'https://example.com' }) }); assert.equal(invalid.status, 401);
const restricted = await fetch(origin + '/v2/scrape', { method: 'POST', headers, body: JSON.stringify({ url: 'http://169.254.169.254' }) }); assert.equal(restricted.status, 403);
const sdk = new Firecrawl({ apiKey: key, apiUrl: origin });
const http = await sdk.scrape('https://example.com', { formats: ['markdown', 'html', 'links'], maxAge: 0, timeout: 60000 });
assert.match(http.markdown, /Example Domain/); assert.equal(http.metadata.statusCode, 200);
const browser = await sdk.scrape(fixture, { formats: ['markdown'], maxAge: 0, timeout: 60000, waitFor: 500 });
assert.match(browser.markdown, /BROWSER_EXECUTED_JAVASCRIPT_42/);
const map = await sdk.map(fixture, { limit: 5 }); assert.ok(map.links.some(link => link.url.includes('/second')));
const start = await call('/v2/crawl', { url: fixture, limit: 2, maxDiscoveryDepth: 1, scrapeOptions: { formats: ['markdown'], maxAge: 0 } });
assert.ok(start.id); const crawl = await poll('/v2/crawl/' + start.id); assert.ok(crawl.data.length > 0 && crawl.data.length <= 2);
const batchStart = await call('/v2/batch/scrape', { urls: [fixture, fixture + '/second'], formats: ['markdown'], maxAge: 0 });
const batch = await poll('/v2/batch/scrape/' + batchStart.id); assert.equal(batch.data.length, 2);
const mcp = new Client({ name: 'aihackr-native-stack-check', version: '0.2.0' });
try {
  await mcp.connect(new StreamableHTTPClientTransport(new URL(origin + '/mcp'), { requestInit: { headers: { Authorization: 'Bearer ' + key } } }));
  const tools = await mcp.listTools(); assert.ok(tools.tools.some(tool => tool.name === 'firecrawl_scrape')); assert.ok(!tools.tools.some(tool => tool.name === 'firecrawl_agent'));
  const result = await mcp.callTool({ name: 'firecrawl_scrape', arguments: { url: 'https://example.com', formats: ['markdown'], maxAge: 0 } });
  assert.ok(!result.isError, JSON.stringify(result)); assert.match(JSON.stringify(result), /Example Domain/);
  const report = { checkedAt: new Date().toISOString(), engine: 'firecrawl-oss', release: 'v2.11.162', sourceCommit: '7666c1f9ae8720a6bba271e0f60b6a217f8a5210', nativeSdk: true, http: true, browserJavaScript: true, map: true, crawlId: start.id, crawlPages: crawl.data.length, batchPages: batch.data.length, officialMcpTools: tools.tools.map(tool => tool.name), officialMcpScrape: true, invalidKeyRejected: true, metadataTargetRejected: true, persistenceAcrossContainerReplacement: false };
  await writeFile(reportPath, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await mcp.close(); }
