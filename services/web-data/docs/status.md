# Implementation and release status — 8 November 2026

**Existing-infrastructure production update:** The owner subsequently authorized merge and live deployment. The implementation now supports the same Cloudflare Worker/container, existing D1 scanner, and an authenticated SQLite Durable Object for web-data state. This replaces the separate-host/PostgreSQL requirement for that deployment path. Real workerd tests cover durable transactions and remote orchestration. See `cloudflare-production.md`; the original milestone inventory below remains a record of broader paid-beta gaps, not the current deployment receipt.

This branch is a working **development implementation**, not the completed paid-beta specification.

| Milestone | Implemented / verified locally | Outstanding |
|---|---|---|
| M0 audit | Existing scanner/auth/storage/deployment inspected; isolated additive branch; dependency and engine-routing map | Production configuration/health not inspected with credentials; hosted OAuth spike not run |
| M1 retrieval | Guarded live HTTP, content normalization, source metadata, tenant cache/freshness, bounds, SSRF tests, one public-page smoke | Complete Firecrawl core-engine reuse, hardened renderer, actual JS fixture, subresource/WebSocket transfer/request bounds |
| M2 accounts/jobs/billing | Verified-owner bridge, hashed keys, one-time trial, PostgreSQL wallet/reservations/ledger/outbox, leases/reconciliation, idempotency, cancellation, partials, pagination, crawl/research, search/model adapters, sandbox-only signed billing handlers, dashboard | Real provider calls, actual Checkout purchases/refund ordering, email-session roundtrip, multi-process PostgreSQL races, anti-abuse controls, production cost instrumentation/object storage |
| M3 agent/plugin | Official SDK Streamable HTTP, 11 tools with schemas, SDK client tests, OAuth resource/linking code and realm template, per-client caps/revocation, CLI/SDK/stdio bridge, official-schema-valid plugin ZIP, cases/guides | Hosted PKCE/provider linking, actual ChatGPT/Codex installation and all reviewer scenarios, registration/callback validation, public origin, recording |
| M4 readiness | Pinned compatibility SDK contract test, 1,000-operation fixture report, dependency audit, reproducible source/config/runbooks | 1,000 representative LIVE requests, margin/break-even, Docker/restore/deployment rehearsal, dashboard browser QA, policy/support review, release source offer at exact commit |

The browser preview tool timed out before opening the local dashboard. The frontend compiles and its responsive styles are supplied; visual interaction/accessibility QA is **not claimed**.

**Deployed:** no. **Submitted:** no. **Approved:** no. **Published:** no. **Installed/tested in an actual host client:** no. An official MCP SDK client test is protocol evidence, not a ChatGPT/Codex host test. A schema-valid ZIP is packaging evidence, not an installed service.

Missing release inputs: a separate container host and managed PostgreSQL/TLS, private hardened Firecrawl deployment, actual search/model credentials and current cost rates, hosted OAuth issuer/JWKS/client registration with exact callbacks, Stripe sandbox configuration/reviewer account, verified policy/support/source URLs and an authorized representative target set with benchmark spending caps. Live Stripe keys are intentionally rejected until the release gates are completed.

Important unfinished engineering is listed above; missing credentials alone do not explain the remaining browser, observability, object-storage and anti-abuse work. Do not turn on production payments or advertise unavailable capabilities based on this branch.
