import {authenticate,directoryCall} from './accounts.mjs';
import {boundedJson,json,onlyKeys,reject} from './policy.mjs';
import {capabilities} from './gateway.mjs';

export const workspaceName=identity=>identity.operator?'operator-workspace-v1':'customer-workspace-v1:'+identity.id;
export async function customerGateway(request,env){
  const url=new URL(request.url),identity=await authenticate(request,env);
  const workspace=env.BROWSER_WORKSPACE.getByName(workspaceName(identity));
  if(url.pathname==='/api/session'&&request.method==='GET')return json({authenticated:true,user:{id:identity.id??null,email:identity.email??null},workspace:identity.operator?'Operator workspace':'Your workspace',usage:{...await workspace.profile(identity),trialReserved:identity.trialReserved??null,trialLimit:identity.trialLimit??null},...capabilities(env)});
  if(url.pathname.startsWith('/api/keys')){
    if(identity.kind!=='session')reject('AUTH_REQUIRED','Sign in on the website to manage API keys.',403);
    if(url.pathname==='/api/keys'&&request.method==='GET')return json({keys:await directoryCall(env,'keys',identity.id)});
    if(url.pathname==='/api/keys'&&request.method==='POST'){const body=await boundedJson(request,2048);onlyKeys(body,['name']);return json(await directoryCall(env,'createKey',identity.id,body.name),201);}
    const match=url.pathname.match(/^\/api\/keys\/([a-f0-9-]{36})$/);if(match&&request.method==='DELETE')return json(await directoryCall(env,'revokeKey',identity.id,match[1]));
    reject('NOT_FOUND','Unknown API key route.',404);
  }
  const response=await workspace.run(request,identity);
  if(identity.kind==='oauth'&&request.headers.has('origin')){const headers=new Headers(response.headers);headers.set('Access-Control-Allow-Origin',request.headers.get('origin'));headers.set('Access-Control-Expose-Headers','Mcp-Session-Id, WWW-Authenticate');headers.set('Vary','Origin');headers.set('Cache-Control','no-store');return new Response(response.body,{status:response.status,headers});}
  return response;
}
