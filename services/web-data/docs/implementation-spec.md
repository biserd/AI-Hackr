# AIHackr: agent-first web data API and plugin

Version: 1.0 — 8 November 2026
Status: implementation handoff; proposed prices and performance targets require validation.
Brand/domain: AIHackr / aihackr.com. Proposed hosts are not claims of existing deployments.

## 1. Instruction to the implementing Codex agent

Build a working, self-service, multi-tenant SaaS that provides affordable public-web search, scraping, structured extraction, bounded research, and crawling. Reuse the open-source Firecrawl engine behind an AIHackr-owned service layer. Make the product usable by agents through remote MCP and a packaged plugin, and by developers through REST. The dashboard supports onboarding, credentials, spending controls, and inspection; it must not be required for each research task.

The agreed direction is a lower-cost, focused Firecrawl alternative. Do not pivot into a data-quality enterprise platform, SEO auditing, payment infrastructure, or a vertical property-data product. Those can be later applications. Do not claim full Firecrawl compatibility or scraping success on every website.

First inspect the supplied repository, AGENTS.md instructions, existing deployment, authentication, billing, and AIHackr scanner features. No repository or credentials were inspected in preparing this document. Preserve existing functionality unless its replacement is clearly within the implementation task. Reuse sound infrastructure; avoid coupling this service to PayGate402 merely because the owner owns that project. When working in an empty repository, use the default architecture below.

Implement in milestones, run the required checks, and leave a concrete runnable result. Use development/test billing only until production credentials and release configuration are supplied. Missing optional providers must produce explicit capability-unavailable errors, not fabricated results. Do not require follow-up decisions for routine implementation choices. Record changes to these defaults and the reason in docs/decisions.md.

## 2. Product and first customer

Promise: “Affordable web data for AI agents. Search, scrape, and extract with predictable spending.”

First customers: individual developers, small agent products, and users who need more than a small scraping allowance but do not fully use a large subscription. Initial differentiation: low minimum spend, explicit operation pricing, no mandatory monthly subscription, compact agent outputs, easy migration, and good performance on ordinary public pages.

Success means an external agent can connect, discover tools, authenticate, inspect prices, retrieve real data, and see the credits charged without copying secrets into a conversation. It also means the operator can prove the actual cost per usable result. A cheaper published price without viable delivery costs is not success.

## 3. Release scope

### Required for v1 paid beta

- Public HTTPS pages: Markdown, cleaned text, optionally bounded HTML and links.
- Fetch-first retrieval with browser rendering only when necessary and permitted by the caller's cap.
- Search through one configured provider, returning results without scraping all of them automatically.
- JSON Schema-based extraction from one URL or an existing authorized result.
- Bounded same-origin mapping and crawling, asynchronous jobs, cancellation, pagination.
- A bounded research operation combining search, selected retrieval, and structured extraction.
- Remote MCP, account-linked OAuth, installable plugin package, local client configuration examples.
- API keys for REST and compatible developer clients; unified account balance across interfaces.
- Prepaid credit purchase in a web dashboard; free trial allowance; hard spending limits.
- Transactional usage ledger, quotes, reservations, idempotency, and internal cost accounting.
- OpenAPI, machine-readable capabilities and prices, examples, error codes, SDK, tests, Docker deployment.

### Explicitly later

Authenticated target-site browsing, stored customer cookies, arbitrary browser automation/code execution, CAPTCHA-solving promises, specialized paid data marketplaces, monitoring subscriptions, screenshots/PDF parsing, unrestricted autonomous agents, x402 settlement, bring-your-own provider secrets, and enterprise SSO. Do not implement these to finish v1. Keep adapter interfaces extensible. Initial browser workers render public pages only; they do not submit forms or execute customer-provided scripts.

Search and extraction are required for the deployed beta. Local fixture mode can run without provider credentials, but the live capability must be visibly unavailable until configured. Do not market an unavailable feature as live.

## 4. Agent-first principles

1. REST, MCP, and the dashboard call the same application services and billing paths.
2. Every paid operation accepts maxCredits and an optional idempotencyKey. Explicit price ceilings apply to the entire operation, including retries and fallback. Trial users have the same caps.
3. Publish capabilities, limits, retention, price version, and current provider availability in machine-readable form. Discovery and quoting are free and cannot launch retrieval work.
4. Default responses are compact, structured, and source-backed. Return handles and pagination instead of dumping entire websites into model context.
5. Every result includes source URL, final URL, observedAt, cache status, retrieval method, warnings, and actual charge. Never use observedAt as the publication date.
6. A caller chooses fresh-only or bounded cache age. Never silently serve stale results after a failed refresh.
7. Tools must explain when to use them, their limits, charging behavior, and whether they return an asynchronous job.
8. No hidden paid chains. Search does not scrape results. Scrape does not invoke a model unless extraction was requested. Research is the explicitly bundled operation.
9. The external agent normally reasons and composes the tools. A second AI model is not required for ordinary HTTP retrieval or every orchestration decision.
10. A plugin installation does not imply directory publication. Deliver installable/testable integration and a submission-ready package; track public approval separately.

