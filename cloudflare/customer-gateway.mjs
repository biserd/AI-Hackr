import {authenticate,directoryCall} from './accounts.mjs';
import {boundedJson,json,onlyKeys,reject} from './policy.mjs';
import {capabilities} from './gateway.mjs';
import {billingRoute,billingConfig} from './billing.mjs';
import {PLANS} from './plans.mjs';

export const workspaceName=identity=>identity.operator?'operator-workspace-v1':'customer-workspace-v1:'+identity.id;
export async function customerGateway(request,env){
  const url=new URL(request.url),identity=await authenticate(request,env);
  const workspace=env.BROWSER_WORKSPACE.getByName(workspaceName(identity));
  if(url.pathname==='/api/session'&&request.method==='GET')return json({authenticated:true,user:{email:identity.email??null},workspace:identity.operator?'Operator workspace':'Your workspace',usage:{...await workspace.profile(identity),...(identity.operator?{}:await directoryCall(env,'creditSummary',identity.id))},plans:PLANS,billingReady:billingConfig(env).ready,...capabilities(env)});
  if(url.pathname.startsWith('/api/billing/'))return billingRoute(request,env,identity);
  if(url.pathname==='/api/usage'&&request.method==='GET'){if(identity.operator)reject('NOT_FOUND','Customer account required.',404);return json({...await directoryCall(env,'creditEntries',identity.id,url.searchParams.get('cursor')),days:await directoryCall(env,'creditDaily',identity.id)});}
  if(url.pathname.startsWith('/api/jobs')&&request.method==='GET'){
    const match=url.pathname.match(/^\/api\/jobs\/([a-f0-9-]{36}|[a-f0-9]{64})$/);
    const response=match?await workspace.result(identity,match[1]):url.pathname==='/api/jobs'?await workspace.jobs(identity,url.searchParams.get('cursor')):null;
    if(!response)reject('NOT_FOUND','Unknown jobs route.',404);if(!response.ok)reject(response.error.code,response.error.message,response.error.status);return json(response.value);
  }
  if(url.pathname.startsWith('/api/keys')){
    if(identity.kind!=='session')reject('AUTH_REQUIRED','Sign in on the website to manage API keys.',403);
    if(url.pathname==='/api/keys'&&request.method==='GET')return json({keys:await directoryCall(env,'keys',identity.id)});
    if(url.pathname==='/api/keys'&&request.method==='POST'){const body=await boundedJson(request,2048);onlyKeys(body,['name']);return json(await directoryCall(env,'createKey',identity.id,body.name),201);}
    const match=url.pathname.match(/^\/api\/keys\/([a-f0-9-]{36})$/);if(match&&request.method==='DELETE')return json(await directoryCall(env,'revokeKey',identity.id,match[1]));
    reject('NOT_FOUND','Unknown API key route.',404);
  }
  return workspace.run(request,identity);
}
