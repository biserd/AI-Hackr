export const OAUTH_SCOPES=Object.freeze({
  'account:read':'Identify your linked AIHackr account and email.',
  'web:read':'Scrape, map and extract public webpages using your allowance.',
  'crawl:read':'Read private crawl results in your workspace.',
  'crawl:write':'Start and cancel crawls using your allowance.',
  'offline_access':'Stay connected for up to 30 days, until you disconnect this app.',
});
export const TOOL_SCOPES=Object.freeze({get_account:'account:read',get_url_html_content:'web:read',get_url_markdown:'web:read',get_url_json:'web:read',get_url_links:'web:read',scrape_url_elements:'web:read',start_crawl:'crawl:write',get_crawl_result:'crawl:read',cancel_crawl:'crawl:write'});
export const oauthIssuer=env=>env.OAUTH_ISSUER??'https://aihackr.com';
export const oauthResource=env=>oauthIssuer(env)+'/mcp';
export const metadataUrl=env=>oauthIssuer(env)+'/.well-known/oauth-protected-resource/mcp';
export function oauthChallenge(env,{error,scope}={}){return `Bearer resource_metadata="${metadataUrl(env)}"${error?`, error="${error}"`:''}${scope?`, scope="${scope}"`:''}`;}
export function resourceMetadata(env){return {resource:oauthResource(env),authorization_servers:[oauthIssuer(env)],scopes_supported:['account:read','web:read'],bearer_methods_supported:['header'],resource_name:'AIHackr',resource_documentation:'https://aihackr.com/docs'};}
export const hasToolScope=(identity,name)=>Boolean(identity&&(identity.kind!=='oauth'||(TOOL_SCOPES[name]&&identity.scopes?.includes(TOOL_SCOPES[name]))));
export async function accountProfile(identity,storage){
  if(identity?.id)return {id:identity.id,...(identity.email?{email:identity.email}:{})};
  if(!identity?.operator)throw new Error('Authenticated profile required');
  const id=await storage.transaction(async tx=>{let id=await tx.get('operator-profile-id');if(!id){id=crypto.randomUUID();await tx.put('operator-profile-id',id);}return id;});
  return {id,nickname:'Operator workspace'};
}
