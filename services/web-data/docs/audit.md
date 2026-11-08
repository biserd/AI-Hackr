# M0 repository and capability audit

Baseline: biserd/AI-Hackr, clean main checkout at `fedf9e6` (Persist Cloudflare production domains), inspected 8 November 2026. No AGENTS.md was found in the checkout ancestry. Work is isolated in `codex/agent-web-data`.

Existing system: React/Vite, Express in a Cloudflare Container, Worker public routing/cron, D1/Drizzle, Cloudflare Email Sending and verified magic-link sessions. Passive/render/probe scanning, watchlists, provider pages, SEO/blog pages and background monitoring remain. No existing prepaid wallet, Stripe credit billing, API-key control plane, account-linked MCP or PostgreSQL jobs were found. No production secret values were opened or changed.

Repository configuration names aihackr.com and www.aihackr.com. This observation is not a deployment health check. This branch does not change production domains, credentials or scanner persistence.

| Boundary | Implementation | Evidence |
|---|---|---|
| Owner identity | Existing emailVerified session and server-only bridge | Compiled; real email roundtrip unrun |
| Ledger/jobs | PostgreSQL transactions, row locks, append-only events, leases | Embedded PostgreSQL integration tests |
| HTTP | Validated DNS pinned at connection; redirect checks | SSRF tests and one live example.com scrape |
| Firecrawl | Pin 9965df2b1d4e2bef848feee475b61124cea7902d; private rendering-component adapter | Source inspected; runtime unrun |
| Search | Brave Web Search adapter and configured per-call cost | Fixture tested; live unrun |
| Extraction | OpenAI Responses, tokenizer, bounded plan, schema/evidence checks | Fixture missingness tested; live unrun |
| OAuth | openid-client PKCE/state/nonce linking; jose; DB subject/client binding | Signed token rejection tests; hosted callback unrun |
| MCP | Official SDK 1.32.2 Streamable HTTP | Official SDK initialize/list/call tests |
| Compatibility | Firecrawl JS SDK 4.52.0 apiUrl override | Actual SDK contract test |
| Plugin | Portable 1.0.0 manifests | Official schema validation, ZIP roundtrip; installation unrun |

## Engine routing spike

Inspected upstream core engine selection uses internal `forceEngine` for `fetch` and `playwright`; this is not an exposed public scrape option. An invented `render=http` field would not guarantee routing. This implementation uses its verified HTTP adapter and a private Firecrawl rendering-component adapter, disabled by default.

The upstream rendering component has a fresh context and DNS-pinning SSRF proxy, but launch arguments include --no-sandbox and do not implement every AIHackr origin/request/transfer constraint. Hardening, browser runtime tests, the JavaScript fixture and full core-engine integration remain unfinished. The upstream Compose stack also needs API/harness/scrape workers, Redis, RabbitMQ, NuQ PostgreSQL and Playwright; AIHackr's own queue is not their replacement. Cloud Agent/Browser/Interact, paid proxies and Alexandria are not assumed locally available.

M0 is locally audited; M1's complete engine/browser acceptance has NOT passed. Hosted OAuth support is implemented with a maintained client library but is not certified by a local token test.
