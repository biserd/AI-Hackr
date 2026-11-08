# AIHackr — Cloudflare Browser Run

Public-web data for developers and agents, hosted entirely on Cloudflare. The new portal and gateway use managed Browser Run for page retrieval, JavaScript rendering, structured extraction and asynchronous crawls. MCP embeds the official Cloudflare Browser Run tool implementations and schemas.

This replaces the previously prepared native Firecrawl/Docker design following the owner's explicit selection of Browser Run. No external Docker host, PostgreSQL, Redis, RabbitMQ or Firecrawl Cloud API is required. The outdated scanner application is retired. Earlier implementations remain in Git history; existing stored production resources are not deleted.

## Architecture

| Layer | Implementation |
| --- | --- |
| Portal and documentation | Reused fresh static portal in `web/` |
| HTTPS, routing, authentication | Cloudflare Worker and adapted shared gateway |
| Customer accounts | Email-code sign-in through the existing Cloudflare Email Service; hashed sessions and keys in AccountDirectory |
| Rendering, conversion, extraction | Browser Run Quick Actions through the Worker browser binding |
| Asynchronous crawling | Browser Run managed `/crawl` API, using a scoped operator credential |
| Workspace limits, job ownership and retained results | New SQLite-backed `BrowserWorkspace` Durable Object |
| MCP | Unmodified tool-registration source from `cloudflare/mcp-server-cloudflare`, pinned to `a21972e219289337731a066befb5c66886b9ce7b`; patched official MCP SDK/Agents dependencies |

The Cloudflare provider account is fixed server-side. Each verified customer receives a separate BrowserWorkspace Durable Object. Browser sessions use Secure, HttpOnly, SameSite=Strict cookies. Optional developer API keys are hashed at rest, shown once and revocable. Caller credentials never become Cloudflare account credentials. REST and MCP invoke the same target validation, robots policy, quotas and job store. Old Durable Object exports are inert compatibility classes so migration does not delete previously stored resources.

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

Public email-code signup and sign-in create isolated customer workspaces. Each customer receives 20 lifetime free credits. The existing operator API key remains usable for bounded operations without exposing operator data to customers. A shared directory atomically enforces a 1,000-page daily service allowance across customers and operator requests. Balances survive sign-in, key rotation and deployment. The paid-plan implementation adds Starter $9/1,000 credits, Builder $29/5,000 and Scale $79/20,000 per month, once Stripe configuration and sandbox verification are complete. Tax collection stays off.

Scrape Markdown/HTML/links, discover same-origin links, extract JSON and start/status/cancel managed crawls. Crawl defaults are 20 pages and depth 2, with maximum 100 pages/depth 5, subject to the account allowance. Each workspace has two active crawl slots, three concurrent requests and 30 engine operations per minute. Customer credits are held at admission and settled against successful results, returning unused crawl capacity or failed-operation holds. Provider safety reservations remain nonrefundable and separate from the customer ledger. Browser use, email and extraction incur applicable Cloudflare usage charges.

Sign-in codes expire in 10 minutes, are single-use and lock after five invalid attempts. Sign-in requests have per-IP, per-email and global limits; signup is limited to three accounts per IP and 50 globally in a rolling day. Sessions expire after seven days. Email uses the existing hello@aihackr.com sender through the EMAIL binding. The portal no longer accepts an operator key; sign in and manage developer credentials under API keys. No passwords or provider credentials are stored in browser JavaScript. Hosted Stripe Checkout, paid-invoice webhooks and the dedicated Customer Portal handle subscriptions. The customer dashboard shows actual balances, daily usage, private jobs, downloads, keys and billing. Checkout stays disabled when required billing configuration is missing.

Completed crawl records are retained in Durable Object storage for seven days. Retrieval is paginated in groups of ten. Content is limited to 60,000 characters per page/format with explicit truncation. Cached completed records remain readable without the managed provider. Raw provider job identifiers are never accepted as workspace-owned jobs.

Search, batch scraping and OAuth linking are not enabled. Public ChatGPT plugin linking/submission is deferred until OAuth is implemented. Target authentication, arbitrary actions/scripts, custom headers/cookies and webhooks are not accepted. DNS validation checks initial admission; redirect/subresource isolation remains subject to Browser Run. The service does not promise anti-bot bypass or success on every site.

## Paid billing and plugin preparation

See [billing operations](cloudflare/BILLING.md) for restricted-key permissions, dedicated live/sandbox catalog and portal setup, webhook events, ledger semantics and release evidence. The production gate additionally requires current-source Stripe sandbox and customer-credit integration proof. The current paid-plan branch is a staged implementation; a passing unit suite alone does not activate payment collection.

The prepared portable plugin is under `integrations/aihackr-plugin/` and packaged as `/aihackr-plugin.zip`. It contains no secrets and uses a customer API key with compatible clients. OAuth and public submission remain future work. See its README for the canonical-schema/OpenAI extension compatibility note.

## Source and licenses

AIHackr's wrapper remains AGPL-3.0-or-later. The official Cloudflare MCP tool source is Apache-2.0; its license and source digest are retained under `cloudflare/vendor/` and `cloudflare/upstream.lock.json`. The official file is unchanged; import aliases adapt its client and workspace context. Authentication/account selection and exposed tool filtering are AIHackr adaptations. See `THIRD_PARTY_NOTICES.md` and `docs/decisions.md`.