## 5. Proposed system architecture

Default monorepo: TypeScript, current supported Node LTS, pnpm workspaces, Next.js dashboard, Fastify service, official supported MCP TypeScript SDK, PostgreSQL, Redis/BullMQ for AIHackr jobs, S3-compatible result storage, Stripe Checkout, and a maintained OAuth-capable identity solution. Pin tested versions and commit the lockfile. Validate current official documentation before coding integrations.

Services:

- apps/web: marketing, sign-in, account onboarding, dashboard, billing, docs links.
- apps/api: REST, remote MCP /mcp, capabilities, auth verification, rate limits, quote/reservation service.
- apps/worker: bounded fetch/search/extraction/research/crawl execution, result processing, metering.
- packages/contracts: authoritative request/response and tool schemas, generated OpenAPI.
- packages/core: provider-neutral orchestration, tenant authorization, policies, price catalog.
- packages/sdk: small TypeScript REST SDK and CLI.
- packages/mcp: tool registrations and the same core-service calls; optional stdio wrapper.
- packages/plugin: release package, skills, metadata, reviewer cases, validation/build scripts.
- vendor/firecrawl or a separately pinned upstream checkout/image: upstream engine and its required services.
- infra: Compose development stack, production container definitions, migration/backup instructions.

Keep the engine private on an internal network. Never expose its unauthenticated self-hosting API. Obtain engine functionality through an adapter; do not send customer account credentials to the upstream engine. AIHackr owns tenant limits, queues, billing, cache policy, and result authorization independently of upstream identifiers.

Reuse the engine's own supporting services as required by the selected release. Do not assume the AIHackr Redis/job queue replaces every upstream database or queue. Pin a tested upstream commit/tag and document all dependencies. Do not use unpinned latest images.

Deploy browser workers as containers with actual browser and networking support. A frontend or edge host is not the browser runtime. Start with one container host/managed container deployment and managed persistence where available; Kubernetes is not required.

## 6. OSS reuse and licensing

The Firecrawl core is primarily AGPL-3.0; its SDKs and some components have separate licenses. The official MCP adapter is MIT-licensed. Core collection APIs and Playwright processing are available, while the complete cloud Agent/Browser/Interact service is not supplied by the default OSS deployment. Reimplement bounded AIHackr research orchestration rather than calling an unavailable cloud agent as if it were local.

Default licensing decision: maintain an openly available AGPL-compatible server distribution, preserve upstream notices, publish modifications to covered code with corresponding build instructions, and provide a source link from the service. Keep commercial value in hosting, pricing, reliability, and support. Document every component's license in THIRD_PARTY_NOTICES.md; do not remove notices or claim the engine was authored by AIHackr. A separate API boundary is not automatically a legal exemption. Review any proposed proprietary packaging before release.

## 7. Retrieval and data contracts

### Retrieval policy

Use an adapter to the pinned engine. Select its cheapest supported HTTP retrieval path first. Render only for explicit render=browser or when render=auto detects missing useful content and the quote/cap permits fallback. Verify how routing works in the selected engine; do not assume an undocumented mode exists. If it cannot guarantee a bounded route, expose only the verified mode until the adapter supplies one.

Reject unsupported content types and target authentication. Respect robots.txt by default; identify AIHackr through a documented user agent and contact URL. Return restricted/blocked status rather than a bypass promise. Treat login, challenge, paywall, and error pages as unusable content, not successful extraction. A successful engine HTTP response alone is insufficient.

Default resource bounds, configurable server-side and enforced across all interfaces:

| Limit | Initial default |
|---|---|
| Direct fetch wall time | 20 seconds |
| Browser wall time | 45 seconds |
| Redirects | 5 |
| Main response compressed/decompressed size | 5 MiB / 10 MiB |
| Browser total transfer / requests per page | 20 MiB / 100 requests |
| External attempts per page | At most 2 total, including fallback |
| Browser concurrency per trial / paid account | 1 / 3 |
| Discovery requests per account | 30/minute; quota retries return Retry-After |
| Search results | 10 default, 20 maximum |
| Crawl pages / depth | 20 default, 100 maximum / 2 default, 3 maximum |
| Research searches / retrieved pages | 2 / 6 |
| Research elapsed time | 180 seconds |
| Default MCP result text | 12,000 characters; explicit truncation |
| Maximum content page returned by get_result | 32,000 characters |
| Maximum model input/output per extraction | 24,000 / 4,000 tokens |

