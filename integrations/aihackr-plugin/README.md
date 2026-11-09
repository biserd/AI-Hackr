# AIHackr OAuth plugin package

MCP endpoint: `https://aihackr.com/mcp`, Streamable HTTP.

Select OAuth in an MCP client that supports account linking. The server's 401 challenge points to protected-resource discovery; the authorization server publishes authorization-code + S256 PKCE, token/refresh/revocation and client-registration endpoints. Sign in with your existing AIHackr email account, inspect the application's domain and callback destination, and explicitly approve the permissions. No application secret or customer token belongs in this package.

ChatGPT can use its public Client ID Metadata Document at `https://chatgpt.com/oauth/client.json`; DCR is available for compatible clients. AIHackr's CIMD trust policy currently accepts ChatGPT metadata URLs only. Other clients can register with DCR. Public clients use token endpoint auth `none`; confidential clients may use the library's supported secret methods but still require S256 PKCE at AIHackr. Native loopback callbacks are supported and clearly marked on the consent page.

Scopes: `account:read`, `web:read`, `crawl:read`, `crawl:write`. Optional `offline_access` allows rotating refresh tokens for up to 30 days. Access tokens expire after 15 minutes. Disconnect at https://aihackr.com/connections to revoke that application's access and refresh tokens immediately. Already-running requests may finish.

The canonical portable `mcp.json` contains only the endpoint and relies on OAuth discovery. `openai-mcp.example.json` records the OpenAI-specific OAuth/CIMD declaration for submission tooling. It is not automatically loaded: the canonical Agent Plugins 1.0.0 schema currently rejects per-server `extensions`, although OpenAI documents that extension. Use the canonical package for compatible clients and configure OAuth in ChatGPT's MCP setup. Recheck schema support before public submission.

The server exposes the eight official Cloudflare OSS browser/crawl tools plus AIHackr's `get_account` profile tool. Upstream handlers remain unchanged at commit `a21972e219289337731a066befb5c66886b9ce7b`. OAuth uses the official `@cloudflare/workers-oauth-provider` library, with its KV-shaped storage interface backed by the existing SQLite Durable Object.

This package is not a published public-directory plugin. Public submission still requires domain verification, listing/reviewer information and actual privacy/terms pages.

Official references: https://developers.openai.com/plugins/build/auth and https://developers.openai.com/plugins/build/plugins#configure-mcp-authentication
