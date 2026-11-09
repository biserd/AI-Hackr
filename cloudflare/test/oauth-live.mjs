// A real MCP SDK OAuth client. Secrets remain in RAM; only a nonsecret report is saved.
// The owner approves the ordinary browser consent. One public-page call is bounded.
import {createServer} from 'node:http';
import {randomBytes,createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {auth} from '@modelcontextprotocol/sdk/client/auth.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {sourceDigest} from '../scripts/source-digest.mjs';
const origin=process.env.AIHACKR_ORIGIN??'https://aihackr-browser-run-stage.biser-d.workers.dev';
if(!['https://aihackr-browser-run-stage.biser-d.workers.dev','https://aihackr.com'].includes(origin))throw new Error('Use an existing AIHackr deployment.');
const scope='account:read web:read offline_access',port=8794,redirectUrl='http://127.0.0.1:'+port+'/oauth/callback';
const reportFile=new URL(origin==='https://aihackr.com'?'../reports/oauth-production.json':'../reports/oauth-staging.json',import.meta.url),signalFile=new URL('../reports/oauth-resume.json',import.meta.url);
const report={checkedAt:new Date().toISOString(),origin,sourceDigest:await sourceDigest(),passed:false,checks:{}};
let clientInfo,tokens,verifier,authorizationUrl,finished=false;
const expectedState=randomBytes(32).toString('base64url');
const provider={redirectUrl,clientMetadata:{client_name:'AIHackr OAuth verification',application_type:'native',redirect_uris:[redirectUrl],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none',scope},state:()=>expectedState,clientInformation:()=>clientInfo,saveClientInformation:value=>{clientInfo=value;},tokens:()=>tokens,saveTokens:value=>{tokens=value;},saveCodeVerifier:value=>{verifier=value;},codeVerifier:()=>verifier,redirectToAuthorization:url=>{authorizationUrl=url;},invalidateCredentials:part=>{if(part==='all'||part==='client')clientInfo=undefined;if(part==='all'||part==='tokens')tokens=undefined;}};
const check=(name,details={})=>{report.checks[name]={passed:true,...details};console.log('PASS '+name);};
async function callToken(body){const response=await fetch(origin+'/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientInfo.client_id,resource:origin+'/mcp',...body}),signal:AbortSignal.timeout(20000)});return {status:response.status,data:await response.json()};}
async function useClient(token,run){const client=new Client({name:'AIHackr OAuth verification',version:'0.6.0'}),transport=new StreamableHTTPClientTransport(new URL('/mcp',origin),{requestInit:{headers:{Authorization:'Bearer '+token}}});try{await client.connect(transport);return await run(client);}finally{await client.close();}}
async function verify(){
  check('authorizationCodeAndPkce',{accessTokenSeconds:tokens.expires_in,refreshIssued:Boolean(tokens.refresh_token)});assert(tokens.refresh_token);assert.equal(tokens.expires_in,900);const initial={...tokens};
  await useClient(initial.access_token,async client=>{
    const listed=await client.listTools();assert.equal(listed.tools.length,9);assert(listed.tools.some(t=>t.name==='get_account'));const page=listed.tools.find(t=>t.name==='get_url_markdown');assert(page._meta?.securitySchemes?.some(s=>s.scopes.includes('web:read')));check('mcpToolDiscovery',{toolCount:listed.tools.length});
    const profile=await client.callTool({name:'get_account',arguments:{}});assert(!profile.isError);const account=JSON.parse(profile.content[0].text);assert(account.id&&account.email);report.accountFingerprint=createHash('sha256').update(account.id).digest('hex');check('linkedAccountProfile');
    const denied=await client.callTool({name:'start_crawl',arguments:{url:'https://fixtures.aihackr.com',limit:1,render:false}});assert.equal(denied.isError,true);assert(denied._meta?.['mcp/www_authenticate']?.some(h=>h.includes('crawl:write')));check('scopeEnforcement');
    const pageResult=await client.callTool({name:'get_url_markdown',arguments:{url:'https://fixtures.aihackr.com'}});assert(!pageResult.isError);assert.match(pageResult.content[0].text,/Native engine fixture/i);check('realBrowserInCustomerWorkspace',{successfulPageCalls:1});
  });
  if(process.env.AIHACKR_REDEPLOY_CHECK==='1'){
    console.log(JSON.stringify({readyForRedeploy:true,signalFile:signalFile.pathname}));
    const started=Date.now();for(;;){let signal;try{signal=JSON.parse(await readFile(signalFile,'utf8'));}catch{}if(signal?.sourceDigest===report.sourceDigest&&Date.parse(signal.at)>started){report.redeployVersion=signal.version;break;}if(Date.now()-started>15*60000)throw new Error('Worker redeploy signal was not received.');await new Promise(resolve=>setTimeout(resolve,1000));}
    await useClient(initial.access_token,async client=>{const profile=await client.callTool({name:'get_account',arguments:{}});assert(!profile.isError);assert.equal(createHash('sha256').update(JSON.parse(profile.content[0].text).id).digest('hex'),report.accountFingerprint);});check('tokenPersistenceAcrossWorkerRedeploy');
  }
  const refused=await callToken({grant_type:'refresh_token',refresh_token:initial.refresh_token,scope:'crawl:write'});assert.equal(refused.status,400);check('refreshCannotEscalateScope');
  const wrong=await callToken({grant_type:'refresh_token',refresh_token:initial.refresh_token,resource:'https://other.example/mcp'});assert.equal(wrong.status,400);check('audienceBinding');
  const refreshed=await callToken({grant_type:'refresh_token',refresh_token:initial.refresh_token,scope:'web:read offline_access'});assert.equal(refreshed.status,200);assert.notEqual(refreshed.data.refresh_token,initial.refresh_token);tokens={...refreshed.data};check('refreshRotation');
  await useClient(tokens.access_token,async client=>{const profile=await client.callTool({name:'get_account',arguments:{}});assert.equal(profile.isError,true);assert(profile._meta?.['mcp/www_authenticate']?.some(h=>h.includes('account:read')));});check('downscopedTokenEnforcement');
  const revoked=await callToken({token:tokens.refresh_token,token_type_hint:'refresh_token'});assert.equal(revoked.status,200);
  for(const token of [initial.access_token,tokens.access_token]){const r=await fetch(origin+'/mcp',{headers:{Authorization:'Bearer '+token,Accept:'application/json, text/event-stream'},signal:AbortSignal.timeout(10000)});assert.equal(r.status,401);assert.match(r.headers.get('www-authenticate'),/resource_metadata=/);}
  const stopped=await callToken({grant_type:'refresh_token',refresh_token:tokens.refresh_token});assert.equal(stopped.status,400);check('immediateRevocation');
  report.passed=true;
}
async function finalize(error){
  if(finished)return;finished=true;
  if(error){report.failure='OAuth live verification failed: '+(error.name??'Error');console.error(report.failure);process.exitCode=1;}
  try{if(tokens?.refresh_token&&clientInfo)await callToken({token:tokens.refresh_token,token_type_hint:'refresh_token'});}catch{/* Owner can also disconnect in Connected apps. */}
  await mkdir(new URL('../reports/',import.meta.url),{recursive:true});await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:Object.keys(report.checks),report:reportFile.pathname}));
  server.close();tokens=undefined;verifier=undefined;clearTimeout(expiry);
}
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,redirectUrl);if(url.pathname!=='/oauth/callback'){res.writeHead(404);res.end();return;}
  if(url.searchParams.get('state')!==expectedState||url.searchParams.get('iss')!==origin){res.writeHead(400,{'Content-Type':'text/plain'});res.end('OAuth callback could not be verified.');return;}
  if(url.searchParams.has('error')){res.writeHead(400,{'Content-Type':'text/plain'});res.end('Connection was not approved.');await finalize(new Error('Consent declined'));return;}
  try{const result=await auth(provider,{serverUrl:new URL('/mcp',origin),authorizationCode:url.searchParams.get('code'),scope});assert.equal(result,'AUTHORIZED');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end('<!doctype html><title>AIHackr verification</title><h1>AIHackr connected.</h1><p>Verification is running in Codex. The test application will disconnect automatically when it finishes.</p>');await verify();await finalize();}catch(error){if(!res.headersSent){res.writeHead(400,{'Content-Type':'text/plain'});res.end('Verification could not complete. Check Codex.');}await finalize(error);}
});
const expiry=setTimeout(()=>finalize(new Error('Consent test timed out')),30*60000);
await new Promise((resolve,reject)=>server.listen(port,'127.0.0.1',error=>error?reject(error):resolve()));
try{const result=await auth(provider,{serverUrl:new URL('/mcp',origin),scope});assert.equal(result,'REDIRECT');console.log(JSON.stringify({authorizationUrl:authorizationUrl.href,client:'AIHackr OAuth verification',publicPageCalls:1}));}catch(error){await finalize(error);}
