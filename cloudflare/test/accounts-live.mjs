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
report.checks.customerAccountGuards={passed:true};report.customerAccountGuardsVerifiedAt=new Date().toISOString();
await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');
console.log('PASS customer auth errors, CSRF guards, private endpoints, signup UI and logo cleanup.');
