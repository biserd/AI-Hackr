# AIHackr — Cloudflare Browser Run

Public-web data for developers and agents, hosted entirely on Cloudflare. The new portal and gateway use managed Browser Run for page retrieval, JavaScript rendering, structured extraction and asynchronous crawls. MCP embeds the official Cloudflare Browser Run tool implementations and schemas.

This replaces the previously prepared native Firecrawl/Docker design following the owner's explicit selection of Browser Run. No external Docker host, PostgreSQL, Redis, RabbitMQ or Firecrawl Cloud API is required. The outdated scanner application is retired. Earlier implementations remain in Git history; existing stored production resources are not deleted.

## Architecture

| Layer | Implementation |
| --- | --- |
| Portal and documentation | Reused fresh static portal in `web/` |
| HTTPS, routing, authentication | Cloudflare Worker and adapted shared gateway |
| Rendering, conversion, extraction | Browser Run Quick Actions through the Worker browser binding |
| Asynchronous crawling | Browser Run managed `/crawl` API, using a scoped operator credential |
| Workspace limits, job ownership and retained results | New SQLite-backed `BrowserWorkspace` Durable Object |
| MCP | Unmodified tool-registration source from `cloudflare/mcp-server-cloudflare`, pinned to `a21972e219289337731a066befb5c66886b9ce7b`; patched official MCP SDK/Agents dependencies |

The account is fixed server-side. Caller credentials never become Cloudflare account credentials. REST and MCP invoke the same target validation, robots policy, quotas and job store. Old Durable Object exports are inert compatibility classes so migration does not delete previously stored resources.

## Setup and validation

Use Node 24 and the exact lockfiles:

```sh
npm ci --ignore-scripts
npm run build
npm test
npm --prefix cloudflare audit --omit=dev
node cloudflare/node_modules/wrangler/bin/wrangler.js deploy --dry-run
```

Set encrypted Worker secrets `AIHACKR_API_KEY` (a random workspace key of at least 32 characters) and `CLOUDFLARE_BROWSER_TOKEN` (Browser Run: Edit, scoped to the operator's account). The `BROWSER` binding handles page Quick Actions without an API token; the managed crawl API requires the scoped token. Never persist a Wrangler OAuth refresh token in the service or put provider credentials in Git/client code.

Staging is `aihackr-browser-run-stage.biser-d.workers.dev`, configured by the `staging` Wrangler environment. Production is the existing `aihackr` Worker on `aihackr.com` and `www.aihackr.com`.

```sh
node cloudflare/node_modules/wrangler/bin/wrangler.js deploy --env staging
AIHACKR_ORIGIN=https://your-stage.example AIHACKR_API_KEY=your-private-key node cloudflare/test/live.mjs
```

The live verification exercises real browser JavaScript, links, managed crawling, retained records, JSON extraction and the official MCP implementation. Mocked local tests do not substitute for it. Redeploy staging and re-read a completed crawl to verify persistence across Worker replacement. The production deploy script requires a passing release gate matching the current source digest and a ready staging deployment.

## API and supported scope

See `/docs` and `/api/capabilities`. `/v2` provides a documented Firecrawl-shaped migration subset, not full Firecrawl SDK/API compatibility. MCP uses official Cloudflare tool names, not Firecrawl tool names.

One operator workspace. Scrape Markdown/HTML/links, discover same-origin links on one page, extract structured JSON, and start/status/cancel a bounded managed crawl. Defaults are 20 pages and depth 2; maximum is 100 pages and depth 5. There are two active crawl slots, three concurrent gateway requests, 30 admitted engine operations per minute and 1,000 reserved pages per day. A crawl reserves its requested maximum even when fewer pages complete; this is an allowance, not customer billing. Browser use and optional inference incur Cloudflare usage charges.

Completed crawl records are retained in Durable Object storage for seven days. Retrieval is paginated in groups of ten. Content is limited to 60,000 characters per page/format with explicit truncation. Cached completed records remain readable without the managed provider. Raw provider job identifiers are never accepted as workspace-owned jobs.

Search, batch scraping, customer signup, tenant billing and OAuth linking are not enabled. Target authentication, arbitrary actions/scripts, custom headers/cookies and webhooks are not accepted. DNS validation checks initial admission; redirect/subresource isolation remains subject to Browser Run. The service does not promise anti-bot bypass or success on every site.

## Source and licenses

AIHackr's wrapper remains AGPL-3.0-or-later. The official Cloudflare MCP tool source is Apache-2.0; its license and source digest are retained under `cloudflare/vendor/` and `cloudflare/upstream.lock.json`. The official file is unchanged; import aliases adapt its client and workspace context. Authentication/account selection and exposed tool filtering are AIHackr adaptations. See `THIRD_PARTY_NOTICES.md` and `docs/decisions.md`.
