const backendPath = path => path === '/mcp' || path.startsWith('/v2/') || path.startsWith('/api/') || path.startsWith('/health/');
const unavailable = message => Response.json({ success: false, error: { code: 'ENGINE_UNAVAILABLE', message } }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
export async function routeEdge(request, env, fetcher = fetch) {
  const url = new URL(request.url);
  if (url.hostname === 'www.aihackr.com') { url.hostname = 'aihackr.com'; return Response.redirect(url.href, 308); }
  if (url.pathname === '/web-data') return Response.redirect(new URL('/', url).href, 308);
  if (url.pathname === '/__version') return Response.json({ release: 'firecrawl-native-0.2.0', engine: 'firecrawl-oss', upstream: 'v2.11.162', configured: Boolean(env.NATIVE_BACKEND_ORIGIN) }, { headers: { 'Cache-Control': 'no-store' } });
  if (url.pathname.startsWith('/__internal/')) return new Response('Not found', { status: 404 });
  if (backendPath(url.pathname)) {
    let backend;
    try { backend = new URL(env.NATIVE_BACKEND_ORIGIN); } catch { return unavailable('The native Firecrawl backend has not been configured.'); }
    if (backend.protocol !== 'https:' || backend.username || backend.password || ['aihackr.com', 'www.aihackr.com'].includes(backend.hostname)) return unavailable('The private backend origin is invalid.');
    const target = new URL(url.pathname + url.search, backend.origin);
    const headers = new Headers();
    for (const name of ['authorization', 'content-type', 'accept', 'origin', 'mcp-protocol-version', 'mcp-session-id', 'last-event-id', 'idempotency-key']) {
      const value = request.headers.get(name); if (value) headers.set(name, value);
    }
    try {
      const upstream = await fetcher(target, { method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body, redirect: 'manual', duplex: 'half' });
      const output = new Headers();
      for (const name of ['content-type', 'mcp-session-id', 'retry-after', 'www-authenticate']) { const value = upstream.headers.get(name); if (value) output.set(name, value); }
      output.set('Cache-Control', 'no-store'); return new Response(upstream.body, { status: upstream.status, headers: output });
    } catch { return unavailable('The native Firecrawl backend is unavailable.'); }
  }
  const asset = await env.ASSETS.fetch(request);
  const headers = new Headers(asset.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  return new Response(asset.body, { status: asset.status, headers });
}
