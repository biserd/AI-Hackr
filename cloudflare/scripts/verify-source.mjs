import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const lock=JSON.parse(await readFile(new URL('../upstream.lock.json',import.meta.url),'utf8'));
const file=await readFile(new URL('../vendor/browser.tools.ts',import.meta.url));
if(createHash('sha256').update(file).digest('hex')!==lock.sha256)throw new Error('Official Cloudflare MCP tool source differs from its pinned provenance.');
console.log(`Verified unmodified official Cloudflare Browser Run MCP tools at ${lock.commit}.`);
