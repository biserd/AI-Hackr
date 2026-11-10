import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pages,posts} from '../../content/manifest.mjs';
import {sourceDigest} from '../scripts/source-digest.mjs';
const origin=process.env.AIHACKR_ORIGIN??'https://aihackr-browser-run-stage.biser-d.workers.dev',production=origin==='https://aihackr.com',directory=new URL('../../dist/public/',import.meta.url);
assert(['https://aihackr.com','https://aihackr-browser-run-stage.biser-d.workers.dev'].includes(origin));
const report={checkedAt:new Date().toISOString(),origin,sourceDigest:await sourceDigest(),passed:false,checks:{},pages:[]};
const get=path=>fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(15000)});
for(const item of [{path:'/'},...pages]){
  const response=await get(item.path);assert.equal(response.status,200,item.path);assert.match(response.headers.get('content-type'),/text\/html/);assert.equal(response.headers.get('link'),'<https://aihackr.com'+item.path+'>; rel="canonical"');assert.equal(response.headers.get('x-robots-tag'),production?null:'noindex, nofollow');
  const text=await response.text(),expected=await readFile(new URL(item.path==='/'?'index.html':'.'+item.path+'.html',directory),'utf8');assert.equal(text.replaceAll('\r\n','\n'),expected.replaceAll('\r\n','\n'),'Deployed source: '+item.path);
  const script=text.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],hash=createHash('sha256').update(script).digest('base64');assert(response.headers.get('content-security-policy').includes("'sha256-"+hash+"'"));
  report.pages.push({path:item.path,status:200,deployedSourceMatches:true,canonical:true,structuredDataCsp:true});
}
report.checks.pagesAndMetadata={passed:true,count:report.pages.length};
for(const [path,target]of [['/docs/','/docs'],['/docs.html','/docs'],['/docs/crawl/','/docs/crawl'],['/blog/','/blog'],['/index.html','/']]){const response=await get(path);assert.equal(response.status,308,path);assert.equal(response.headers.get('location'),origin+target);}
const absent=await get('/blog/not-a-real-article');assert.equal(absent.status,404);assert.match(absent.headers.get('x-robots-tag'),/noindex/);report.checks.redirectsAnd404={passed:true};
const robots=await get('/robots.txt'),rules=await robots.text();assert.equal(robots.status,200);if(production){assert(rules.includes('Sitemap: https://aihackr.com/sitemap.xml'));assert(!/^Disallow: \/$/m.test(rules));}else assert(/^Disallow: \/$/m.test(rules));
const sitemap=await get('/sitemap.xml');assert.equal(sitemap.status,200);assert.match(sitemap.headers.get('content-type'),/xml/);assert((await sitemap.text()).includes('<loc>https://aihackr.com/blog</loc>'));
const rss=await get('/rss.xml');assert.equal(rss.status,200);assert.match(rss.headers.get('content-type'),/application\/rss\+xml/);assert.equal([...(await rss.text()).matchAll(/<item>/g)].length,posts.length);
const search=await get('/docs-search.json');assert.equal(search.status,200);assert.equal((await search.json()).length,10);report.checks.discoveryFeedsAndSearch={passed:true};
for(const path of ['/assets/aihackr-mark.svg','/assets/aihackr-wordmark.svg','/assets/social-card.png','/marketing-kit.md','/marketing.css','/content.mjs']){const response=await get(path);assert.equal(response.status,200,path);const actual=Buffer.from(await response.arrayBuffer()),expected=await readFile(new URL('.'+path,directory));assert.deepEqual(actual,expected);}
report.checks.brandAssetsAndMarketingKit={passed:true};
assert.equal((await get('/api/session')).status,401);assert.equal((await get('/api/keys')).status,401);assert.equal((await get('/api/capabilities')).headers.get('x-robots-tag'),'noindex');report.checks.privateRoutes={passed:true};
const tagged=await get('/blog?utm_source=verification');assert.equal(tagged.status,200);assert((await tagged.text()).includes('href="https://aihackr.com/blog"'));report.checks.queryCanonical={passed:true};
report.passed=true;await mkdir(new URL('../reports/',import.meta.url),{recursive:true});await writeFile(new URL(production?'../reports/site-production.json':'../reports/site-staging.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log('PASS live '+report.pages.length+' pages, source parity, CSP, aliases, real 404, index controls, feeds, search index, assets and private-route guards.');