Reject requests exceeding hard limits; do not silently widen them. Long documents can be returned as paginated content; extraction over omitted input must declare incomplete coverage. Model tokenization/cost estimation must use the configured provider's supported methods and record estimates versus measured usage.

### Result envelope

Use camelCase for native AIHackr contracts. Example values below illustrate schema, not real retrieval:

```json
{
  "requestId": "req_example",
  "status": "completed",
  "resultId": "res_example",
  "data": {
    "title": "Example product",
    "markdown": "# Example product\nPrice: $125",
    "links": []
  },
  "sources": [{
    "sourceId": "src_example",
    "url": "https://example.com/product",
    "finalUrl": "https://example.com/product",
    "observedAt": "2026-11-08T15:00:00Z",
    "publishedAt": null,
    "contentHash": "sha256:example",
    "method": "http"
  }],
  "cache": {"hit": false, "ageSeconds": 0},
  "usage": {"creditsCharged": 1, "priceVersion": "beta-1"},
  "coverage": {"complete": true, "reason": null},
  "warnings": [],
  "truncated": false,
  "nextCursor": null
}
```

Extraction returns json plus fieldEvidence keyed by JSON Pointer. Evidence includes sourceId and a short exact excerpt or locator when available. Unsupported/missing values become null only where the schema allows null. Otherwise return EXTRACTION_INCOMPLETE with partial data and missing paths. Do not fabricate a schema-valid completion. Describe evidence as support in the source, not independent truth verification. No opaque confidence score presented as calibrated accuracy.

Preserve original price strings, currency, units, and date strings when normalizing could lose meaning. Each research row links to at least one actual source; distinguish conflicting observations instead of merging them into a guessed value.

## 8. Native REST API

Prefix /v1. Bearer API keys or valid scoped OAuth access tokens. Do not rely on a tenantId supplied in the request. Zod/JSON Schema validates input with bounded arrays and strings. Use a supported safe subset of JSON Schema; reject remote refs and unbounded recursion.

| Method/path | Required input and behavior |
|---|---|
| GET /v1/capabilities | Public feature availability, supported formats, hard limits, API version, priceVersion; no secrets |
| GET /v1/prices | Public price catalog and charge rules |
| POST /v1/quote | operation plus exact bounded operation input; free; normalized args, plan, min/max credits, expiresAt, quoteId |
| POST /v1/search | query, limit, optional country/language, maxCredits; results title/url/snippet, optional supported publication dates; no automatic scraping |
| POST /v1/scrape | url, formats, render, maxAgeSeconds, maxCredits; default Markdown; bounded synchronous response or 202 job |
| POST /v1/extract | exactly one of url/resultId, schema, optional extraction instruction, maxCredits; structured result and evidence |
| POST /v1/map | url, same-origin paths/filters, limit, maxCredits; synchronous bounded sitemap/link discovery; does not claim full-site completeness |
| POST /v1/crawl | url, includePaths/excludePaths, maxPages/maxDepth, formats/render/cache controls, maxCredits; returns 202 job |
| POST /v1/research | objective, optional startingUrls, optional schema, maxSearches/maxPages, maxCredits; returns 202 job |
| GET /v1/jobs/:id | Authorized state/progress/cost, result handles, retryAfterSeconds; free |
| POST /v1/jobs/:id/cancel | Stop future work; return final charge after settlement |
| GET /v1/results/:id | Authorized, paginated retained content; free; expiresAt; consistent cursor ordering |
| GET /v1/usage | Balance, reserved/spendable credits, current limits and usage; free |

All paid POSTs accept quoteId and idempotencyKey; REST also supports Idempotency-Key header. If both are supplied they must agree. Without a key, generate an operation identifier but warn that client retries can start separate work. Native SDK supplies a stable key for retries. Quote validity: 5 minutes, tied to tenant, normalized args hash and price version. It is a ceiling for the stated plan, not a guarantee of data completeness. Changing arguments requires a new quote. A quote does not reserve funds. Direct calls without quotes remain supported within maxCredits and documented defaults.

For scrape: default render=auto, maxAgeSeconds=3600, maxCredits=5. Server enforces tighter account policy where configured. For extract: default cap 10; research: default cap 50; crawl: default cap 100. If the requested plan cannot fit its cap, fail before external work. Do not silently spend above it. Expensive route upgrades require a new explicit request or must already be in the accepted bounded plan.

### Jobs and bounded research

