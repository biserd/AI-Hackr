import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const lock = JSON.parse(await readFile(new URL('../upstream.lock.json', import.meta.url)));
const root = new URL('../../vendor/firecrawl/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const head = execFileSync('git', ['-C', root, '-c', `safe.directory=${root.replace(/\/$/, '')}`, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (head !== lock.firecrawl.commit) throw new Error(`Upstream pin mismatch: ${head}`);
const changes = execFileSync('git', ['-C', root, '-c', `safe.directory=${root.replace(/\/$/, '')}`, 'status', '--porcelain'], { encoding: 'utf8' }).trim();
if (changes) throw new Error('Upstream has undocumented modifications.');
console.log(JSON.stringify({ upstream: lock.firecrawl.release, commit: head, modified: false }));
