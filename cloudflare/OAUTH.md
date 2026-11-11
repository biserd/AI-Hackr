# OAuth account linking

This release adds MCP account linking to the existing plans and credit ledger. It uses the official `@cloudflare/workers-oauth-provider` 1.2.4, with the existing email sign-in, AccountDirectory and BrowserWorkspace. It introduces no external identity provider or additional hosting service.

## Endpoints and identity

Canonical issuer: `https://aihackr.com`. Resource/audience: `https://aihackr.com/mcp`. Staging uses its own origin for both, configured explicitly in `OAUTH_ISSUER`.

- `GET /.well-known/oauth-protected-resource/mcp` (and root alias): RFC 9728 metadata.
- `GET /.well-known/oauth-authorization-server`: RFC 8414 discovery.
- `GET/POST /oauth/authorize`: browser-bound consent, existing email sign-in, approval or denial.
- `POST /oauth/register`: RFC 7591 registration for compatible clients.
- `POST /oauth/token`: code exchange, refresh, and RFC 7009 revocation, as advertised by the official provider.
- `GET /connections`: customer application settings; its private list and disconnect operations are under `/oauth/connections`.

The authorization code flow requires S256 PKCE for every client, including confidential clients. The provider validates the exact registered redirect, resource and issuer; authorization responses include RFC 9207 `iss` and preserve client state. Consent shows the client metadata domain, the callback host, a warning for native loopback callbacks and requested permissions. Names submitted through DCR are explicitly unverified. Cancelling requires the browser-bound consent cookie but no sign-in. Approving requires the current account session and displayed user ID to match; cross-origin mutations and reused/expired handles fail.

Scopes are `account:read`, `web:read`, `crawl:read`, `crawl:write` and optional `offline_access`. Every MCP tool checks its own scope before touching the browser or private results. The normal connection requests profile and public-page access; clients can request crawl scopes separately. `get_account` is a designated OpenAI profile tool with a stable opaque account UUID, optional display email and a constrained output schema. Profile fields contain no API keys or billing credentials.

OAuth tokens are accepted only at the canonical `/mcp` resource. They do not authorize REST, billing, API-key management or website sessions. Existing customer API keys continue to work with REST and MCP. The eight upstream browser/crawl tool implementations are unchanged; AIHackr adds the profile tool and permission wrapper.

## Client registration policy

ChatGPT's public CIMD URLs under `https://chatgpt.com/oauth/…/client.json` are trusted. Metadata and any JWKS fetches use the provider's public-only fetch protection, enabled by `global_fetch_strictly_public`. Other clients use DCR. The provider supports public-client `none`, confidential-client secret methods and supported CIMD signed assertions. No private-use custom redirect scheme is enabled; native loopback redirects are supported.

Registered clients follow the provider's 90-day lifetime, renewed on successful use after half the lifetime. Refresh permission is explicit: without `offline_access`, no refresh token is issued. Access tokens last 15 minutes. Refresh-enabled grants last up to 30 days. Refresh tokens rotate using the provider's retry grace: the immediately previous token remains usable until the replacement is first used. Reconnecting requires a new consent when a grant expires. The UI can revoke all tokens for one connection immediately; a running request may still finish.

## Storage and operational controls

The official provider's KV-shaped API is adapted to the existing SQLite AccountDirectory storage. Token/code/secret hashing and encrypted props remain the official library's implementation. Protocol mutations, validation and expiry cleanup are serialized in the Durable Object, including provider `waitUntil` work. The adapter preserves prefix listings, cursors, metadata and logical TTLs, writes value/expiry index atomically, and sweeps expiry entries. There is no eventually consistent token cache between authorization and resource validation.

OAuth records have a separate `oauth-kv:<issuer-host>:` prefix. No existing user, trial, API-key, session or job record is reset. Raw tokens, refresh tokens, verifiers and client secrets are not logged or written into reports. Request bodies and record sizes are bounded. Registration has per-IP/hour and global/day caps; authorization has per-IP/hour and global/day caps; token requests are rate limited. The maximum is 20 active grants per customer. These launch controls can be reviewed as adoption grows.

## Verification and release

`node --test cloudflare/test/*.test.mjs` exercises the actual official provider with a test-only Workers import shim. It tests code/PKCE, wrong audiences and redirects, cookies/origin/account binding, replay, refresh, expiry, scope checks, revocation and namespace isolation. Production runs the real Workers implementation, not the test shim.

`node cloudflare/test/oauth-public-live.mjs` checks real public discovery, ChatGPT CIMD resolution, native DCR, consent binding and unauthenticated denial on staging. `oauth-live.mjs` is a real MCP SDK client: the owner approves the ordinary browser consent, it makes one public-page call in that customer's workspace, verifies profile/tool scopes, refresh/downscope/audience checks and revocation. Tokens stay in RAM. With `AIHACKR_REDEPLOY_CHECK=1`, it waits for the nonsecret `reports/oauth-resume.json` signal after an actual staging redeploy, then verifies the same token still works. It automatically revokes its connection after testing.

The source-bound release gate requires the OAuth public/live reports for current source, token persistence after redeploy, existing browser/MCP checks and customer portal evidence. A unit test pass or endpoint heartbeat alone does not mark OAuth production-ready. Do not put real credentials into test fixtures or receipts.

The portable plugin package uses discovery and contains no fixed tokens. The package declares the documented OpenAI OAuth/CIMD extension and requested scopes in mcp.json. Public submission requires the OpenAI portal domain challenge and reviewer materials.

References: [Cloudflare official provider](https://github.com/cloudflare/workers-oauth-provider), [OpenAI authentication](https://developers.openai.com/plugins/build/auth), [MCP authorization 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).

## Dedicated reviewer account

The /reviewer sign-in uses only plugin-review@aihackr.com and the independently generated reviewer credential. Configure REVIEWER_LOGIN_HASH as a secret and REVIEWER_LOGIN_EXPIRES_AT as an absolute UTC expiration. The account is created in a separate workspace after successful credential validation and uses the standard monthly free allowance. Its credentials never select another email account. Requests require a same-origin POST and use the ordinary sign-in rate limits and secure session cookie. Missing or expired configuration disables reviewer sign-in. The credential is supplied privately through the OpenAI review form. It is excluded from the package, repository and public reports.
