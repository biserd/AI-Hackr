# AIHackr messaging and launch kit

Publication baseline: 9 November 2026. Recheck https://aihackr.com/api/capabilities before reusing availability claims. These are reusable copy drafts, not evidence that any campaign was sent or posted.

## Positioning

Audience: developers building applications and AI agents that need content from public webpages. Primary jobs: retrieve readable text, inspect page links, crawl a bounded section and extract fields.

One line: **Public web data for your apps and AI agents.**

Headline: **Web scraping API for your apps and AI agents.**

Supporting copy: Turn public webpages into Markdown, HTML, links or structured JSON. Start in the playground, then connect your application through REST or MCP. Powered by Cloudflare Browser Run.

Primary call to action: **Start free** → https://aihackr.com/#workspace

Developer call to action: **Make your first API request** → https://aihackr.com/docs/quickstart

## Product descriptions

Short: AIHackr turns public webpages into Markdown, HTML, links and structured JSON through a browser playground, REST API and MCP tools, powered by Cloudflare Browser Run.

Extended: AIHackr gives developers a managed way to collect public web content for applications and AI agents. Start with one page in the playground, create a server-side API key, then use REST or a compatible MCP client. Scrape readable content, discover same-origin links, run a bounded asynchronous crawl or extract JSON from one page. Each verified account starts with 20 free credits and a private workspace. Monthly paid plans add credits through Stripe Checkout. Hosted OAuth remains in testing.

## Value propositions and proof

1. **Start with a URL.** A browser playground lets a verified user run the live service without creating an API key first. Proof: the live playground.
2. **Choose your output.** Markdown, HTML, links and structured extraction support different application tasks. Proof: endpoint documentation and actual responses.
3. **Connect your workflow.** REST endpoints and eight official Cloudflare OSS browser/crawl MCP tools reach the same customer workspace. Proof: API reference, MCP tool discovery and source repository.
4. **Keep retrieval bounded.** Explicit page and depth limits, private crawl ownership and retained results help applications manage a small collection. Proof: documented limits and live crawl behavior. This is not a promise of successful access to every target.
5. **Use managed browser infrastructure.** AIHackr runs on Cloudflare Browser Run and Workers; users do not operate a browser fleet to try it. This is not a Cloudflare endorsement or an uptime guarantee.

## Landing-page copy by use case

### RAG

Headline: Collect the sources your answers depend on.

Copy: Retrieve public webpages as Markdown, keep source URLs and observation times, then bring your own chunking, embeddings and retrieval layer. Start with a bounded collection you can inspect.

CTA: Explore the RAG workflow → https://aihackr.com/use-cases/rag

### AI agents

Headline: Give your agent a bounded view of the public web.

Copy: Read a page, discover links or manage a small crawl through MCP tools. Keep credentials in your client’s secure settings and give the agent an explicit page budget.

CTA: Connect an MCP client → https://aihackr.com/docs/mcp

### Structured extraction

Headline: From public page to fields your app can use.

Copy: Describe the data you need with a prompt or JSON schema. Validate the output and retain the source alongside every object.

CTA: Try the Extract API → https://aihackr.com/docs/extract

## Launch announcement draft

AIHackr is live for developers who need public web content in their apps and AI agents.

Use the playground or REST API to turn a page into Markdown, HTML, links or JSON. Discover same-origin links, submit a bounded crawl, or connect a compatible MCP client using your own customer API key.

The service runs on Cloudflare Browser Run. Each verified account starts with 20 free credits; no credit card is required. Crawls hold their requested maximum while running and return unused credits at completion. Monthly paid plans add allowances; hosted OAuth remains in testing.

Try one page: https://aihackr.com/#workspace
Read the quickstart: https://aihackr.com/docs/quickstart

## Social post drafts

1. A URL is only the start. AIHackr turns public pages into Markdown, HTML, links or JSON for your apps and agents. Try one page in the playground: https://aihackr.com/#workspace

2. Scrape one page. Map its links. Crawl a bounded section. Choosing the right request makes web data easier to inspect. Our practical guide: https://aihackr.com/blog/scrape-vs-crawl-vs-map

