export default {
  fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/robots.txt') return new Response('User-agent: *\nAllow: /\n', { headers: { 'Content-Type': 'text/plain' } });
    if (path === '/sitemap.xml') return new Response('Not found', { status: 404 });
    if (!['/', '/second'].includes(path)) return new Response('Not found', { status: 404 });
    return new Response(`<!doctype html><html><head><title>AIHackr native Firecrawl fixture</title></head><body><main><h1>${path === '/' ? 'Native engine fixture' : 'Second native fixture page'}</h1><p>This cooperative public test page verifies the real Firecrawl core pipeline, asynchronous crawl queue, content conversion and browser worker. It contains no private information.</p><a href="/second">Second test page</a><div id="rendered"></div></main><script>setTimeout(()=>{document.getElementById('rendered').textContent='BROWSER_EXECUTED_JAVASCRIPT_42'},40)</script></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
  },
};
