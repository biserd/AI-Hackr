# AIHackr on native Firecrawl OSS

This replaces the earlier AIHackr scanner-based prototype. The active application in this directory does not import its frontend, authentication, scanner, provider directory, database, queue, HTTP scraper or MCP tools. The old application remains in Git only until the new backend passes its deployment gate and the domain is switched. Do not confuse a prepared replacement with a completed production cutover.

## What runs upstream code

- **Firecrawl core API and workers:** unmodified `v2.11.162`, commit `7666c1f9ae8720a6bba271e0f60b6a217f8a5210`, in `vendor/firecrawl` as a pinned Git submodule. This release is pinned in Firecrawl's official self-hosting guide.
- **Scrape/content conversion/crawl/map/batch/extraction:** upstream native `/v2` implementations, native queues and job identifiers. No AIHackr reimplementation of collection or Markdown conversion.
- **Playwright renderer:** upstream `apps/playwright-service-ts`, with its locked Playwright dependency and Chromium. No use of the previous scanner's browser.
- **Redis, RabbitMQ, NuQ PostgreSQL:** actual upstream-required services with durable Docker volumes. No substitution with D1, Durable Objects or Cloudflare Queues.
- **MCP:** official `firecrawl-mcp@3.36.1` embedding API, native implementations and schemas. Tool filtering hides cloud-only/unconfigured features. No copy of the earlier custom AIHackr tool suite.
- **AIHackr:** a fresh static portal, a thin authenticated reverse proxy, public-page policy and operation bounds. Native SDK `apiUrl` override works directly against the gateway.

The upstream source is unmodified. `scripts/prepare-build.mjs` produces Dockerfiles from that exact source with immutable base-image pins. Redis/RabbitMQ runtime images are digest-pinned. NuQ WAL limits and worker concurrency are configured for an initial small deployment; they are not a certified minimum capacity. FoundationDB remains unselected.

## Run

Use a persistent Linux Docker host, Docker Compose v2 and Node 24. PostgreSQL, Redis and RabbitMQ data must be on durable host storage.

```sh
git submodule update --init --recursive
cd native
npm ci --ignore-scripts
npm run verify:source
node scripts/prepare-build.mjs
npm run setup
docker compose up --build -d --wait --wait-timeout 360
```

`setup` writes a new `.env` with random credentials, refuses to overwrite an existing file and never prints credentials. Load the operator workspace key privately from `.env` into the portal at `http://localhost:8080`. Do not paste it into chat. The key is not forwarded to target websites or the private Firecrawl API.

Only the authenticated gateway binds a host port, and only on `127.0.0.1:8080`. The unauthenticated Firecrawl API, Playwright, PostgreSQL, Redis, RabbitMQ and administration ports are never published. Keep the Docker network private.

Configure `PUBLIC_ORIGIN` for the eventual live origin. Search requires `SEARXNG_ENDPOINT` and explicit `SEARCH_ENABLED=true`; LLM extraction requires appropriate upstream provider variables plus `EXTRACTION_ENABLED=true`. The flags declare operator readiness; they do not prove providers work. No silent Firecrawl Cloud fallback is configured.

## Tests

```sh
npm test
npm run test:stack
docker compose down
docker compose up -d --wait --wait-timeout 360
npm run test:stack -- --restore
```

The stack test must run against real containers. It verifies the native SDK, an HTTP scrape, a rendered JavaScript marker on an operator-owned public fixture, native map/crawl/batch jobs, official MCP initialize/list/call, rejected credentials and metadata targets. The restore check reads a completed crawl after container replacement with the same volumes. It is not a backup restoration proof or representative-web benchmark. CI sets `FORCED_ENGINE_DOMAINS` to exercise the upstream fetch and Playwright paths independently.

## Access and remaining product gates

This native baseline is **one operator workspace** protected by an API key. It does not implement public signup, customer tenant isolation, prepaid billing, OAuth account linking or signup abuse controls. The old prototype's trial balances and custom jobs are not silently migrated into this different service. Do not offer it as a paid multi-tenant beta until those gates are implemented and tested.

Target credentials, arbitrary actions and webhooks are rejected. Browser subresource/redirect protections come from upstream; a full public-release isolation and resource audit remains required. The gateway DNS check is an admission check, not a claim of DNS pinning across every upstream request.

The default self-hosted stack lacks Fire-engine's advanced anti-bot behavior, Agent, Interact, Alexandria and screenshots/actions. Source availability does not imply Firecrawl Cloud parity. Optional providers and LLM costs need separate validation.

## Cloudflare and production cutover

Retain Cloudflare DNS/TLS and use an authenticated Cloudflare Tunnel from this Docker host to the loopback gateway. The backend needs persistent disks; Cloudflare Containers' default disk is ephemeral. D1/Queues/KV are different APIs and are not substitutions for native PostgreSQL/RabbitMQ/Redis. Hyperdrive accelerates an external PostgreSQL/MySQL database; it does not host one. A Cloudflare-only port would be a different implementation direction.

Before switching the live domain: identify the persistent Docker host, start the stack with production secrets and origin, pass functional tests, back up/restore the volumes, test an authenticated tunnel, then change Worker routing/domain bindings. Preserve the old release as rollback, remove the legacy scanner routes from public routing, and verify native SDK and MCP against the domain. Do not merge an unconfigured origin into the production auto-deploy branch.

## License and upstream notices

The corresponding upstream source, licenses and build instructions stay in the pinned submodule; preserve them and all component notices. AIHackr's new wrapper is AGPL-3.0-or-later. The official MCP package is MIT; components have their own licenses. `upstream.lock.json` records provenance. This directory reuses Firecrawl code; it does not claim authorship of it.

References: [official self-hosting](https://docs.firecrawl.dev/contributing/self-host), [pinned source](https://github.com/firecrawl/firecrawl/tree/7666c1f9ae8720a6bba271e0f60b6a217f8a5210), [MCP source](https://github.com/firecrawl/firecrawl-mcp-server/tree/6bd077c69a0143f03de93687f5f8bb8477944845), [Cloudflare storage lifecycle](https://developers.cloudflare.com/containers/concepts/architecture/).
