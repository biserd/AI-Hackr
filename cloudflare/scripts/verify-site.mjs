import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pages,docs,posts} from '../../content/manifest.mjs';
import {sourceDigest} from './source-digest.mjs';
const out=new URL('../../dist/public/',import.meta.url),origin='https://aihackr.com';
const catalogue=[{path:'/'},...pages],html=new Map(),titles=new Set(),descriptions=new Set(),report={checkedAt:new Date().toISOString(),sourceDigest:await sourceDigest(),passed:false,pages:[],limitations:['Static/source validation does not establish search-engine indexing, rankings, Core Web Vitals or a fresh visual browser review.']};
for(const item of catalogue)html.set(item.path,await readFile(new URL(item.path==='/'?'index.html':'.'+item.path+'.html',out),'utf8'));
const files=new Set(['/style.css','/marketing.css','/app.mjs','/account.mjs','/content.mjs','/dashboard','/docs-search.json','/robots.txt','/sitemap.xml','/rss.xml','/marketing-kit.md','/assets/aihackr-mark.svg','/assets/aihackr-wordmark.svg','/assets/social-card.png','/api/capabilities']);
const connections=await readFile(new URL('connections.html',out),'utf8');
assert.match(connections,/<meta name="robots" content="noindex">/);
files.add('/connections');
const hashes=JSON.parse(await readFile(new URL('csp-hashes.json',out),'utf8'));
for(const item of catalogue){
  const text=html.get(item.path),title=text.match(/<title>(.*?)<\/title>/)?.[1],description=text.match(/<meta name="description" content="([^"]+)"/)?.[1];
  assert(title?.length>10&&title.length<95,'Useful title: '+item.path);assert(description?.length>=70&&description.length<=180,'Useful description: '+item.path);assert(!titles.has(title),'Duplicate title');assert(!descriptions.has(description),'Duplicate description');titles.add(title);descriptions.add(description);
  assert.equal([...text.matchAll(/<h1(?:\s[^>]*)?>/g)].length,1,'One H1: '+item.path);
  assert(text.includes(`<link rel="canonical" href="${origin+item.path}">`),'Canonical: '+item.path);assert(!text.includes('content="noindex'),'Unexpected noindex');
  for(const marker of ['property="og:title"','property="og:description"','property="og:url"','property="og:image"','name="twitter:card"','name="twitter:image"','name="viewport"'])assert(text.includes(marker),'Social/mobile metadata: '+marker);
  const ids=[...text.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,'Duplicate IDs: '+item.path);
  for(const [,src]of text.matchAll(/<(?:script|link|img)\b[^>]*\b(?:src|href)="([^"]+)"/g)){const u=new URL(src,origin+item.path);if(u.origin===origin&&u.pathname!==item.path)assert(files.has(u.pathname)||html.has(u.pathname),'Missing asset: '+src);}
  for(const [,href]of text.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)){
    const u=new URL(href,origin+item.path);if(u.origin!==origin)continue;assert(html.has(u.pathname)||files.has(u.pathname),'Broken internal link '+item.path+' -> '+href);
    if(u.hash&&html.has(u.pathname))assert(new RegExp('\\sid="'+u.hash.slice(1)+'"').test(html.get(u.pathname)),'Broken anchor '+item.path+' -> '+href);
  }
  const scripts=[...text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,1,'One structured data graph');
  const graph=JSON.parse(scripts[0][1])['@graph'];assert(graph.some(x=>x['@type']==='BreadcrumbList'));assert(graph.some(x=>x['@type']==='Organization'));assert.deepEqual(hashes[item.path],scripts.map(([,script])=>"'sha256-"+createHash('sha256').update(script).digest('base64')+"'"));
  if(item.kind==='post'){const blog=graph.find(x=>x['@type']==='BlogPosting');assert(blog?.author&&blog?.datePublished&&blog?.mainEntityOfPage);const article=text.match(/<article class="article-content">([\s\S]*?)<\/article>/)[1],words=article.replace(/<[^>]+>/g,' ').split(/\s+/).filter(Boolean).length;assert(words>=500,'Substantive article: '+item.path+' '+words);}
  report.pages.push({path:item.path,title,description,canonical:origin+item.path,internalLinksVerified:true,structuredDataVerified:true});
}
const sitemap=await readFile(new URL('sitemap.xml',out),'utf8');for(const item of catalogue)assert(sitemap.includes('<loc>'+origin+item.path+'</loc>'));
assert.equal([...sitemap.matchAll(/<loc>/g)].length,catalogue.length);
const rss=await readFile(new URL('rss.xml',out),'utf8');for(const post of posts)assert(rss.includes('<link>'+origin+post.path+'</link>'));assert.equal([...rss.matchAll(/<item>/g)].length,posts.length);
const search=JSON.parse(await readFile(new URL('docs-search.json',out),'utf8'));assert.equal(search.length,docs.length);assert(search.every(item=>html.has(item.path)&&item.text.length>200));
const card=await readFile(new URL('assets/social-card.png',out));assert.equal(card.readUInt32BE(16),1200);assert.equal(card.readUInt32BE(20),630);
report.passed=true;report.docs=docs.length;report.posts=posts.length;report.search=true;report.sitemap=true;report.rss=true;report.socialCard={width:1200,height:630};
await mkdir(new URL('../reports/',import.meta.url),{recursive:true});await writeFile(new URL('../reports/site-static.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log('PASS '+catalogue.length+' pages: unique metadata, canonical URLs, social cards, schema, internal links, anchors, sitemap, RSS and docs search.');
