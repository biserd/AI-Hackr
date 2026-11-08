# Local validation receipt

8 November 2026, supported bundled Node **24.22.1**, Windows. All final deterministic suites pass: **37 tests, 0 failures**, approximately 43.39 seconds. Raw test output is included with the delivered evidence. Tests exercise embedded PostgreSQL constraints/transactions, REST, the official MCP SDK client, pinned Firecrawl JS SDK, signed OAuth tokens, signed sandbox webhook handlers, cache/freshness, permissions, monetary ceilings, cancellation, lease expiry and pagination.

- Existing scanner plus `/web-data`: TypeScript check and production build pass. Existing Vite large-chunk warning remains; it is not a deployment or functional failure.
- New service: TypeScript build/typecheck and ESLint pass.
- Plugin: portable plugin/MCP official schema validation and ZIP roundtrip pass, six packaged files. Actual installation is unrun.
- New service production dependency audit: **0 vulnerabilities reported** after patched Zod/Ajv/fflate updates. This audit does not certify the unchanged scanner dependency tree.
- Secret-pattern scan of new implementation source: no credential matches. Fake test values and secret-free templates are intentional.
- Guarded live HTTP smoke: example.com retrieved as Example Domain, 156 characters, source observation/hash saved. No paid provider was called.
- Fixture benchmark: 1,000 operations, 900 expected usable fixtures, 100 deliberate failures, 203 credits. p50 28.10 ms / p95 61.85 ms are local fixture-cycle measurements, not live web performance. Live economic results remain null/unrun.
- Browser preview tool timed out; UI visual/interaction QA is unrun.
- Docker/browser runtime, real PostgreSQL multi-process recovery, hosted OAuth callback, Stripe sandbox checkout transaction, actual ChatGPT/Codex, deployment, public review and representative live economics are unrun. See docs/status.md for exact unfinished engineering and external inputs.