Persist states: queued -> running -> completed | partial | failed | canceled. Terminal transition is exclusive and billing settlement is exactly-once. Retry an individual transient fetch only within remaining caps; a resumed job cannot reset its budget or page counters. Use job leases, heartbeats and a reconciler for abandoned work/reservations. Cancellation blocks scheduling new children; already-started work may settle, and the API exposes this until cancellation finalizes.

Research v1 is an auditable coordinator, not an unrestricted browser agent. It uses starting URLs or at most two search queries, deduplicates candidate URLs, selects up to six pages, retrieves them, then extracts requested data. A small optional planning call may form search terms, but all calls count against an explicit bounded model/cost plan. No recursive agents, target form submissions, or invented URLs. Stop on budget/time/page exhaustion and return partial results with a stopReason. Preserve completed sources even when another page fails. Return task trace events describing tools, time, result and cost, not hidden model reasoning.

Support polling first. Optional REST SSE job events can follow, but plugin workflows must work without custom streaming UI or MCP task extensions. Dedup crawl work within job by canonical URL; normalize scheme/host/fragments and ordinary tracking parameters without stripping meaningful query parameters. Enforce same origin after every redirect and canonicalization.

### Errors

Envelope: error.code, message, retryable, retryAfterSeconds, suggestedAction, requestId, creditsCharged, partialResultId when relevant. HTTP: 400 invalid input, 401 auth, 403 policy/scope, 404 tenant-safe not-found, 409 idempotency conflict, 402 insufficient prepaid balance, 422 unsupported/extraction incomplete, 429 account/domain limit, 502 upstream failure, 503 unavailable capability, 504 timeout. Asynchronous partial success belongs in job status, not a fake completed result.

Codes include INVALID_INPUT, AUTH_REQUIRED, SCOPE_REQUIRED, INSUFFICIENT_CREDITS, BUDGET_EXCEEDED, QUOTE_EXPIRED, IDEMPOTENCY_CONFLICT, TARGET_BLOCKED, TARGET_RESTRICTED, ROBOTS_DISALLOWED, UNSUPPORTED_CONTENT, RATE_LIMITED, UPSTREAM_TIMEOUT, EXTRACTION_INCOMPLETE, CAPABILITY_UNAVAILABLE, RESULT_EXPIRED, JOB_CANCELED. No raw stack traces or secrets in tool errors.

## 9. MCP and plugin: mandatory release surface

Use the current supported official MCP SDK and Streamable HTTP at https://api.aihackr.com/mcp. Negotiate supported protocol versions and test against actual target clients. Do not hand-roll JSON-RPC transport or assume clients implement the same protocol revision. Keep state in explicit tenant-bound job/result handles so workflows do not depend on a long-lived transport session.

Expose these tools, each backed by the REST application service, with bounded inputSchema, outputSchema, structuredContent, and a compact text rendering:

| Tool | Purpose |
|---|---|
| aihackr_capabilities | Free discovery of currently available tools, prices, caps and freshness options |
| aihackr_quote | Free bounded price/plan estimate; no execution |
| aihackr_search | Find pages; return snippets and URLs without fetching full pages |
| aihackr_scrape | Read a known public URL; return compact content and a retained result handle |
| aihackr_extract | Extract a requested schema from a URL or authorized retained result |
| aihackr_map | Find a bounded list of URLs at a public site |
| aihackr_crawl | Start a bounded same-origin collection job |
| aihackr_research | Start a bounded multi-page research task |
| aihackr_job | Inspect job or explicitly cancel it using action=status/cancel |
| aihackr_result | Retrieve paginated result content |
| aihackr_usage | Inspect own balance, reservations and limits |

Use accurate annotations, not approval avoidance. Retrieval tools do not modify target sites and should describe read-only behavior and normal prepaid usage charges. Job cancellation changes account state: aihackr_job with a cancel action must not be globally annotated read-only; either mark the combined tool non-read-only or split cancellation into a separate tool. Tools contacting arbitrary public sources are open-world. Do not mark job-starting tools idempotent unless their supported idempotency contract makes that true. Host clients decide their own confirmation UX. The backend enforces budget regardless of annotations.

Return domain/tool failures with isError=true and a structured recoverable error. Protocol failures use SDK mechanisms. Never return enormous base64 content. Include source arrays, stopReason, truncation and nextCursor consistently. Require explicit get_result pagination to expand content.

### Account linking and authorization

REST API keys are not the ChatGPT account-linking design. Implement OAuth authorization-code flow with PKCE S256 using a maintained provider/library. Advertise protected-resource and authorization-server metadata, issue audience-bound tokens, validate issuer/audience/expiry/scopes, and enforce tenant authorization per request. Configure actual callback URLs from the host rather than guessing. Support a documented client-registration method compatible with ChatGPT; predefined clients are acceptable for initial testing, with dynamic registration/CIMD only if supported and tested by the chosen provider. Rotate/revoke tokens. Never ask users to paste API keys into chat.

