# Implementation decisions

## November 8, 2026: Cloudflare-only Browser Run

The owner explicitly selected Cloudflare Browser Run and the official OSS MCP server, directed reuse of the newly built portal/gateway, and authorized merge/deployment to aihackr.com. This supersedes the attached implementation document's proposed Firecrawl/Docker/PostgreSQL/Redis architecture. The document is a reference, not a source of permission to override the owner's later instructions.

Use Cloudflare's existing managed crawl implementation rather than porting Firecrawl's queue/storage internals. Run page Quick Actions through the Worker binding and managed crawls through a dedicated Browser Run-only credential. Adapt official Cloudflare tool registrations through a shared service seam; preserve the upstream file and license, and record changes to its dependency set. Do not expose Cloudflare account selection or browser-administration tools to workspace clients.

Keep the fresh portal, bearer-key flow, static-asset policies and gateway bounds from the prepared replacement. Move them into a Cloudflare Worker and durable workspace. Remove the inactive native Docker runtime and Firecrawl submodule from active source; preserve previous commits and production stored resources for rollback.

Completed crawl results use Durable Object storage rather than R2 for this bounded operator workspace. Limits are 100 pages, 60,000 characters per page/format, paginated responses and seven-day retention. This avoids an additional provisioning dependency while keeping data durable across Worker replacement. A larger multi-tenant product should reassess R2 content storage and tenant partitioning.

This release remains the previously agreed operator-workspace baseline. Public signup, independent customer tenants, payment collection and OAuth linking are not advertised or implemented as part of this infrastructure cutover. No reuse of the outdated scanner or its custom data/queue/MCP implementation is introduced.

Production deployment requires live staging verification, persistence across redeploy, a matching source digest and configured encrypted secrets. A deployment heartbeat is not evidence of successful retrieval. Preserve existing Durable Object identities as inert compatibility exports; do not delete stored production data during this rollout.
