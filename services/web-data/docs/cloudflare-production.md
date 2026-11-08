# Existing Cloudflare production integration

The container uses a multi-stage build to keep development dependencies and npm cache/build layers outside the runtime image, within the existing 4 GB application image limit. The Playwright runtime base and current instance size are retained.

Production uses AIHackr's existing `aihackr` Worker and `AIHackrContainer`, existing D1 scanner database, existing email binding, and cron. No separate host or PostgreSQL service is provisioned. `WebDataStore` is an additive SQLite-backed Durable Object in the same Worker.

The original application and the web-data API run as supervised sibling processes in the existing container. The public app forwards `/v1`, `/mcp`, protected-resource metadata, sandbox webhooks, compatibility and health routes to the private companion process. The verified-email dashboard bridge retains owner identity. Production endpoints are `https://aihackr.com/web-data` and `https://aihackr.com/mcp`.

Ledger/domain operations cross the container's private `web-data.internal` outbound handler. A Worker secret named `WEB_DATA_STORAGE_TOKEN` authenticates every RPC independently of network placement. It is passed only into the container environment, never browser requests, build arguments, source or logs. Source HTML cannot authorize storage mutations. Arbitrary SQL is reachable only through this authenticated private interface; public routing never exposes it.

Each full Store operation executes in a real SQLite Durable Object storage transaction. The dialect adapter maps positional binds, UTC timestamp expressions, row-lock syntax, JSON and booleans explicitly. Domain RPCs keep reservation/idempotency/job/outbox creation and settlement atomic. Multi-statement maintenance uses `Store.batch`; the single-query facade refuses a second query. Payments and identity linking use full domain RPCs. Jobs, wallets, keys, caches and results survive container restarts. D1 scanner tables are unaffected.

`npm run test:cloudflare` builds a local-only test Worker, runs real workerd/SQLite, and verifies concurrent wallet caps, idempotency, exclusive settlement, tenant isolation, transaction rollback, source-backed research through the remote Store, purchase-event deduplication, and OAuth binding. The test Worker is not part of public routing or production deployment.

A 1 MiB retained-result bound prevents oversized SQLite rows. Published capabilities include this bound. Provider discovery stays explicit: HTTP is enabled; search/model/browser/OAuth/checkout stay unavailable until configured. Live Stripe keys remain rejected. This deployment does not certify the outstanding paid-beta or browser-engine release gates.

Cloudflare Workers Builds is already connected to the repository. The root build installs/builds the companion service before bundling, and the existing Docker image runs `script/start-production.mjs`. A v2 additive migration registers the new SQLite DO; the existing container class is retained. New work is polled once per second; retention/lease reconciliation runs at most once per minute while the container is running. The existing cron wakes the container after restarts.
