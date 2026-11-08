# AIHackr Web Data — development implementation

The existing-infrastructure production path is documented in [docs/cloudflare-production.md](docs/cloudflare-production.md): same Cloudflare Worker/container and D1 scanner, with an authenticated SQLite Durable Object for durable web-data state. Standalone PostgreSQL/local instructions follow below.

An additive service beside the existing AIHackr scanner. REST, MCP and the verified-owner dashboard use the same service, SQL ledger and retained result handles. No production deployment or paid-beta readiness is implied.

## Run locally

Use Node 24 LTS and the committed npm lockfile. Run from this directory:

```powershell
npm ci
$env:DEV_FIXTURES='true'
npm run dev
```

The local SQL database is durable PGlite PostgreSQL in `.local/postgres`; production refuses to start without `DATABASE_URL` for PostgreSQL. The developer key is written to `.local/dev-key`, never printed. Fixtures only retrieve `https://fixtures.aihackr.test` and are explicitly labeled in capabilities and source method. No fixture provider is silently used in live mode.

```powershell
$env:AIHACKR_API_KEY=Get-Content -Raw .local/dev-key
npx tsx src/cli.ts scrape https://fixtures.aihackr.test/products/1
npx tsx src/cli.ts job <returned-job-id>
npx tsx src/cli.ts result <returned-result-id>
```

The worker consumes the durable transactional outbox/job queue. All paid operations return 202; poll jobs and read authorized results. Quotes are free, expire after five minutes, and do not hold funds. A stable idempotency key replays work; changed billable arguments conflict. Cache hits preserve observation time and cost zero. A fresh-only failure never falls back to stale content.

For `/web-data` in the existing application, configure `WEB_DATA_API_URL`, a shared high-entropy `WEB_DATA_CONTROL_TOKEN`, and exact `WEB_DATA_DASHBOARD_ORIGIN`. Use the existing verified email sign-in. The server bridge derives tenant identity from that session; browsers cannot choose it. Trial grants happen once per verified account.

## Interfaces and checks

- `generated/openapi.json`, `generated/mcp-tools.json`: contracts and tool schemas.
- `src/sdk.ts`: typed REST client with stable keys across retries; `src/cli.ts`: CLI.
- `/mcp`: official SDK Streamable HTTP, authentication on every request.
- `npx tsx src/stdio.ts`: optional bridge using `AIHACKR_API_KEY` and `AIHACKR_BASE_URL` in the local client environment. Never paste credentials into chat.
- `/compat/firecrawl/v2/scrape`: tested SDK subset in `docs/compatibility.md`.
- Sandbox Checkout and signed raw-body webhooks; live Stripe keys/events rejected.
- Scripts: `lint`, `typecheck`, `test:unit`, `test:integration`, `test:e2e`, `test:mcp`, `test`, `contracts`, `plugin:build`, `plugin:validate`, `benchmark`, `build`.

Tests use actual embedded PostgreSQL, local HTTP and official SDK transports with deterministic source fixtures. They do not prove arbitrary-web success, multi-process PostgreSQL behavior or hosted-client compatibility. The plugin ZIP builds in `release/`; its production origin is proposed. Installation is separate from packaging. See `docs/status.md`, `DEPLOYMENT.md`, `OPERATIONS.md`, and `SECURITY.md`.
