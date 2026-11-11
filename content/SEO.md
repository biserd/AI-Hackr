# Public content and SEO operations

The homepage targets the product category “web scraping API” and “AI agents.” Supporting pages cover distinct user tasks rather than repeating the homepage text:

| Cluster | Primary page | Supporting guide |
| --- | --- | --- |
| Website to Markdown API | /blog/website-to-markdown-api | /docs/scrape |
| Scrape, map and crawl | /docs/crawl and /docs/map | /blog/scrape-vs-crawl-vs-map |
| Web data for RAG | /use-cases/rag | /blog/web-data-for-rag |
| JSON extraction | /use-cases/data-extraction and /docs/extract | /blog/structured-data-extraction |
| Web scraping MCP server | /docs/mcp | /use-cases/ai-agents |
| Account activation | /docs/quickstart | /docs/authentication |

These are editorial intent themes, not measured search volume or ranking claims. Semrush keyword data was unavailable because the connected account lacked API units. No traffic forecast, keyword difficulty score or ranking position is invented.

## Publishing

Add a metadata entry to `content/manifest.mjs` and its body to the content sources. The build fails if a body is missing. Keep titles/descriptions unique and the page focused on a real task. Articles have an AIHackr organization byline and a real publication date; do not refresh dates without substantive review. Update availability statements when billing or OAuth actually ships.

Run `node cloudflare/scripts/build.mjs`, `node cloudflare/scripts/verify-site.mjs`, the unit tests and `node cloudflare/test/site-live.mjs` against staging. Live page content must match the built source. The source-bound release receipt requires live site checks. CSS/HTML use system fonts, semantic headings, accessible navigation and no required third-party marketing scripts. API keys and customer data do not belong in public metadata or search indexes.

## Indexing and discovery

Only canonical public HTML is listed in `/sitemap.xml`. Staging sends `X-Robots-Tag: noindex, nofollow` and disallows crawling in its robots file. Production public pages are crawlable; private API responses are noindex. Robots exclusions are crawl instructions, not access control. Unknown public paths return HTTP 404, while known trailing-slash and `.html` variants redirect to one canonical path. JSON-LD hashes are included in CSP so metadata does not require arbitrary inline JavaScript.

The RSS feed includes the four published guides. Docs search uses a static public documentation index. No session, private result, email or credential is indexed. The sitemap is discoverable from robots.txt; Search Console verification/submission is not configured by this release. Actual indexing, ranking, Core Web Vitals and conversions need separate measurement. Static checks and content generation do not establish those outcomes.

## Marketing materials

`content/marketing-kit.md` contains positioning, launch copy, six social drafts, three email drafts, use-case messages, objection handling and a four-week distribution plan. No messages are sent, campaigns scheduled or paid ads purchased by this release.
