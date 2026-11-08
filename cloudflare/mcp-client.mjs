import { AsyncLocalStorage } from 'node:async_hooks';
import { reject } from './policy.mjs';
export const browserRequest = new AsyncLocalStorage();

// The official tool handlers import this adapter instead of constructing a
// Cloudflare SDK client. Every operation passes through our shared service.
// No customer can supply an account ID, provider token or arbitrary API path.
export function getCloudflareClient() {
  const request = browserRequest.getStore();
  if (!request) throw new Error('Browser tool requires an authenticated workspace.');
  const {service, accountId} = request;
  async function call(path, options = {}, method = 'POST') {
    const match = path.match(/^\/accounts\/([a-z0-9]+)\/browser-run\/(markdown|content|links|json|scrape|crawl)(?:\/([a-zA-Z0-9-]+))?$/);
    if (!match || match[1] !== accountId) reject('TARGET_RESTRICTED','Only workspace browser operations are available.',403);
    const [, , action, id] = match;
    if (action === 'crawl') {
      if (method === 'POST' && !id) return { result: (await service.createCrawl(options.body)).id };
      if (method === 'GET' && id) {
        const result = await service.getCrawl(id);
        return { result: { ...result, status: result.providerStatus, job_id: result.id } };
      }
      if (method === 'DELETE' && id) return { result: await service.cancelCrawl(id) };
    } else if (method === 'POST' && !id) return service.page(action, options.body);
    reject('NOT_FOUND','Unsupported browser tool operation.',404);
  }
  return {
    post:(path,options)=>call(path,options,'POST'),
    get:path=>call(path,{},'GET'), delete:path=>call(path,{},'DELETE'),
    browserRendering:{content:{create:async body=>{const {account_id,...params}=body;if(account_id!==accountId)reject('TARGET_RESTRICTED','Invalid account.',403);return (await service.page('content',params)).result;}}},
  };
}
