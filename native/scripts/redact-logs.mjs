import { readFile, writeFile, readdir } from 'node:fs/promises';
const env = await readFile(new URL('../.env', import.meta.url), 'utf8');
const secrets = env.split(/\r?\n/).map(line => line.match(/^(AIHACKR_API_KEY|POSTGRES_PASSWORD|RABBITMQ_PASSWORD|OPENAI_API_KEY)=(.+)$/)?.[2]).filter(Boolean);
for (const name of await readdir(new URL('../reports/', import.meta.url))) {
  const path = new URL('../reports/' + name, import.meta.url); let content = await readFile(path, 'utf8');
  for (const secret of secrets) content = content.replaceAll(secret, '[redacted]');
  content = content.replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [redacted]');
  await writeFile(path, content);
}
console.log('Operational evidence redacted; no credentials included.');
