import test from 'node:test';
import assert from 'node:assert/strict';
import {publicSite} from '../public-site.mjs';
const env={ASSETS:{fetch:async request=>{const path=new URL(typeof request==='string'||request instanceof URL?request:request.url).pathname;if(path==='/csp-hashes.json')return Response.json({'/docs':["'sha256-testhash'"]});return new Response(path,{headers:{'Content-Type':'text/plain'}});}}};
test('public routes have exact assets, one-hop aliases and genuine 404s',async()=>{
  const guide=await publicSite(new Request('https://aihackr.com/docs/crawl'),env);assert.equal(guide.status,200);assert.equal(await guide.text(),'/docs/crawl.html');assert.equal(guide.headers.get('link'),'<https://aihackr.com/docs/crawl>; rel="canonical"');
  for(const [path,target]of [['/docs/','/docs'],['/docs.html','/docs'],['/docs/crawl/','/docs/crawl'],['/index.html','/']]){const r=await publicSite(new Request('https://aihackr.com'+path),env);assert.equal(r.status,308);assert.equal(r.headers.get('location'),'https://aihackr.com'+target);}
  const missing=await publicSite(new Request('https://aihackr.com/blog/does-not-exist'),env);assert.equal(missing.status,404);assert.equal(missing.headers.get('x-robots-tag'),'noindex');assert.equal(await missing.text(),'/404.html');
  assert.equal(await publicSite(new Request('https://aihackr.com/api/private'),env),null);assert.equal(await publicSite(new Request('https://aihackr.com/docs',{method:'POST'}),env),null);
});
test('staging is excluded from indexing while production remains crawlable',async()=>{
  for(const path of ['/','/docs','/blog','/sitemap.xml']){const response=await publicSite(new Request('https://aihackr-browser-run-stage.biser-d.workers.dev'+path),env);assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');}
  const robots=await publicSite(new Request('https://aihackr-browser-run-stage.biser-d.workers.dev/robots.txt'),env);assert.match(await robots.text(),/Disallow: \/\n/);
  const production=await publicSite(new Request('https://aihackr.com/docs'),env);assert.equal(production.headers.get('x-robots-tag'),null);assert.match(production.headers.get('content-security-policy'),/script-src 'self' 'sha256-testhash'/);
  const head=await publicSite(new Request('https://aihackr.com/docs',{method:'HEAD'}),env);assert.equal(head.status,200);assert.equal(await head.text(),'');
});
