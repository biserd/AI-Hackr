import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

test('official Firecrawl MCP exposes native supported tools and dispatches through the authenticated gateway', { timeout: 30000 }, async t => {
  const key = 'fc-' + randomBytes(32).toString('hex');
  const calls = [];
  const upstream = createServer(async (req, res) => {
    const parts = []; for await (const chunk of req) parts.push(chunk);
    calls.push({ path: req.url, authorization: req.headers.authorization, body: Buffer.concat(parts).toString() });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(req.url.includes('/health/') ? { status: 'ok' } : { success: true, data: { markdown: '# Local MCP contract fixture', metadata: { statusCode: 200 } } }));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve)); t.after(() => upstream.close());
  const processHandle = spawn(process.execPath, [new URL('../src/start.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')], {
    env: { ...process.env, AIHACKR_API_KEY: key, PORT: '8097', PUBLIC_ORIGIN: 'http://localhost:8097', FIRECRAWL_API_URL: `http://127.0.0.1:${upstream.address().port}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = ''; processHandle.stdout.on('data', chunk => logs += chunk); processHandle.stderr.on('data', chunk => logs += chunk);
  t.after(() => processHandle.kill('SIGTERM'));
  for (let i = 0; i < 150 && !logs.includes('native_gateway_ready'); i++) {
    if (processHandle.exitCode !== null) throw new Error('Gateway exited: ' + logs.replaceAll(key, '[redacted]'));
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.match(logs, /native_gateway_ready/);
  const client = new Client({ name: 'native-mcp-contract', version: '0.2.0' }); t.after(() => client.close());
  await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:8097/mcp'), { requestInit: { headers: { Authorization: 'Bearer ' + key } } }));
  const tools = await client.listTools();
  assert.deepEqual(tools.tools.map(tool => tool.name).sort(), ['firecrawl_scrape', 'firecrawl_map', 'firecrawl_crawl', 'firecrawl_check_crawl_status'].sort());
  const result = await client.callTool({ name: 'firecrawl_scrape', arguments: { url: 'https://example.com', formats: ['markdown'], maxAge: 0 } });
  assert.ok(!result.isError, JSON.stringify(result)); assert.match(JSON.stringify(result), /Local MCP contract fixture/);
  assert.ok(calls.some(call => call.path === '/v2/scrape'));
  assert.ok(calls.every(call => !call.authorization));
});
