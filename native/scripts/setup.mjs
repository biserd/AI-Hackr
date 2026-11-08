import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const env = `AIHACKR_API_KEY=fc-${randomBytes(32).toString('hex')}\nPOSTGRES_PASSWORD=${randomBytes(32).toString('hex')}\nRABBITMQ_PASSWORD=${randomBytes(32).toString('hex')}\nPUBLIC_ORIGIN=http://localhost:8080\nSEARCH_ENABLED=false\nEXTRACTION_ENABLED=false\n`;
await writeFile(new URL('../.env', import.meta.url), env, { flag: 'wx', mode: 0o600 });
console.log('Created native/.env with new credentials. Existing files are never overwritten; no credential is printed.');
