# Implementation decisions

## November 8, 2026: Cloudflare-only Browser Run

The owner explicitly selected Cloudflare Browser Run and the official OSS MCP server, directed reuse of the newly built portal/gateway, and authorized merge/deployment to aihackr.com. This supersedes the attached implementation document's proposed Firecrawl/Docker/PostgreSQL/Redis architecture. The document is a reference, not a source of permission to override the owner's later instructions.

Use Cloudflare's existing managed crawl implementation rather than porting Firecrawl's queue/storage internals. Run page Quick Actions through the Worker binding and managed crawls through a dedicated Browser Run-only credential. Adapt official Cloudflare tool registrations through a shared service seam; preserve the upstream file and license, and record changes to its dependency set. Do not expose Cloudflare account selection or browser-administration tools to workspace clients.

Keep the fresh portal, bearer-key flow, static-asset policies and gateway bounds from the prepared replacement. Move them into a Cloudflare Worker and durable workspace. Remove the inactive native Docker runtime and Firecrawl submodule from active source; preserve previous commits and production stored resources for rollback.

Completed crawl results use Durable Object storage rather than R2 for this bounded operator workspace. Limits are 100 pages, 60,000 characters per page/format, paginated responses and seven-day retention. This avoids an additional provisioning dependency while keeping data durable across Worker replacement. A larger multi-tenant product should reassess R2 content storage and tenant partitioning.

This release remains the previously agreed operator-workspace baseline. Public signup, independent customer tenants, payment collection and OAuth linking are not advertised or implemented as part of this infrastructure cutover. No reuse of the outdated scanner or its custom data/queue/MCP implementation is introduced.

Production deployment requires live staging verification, persistence across redeploy, a matching source digest and configured encrypted secrets. A deployment heartbeat is not evidence of successful retrieval. Preserve existing Durable Object identities as inert compatibility exports; do not delete stored production data during this rollout.


## November 8, 2026: Customer SaaS accounts

The owner clarified that the product must be a SaaS and asked to remove the OSS logo badges and increase typography. Replace the public operator-key connection form with email-code signup/sign-in. Reuse the verified Cloudflare Email Service sender and add an AccountDirectory Durable Object; no external identity or hosting provider is introduced. The code uses existing Web Crypto primitives with no new runtime dependencies.

A verified email owns an immutable account UUID, an isolated BrowserWorkspace, hashed revocable API keys and expiring hashed session records. Browser mutations require an exact same-origin header, sessions use Secure/HttpOnly/SameSite=Strict cookies, and challenges bind an eight-digit code to an opaque HttpOnly cookie, expire after ten minutes and lock after five incorrect attempts. Auth errors are serialized through the DO RPC boundary and reconstructed as typed service errors. Public signup requires no payment or terms acceptance. Customer quotas and global reservations are stored atomically, not inferred from keys or browser state.

Start with a 20-page lifetime trial per account, a 20-page daily cap, and the existing shared 1,000-page daily service reservation ceiling. Per-email/IP/global auth throttles and account creation limits bound email and browser spending. Aliases and distributed signups can still consume the shared service allowance; this is not a full fraud prevention system or a dollar spending cap. Paid billing, OAuth linking, search, customer data export/deletion and larger-scale operations remain future scope. Existing operator bearer access and stored data remain isolated and usable for operations. The former operator-workspace-only release decision is superseded for customer onboarding.


## November 8, 2026: Paid launch plans and accurate credits

The owner requested smaller launch tiers, existing Stripe account reuse, accurate customer credits and a Firecrawl-style SaaS dashboard. Chosen monthly USD plans are Starter $9/1,000, Builder $29/5,000 and Scale $79/20,000. Tax collection stays off as explicitly requested. These are fixed-price subscriptions with included application credits, not monetary metered overages. OAuth is explicitly deferred; prepare a protected API-key plugin development package without claiming public ChatGPT linking.

AccountDirectory now owns atomic allowance buckets, holds, replay-safe paid-invoice grants and settlement. BrowserWorkspace records private operations, retained chunked results and a settlement outbox, reconciled by alarms after interrupted client sessions or deployments. Legacy trial usage is preserved. This replaces the earlier nonrefundable customer-trial counter; the separate 1,000-page daily provider safety budget remains in place.

Reuse Cloudflare Workers, Browser Run, Durable Objects, email auth and official MCP tool source. Use the existing Stripe account with dedicated AIHackr products, portal configuration and webhook, and a separate Stripe sandbox for integration proof. No Firecrawl Cloud runtime, external Docker host or new billing provider is introduced. Payment collection remains disabled until credentials/catalog and sandbox verification are complete. The production source gate requires actual billing and customer-ledger proof, in addition to the earlier browser/MCP and redeploy checks.