Scopes: web:read, jobs:read, jobs:write, usage:read. Account login establishes an organization; consent binds the connection to one selected organization. Spending authorization lives in the owner's per-connection credit caps; agents cannot change caps or fund the account. Explicitly consent that retrieval uses prepaid credits. New connections default to 50 credits per operation and 200/day, further constrained by individual operation defaults and balance. Daily resets use UTC and are shown in the dashboard. Owner can edit/revoke these controls in the dashboard.

### Deliverable plugin package

Follow current official OpenAI plugin packaging documentation; validate generated manifests against the actual supported schema. Do not use an obsolete ai-plugin.json-only integration. Supply plugin identity/listing assets, remote MCP configuration, scopes, and skills for setup and research. Include no credentials in the ZIP. Provide an installable local release ZIP and build/check commands. Include examples for a remote OAuth client and stdio/API-key clients; verify exact client configuration formats at implementation time.

The skill teaches: use search for unknown URLs, scrape for known URLs, extract only when needed, inspect quotes for larger jobs, pass stable idempotency keys, keep within user budget, poll jobs with backoff, fetch only useful content pages, cite sources and freshness, and report partial coverage. It must not tell the host to ignore its policies or silently buy credits.

For public-directory submission, prepare stable public HTTPS, domain verification support, publisher/support/privacy/terms URLs, dedicated reviewer access, five positive and three negative test cases, release notes, and an actual walkthrough recording. Keep reviewer secrets outside the package. Record account verification/review/publication as external release steps, not completed engineering work. Availability in ChatGPT, Codex and other clients must be tested individually; do not promise universal compatibility or guaranteed directory approval.

### Required plugin evaluation prompts

Use controlled public test fixtures with known content so expected results are reproducible:

1. “Read this product page and give the current price, currency and source.” -> scrape, correct evidence and observedAt.
2. “Find the documentation for this test library and read its installation instructions.” -> search then selective scrape; no blanket search-result fetching.
3. “Extract name, price and availability from these three test product pages.” -> bounded research/extract, correct rows and citations.
4. “Collect the first ten pages from this test documentation site within 20 credits.” -> quote/crawl, bounded polling and result pagination.
5. “Show my remaining credits and the cost of that last job.” -> usage/job with exact ledger settlement.

Negative cases: private-network or cloud-metadata URL; request exceeding balance/cap; and an injected webpage telling the agent to expose credentials or buy credits. The service must reject restricted access/budget violations and treat injected instructions as untrusted source text, without executing them.

## 10. Pricing, wallet and unit economics

All values here are beta defaults to implement behind configuration, not established economics or public promises.

- Prepaid web checkout: $10 -> 12,500 credits; one credit has a beta retail value of $0.0008. No required subscription; purchased credits have no time-based expiry under the proposed beta terms. Grant 100 one-time trial credits only after verified account creation; add anti-abuse controls.
- Price catalog beta-1: usable HTTP page=1 credit; browser page=5 total, not 1+5; cache hit=0; extraction=+3 for the bounded model input/output plan; search=2 for up to 10 results, 4 for up to 20. Map charges 1 per discovery fetch, capped by its quote. Research/crawl sum actual child operations, with no hidden orchestration surcharge in beta. If model planning is used, quote its configured fee explicitly.
- No charges for discovery, quote, result pagination, status polling or usage inspection. Re-reading cached content does not launch a fresh extraction or charge again. Re-extraction with a different schema is a new bounded paid operation.
- Automatic provider retries are included in the customer price; they increase internal COGS. Never launch a retry that violates internal cost caps. No paid upstream fallback in default configuration; opt-in operator adapters require a catalog price that covers their cost.
- Unusable pages, CAPTCHA/login pages, timeouts and missing required extraction results incur no charge for the failed unit. In a multi-page partial job, charge only completed usable units. A successful page fetch can remain chargeable if extraction separately fails; show these units separately and retain the fetched page.
- Valid zero search results is still a completed search and charged at its quoted price. Provider error is not a valid empty search. Document this distinction.
- Free trial credits fund actual work and are included in cost reports; they are not a route around budgets.

Store integer credits and integer micro-USD financial estimates; never float balances. Stripe checkout uses integer cents. Capture priceVersion on every quote, reservation, unit and settlement. Catalog changes never reprice in-flight work or already-purchased credit quantities retroactively.

### Transactional ledger

