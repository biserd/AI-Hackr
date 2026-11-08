# Deployment runbook — not yet rehearsed

Deploy this service separately from the existing Cloudflare scanner. Preserve its Worker/D1 routes. Docker/Compose is supplied for a container host; Docker was unavailable in this workspace, so container build/run, real PostgreSQL failover and restore rehearsal are **unrun**.

1. Use Node 24 LTS and the committed package-lock. `npm ci`, all checks, `npm run build`.
2. Create managed PostgreSQL or use `infra/compose.yaml`. Set a unique POSTGRES_PASSWORD, copy `.env.example` to a secret-managed `.env`, set DEV_FIXTURES=false and DATABASE_URL. Do not commit `.env`.
3. Apply `migrations/001.sql` with a migration owner. The current entrypoint also applies it idempotently. For production, separate migration ownership from an application role that cannot UPDATE/DELETE the ledger. Test both roles before launch.
4. `docker compose --env-file .env -f infra/compose.yaml up --build -d`. Only the API binds localhost:4100; PostgreSQL remains private. Put a TLS reverse proxy in front. Set exact PUBLIC_API_ORIGIN and DASHBOARD_ORIGIN; restrict network ingress and CORS. Trust no user-controlled forwarding header for identity.
5. In the existing scanner container configure WEB_DATA_API_URL to the private service address, the same high-entropy WEB_DATA_CONTROL_TOKEN in both services, and WEB_DATA_DASHBOARD_ORIGIN=https://aihackr.com. The control token grants account provisioning, so it must never reach browsers, logs or source. The dashboard bridge requires an existing verified email session.
6. Enable LIVE_HTTP_ENABLED only after SSRF, outbound policy and resource limits are rehearsed on the host. Provide Brave and/or OpenAI secrets only to this service, with operator-validated integer micro-USD call/token rates and MAX_PROVIDER_COST_MICRO_USD. Missing providers remain visibly unavailable. No customer cookies/headers/scripts are accepted.
7. For OAuth, use a maintained provider (Keycloak realm template supplied, not a fully deployed provider). Register separate dashboard-link and plugin clients; require PKCE S256, exact host callback URLs, five-minute API-audience tokens, verified identity and explicit prepaid-credit consent. Populate actual host redirect URIs; the template intentionally has no guessed plugin callback. Configure issuer, JWKS URL, link-client secret and agent client ID. Click Link agent identity from a verified owner workspace, then use host account linking. Test real PKCE, nonce/state replay, issuer, audience, scopes, revocation and tenant binding end to end. No dynamic registration is claimed.
8. Configure a Stripe sandbox restricted key with Checkout access and a signed webhook endpoint `/webhooks/stripe`. Test payment completion, delayed success, retries, refunds/disputes and ordering. Success redirects never grant credits. Live keys/events are hard-disabled in this version.

## Firecrawl gate

`infra/prepare-firecrawl.ps1` obtains the exact inspected commit in a new directory. It does not expose or launch it. Full upstream core requires its own supporting Redis, RabbitMQ, NuQ PostgreSQL and workers. Never publish its unauthenticated API.

The supplied adapter speaks to the upstream private rendering component, not an unavailable cloud Agent/Interact service. Do **not** set BROWSER_SECURITY_REHEARSED=true against the stock renderer: it disables Chromium sandbox and does not yet implement all request/transfer/same-origin bounds. Complete hardening, firewall/proxy restrictions for all subresources/WebSockets, media blocking, non-root sandbox/container isolation, 45-second wall time, 100 requests/20 MiB page transfer, redirect checks and JavaScript fixtures first. This engineering and rehearsal gate is unfinished.

## Release requirements

Rehearse backup/restore, migrations, graceful drain, stale-lease settlement, tenant isolation and rollback on real PostgreSQL. Run 1,000 authorized representative LIVE requests and establish viable costs and margin. Test installation and OAuth workflows in each actual target client, validate policy/support/source URLs, and record the walkthrough. Domain verification, reviewer access, submission, approval and publication are distinct external steps. This local branch does not perform them or enable live charges.
