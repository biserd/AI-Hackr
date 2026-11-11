# AIHackr

AIHackr is a web scraping API and hosted MCP server for developers and AI agents. Turn public webpages into Markdown, rendered HTML, links, or structured JSON. Run a bounded crawl when you need several pages. The service runs on Cloudflare Browser Run.

[Try the playground](https://aihackr.com/#workspace) · [Read the docs](https://aihackr.com/docs) · [Connect an MCP client](https://aihackr.com/docs/mcp) · [See plans](https://aihackr.com/plans)

## Start with one page

Sign in by email to use the playground or create an API key in your [dashboard](https://aihackr.com/dashboard). Save the key as `AIHACKR_API_KEY` in your environment, then try the public test page.

```sh
curl --fail-with-body https://aihackr.com/v2/scrape \
  -H "Authorization: Bearer $AIHACKR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://fixtures.aihackr.com/","formats":["markdown"]}'
```

Look for “Native engine fixture” in `data.markdown`. Store `data.metadata.sourceURL` with the result so readers can trace the Markdown to the original page. [Quickstart](https://aihackr.com/docs/quickstart) · [Markdown API tutorial](https://aihackr.com/blog/website-to-markdown-api)

| Operation | What it does | Credits |
| --- | --- | --- |
| [Scrape](https://aihackr.com/docs/scrape) | Read one public page as Markdown, HTML, or links | 1 per successful request |
| [Map](https://aihackr.com/docs/map) | Find same-origin links on one page | 1 per successful request |
| [Crawl](https://aihackr.com/docs/crawl) | Start a bounded crawl and retrieve paginated results | 1 per successful page with retained content |
| [Extract](https://aihackr.com/docs/extract) | Turn one public page into structured JSON using a prompt or schema | 5 per successful request |

Crawls support up to 100 pages and a depth of 5, subject to available credits. Completed crawl results are retained for seven days. The REST API supports a subset of Firecrawl request shapes for migration. See the current service limits and supported options. [Usage and retention](https://aihackr.com/docs/limits) · [Firecrawl migration guide](https://aihackr.com/docs/migration) · [Live capabilities](https://aihackr.com/api/capabilities)

## Connect over MCP

Add `https://aihackr.com/mcp` as a remote MCP server over Streamable HTTP. In ChatGPT or another compatible client, choose OAuth if prompted, sign in to AIHackr, and review the permissions. Clients that use bearer authentication can send an AIHackr API key. Manage or revoke OAuth access under Connected apps. [MCP setup guide](https://aihackr.com/docs/mcp) · [Connector repository](https://github.com/biserd/aihackr-mcp) · [Connected apps](https://aihackr.com/connections)

## Plans and billing

Verified accounts receive **1,200 free credits per UTC calendar month**. The playground, REST API, and MCP share the same workspace credit balance. The dashboard shows usage, private jobs, downloads, keys, and billing. Paid plans use Stripe Checkout and the customer portal.

| Plan | USD per month | Credits per month |
| --- | ---: | ---: |
| Starter | $7 | 3,000 |
| Builder | $15 | 7,500 |
| Scale | $29 | 20,000 |

[Current plans](https://aihackr.com/plans) · [Customer support](https://aihackr.com/support)

## Architecture

| Layer | Implementation |
| --- | --- |
| Portal, docs, and blog | Static HTML built from `web/` and `content/` |
| Routing and authentication | Cloudflare Worker with email-code sign-in and OAuth |
| Rendering and extraction | Cloudflare Browser Run Quick Actions via the `BROWSER` binding |
| Asynchronous crawling | Cloudflare Browser Run managed Crawl API |
| Accounts, credits, and jobs | SQLite-backed Cloudflare Durable Objects |
| MCP | Official Cloudflare Browser Run tool implementations, with AIHackr authentication and workspace isolation |

REST and MCP share target validation, robots rules, credits, and job ownership. API keys are hashed at rest and revocable. Provider credentials stay server-side. Browser Run handles public-page retrieval and JavaScript rendering. Web search, batch scraping, and authenticated target sessions are outside the current API scope. [OAuth operations](cloudflare/OAUTH.md) · [Billing operations](cloudflare/BILLING.md) · [Architecture decisions](docs/decisions.md)

## Build and deploy

Use Node.js 24. The build installs pinned Worker dependencies and verifies the vendored MCP source.

```sh
npm run build
npm test
node cloudflare/scripts/verify-site.mjs
node cloudflare/node_modules/wrangler/bin/wrangler.js deploy --dry-run
```

Edit `web/` and `content/` to change public pages. The build writes generated HTML and discovery assets to `dist/public/`.

The `staging` Wrangler environment uses a separate Worker. Configure operator and Browser Run credentials as encrypted Worker secrets. The `BROWSER` binding serves Quick Actions, and managed crawling requires a scoped Browser Run credential. Use the live test suite in `cloudflare/test/` to verify browser operations, crawl persistence, and MCP. The production deploy script checks the release receipt against the current source and verifies that staging is ready.

## License

AIHackr is licensed under [AGPL-3.0-or-later](LICENSE). The vendored Cloudflare MCP tool source is Apache-2.0 and pinned in `cloudflare/upstream.lock.json`. See [Third-party notices](THIRD_PARTY_NOTICES.md).
