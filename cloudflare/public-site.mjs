import {pages} from '../content/manifest.mjs';
const routes=new Map([['/','/index.html'],...pages.map(p=>[p.path,p.path+'.html'])]);
const files=new Map(['/app.mjs','/account.mjs','/style.css','/content.mjs','/marketing.css','/docs-search.json','/robots.txt','/sitemap.xml','/rss.xml','/marketing-kit.md','/assets/aihackr-wordmark.svg','/assets/aihackr-mark.svg','/assets/social-card.png'].map(path=>[path,path]));
const aliases=new Map([['/index.html','/'],['/web-data','/'],['/web-data/','/'],...pages.map(p=>[p.path+'.html',p.path])]);
const baseCsp="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
export async function publicSite(request,env){
  if(!['GET','HEAD'].includes(request.method))return null;
  const url=new URL(request.url),path=url.pathname,stage=url.hostname!=='aihackr.com';
  const target=aliases.get(path)??(path.endsWith('/')&&routes.has(path.slice(0,-1))?path.slice(0,-1):null);
  if(target!==null&&target!==undefined){url.pathname=target;return new Response(null,{status:308,headers:{Location:url.href,...(stage?{'X-Robots-Tag':'noindex, nofollow'}:{})}});}
  if(path==='/robots.txt'&&stage)return new Response(request.method==='HEAD'?null:'User-agent: *\nDisallow: /\n',{headers:{'Content-Type':'text/plain; charset=utf-8','X-Robots-Tag':'noindex, nofollow'}});
  const assetPath=routes.get(path)??files.get(path);
  // Unknown website paths return a real 404; never serve the app as a soft 404.
  if(!assetPath&&/^\/(?:api|v[12]|mcp|auth|oauth|health)(?:\/|$)/.test(path))return null;
  url.pathname=assetPath??'/404.html';
  const asset=await env.ASSETS.fetch(new Request(url,{method:request.method,headers:request.headers}));
  const headers=new Headers(asset.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','strict-origin-when-cross-origin');
  const html=routes.has(path)||!assetPath;
  if(html){
    const hashResponse=await env.ASSETS.fetch(new URL('/csp-hashes.json',url));
    const hashes=hashResponse.ok?(await hashResponse.json())[path]??[]:[];
    headers.set('Content-Security-Policy',baseCsp.replace("script-src 'self'","script-src 'self'"+(hashes.length?' '+hashes.join(' '):'')));
    headers.set('Content-Type','text/html; charset=utf-8');
    if(assetPath)headers.set('Link','<https://aihackr.com'+path+'>; rel="canonical"');
  }
  if(stage||!assetPath)headers.set('X-Robots-Tag',stage?'noindex, nofollow':'noindex');
  if(['/sitemap.xml','/rss.xml'].includes(path))headers.set('Content-Type',path==='/rss.xml'?'application/rss+xml; charset=utf-8':'application/xml; charset=utf-8');
  if(path==='/marketing-kit.md'){headers.set('Content-Type','text/markdown; charset=utf-8');headers.set('Content-Disposition','attachment; filename="AIHackr-Marketing-Kit.md"');}
  headers.set('Cache-Control',!assetPath?'no-store':stage?'no-cache':html?'public, max-age=0, must-revalidate':'public, max-age=3600');
  return new Response(request.method==='HEAD'?null:asset.body,{status:assetPath?asset.status:404,headers});
}
