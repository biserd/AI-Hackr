# AIHackr

## Overview

AIHackr is an AI provider intelligence tool for SaaS companies, designed to identify which AI/LLM providers (e.g., OpenAI, Anthropic, Google) any given SaaS product uses. Users can input a URL to receive an "AI Intelligence Report" detailing the AI provider, inferred model family, and integration method (direct API, gateway, or proxy). The report also covers the broader tech stack, including framework, hosting, payments, auth, and analytics. A key feature is change/migration monitoring, alerting users when competitors switch AI providers. AIHackr aims to be a specialized tool for AI provider intelligence, distinct from general tech stack profilers. The project's vision is to provide unparalleled insight into the AI strategies of SaaS companies, offering a competitive edge and market understanding.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Frontend Framework**: React 18 with TypeScript.
- **Styling**: Tailwind CSS v4 with CSS variables for theming, using shadcn/ui (New York style) built on Radix UI primitives for components.
- **Theming**: Supports dark/light mode via next-themes.
- **Animations**: Framer Motion for smooth transitions.
- **Navigation**: Lightweight Wouter for routing.
- **Pages**: Includes `/watchlist` for managing monitored domains, `/stack` for browsing tracked companies, and `/leaderboard` for viewing rankings and changes in AI adoption. Specific pages for company details (`/stack/:slug`), provider details (`/provider/:slug`), and archived leaderboards (`/leaderboard/:week`) are also implemented.
- **SEO**: Utilizes build-time prerendering for SEO-friendly HTML stubs for key pages and blog posts, incorporating JSON-LD for rich snippets.
- **Social Previews**: Generates SVG images for social media previews for leaderboard snapshots.
- **Embeds**: Provides an embeddable leaderboard for partners with filtering and theming options.

### Technical Implementations
- **Backend**: Node.js with Express, written in TypeScript using ESM modules, providing REST endpoints under `/api/*`.
- **Data Storage**: PostgreSQL database managed with Drizzle ORM. The schema is defined once in `shared/schema.ts` for type safety across frontend and backend. Migrations are handled via Drizzle Kit.
- **Core Scanning Engine**: A server-side scanner (`server/scanner.ts`) analyzes HTML, scripts, headers, and DNS records to detect frameworks, hosting, payments, authentication, analytics, and AI providers. Detections include confidence levels and an evidence trail.
- **Watchlists & Alerts**: Users can add domains to watchlists (with plan-based limits). A background worker scans these domains at defined cadences (Pro: 24h, Free: 7d) and generates alerts for changes in AI providers. Alerts have a 0.60 confidence floor and include features like rolling 24-hour deduping, quiet hours, and plan-specific caps. Alert delivery is via email and Slack. Manual scans are a Pro-only feature.
- **Content & Leaderboard Engine**: Tracks a curated list of SaaS companies, scanning them regularly to build a database of their AI providers. This data populates a leaderboard and allows for historical tracking of provider changes. Companies are mapped to 10 canonical AI provider rollups. Weekly snapshots of the leaderboard are archived.
- **Build Process**: Uses Vite for frontend builds and esbuild for backend production bundling, with custom optimizations for Replit integration.
- **Monorepo Structure**: Organized into `client/`, `server/`, and `shared/` directories.

### Feature Specifications
- **AI Intelligence Report**: Provides detailed insights into AI provider, model family, and integration method.
- **Stack Fingerprinting**: Identifies the broader tech stack beyond just AI providers.
- **Change Monitoring**: Alerts users to changes in AI providers for monitored domains.
- **Watchlists**: Allows users to track specific domains with configurable alert settings.
- **Leaderboard**: Ranks companies based on AI adoption, offering filters by provider, category, and other criteria.
- **API**: Provides endpoints for scanning, retrieving company and provider information, leaderboard data, and managing user settings.
- **Blog**: Includes SEO-optimized blog posts discussing AI in SaaS, linking to live data.

## External Dependencies

- **Database**: PostgreSQL (via `DATABASE_URL`)
- **ORM**: Drizzle ORM for PostgreSQL
- **UI Components**: Radix UI (primitives), shadcn/ui (component library), Lucide React (icons)
- **Notifications**: Sonner (toast notifications)
- **Email**: Resend (for sending emails like stack change alerts, site unreachable, and weekly digests)
- **Development/Build Tools**: Vite, esbuild, Replit plugins (cartographer, dev-banner, runtime-error-modal)