3. Building RAG from web sources? Keep the URL and observation time attached to every chunk. Start with a collection you can inspect before expanding it: https://aihackr.com/blog/web-data-for-rag

4. Valid JSON does not guarantee accurate data. Define useful fields, validate the response and keep the source. A practical extraction workflow: https://aihackr.com/blog/structured-data-extraction

5. Your website session and API keys use the same private AIHackr workspace. Try the playground first; create a named key when you connect your own code: https://aihackr.com/docs/authentication

6. AIHackr includes eight browser and crawl MCP tools from Cloudflare’s official OSS server. Use a compatible Streamable HTTP client and a customer API key: https://aihackr.com/docs/mcp

## Email drafts for opted-in recipients

### Welcome

Subject: Your first page with AIHackr

Welcome to AIHackr. Start in the playground with one public URL and choose Markdown, HTML or links. Your verified account includes 20 free credits and does not need a credit card.

When you connect your own code, create a named API key and keep it on your server. The quickstart includes cURL, JavaScript and Python examples: https://aihackr.com/docs/quickstart

For a crawl, set a small page limit. Its maximum is held while running; unused held credits return when the job ends.

### Education

Subject: Scrape, map or crawl?

Use Scrape when you know the page. Use Map to inspect its same-origin links. Use Crawl when you need content from several pages and can define a small bound.

See the examples and usage differences: https://aihackr.com/blog/scrape-vs-crawl-vs-map

### Developer activation

Subject: Connect your code to the page you just tested

Once a page produces useful output in the playground, make the same request from your application. Create a customer API key, store it as AIHACKR_API_KEY and call the documented endpoint.

Quickstart: https://aihackr.com/docs/quickstart
Error handling: https://aihackr.com/docs/errors

These drafts are not configured as automated emails. Before a marketing send, use a consent-based list and the actual sender’s unsubscribe and mailing-address requirements. Do not mix promotional copy into necessary sign-in emails.

## Objection handling

**Do I need an API key to try the website?** No. Sign in with your email code and use the playground. Create a key when connecting code or an MCP client.

**Does this run Firecrawl?** No. AIHackr uses Cloudflare Browser Run. Some REST routes provide a documented Firecrawl-shaped subset; full SDK or feature compatibility is not claimed.

**Can I scrape every website?** No. Public target restrictions, robots rules, provider limits and target behavior apply. Logged-in sessions and CAPTCHA bypass are not available.

**Is it unlimited?** No. The current trial is 20 free credits per verified account. Crawl requests reserve the full requested maximum. Other request and service limits are documented.

**Can I buy a plan or install a public ChatGPT plugin?** Monthly subscriptions are available through the dashboard. A public ChatGPT listing and hosted OAuth are not live; check current integration availability before making a promise.

## Four-week content distribution plan

Week 1: publish the product introduction and website-to-Markdown guide. Share the quickstart with developer communities where self-promotion is allowed. Use the launch copy as a draft, not an unsolicited message.

Week 2: explain Scrape vs. Map vs. Crawl. Link to each API reference. Invite concrete feedback through the source repository.

Week 3: share the source-aware RAG guide and its use-case page. Demonstrate source metadata and failure handling rather than an invented answer-quality benchmark.

Week 4: share structured extraction and MCP integration examples. Update content from observed user questions. Publish a billing or OAuth announcement only after the capability is live and verified.

## Measurement plan

Track landing-page visits, documentation visits, verified signups, first successful customer operation, API-key creation, first successful API call and return use. No conversion rate, traffic uplift or ranking forecast is asserted. Analytics and Search Console are not provisioned by this kit.

Use tagged links consistently in campaigns you actually publish. Keep sensitive URLs, keys, emails and scraped page content out of analytics events. Record campaign source, content and landing page so results can be compared when measurement is configured.

## Brand and claims

Product name: AIHackr. Palette: orange #e54b16, warm white #f9f9f7, forest ink #34432d. SVG wordmark/icon and a PNG social card are available at https://aihackr.com/media-kit.

Do not add fake customer logos, testimonials, reviews, growth metrics, performance comparisons, certifications, SLA claims or “unlimited” language. Do not imply Cloudflare sponsorship. Distinguish live capabilities from roadmap work in every channel.