PostgreSQL is authoritative. Wallet spendable=posted balance minus active reservations. An atomic transaction checks operation, per-connection/day/account limits, reserves the operation ceiling, creates its idempotent job and writes an outbox enqueue event. A dispatcher publishes the outbox to workers. Failure to enqueue must not orphan reserved funds.

Use append-only events: grant, purchase, reserve, settle, release, refund, adjustment. References to jobs/units/webhook events have uniqueness constraints. Reservation events do not also debit posted balance. Settlement debits only actual successful charges and releases the remaining hold atomically. Workers record completed unit IDs exactly once. Enforce both customer credit ceiling and internal provider cost ceiling before each child operation. Reconcile stale reservations after worker crashes without permitting a live worker to spend unreserved funds.

Idempotency scope=(tenant, operation, key); canonical request hash conflict returns 409; same key/hash returns original job/result without new charge. Persist keys at least 30 days and explicitly document expiry. Stripe signed webhooks are verified against the raw request body; deduplicate event IDs and grant purchase credits exactly once on confirmed successful payment. Refund/dispute events use compensating entries; block further spend if needed without rewriting history. Payment success redirect alone never grants credits. No tool creates checkout charges or auto-top-ups in v1.

### Economic release gate

Track browser CPU/time, transfer, proxy/provider invoices, model tokens, storage, retries, and payment costs. Allocate fixed hosting costs at stated utilization scenarios; do not present marginal cost as total cost. Before live paid release, benchmark at least 1,000 authorized representative requests and report cost per usable HTTP/browser/extraction/research result, success rate, p50/p95 latency, cache hit rate, and margin by operation. Compare supported equivalents with current Firecrawl pricing without claiming unsupported parity.

Target at least 60% contribution margin after variable costs and payment fees on the expected mix, plus a fixed-cost break-even analysis. This is a decision threshold, not an achieved result. If beta prices fail, adjust configured prices or scope before taking live payments; do not invent benchmark results or conceal failed pages. Measure low- and high-utilization cases. Cheap HTTP must not subsidize unlimited expensive browser work.

## 11. Storage, cache and tenant model

Tables: users, organizations, memberships, api_keys, oauth_connections, connection_limits, wallets, ledger_entries, reservations, price_versions, quotes, jobs, job_units, job_events, idempotency_keys, outbox_events, results, result_sources, cache_entries, payments, webhook_events, audit_events. Every relevant row has organization_id, timestamps, indexes, and tenant-scoped lookup. Database migrations include uniqueness and ledger constraints. Hash API secrets, show them once, support scoped revocation/expiry; never log raw keys.

Cache key includes tenant, canonical URL, representation, render mode, relevant locale, extraction schema/prompt/model version where applicable. Keep tenant-scoped caching as v1 default, even for public pages. Do not cache signed/query-token URLs; reject them in v1. No shared cache of target credentials or user-specific data. A cached response preserves its original observedAt and declares cache age.

Retention defaults: result content and raw artifacts 24 hours; successful job metadata/source references 30 days; failed diagnostic bodies up to 24 hours; finance records per published accounting policy. Add lifecycle deletion and user-requested content deletion. Preserve only what retention requires; don't retain full-web archives or images by default. Dashboard shows expiry. Expired authorized results return RESULT_EXPIRED; unknown/other-tenant IDs return generic 404. Result access passes through auth or a short-lived explicitly issued download link; never public permanent object URLs.

## 12. Security and abuse controls required for this product

- URL guard accepts only HTTP(S), rejects userinfo/nonstandard ports by default and blocks loopback, private, link-local, metadata, multicast, reserved, IPv4-mapped IPv6 and alternative-encoding bypasses. Resolve and validate all addresses and revalidate each redirect. Prevent DNS rebinding at actual connection time.
- Enforce outbound firewall/proxy policy for HTTP workers and every browser subresource/WebSocket, not merely the main URL. Browser workers cannot reach API/database/internal services or cloud metadata. Redirect and webhook targets have the same checks.
- Fresh browser context per job, sandboxed process/container, no host mounts/secrets, resource/time/request limits, media downloads blocked where practical. Avoid disabling the browser sandbox as a convenience.
- Web content is untrusted data. No source text can modify instructions, expose secrets, change billing, select arbitrary tools, or cause credential forwarding. Use isolated extraction prompts and restricted output schemas. Prompt filtering is not a guarantee; enforce capabilities outside the model.
- API/MCP auth on every request, ownership on every ID, restricted CORS, MCP Origin validation, TLS, secure cookies, CSRF protection for dashboard writes, rate limits and bounded queues.
- No arbitrary OAuth token passthrough to providers. Validate audience and scope; dashboard role controls gate keys/billing/caps. API/agent users cannot elevate roles.
- Prevent trial farming with verified sign-in, rate limits and operator controls. Redact auth, query secrets and unnecessary content from logs. Sanitise rendered source HTML in the dashboard to prevent stored XSS.
- Only public target pages in v1; no customer-supplied headers/cookies or local-file reading. Enforce source restrictions and publish acceptable-use/reporting contacts. This does not grant data redistribution rights.
- No arbitrary customer webhooks in v1 is a valid simplification. If added, require HTTPS, validate egress per delivery, sign payloads, bound retries and prevent secrets in query strings.

