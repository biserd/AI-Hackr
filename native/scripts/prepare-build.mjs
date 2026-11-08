import { readFile, writeFile, mkdir } from 'node:fs/promises';
const pins = {
  'node:22-slim': 'node:22-slim@sha256:5ec23b7c622b00547753bc6ffd78085dd868a68aeb41c8e0a1418f033e13d96d',
  'golang:1.24': 'golang:1.24@sha256:d2d2bc1c84f7e60d7d2438a3836ae7d0c847f4888464e7ec9ba3a1339a1ee804',
  'postgres:${PG_MAJOR}': 'postgres:17-bookworm@sha256:665dc7b37ac52a17e298511414c21d23ffa4e6a6ef6225b3e5d59c7afb35e994',
};
await mkdir(new URL('../.build/', import.meta.url), { recursive: true });
for (const [component, name] of [['api', 'api'], ['playwright-service-ts', 'playwright'], ['nuq-postgres', 'postgres']]) {
  let source = await readFile(new URL(`../../vendor/firecrawl/apps/${component}/Dockerfile`, import.meta.url), 'utf8').catch(() => {
    throw new Error('Initialize the pinned source first: git submodule update --init --recursive');
  });
  for (const [before, after] of Object.entries(pins)) source = source.replaceAll('FROM ' + before, 'FROM ' + after);
  await writeFile(new URL(`../.build/${name}.Dockerfile`, import.meta.url), source);
}
console.log('Prepared upstream Dockerfiles with immutable base-image pins. Upstream source remains unmodified.');
