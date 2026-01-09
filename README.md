# AIHackr

**The "BuiltWith" for AI SaaS** — Reverse-engineer any website's tech stack and AI provider signals in seconds.

## What is AIHackr?

AIHackr is a SaaS reverse-engineering tool that analyzes any website URL and generates a shareable "Stack Card" showing the detected technology stack. Think of it as X-ray vision for SaaS products.

### What We Detect

- **Frameworks**: Next.js, React, Vue, Angular, Svelte, and more
- **Hosting**: Vercel, Netlify, AWS, Cloudflare, Replit, Railway, Heroku
- **Payments**: Stripe, Paddle, and other payment processors
- **Authentication**: Auth0, Clerk, Firebase Auth, Supabase Auth
- **Analytics**: Google Analytics, Mixpanel, Segment, Amplitude
- **AI Providers**: OpenAI, Anthropic, Google AI, Groq, Mistral, and more
- **Support**: Intercom, Crisp, Zendesk, and other chat widgets

### How It Works

1. **Paste a URL** — Enter any website address
2. **Passive Scan** — We analyze HTML, headers, scripts, and DNS records (instant)
3. **Render Scan** — We load the page in a browser to capture network activity (automatic)
4. **Probe Scan** — Optional deep scan that interacts with the page to detect AI features

Each detection includes:
- **Confidence levels** (High, Medium, Low)
- **Evidence trails** showing exactly what we found
- **Shareable Stack Cards** for social media

## Features

- **Progressive Scanning**: Get instant results while deeper analysis runs in the background
- **AI Stack Detection**: See which LLM providers a site is using (when publicly visible)
- **Origin Host Inference**: Detect the actual hosting provider behind CDNs
- **Third-Party Service Grouping**: Organized view of all external services
- **Shareable Reports**: Clean URLs like `/scan/stripe.com` for easy sharing

## Tech Stack

AIHackr is built with:
- React 18 + TypeScript
- Tailwind CSS + shadcn/ui
- Express.js backend
- PostgreSQL + Drizzle ORM
- Playwright for browser scanning

## FAQ

### Is this legal?

Yes! AIHackr only analyzes publicly accessible information — the same data your browser sees when visiting a website. We don't access private data, bypass authentication, or exploit vulnerabilities.

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

## Self-Hosting

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up PostgreSQL and configure `DATABASE_URL`
4. Run migrations: `npm run db:push`
5. Start the server: `npm run dev`

## License

MIT License — feel free to use, modify, and distribute.

---

Built with curiosity about what powers the web.
