# AIHackr

**AI provider intelligence for SaaS** — the only tool that tells you which AI/LLM provider any SaaS is actually running, with confidence levels and the evidence trail.

## What is AIHackr?

AIHackr fingerprints the AI stack behind any SaaS in seconds. Paste a URL and get back an **AI Intelligence Report**: the AI provider, the inferred model family, the gateway, and how they're calling it (direct API, gateway, or proxy) — plus the surrounding tech stack.

We're positioned distinctly from BuiltWith and Wappalyzer. They map general tech stacks. We're the wedge tool for AI provider intelligence.

### What We Detect

- **AI Providers**: OpenAI, Anthropic, Google, Mistral, Cohere, Azure OpenAI, AWS Bedrock, Groq, and more — with direct-API vs gateway distinction
- **Frameworks**: Next.js, React, Vue, Angular, Svelte, and more
- **Hosting**: Vercel, Netlify, AWS, Cloudflare, Replit, Railway, Heroku
- **Payments**: Stripe, Paddle, and other payment processors
- **Authentication**: Auth0, Clerk, Firebase Auth, Supabase Auth
- **Analytics**: Google Analytics, Mixpanel, Segment, Amplitude
- **Support**: Intercom, Crisp, Zendesk, and other chat widgets

### How It Works

1. **Paste a URL** — Enter any website address
2. **Passive Scan** — We analyze HTML, headers, scripts, and DNS records (instant)
3. **Render Scan** — We load the page in a browser to capture network activity (automatic)
4. **Probe Scan** — Optional deep scan that interacts with the page to detect AI features

Each detection includes:
- **Confidence levels** (High, Medium, Low)
- **Evidence trails** showing exactly what we found
- **Shareable AI Intelligence Reports** for social media

## Features

- **AI Provider Fingerprinting**: Identify which LLM provider a SaaS is using and how
- **Confidence Scores With Evidence Trails**: Every detection ships with the signals that triggered it — no black box
- **Migration Monitoring** *(Pro)*: Watch any SaaS and get alerted when their AI stack changes
- **Progressive Scanning**: Get instant results while deeper analysis runs in the background
- **Origin Host Inference**: Detect the actual hosting provider behind CDNs
- **Third-Party Service Grouping**: Organized view of all external services
- **Shareable Reports**: Clean URLs like `/scan/stripe.com` for easy sharing

## Tech Stack

AIHackr is built with:
- React 18 + TypeScript
- Tailwind CSS + shadcn/ui
- Express.js in a Cloudflare Container
- Cloudflare Workers as the public edge and scheduler
- Cloudflare D1 + Drizzle ORM
- Cloudflare Email Sending for transactional email
- Playwright for browser scanning inside the container

## FAQ

### Is this legal?

Yes. AIHackr only analyzes publicly accessible information — the same data your browser sees when visiting a website. We don't access private data, bypass authentication, or exploit vulnerabilities.

### How accurate is the detection?

Our passive scans achieve ~94% accuracy on frameworks, hosting, and major integrations. AI provider detection depends on public signals — we only report what we can verify, with confidence levels for each claim.

### Why wasn't AI detected on a site I know uses AI?

AI calls may be:
- Server-side only (not visible in browser network)
- Routed through custom proxies that strip identifying headers
- Only triggered after user authentication
- Using internal/custom models

That's why we show confidence levels — if we're not sure, we tell you.

### What's the difference between scan types?

- **Passive**: Analyzes static HTML and headers (instant, always runs)
- **Render**: Loads the page in a real browser to capture JavaScript-initiated requests (automatic)
- **Probe**: Interacts with the page (clicks buttons, fills forms) to trigger AI features (optional, user-initiated)

### Can I scan any website?

Most public websites work. Some sites with aggressive bot protection may block our scans. Sites requiring authentication cannot have their authenticated features scanned.

### Is my data private?

Scan results are stored to enable shareable links. We don't store any data from the scanned websites themselves — only our analysis results.

## Cloudflare deployment

The public Worker owns routing, scheduled work, D1 access, and outbound email.
It proxies application requests to a single Cloudflare Container running the
Express/Playwright application. The container reaches D1 and Email Sending only
through private Worker outbound handlers, so no database URL or email API key is
stored in the app.

1. Install dependencies with `npm ci` (Node 22 or newer).
2. Create a D1 database and set its ID in `wrangler.jsonc`.
3. Apply migrations with `npm run db:migrate:remote`.
4. Enable Email Sending for `aihackr.com` and keep the `EMAIL` binding's allowed
   sender aligned with the verified domain.
5. Deploy with `npm run deploy`. Cloudflare Workers Builds can build the
   `Dockerfile` remotely when the GitHub repository is connected.
6. Validate the `workers.dev` staging URL before attaching `aihackr.com` and
   `www.aihackr.com` as custom domains.

For local schema work, use `npm run db:migrate:local`. Production background
jobs run from the Worker cron trigger; the container's in-process timers are
disabled unless `ENABLE_BACKGROUND_LOOPS=true` is explicitly set.

## License

The additive [agent web-data service](services/web-data/README.md) is available in development at `/web-data`. Existing scanner functionality and production deployment remain in place. Read the service status and release gates before enabling providers. The new service is AGPL-3.0-or-later, separately from the scanner's existing MIT terms.

MIT License — feel free to use, modify, and distribute.

---

Built with curiosity about what powers the AI behind the web.
