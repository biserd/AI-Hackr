import { McpServer } from '@modelcontextprotocol/server';
import { createMcpHandler } from 'agents/mcp/server';
import { registerBrowserTools } from './vendor/browser.tools.ts';
import { browserRequest } from './mcp-client.mjs';
import {TOOL_SCOPES,oauthChallenge,hasToolScope,accountProfile} from './oauth-config.mjs';
import {z} from 'zod';

const allowed = new Set(['get_url_html_content','get_url_markdown','get_url_json','get_url_links','scrape_url_elements','start_crawl','get_crawl_result','cancel_crawl']);
export const officialTools = [...allowed];
export async function handleMcp(request, env, ctx, service,identity) {
  const permissionError=scope=>({isError:true,content:[{type:'text',text:'Reconnect AIHackr to approve the required permission: '+scope}],_meta:{'mcp/www_authenticate':[oauthChallenge(env,{error:'insufficient_scope',scope})]}});
  const handler = createMcpHandler(() => {
    const server = new McpServer({name:'AIHackr Browser Run',version:'0.6.0'},{instructions:'Public-page tools powered by Cloudflare Browser Run and its official open-source MCP tool implementations. Calls use the authenticated customer workspace. Crawl defaults to 20 pages and at most 100 pages / depth 5; free-trial allowances may be lower. Page results may be truncated; inspect truncation warnings. OAuth account linking and scoped permissions are enabled. Search and paid billing are not enabled. Use the AIHackr REST API to paginate larger crawl results.'});
    registerBrowserTools({
      props:{accessToken:'workspace-internal'},
      accountTool(name, config, callback) {
        if (!allowed.has(name)) return;
        const description = config.description + (name==='start_crawl'?' Workspace maximum: 100 pages and depth 5.':'');
        const scope=TOOL_SCOPES[name];
        server.registerTool(name,{...config,description,_meta:{...config._meta,securitySchemes:[{type:'oauth2',scopes:[scope]}]}},async params=>{if(!hasToolScope(identity,name))return permissionError(scope);return browserRequest.run({service,accountId:env.CLOUDFLARE_ACCOUNT_ID},async()=>{
          const result=await callback(params,env.CLOUDFLARE_ACCOUNT_ID);
          const shorten=(value,depth=0)=>{
            if(depth>20)return '[depth limit]';
            if(typeof value==='string')return value.length>12000?value.slice(0,12000)+'\n[truncated; use REST for full retained content]':value;
            if(Array.isArray(value))return value.slice(0,10).map(item=>shorten(item,depth+1));
            if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,shorten(item,depth+1)]));
            return value;
          };
          return {...result,content:result.content.map(block=>{
            if(block.type!=='text'||block.text.length<=24000)return block;
            try{return {...block,text:JSON.stringify({data:shorten(JSON.parse(block.text)),truncated:true,warning:'Use REST for full content and pagination.'})};}
            catch{return {...block,text:block.text.slice(0,24000)+'\n[truncated]'};}
          })};
        });});
      },
    });
    server.registerTool('get_account',{description:'Identify the connected AIHackr account.',inputSchema:{},outputSchema:{id:z.string().min(1).regex(/\S/),email:z.string().optional(),nickname:z.string().optional()},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},_meta:{'openai/profile':true,securitySchemes:[{type:'oauth2',scopes:['account:read']}]}},async()=>{
      if(!hasToolScope(identity,'get_account'))return permissionError('account:read');
      const profile=await accountProfile(identity,service.storage);return {content:[{type:'text',text:JSON.stringify(profile)}],structuredContent:profile};
    });
    return server;
  },{route:'/mcp',corsOptions:false});
  return handler(request,env,ctx);
}
