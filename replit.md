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