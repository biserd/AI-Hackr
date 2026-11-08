# AIHackr plugin development package

Remote endpoint: `https://aihackr.com/mcp` (Streamable HTTP).

This portable Agent Plugins package uses API-key Bearer authentication. Create a customer key at https://aihackr.com/dashboard, then store it in an API-key-capable MCP client's secret settings. The root MCP config references `AIHACKR_API_KEY`; use a client that supports environment expansion, or set the equivalent Authorization header through its secret settings. Do not send the literal placeholder. The package contains no credentials. Do not set authentication to `none` to work around a client limitation.

The root manifests validate against the canonical Agent Plugins 1.0.0 schemas. `openai-mcp.example.json` separately records the API-key auth declaration documented by OpenAI. It is an example, not an automatically loaded component: the canonical MCP schema currently rejects per-server `extensions`, despite the OpenAI-specific documentation describing them. Recheck this format when implementing OAuth and preparing public submission. Neither file asserts that the protected server is unauthenticated.

Official Cloudflare OSS tool handlers expose: `get_url_html_content`, `get_url_markdown`, `get_url_json`, `get_url_links`, `scrape_url_elements`, `start_crawl`, `get_crawl_result`, `cancel_crawl`. They share REST ownership, quotas and credit settlement. Attribution: https://github.com/cloudflare/mcp-server-cloudflare, upstream commit `a21972e219289337731a066befb5c66886b9ce7b`; original tool source is unchanged in the gateway repository.

## OAuth deferred

This is prepared source, not a published ChatGPT plugin. The current ChatGPT submission portal does not offer a fixed API-key connection flow. Before public submission:

- Add OAuth authorization-code + S256 PKCE, consent, short-lived audience-bound access tokens, refresh/revocation and per-user scopes.
- Implement protected-resource and authorization-server discovery, with a 401 Bearer discovery challenge. Use a supported registration method (CIMD or DCR); do not publish pretend endpoints.
- Map OAuth identities to the existing customer directory and workspace. REST and MCP must continue to use the same credit ledger.
- Replace `mcp.json` API-key auth with the implemented OAuth configuration; declare accurate tool security metadata and annotations.
- Publish actual privacy/terms pages, complete domain verification, add reviewer access and recording, test revocation/expired scopes, and submit through With MCP.

Official packaging and auth reference: https://developers.openai.com/plugins/build/plugins#configure-mcp-authentication

Portal limitations: https://developers.openai.com/plugins/deploy/submission#authentication-limitations

## Smoke/evaluation prompts

1. “Read https://fixtures.aihackr.com and return its JavaScript-rendered marker.” Expect `BROWSER_EXECUTED_JAVASCRIPT_42`, source citation and 1 credit.
2. “Extract the main heading from that URL as JSON.” Expect a bounded schema result and 5 credits.
3. “Crawl that site, maximum two pages.” Expect one job, terminal polling and at most 2 spent credits.
4. “Fetch http://169.254.169.254/latest/meta-data.” Expect rejection and no customer credit spend.
5. Revoke the connected customer key and retry. Expect authentication failure.
6. Ask a second account to retrieve the first account's job ID. Expect not found.
7. Cancel an in-progress crawl. Expect successful partial pages charged once and unused holds released after terminal reconciliation.

Client setup and tests must never include production credentials in a ZIP, repository or prompt.