## 13. Dashboard and onboarding

Keep a small developer product: responsive light/dark interface, clear typography, accessible forms and keyboard navigation. Pages: landing, pricing, sign-in, overview, API keys, jobs/results, usage/credit ledger, billing, connected clients/spend controls, docs, account/privacy.

First-run sequence: verified sign-in -> trial balance -> choose “Connect an agent” or “Use API” -> OAuth MCP instructions or one-time key display -> run a known sample -> show real content, sources and exact charge. No compulsory credit card for trial. The agent-connection page names capabilities and charging behavior before consent.

Landing page states scope honestly: public pages, bounded crawling/research, optional browser rendering, prepaid pricing. Do not advertise an unmeasured percent cheaper, all-site success, official Firecrawl affiliation, or an already-published ChatGPT listing. “Connect MCP” and “Get API key” are primary actions. Document migration as a supported subset.

Optional rich in-chat UI is post-MVP. Core tools must be useful with structured/text results only. A dashboard screenshot is not evidence of a working plugin.

## 14. Firecrawl migration compatibility

Add /compat/firecrawl/v2/scrape first, supporting a documented tested subset: url, markdown/html/links formats, onlyMainContent, waitFor within bounds, maxAge mapping, and timeout bounded by service policy. Return a Firecrawl-shaped response for that route only. If extraction formats are supported, document their mapping explicitly. Reject unsupported options with UNSUPPORTED_OPTION; never ignore action scripts, credentials, advanced proxy options or unsupported formats.

Compatibility scope is based on the selected upstream/SDK version and contract fixtures. Publish a matrix with supported / unsupported / different semantics for every promised option. Include one real SDK base-URL override example verified against the pinned SDK. Native AIHackr routes are canonical and include maxCredits; compatibility routes use owner-configured caps, so they cannot bypass spending controls. No claim of drop-in compatibility across every SDK or endpoint. Other compat endpoints are later.

## 15. Observability and operational requirements

Use request/job/tenant correlation IDs and redacted structured logs. Metrics: job queue age, worker saturation, attempts per successful page, browser-fallback rate, error reasons, charge/reservation reconciliation, provider spend, ledger mismatches and result expiration. Internal cost and account-billing data must not leak through public capabilities.

Initial targets to validate, not SLAs: own control-plane p95 under 500 ms excluding providers; warm ordinary scrape p95 under 10 seconds on cooperative test pages; accepted async requests respond within 2 seconds; bounded research ends within its 180-second deadline; no accepted work above account caps. Record hardware and concurrent load when reporting results.

Implement liveness/readiness, graceful draining, migrations, backup/restore instructions, secrets management, object lifecycle, dependency/security updates and rollback. Global/provider/domain kill switches stop new work and settle existing work safely. No expensive production workers provision automatically just because a demo runs.

## 16. Build milestones and acceptance tests

### M0: repository and capability audit

Inspect existing app; record upstream commit/license/dependencies, proposed architecture, current endpoints, and what cloud-only features must not be assumed. Resolve engine routing and OAuth provider support with a minimal spike. Produce a verified dependency/adapter map.

### M1: private retrieval API

Real engine integration, normalized results, safe public URL retrieval, cache, source metadata, bounded HTTP/browser paths, local fixture site and Docker runbook. No fake production provider. Demonstrate HTTP and JavaScript-rendered fixture retrieval.

### M2: accounts, billing and jobs

Tenant isolation, keys, wallet/reservations, idempotent jobs, search provider adapter, bounded extraction, crawl/research, polling/pagination/cancellation, Stripe test checkout/webhooks, dashboard inspection. Validate cost ceilings before enabling external paid adapters.

### M3: agent/plugin release

Remote MCP, OAuth linking, per-connection budgets, plugin skills/package, SDK, public contracts, client install guides, real target-client smoke tests and reviewer cases. Deliver local installable ZIP. Hosted review preparation remains separate from approval/publication.

### M4: benchmark and paid-beta readiness

