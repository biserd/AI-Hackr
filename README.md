# AIHackr — native Firecrawl OSS

AIHackr is being rebuilt on Firecrawl's own open-source stack: API, engines, format conversion, crawling, job workers, Playwright renderer, Redis, RabbitMQ and NuQ PostgreSQL. The official Firecrawl SDK and MCP tools connect directly to native `/v2` endpoints.

The previous scanner, provider intelligence pages, watchlists, custom scraping engine, custom queue and bespoke MCP tools are removed from this branch. The new portal and gateway import none of that application. Previous releases remain in Git for rollback; existing production databases are not deleted.

**Status:** replacement under validation in [PR #4](https://github.com/biserd/AI-Hackr/pull/4). This branch has not replaced the live prototype. Full-stack tests and an identified persistent Docker host are required before cutover.

## Architecture

| Layer | Implementation |
|---|---|
| Public domain, frontend, TLS and routing | Existing Cloudflare Worker with fresh static portal |
| Thin access gateway | New Node service; one operator workspace API key |
| Core collection, conversion, queues and workers | Unmodified Firecrawl `v2.11.162`, pinned commit `7666c1f9ae8720a6bba271e0f60b6a217f8a5210` |
| Browser | Upstream Playwright service and its locked Chromium version |
| Persistence / messaging | Native NuQ PostgreSQL, Redis and RabbitMQ, with durable Docker volumes |
| MCP | Official `firecrawl-mcp@3.36.1` tool implementations, schemas and transport |

Cloudflare D1/Queues/KV are not drop-in PostgreSQL/RabbitMQ/Redis implementations. Hyperdrive connects to an existing database; it does not host PostgreSQL. Keeping Firecrawl native requires persistent backend infrastructure rather than rewriting it for those APIs.

## Run and verify

```sh
git submodule update --init --recursive
cd native
npm ci --ignore-scripts
npm run verify:source
node scripts/prepare-build.mjs
npm run setup
docker compose up --build -d --wait --wait-timeout 360
npm test
npm run test:stack
```

Only the gateway is exposed, on loopback port 8080. All upstream APIs and dependency ports are private. See [native/README.md](native/README.md) for setup, persistence, tests, providers and deployment gates. [Provenance](native/upstream.lock.json) records exact source/package pins; upstream source and licenses are retained in [vendor/firecrawl](vendor/firecrawl).

## Deploy

Configure a persistent Docker host and an authenticated Cloudflare Tunnel to the native gateway. Set `NATIVE_BACKEND_ORIGIN` in `wrangler.jsonc` to that verified HTTPS origin, then run `npm run build && npm run deploy`. Deployment refuses an empty/unconfigured origin, preventing an accidental cutover to a nonfunctional backend. The old Durable Object class identities remain as inert compatibility exports to preserve stored data during migration; they do not serve the new product.

This native baseline supports one operator workspace. Public signup, prepaid tenant billing and OAuth are not implemented in the replacement. It is not a paid multi-tenant beta or a claim of Firecrawl Cloud feature parity. Search and extraction require separately configured providers. Full browser isolation and backup/restore validation remain release gates.
