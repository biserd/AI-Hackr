import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const origin=process.env.AIHACKR_ORIGIN??'https://aihackr-browser-run-stage.biser-d.workers.dev';
const reportFile=new URL(origin.includes('-stage.')?'../reports/staging.json':'../reports/production.json',import.meta.url);
const report=JSON.parse(await readFile(reportFile,'utf8'));assert.equal(report.passed,true);
async function post(path,body,source=origin){return fetch(origin+path,{method:'POST',headers:{'content-type':'application/json',origin:source},body:JSON.stringify(body)});}
assert.equal((await fetch(origin+'/api/session')).status,401);
assert.equal((await fetch(origin+'/api/keys')).status,401);
assert.equal((await post('/auth/start',{email:'not-an-email'})).status,400);
assert.equal((await post('/auth/verify',{code:'00000000'})).status,401);
assert.equal((await post('/auth/start',{email:'invalid@example.com'},'https://attacker.example')).status,403);
const html=await (await fetch(origin)).text();assert(!html.includes('class="badge"'));assert(!html.includes('Connect workspace'));assert(html.includes('Create your account.'));assert(html.includes('API keys'));
assert.equal((await fetch(origin+'/account.mjs')).status,200);
for(const path of ['/','/docs','/dashboard']){const response=await fetch(origin+path,{redirect:'manual'});assert.equal(response.status,200,path+' must resolve without an HTML canonicalization loop');assert.equal(response.headers.get('location'),null);assert.match(response.headers.get('content-security-policy'),/default-src 'self'/);}
for(const path of ['/docs','/dashboard']){const response=await fetch(origin+path+'/',{redirect:'manual'});assert.equal(response.status,308);assert.equal(new URL(response.headers.get('location'),origin).pathname,path);}
for(const path of ['/api/jobs','/api/usage'])assert.equal((await fetch(origin+path)).status,401);
assert.equal((await post('/api/billing/checkout',{plan:'starter'})).status,401);
assert.equal((await post('/api/billing/portal',{})).status,401);
const plans=await(await fetch(origin+'/api/plans')).json();assert.equal(plans.plans.length,3);assert.equal(plans.taxCollection,false);
for(const path of ['/docs','/connections','/oauth.mjs','/connections.mjs','/oauth.css','/aihackr-plugin.zip'])assert.equal((await fetch(origin+path,{redirect:'manual'})).status,200);
assert.equal((await fetch(origin+'/oauth/connections')).status,401);
report.checks.customerAccountGuards={passed:true};report.customerAccountGuardsVerifiedAt=new Date().toISOString();
await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');
console.log('PASS customer auth/CSRF guards, private endpoints, public plans and HTML routes without redirect loops.');
