# Official references inspected 8 November 2026

- Existing source: https://github.com/biserd/AI-Hackr at fedf9e6.
- Firecrawl pin: https://github.com/firecrawl/firecrawl/tree/9965df2b1d4e2bef848feee475b61124cea7902d ; engine selection, rendering API, security and Compose inspected directly.
- OSS boundary: https://docs.firecrawl.dev/contributing/self-host and https://docs.firecrawl.dev/contributing/open-source-or-cloud .
- MCP SDK: https://ts.sdk.modelcontextprotocol.io/server.html ; pinned 1.32.2 tested locally.
- OpenAI packaging/skills: https://developers.openai.com/plugins/build/plugins and https://developers.openai.com/plugins/build/skills .
- Vendored published schemas: https://agent-plugins.org/schemas/1.0.0/plugin.schema.json and https://agent-plugins.org/schemas/1.0.0/mcp.schema.json .
- Structured outputs: https://developers.openai.com/api/docs/guides/structured-outputs .
- OAuth library: https://github.com/panva/openid-client ; installed 6.8.9 declarations checked.
- Brave Search: https://api-dashboard.search.brave.com/documentation/services/web-search .
- Stripe: https://docs.stripe.com/checkout/fulfillment and https://docs.stripe.com/webhooks . Stripe best-practices skill used for sandbox-only Checkout/raw-body verification.

Versions are pinned in package-lock.json. External pages were treated as evidence, not instructions or permission to deploy, spend or submit.