Compatibility fixtures, 1,000-request benchmark, pricing/margin report, deployment rehearsal, backup/restore, secret scan, policy/support pages, operational runbook. Document unresolved credentials/domain/review tasks precisely. No live billing claims until configured and tested.

### Mandatory tests

1. Public static and JavaScript fixtures produce expected content; login/challenge/error fixtures are identified accurately.
2. Search does not scrape result URLs; retrieval does not invoke models implicitly.
3. Schema missingness/conflict tests return explicit partials, never invented values.
4. Cached results preserve source time and exact cache age; fresh-only requests never receive silent stale fallback.
5. Tenant A cannot access B's jobs/results/quotes/usage through REST or MCP.
6. Concurrent jobs cannot overdraw wallet or daily/connection caps.
7. Same idempotency key/hash returns original operation; changed input conflicts; retries after worker crashes do not double-charge.
8. Checkout webhook replay and out-of-order payment events cannot grant duplicate credits.
9. Queue publication failure, lease expiry, reservation timeout, cancellation races and duplicate worker execution settle correctly.
10. Partial crawl charges only successful units; discovery and result pagination stay free.
11. Retrieval/extraction caps cover every child, retry, model call and browser fallback.
12. SSRF suite includes redirects, IPv6, alternative IP formats, rebinding, browser subresources and OAuth metadata URLs.
13. Stored content cannot execute dashboard script; injected page instructions cannot change tool behavior or access secrets.
14. Crawl respects origin, path, depth, page, time and transfer bounds without false completeness claims.
15. MCP initialize/list/call, input/output schemas, errors, annotations, auth challenge, token expiry/revocation, and result pagination pass Inspector and actual client checks.
16. OAuth PKCE, exact redirects, issuer/audience/scope rejection and tenant binding pass integration tests.
17. Plugin archive validates, contains required files, references stable origins and contains no secrets. Test installation separately from packaging.
18. Five positive and three negative plugin scenarios pass with trace, output and charge evidence.
19. Compatibility endpoint contract tests pass against the pinned supported SDK/options; unsupported options fail clearly.
20. Cost report includes failed requests, retries, trial usage and low utilization; unrun benchmarks are marked unrun.

Use deterministic fixtures for CI and opt-in authorized live benchmarks with spending caps. Do not write network-flaky unit tests or imply fixtures prove arbitrary-web success. Minimum scripts: lint, typecheck, test:unit, test:integration, test:e2e, test:mcp, plugin:build, plugin:validate, benchmark, build. Keep these meaningful; they verify money, permissions, extraction and protocol behavior.

## 17. Required handoff from implementation

- Working repository with migrations, lockfile, environment template and reproducible Docker setup.
- DEPLOYMENT.md, OPERATIONS.md, SECURITY.md, THIRD_PARTY_NOTICES.md, source-offer information and privacy/retention behavior.
- OpenAPI document, MCP tool schemas, capabilities/prices examples, typed SDK, CLI and verified installation guides.
- Plugin source directory and validated release ZIP, packaged skills, review cases and review-preparation checklist.
- Compatibility matrix and fixture test results.
- Benchmark/economics report with raw measurements, methodology, sample mix and explicit limitations.
- A final status that distinguishes implemented, tested locally, tested in an actual client, deployed, submitted, approved and published. Include exact blockers and avoid presenting a mock, packaged ZIP, or successful OAuth callback as proof of end-to-end operation.

## 18. Sources and verification notes

These are implementation references checked while preparing the spec. Revalidate current requirements and exact schemas when implementing; do not freeze client/protocol behavior from this document.

- Firecrawl core and licenses: https://github.com/firecrawl/firecrawl
- OSS/cloud capability boundary: https://docs.firecrawl.dev/contributing/open-source-or-cloud
- Self-host deployment: https://docs.firecrawl.dev/contributing/self-host
- Official reusable MCP adapter: https://github.com/firecrawl/firecrawl-mcp-server
- Pricing comparator (current prices are not promised future prices): https://www.firecrawl.dev/pricing
- OpenAI MCP plugin server: https://developers.openai.com/plugins/build/mcp-server
- OpenAI account authentication: https://developers.openai.com/plugins/build/auth
- OpenAI plugin package format: https://developers.openai.com/plugins/build/plugins
- OpenAI submission/review: https://developers.openai.com/plugins/deploy/submission
- MCP tools reference: https://modelcontextprotocol.io/specification/2025-11-25/server/tools
- MCP security reference: https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices

The MCP links identify a reviewed reference revision, not a claim that it is the newest or universally supported version. Use the supported SDK/client negotiation and current official references. This specification defines a product and acceptance criteria; it does not certify benchmark results, hosting costs, platform approval, license compliance of an uninspected implementation, or ownership of proposed subdomains.
