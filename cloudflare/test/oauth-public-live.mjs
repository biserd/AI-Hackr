import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import {sourceDigest} from '../scripts/source-digest.mjs';
const origin=process.env.AIHACKR_ORIGIN??'https://aihackr-browser-run-stage.biser-d.workers.dev',resource=origin+'/mcp';
const report={checkedAt:new Date().toISOString(),origin,sourceDigest:await sourceDigest(),passed:false,checks:{}};
const check=(name,details={})=>{report.checks[name]={passed:true,...details};console.log('PASS '+name);};
try{
  const prm=await(await fetch(origin+'/.well-known/oauth-protected-resource/mcp')).json(),metadata=await(await fetch(origin+'/.well-known/oauth-authorization-server')).json();assert.equal(prm.resource,resource);assert.equal(metadata.issuer,origin);assert.equal(metadata.client_id_metadata_document_supported,true);assert(metadata.code_challenge_methods_supported.includes('S256'));assert.equal(metadata.authorization_response_iss_parameter_supported,true);assert(!prm.scopes_supported.includes('offline_access'));check('discovery');
  const missing=await fetch(resource);assert.equal(missing.status,401);assert.match(missing.headers.get('www-authenticate'),/resource_metadata=/);check('transportChallenge');
  const mcp=async (method,params={},headers={})=>fetch(resource,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',...headers},body:JSON.stringify({jsonrpc:'2.0',...(method==='notifications/initialized'?{}:{id:1}),method,params})});
  const message=async response=>{
    assert.equal(response.status,200);
    if(response.headers.get('content-type')?.includes('text/event-stream')){
      const reader=response.body.getReader(),decoder=new TextDecoder();
      let data='';
      try {
        for(;;){
          const {done,value}=await reader.read();
          if(done)throw new Error('MCP stream ended before the JSON-RPC result.');
          data+=decoder.decode(value,{stream:true});
          const event=data.match(/^data: (.+)\r?\n\r?\n/m);
          if(event){
            const parsed=JSON.parse(event[1]);
            if(parsed.id===1)return parsed;
            data=data.slice(event.index+event[0].length);
          }
        }
      } finally {await reader.cancel();}
    }
    return response.json();
  };
  const init=await mcp('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'AIHackr public verification',version:'1.0.0'}});
  assert.equal(init.headers.get('mcp-session-id'),null);
  const initialized=(await message(init)).result;
  assert.match(initialized.serverInfo.name,/AIHackr/);
  const protocol={'MCP-Protocol-Version':initialized.protocolVersion};
  assert.equal((await mcp('notifications/initialized',{},protocol)).status,202);
  assert.deepEqual((await message(await mcp('ping',{},protocol))).result,{});
  const tools=(await message(await mcp('tools/list',{},protocol))).result.tools;
  assert.deepEqual(tools.map(tool=>tool.name).sort(),['cancel_crawl','get_account','get_crawl_result','get_url_html_content','get_url_json','get_url_links','get_url_markdown','scrape_url_elements','start_crawl']);
  for(const tool of tools) {
    assert(tool.inputSchema);
    assert(tool._meta?.securitySchemes?.some(scheme=>scheme.type==='oauth2'&&scheme.scopes.length));
  }
  assert.equal(tools.find(tool=>tool.name==='get_account')._meta['openai/profile'],true);
  const chatgpt=await mcp('tools/list',{}, {...protocol,Origin:'https://chatgpt.com'});
  assert.equal(chatgpt.headers.get('access-control-allow-origin'),'*');
  assert.deepEqual((await message(chatgpt)).result.tools,tools);
  check('anonymousMcpDiscovery',{toolCount:tools.length,stateless:true});
  const modernVersion='2026-07-28';
  const modernParams={_meta:{'io.modelcontextprotocol/protocolVersion':modernVersion,'io.modelcontextprotocol/clientCapabilities':{},'io.modelcontextprotocol/clientInfo':{name:'AIHackr public verification',version:'1.0.0'}}};
  const modern=(method,params={})=>mcp(method,{...params,...modernParams},{'MCP-Protocol-Version':modernVersion,'Mcp-Method':method,...(params.name?{'Mcp-Name':params.name}:{})});
  const discover=(await message(await modern('server/discover'))).result;
  assert(discover.supportedVersions.includes(modernVersion));
  assert.deepEqual((await message(await modern('tools/list'))).result.tools.map(tool=>tool.name).sort(),tools.map(tool=>tool.name).sort());
  assert.equal((await modern('tools/call',{name:'get_account',arguments:{}})).status,401);
  check('anonymousStatelessDiscovery',{protocolVersion:modernVersion,toolCount:tools.length});
  for(const tool of tools){
    const blocked=await mcp('tools/call',{name:tool.name,arguments:{url:'https://fixtures.aihackr.com'}},protocol);
    assert.equal(blocked.status,401,tool.name);
    assert.match(blocked.headers.get('www-authenticate'),/resource_metadata=/);
  }
  const wrongOrigin=await mcp('tools/list',{}, {...protocol,Origin:'https://example.org'});
  assert.equal(wrongOrigin.status,403);
  for(const authorization of ['Basic invalid','Bearer invalid']){
    const rejected=await mcp('tools/list',{}, {...protocol,Authorization:authorization});
    assert.equal(rejected.status,401);
    assert.match(rejected.headers.get('www-authenticate'),/invalid_token/);
  }
  const batch=await fetch(resource,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify([{jsonrpc:'2.0',id:1,method:'tools/list'},{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'get_account',arguments:{}}}])});
  assert.equal(batch.status,400);
  check('anonymousToolCallsBlocked',{toolCount:tools.length});
  const register=await fetch(metadata.registration_endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_name:'AIHackr protocol verification',application_type:'native',redirect_uris:['http://127.0.0.1:8795/callback'],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none'})});assert.equal(register.status,201);const client=await register.json();assert.equal(client.client_secret,undefined);check('publicNativeClientRegistration');
  const verifier=randomBytes(32).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url'),state=randomBytes(20).toString('hex');
  const params=new URLSearchParams({client_id:client.client_id,response_type:'code',redirect_uri:'http://127.0.0.1:8795/callback',resource,scope:'account:read web:read offline_access',state,code_challenge:challenge,code_challenge_method:'S256'});
  const authorize=async changes=>{const p=new URLSearchParams(params);for(const [k,v]of Object.entries(changes??{}))p.set(k,v);return fetch(metadata.authorization_endpoint+'?'+p,{redirect:'manual'});};
  for(const changes of [{code_challenge_method:'plain'},{resource:'https://other.example/mcp'},{redirect_uri:'https://attacker.example/callback'},{client_id:'https://127.0.0.1/client.json'}])assert.equal((await authorize(changes)).status,400);check('pkceRedirectAndResourceAdmission');
  const page=await authorize();assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);const html=await page.text();assert(html.includes('127.0.0.1'));assert(html.includes('application on your computer'));const handle=html.match(/name="handle" value="([^"]+)"/)[1],cookies=page.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');assert(cookies);check('browserBoundConsentPage');
  const deny=(cookie,requestOrigin=origin)=>fetch(metadata.authorization_endpoint,{method:'POST',headers:{Origin:requestOrigin,Cookie:cookie,'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:new URLSearchParams({handle,decision:'deny'}),redirect:'manual'});
  assert.equal((await deny('',origin)).status,400);assert.equal((await deny(cookies,'https://attacker.example')).status,403);const denied=await deny(cookies);assert.equal(denied.status,200);const callback=new URL((await denied.json()).redirectTo);assert.equal(callback.searchParams.get('error'),'access_denied');assert.equal(callback.searchParams.get('state'),state);assert.equal(callback.searchParams.get('iss'),origin);assert.equal((await deny(cookies)).status,400);check('unauthenticatedDenialCsrfAndSingleUse');
  const cimd=await authorize({client_id:'https://chatgpt.com/oauth/client.json',redirect_uri:'https://chatgpt.com/connector_platform_oauth_redirect'});assert.equal(cimd.status,200,'ChatGPT public client metadata must resolve from Cloudflare');assert((await cimd.text()).includes('chatgpt.com'));check('realChatgptCimdResolution');
  for(const path of ['/','/docs','/connections','/oauth.mjs','/oauth.css'])assert.equal((await fetch(origin+path,{redirect:'manual'})).status,200);assert.equal((await fetch(origin+'/oauth/connections')).status,401);check('htmlRoutesAndPrivateConnectionList');
  report.passed=true;
}catch(error){report.failure=error.message;console.error(report.failure);process.exitCode=1;}
await mkdir(new URL('../reports/',import.meta.url),{recursive:true});await writeFile(new URL(origin==='https://aihackr.com'?'../reports/oauth-public-production.json':'../reports/oauth-public-staging.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:Object.keys(report.checks)}));
