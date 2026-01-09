# AIHackr

## Overview

AIHackr is a SaaS reverse-engineering tool that analyzes any website URL and generates a shareable "AI Stack Card" showing the detected technology stack. It identifies frameworks, hosting providers, payment systems, authentication, analytics, and AI providers with confidence levels and evidence. Think "BuiltWith for AI SaaS" with transparent detection methodology.

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