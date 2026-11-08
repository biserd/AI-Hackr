export default {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    const origin = new URL(request.url).origin;
    if (path === '/robots.txt') return new Response('User-agent: *\nAllow: /\nDisallow: /private-fixture\nSitemap: ' + origin + '/sitemap.xml\n', { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
    const paths = ['/', '/second', ...Array.from({length:10},(_,i)=>'/page/'+(i+1))];
    if (path === '/sitemap.xml') return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+paths.map(path=>'<url><loc>'+origin+path+'</loc></url>').join('')+'</urlset>', { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'no-store' } });
    if (path === '/slow') await new Promise(resolve=>setTimeout(resolve,5000));
    if (![...paths,'/slow','/private-fixture','/pagination'].includes(path)) return new Response('Not found', { status: 404 });
    return new Response(`<!doctype html><html><head><title>AIHackr public browser fixture</title></head><body><main><h1>${path === '/' ? 'Native engine fixture' : 'Fixture page '+path}</h1><p>This cooperative public test page verifies actual browser rendering, managed crawl jobs and content conversion. It contains no private information.</p><a href="/second">Second test page</a>${path==='/pagination'?paths.map(path=>'<a href="'+path+'">Fixture '+path+'</a>').join(''):''}<div id="rendered"></div></main><script>setTimeout(()=>{document.getElementById('rendered').textContent='BROWSER_EXECUTED_JAVASCRIPT_42'},40)</script></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
  },
};
