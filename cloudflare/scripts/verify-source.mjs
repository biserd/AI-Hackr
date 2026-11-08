import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const lock=JSON.parse(await readFile(new URL('../upstream.lock.json',import.meta.url),'utf8'));
const file=await readFile(new URL('../vendor/browser.tools.ts',import.meta.url));
if(createHash('sha256').update(file).digest('hex')!==lock.sha256)throw new Error('Official Cloudflare MCP tool source differs from its pinned provenance.');
console.log(`Verified unmodified official Cloudflare Browser Run MCP tools at ${lock.commit}.`);
async function scan(directory){for(const item of await readdir(directory,{withFileTypes:true})){if(['node_modules','.build','reports','.wrangler','.local','release'].includes(item.name))continue;const path=new URL(item.name+(item.isDirectory()?'/':''),directory);if(item.isDirectory())await scan(path);else if(/\.(mjs|ts|json|html|css|md)$/.test(item.name)&&/\b[rs]k_(?:live|test)_[A-Za-z0-9]{20,}\b|\bwhsec_[A-Za-z0-9]{20,}\b/.test(await readFile(path,'utf8')))throw new Error('Possible embedded Stripe credential in '+item.name);}}
for(const directory of ['../','../../web/','../../integrations/'])await scan(new URL(directory,import.meta.url));
console.log('Verified application sources contain no embedded Stripe API keys or signing secrets.');
