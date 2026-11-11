# AIHackr paid SaaS interface

Reference: https://www.firecrawl.dev/pricing (fresh Firecrawl branding, Markdown and screenshot capture requested 2026-11-08). Existing AIHackr portal: https://aihackr.com.

## Source evidence and limits

The Firecrawl branding extraction reports primary/accent `#FF4C00`, background `#F9F9F9`, text `#262626`, secondary `#F9C2AB`, a Suisse/system font stack and 4px spacing base. Pricing text establishes tier cards with monthly amounts and credit allowances. Screenshot capture returned a URL, but local browser access was disabled and pixels were not inspected. Exact reference layout, dashboard internals, responsive states, motion and hover styling are therefore unverified. The layout below is a proposed AIHackr adaptation, not a claim of pixel accuracy.

## Implementation choices

- Preserve the AIHackr wordmark and current orange `#D94C1C`; no OSS label in the logo.
- Retain readable 17px body, 16px controls and at least 15px navigation. Use system fonts rather than copying proprietary font files.
- Light surfaces, thin neutral borders, rounded 7–9px panels, orange primary actions and quiet monospace labels.
- Customer dashboard sidebar: Overview, Playground, Job history, Credit usage, API keys, Plans & billing, MCP & plugin.
- Overview shows real available, held and used credits, current allowance period and recent private jobs. No fabricated usage or revenue metrics.
- Billing uses three side-by-side plan cards on wide screens, stacked on narrow screens. Hosted Stripe Checkout and Customer Portal handle payment details.
- Mobile navigation wraps into rows; wide data tables scroll inside their panel. Card values stay legible without horizontal page overflow.
- The usage chart uses complete daily ledger aggregates, with accessible total text and per-day tooltips. Ledger and job lists paginate.

## Assets

Use the existing code-rendered AIHackr `a↗` logo. No Firecrawl logo, fox imagery or copied product assets. Plugin presentation uses text identity; final marketplace imagery and reviewer recording remain pending with OAuth/public submission.

## Commercial presentation

Starter $9 / 1,000 credits, Builder $29 / 5,000, Scale $79 / 20,000 monthly. Free trial: 20 lifetime credits. No rollover or automatic overage payments. Extract 5 credits per successful request; scrape/map 1 per successful request; crawl 1 per successful page. Do not advertise Firecrawl's search, concurrency or OAuth features as implemented here.
