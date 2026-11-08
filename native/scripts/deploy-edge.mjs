import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const config = JSON.parse(await readFile(new URL('../../wrangler.jsonc', import.meta.url), 'utf8'));
let backend;
try { backend = new URL(config.vars.NATIVE_BACKEND_ORIGIN); } catch { throw new Error('Production cutover blocked: configure the verified persistent Firecrawl backend origin first.'); }
if (backend.protocol !== 'https:' || backend.username || backend.password || ['aihackr.com', 'www.aihackr.com'].includes(backend.hostname)) throw new Error('Production cutover blocked: invalid backend origin.');
const health = await fetch(new URL('/health/ready', backend), { signal: AbortSignal.timeout(10000) });
if (!health.ok || !(await health.json()).ready) throw new Error('Production cutover blocked: native Firecrawl backend is not ready.');
const child = spawn(process.execPath, [fileURLToPath(new URL('../../node_modules/wrangler/bin/wrangler.js', import.meta.url)), 'deploy'], { stdio: 'inherit', cwd: fileURLToPath(new URL('../../', import.meta.url)) });
child.on('exit', code => process.exitCode = code ?? 1);
