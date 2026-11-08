import test from 'node:test';
import assert from 'node:assert/strict';
import { routeEdge } from '../src/edge-route.mjs';
const assets = { fetch: async () => new Response('<h1>Fresh native portal</h1>', { headers: { 'Content-Type': 'text/html' } }) };
test('frontend works before backend configuration; API fails explicitly', async () => {
  const env = { ASSETS: assets, NATIVE_BACKEND_ORIGIN: '' };
  assert.match(await (await routeEdge(new Request('https://aihackr.com/'), env)).text(), /Fresh native portal/);
  const response = await routeEdge(new Request('https://aihackr.com/v2/scrape'), env); assert.equal(response.status, 503); assert.match(await response.text(), /not been configured/);
});
test('edge preserves native API body and credentials only to the configured backend', async () => {
  let seen;
  const response = await routeEdge(new Request('https://aihackr.com/v2/scrape', { method: 'POST', headers: { Authorization: 'Bearer test-only', 'Content-Type': 'application/json', 'Cookie': 'legacy-session=discard' }, body: '{"url":"https://example.com"}' }), { ASSETS: assets, NATIVE_BACKEND_ORIGIN: 'https://native-origin.aihackr.com' }, async (url, init) => {
    seen = { url: url.href, headers: init.headers, body: await new Response(init.body).text() }; return Response.json({ success: true, data: { markdown: 'native' } });
  });
  assert.equal(seen.url, 'https://native-origin.aihackr.com/v2/scrape'); assert.equal(seen.headers.get('authorization'), 'Bearer test-only'); assert.equal(seen.headers.has('cookie'), false); assert.equal(seen.body, '{"url":"https://example.com"}'); assert.equal(response.status, 200);
});
test('edge avoids routing loops and retires the internal API prefix', async () => {
  assert.equal((await routeEdge(new Request('https://aihackr.com/v2/scrape'), { NATIVE_BACKEND_ORIGIN: 'https://aihackr.com' })).status, 503);
  assert.equal((await routeEdge(new Request('https://aihackr.com/__internal/rpc'), {})).status, 404);
  assert.equal((await routeEdge(new Request('https://www.aihackr.com/docs'), {})).headers.get('location'), 'https://aihackr.com/docs');
});
