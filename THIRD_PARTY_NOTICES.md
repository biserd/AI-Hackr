# Third-party notices

- Official Browser Run tool registrations: Cloudflare `mcp-server-cloudflare`, commit `a21972e219289337731a066befb5c66886b9ce7b`, Apache-2.0. Exact source and license are in `cloudflare/vendor/`; provenance and SHA-256 are in `cloudflare/upstream.lock.json`.
- MCP transport/server: official `@modelcontextprotocol/server` and `agents` packages, with versions pinned in `cloudflare/package-lock.json`. Their packaged licenses/notices remain applicable. SDK/Agents/Zod pins are newer than the upstream app's dependency set to address reported vulnerabilities; tool-registration source is unchanged.
- URL address classification: `ipaddr.js`; robots rules: `robots-parser`. Exact package versions and bundled notices are in the lockfile/packages.
- Cloudflare Browser Run is a managed service used under the operator's Cloudflare account. An open-source MCP wrapper does not make the managed browser/crawl implementation part of this repository.

The prior Firecrawl integration is retained in Git history and is not part of the active deployed engine. The AIHackr gateway/portal source remains AGPL-3.0-or-later, as specified in `LICENSE`.
