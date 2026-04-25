# AIHackr

## Overview

AIHackr is the AI provider intelligence tool for SaaS — the only tool that tells you which AI/LLM provider any SaaS is actually running, with confidence levels and an evidence trail. Paste any URL and get back an "AI Intelligence Report" that fingerprints the AI provider (OpenAI, Anthropic, Google, Mistral, Cohere, Azure OpenAI, AWS Bedrock, or self-hosted), the inferred model family, and how they're calling it (direct API, gateway, or proxy). The report also surfaces the surrounding stack — framework, hosting, payments, auth, analytics — and supports change/migration monitoring so users get alerted when a competitor switches AI providers.

The product is positioned distinctly from BuiltWith and Wappalyzer: those map general tech stacks; AIHackr is the wedge tool for AI provider intelligence specifically.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **Styling**: Tailwind CSS v4 with CSS variables for theming
- **UI Components**: shadcn/ui (New York style) with Radix UI primitives
- **State Management**: TanStack React Query for server state
- **Animations**: Framer Motion for smooth transitions
- **Theming**: next-themes for dark/light mode support
- **Build Tool**: Vite with custom plugins for Replit integration

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Pattern**: REST endpoints under `/api/*`
- **Build**: esbuild for production bundling with selective dependency bundling

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts` - shared between client and server
- **Migrations**: Drizzle Kit with `drizzle-kit push` for schema sync
- **Session Storage**: connect-pg-simple for Express sessions

### Core Scanning Engine
The scanner (`server/scanner.ts`) uses pattern matching against HTML, scripts, headers, and DNS to detect:
- Frameworks (Next.js, React, Vue, Angular, Svelte)
- Hosting (Vercel, Netlify, AWS, etc.)
- Payments (Stripe)
- Authentication providers
- Analytics services
- AI providers (OpenAI, Anthropic, Google AI)

Detection includes confidence levels (High/Medium/Low) and evidence trails.

### Watchlists & Change Alerts (Task #2)
- **Watchlists** (`subscriptions` table): Free plan capped at 5 domains; Pro unlimited. Each domain has per-row `alertThreshold`, `slackEnabled`, `pausedUntil`, `nextScanAt`, `scanStatus`, `consecutiveFailures`, `manualScansToday`, `pendingRemovals`, and `providersDetected`.
- **Background worker** (`server/background-worker.ts`):
  - Per-plan rescan cadence (Pro 24h, Free 7d) with ±2h jitter, Pro head-of-queue priority.
  - `computeDiff` applies a **0.60 confidence floor**: providers below the floor are not "present" for add/remove transitions; this ensures crossing the floor correctly emits `provider_added`.
  - 2-consecutive-scan removal counter via `pendingRemovals` jsonb to avoid one-off flakes.
  - 4h retry × 3 then site-unreachable email.
  - Alert delivery filters: rolling-24h dedup `(subscriptionId, provider, changeType)`, quiet hours, free-plan 5 alerts/week cap, dismissal windows, min-confidence and per-row threshold gating.
  - **Dedup design choice (accepted spec deviation)**: the playbook spelled the dedup key as `(entry, provider, change_type, date)` (calendar-day bucket); we deliberately implemented a rolling 24-hour window keyed off the most recent `alertedAt` of a sibling change_event. Rationale: (a) calendar-day buckets emit two alerts within minutes when a flap straddles midnight UTC, (b) "date" is timezone-ambiguous for users in different IANA zones, and (c) rolling-24h matches our wall-clock-based quiet-hours / weekly-cap semantics. Documented at `server/background-worker.ts` `deliverAlert`.
  - **Manual scan limits**: Pro-only feature, capped at 3 per rolling 24h. Free users see the Scan Now button as a dimmed upsell prompt; clicking it surfaces a "Pro feature — upgrade to scan on demand" toast (API returns `403 {error: "pro-only"}`). Implemented in `server/background-worker.ts manualScanNow`, gated in `server/routes.ts /scan-now`, and rendered conditionally in `client/src/pages/watchlist.tsx WatchlistRow`.
  - Weekly digest cron (Mon 7–11 AM in user's timezone); only marks digest sent on confirmed email success.
- **User settings** (`user_settings` table): email/Slack toggles, Slack webhook (masked on GET), frequency cap, global threshold, min confidence, quiet hours, timezone, digest mode (`individual` | `daily_bundle`), `lastDailyBundleAt` for bundle throttling. PATCH endpoint validates with strict zod schema (enums, `HH:MM` regex, IANA timezone).
- **Daily bundle digest**: when `alertDigestMode = daily_bundle`, `deliverAlert` defers the email send (Slack still fires real-time) and leaves `alertedAt` null. An hourly `runDailyBundleCycle` cron then gathers each user's pending un-alerted, un-suppressed events (last 25h), throttled to one bundle per 22h, and sends a single grouped email via `sendWeeklyDigestEmail` with a custom subject override. On success it bulk-marks events alerted via `markChangeEventsAlertedBulk` and stamps `lastDailyBundleAt`.
- **Email** (`server/email.ts`): `sendStackChangeAlertEmail`, `sendSiteUnreachableEmail`, `sendWeeklyDigestEmail` (Resend with `hello@aihackr.com` sender).
- **Slack** (`server/slack.ts`): `sendStackChangeSlack` (Block Kit) + `sendSlackTestMessage`.
- **UI**: `/watchlist` (table with filters, sort, expansion, edit/add modals), `/settings/alerts` (email/Slack/threshold/quiet-hours/digest sections), and a new "+ Add to Watchlist" CTA on the report card replacing the old disabled "Monitor weekly (Pro)" button.

### Content & Leaderboard Engine (Task #3)
- **Tracked companies** (`tracked_companies` table): seeded with 50 well-known SaaS products (Notion, Linear, Stripe, Cursor, Replit, Perplexity, ...), each with `slug`, `domain`, `category`, optional `ycBatch`, `lastScanId`, `priorAiProvider`, `providerChangedAt`, plus the same 7-day rescan plumbing (`nextScanAt`, `scanStatus`). Anyone can submit a new company via `POST /api/stack/request` (idempotent on slug).
- **Provider rollups** (`provider_rollups` table): 10 canonical providers — `openai`, `anthropic`, `google-gemini`, `azure-openai`, `aws-bedrock`, `mistral`, `meta-llama`, `cohere`, `other`, `unknown` — each with an `aliases[]` list used for case-insensitive matching when a Scan's `aiProvider` string maps onto a rollup.
- **Background worker — tracked-company cycle** (`runTrackedCompanyScans` in `server/background-worker.ts`): on a 10-minute tick, claims up to 5 due companies via an optimistic `scanStatus = "scanning"` flip, runs the same `scanUrl()` used by `/api/scan`, persists a `Scan` row, then stamps `lastScanId / lastScannedAt / nextScanAt` on the company. `providerChangedAt` is updated only when the canonical primary AI provider's lowercase name flips (so confidence drift alone doesn't pollute "this week's changes"). 7-day cadence with ±2h jitter, 4h retry on failure.
- **API routes** (`server/routes.ts`):
  - `GET /api/stack` — filterable list of tracked companies + categories.
  - `GET /api/stack/:slug` — company + latestScan + 10-row history + similar (same category).
  - `POST /api/stack/request` — z-validated, idempotent by slug; auto-derives slug from name.
  - `GET /api/leaderboard` — rows with filters (provider/category/confidence/changedThisWeek), plus categories + provider rollups sidebar payload.
  - `GET /api/leaderboard/changes-this-week` — companies whose primary provider flipped in last 7 days.
  - `GET /api/providers`, `GET /api/providers/:slug` — provider rollups + companies-using-this-provider via alias matching.
  - `GET /badge/:slug.svg` — dynamically generated SVG badge ("Powered by {provider} · {confidence} · AIHackr") with confidence-band coloring, cached 1h.
  - `GET /sitemap.xml` — dynamic, includes 8 static + 50 stack + 10 provider + 12 blog URLs (80 total). Replaces the old static `client/public/sitemap.xml` (deleted).
- **Pages**:
  - `/stack` (`stack-index.tsx`): searchable, category-filtered grid of all tracked companies + "Request a company" modal.
  - `/stack/:slug` (`stack-detail.tsx`): full intelligence report with `TechArticle` + `BreadcrumbList` JSON-LD, evidence trail (signals, network domains), AI Stack History timeline, badge embed snippet, and similar-companies grid.
  - `/leaderboard` (`leaderboard.tsx`): rank table with provider/category/confidence filters, "This Week's Provider Changes" panel, provider-rollup grid, and embed-iframe CTA.
  - `/provider/:slug` (`provider-rollup.tsx`): full list of companies detected on a given provider (alias-matched).
  - `/embed/leaderboard` (`leaderboard-embed.tsx`): minimal table with no chrome, intended for iframe embeds with backlink attribution.
- **Blog scaffolds**: 12 SEO posts (1 pre-existing + 11 new) under `client/src/pages/blog/*.tsx`. Each new post is a thin wrapper around the shared `BlogPostScaffold` (`client/src/components/blog-post.tsx`) which standardizes SEO/JSON-LD plumbing, lead paragraphs, sectioned outlines, and a "Live data behind this post" internal-link block that points at `/leaderboard`, relevant `/provider/:slug`, and 3-5 `/stack/:slug` pages. Slugs: `openai-vs-anthropic-which-saas-companies-use-which`, `the-state-of-ai-in-saas-2026`, `azure-openai-adoption-in-enterprise-saas`, `ai-gateways-explained-cloudflare-portkey-helicone`, `claude-vs-gpt-4-real-world-saas-deployments`, `self-hosted-llms-which-saas-products-run-their-own-models`, `aws-bedrock-customers-the-complete-list`, `every-yc-batch-and-which-ai-they-use`, `how-to-tell-which-llm-a-website-is-using`, `what-changed-this-week-in-saas-ai-stacks`, `the-complete-guide-to-fingerprinting-ai-providers`. Blog index updated to list all 12.
- **Seed** (`server/seed.ts`): `runSeed()` invoked on server boot in `server/index.ts`, populates `tracked_companies` + `provider_rollups` idempotently with `ON CONFLICT DO NOTHING`.

### Key Design Decisions

1. **Shared Schema**: Database types are defined once in `shared/schema.ts` and used by both frontend (for type safety) and backend (for Drizzle ORM). Uses drizzle-zod for validation.

2. **Monorepo Structure**: Single repo with `client/`, `server/`, and `shared/` directories. Path aliases configured in tsconfig (`@/` for client, `@shared/` for shared).

3. **Production Build**: Custom build script bundles frontend with Vite and backend with esbuild. Allowlist pattern bundles common dependencies to reduce cold start syscalls.

4. **Passive vs Probe Scanning**: Current implementation is passive (HTML/header analysis). Architecture supports future probe scanning for deeper network-level detection.

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries with PostgreSQL dialect

### UI Framework
- **Radix UI**: Full suite of accessible primitives (dialog, dropdown, tabs, etc.)
- **Lucide React**: Icon library
- **Sonner**: Toast notifications (alternative to shadcn toast)

### Development Tools
- **Vite**: Dev server with HMR and production builds
- **Replit Plugins**: cartographer, dev-banner, runtime-error-modal for Replit integration

### Potential Future Integrations
- Payment processing (Stripe referenced in dependencies)
- Authentication (Passport.js with passport-local in dependencies)
- Email (Nodemailer in dependencies)
- AI providers for enhanced detection (OpenAI and Google Generative AI SDKs in dependencies)