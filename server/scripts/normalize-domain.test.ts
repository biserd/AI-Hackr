/**
 * Lightweight unit test for `normalizeDomain` — guards against regressing
 * the YC tracking-parameter recovery (Task #15) and other real-world dirty
 * URLs we've seen in the bulk-import pipeline.
 *
 * Run with:  tsx server/scripts/normalize-domain.test.ts
 *
 * No test framework needed — uses `node:assert` so it works in any
 * environment that already has `tsx` installed for the importer.
 */
import assert from "node:assert/strict";
import { normalizeDomain } from "./import-companies";

interface Case {
  input: string;
  expect: string;
  why: string;
}

const cases: Case[] = [
  { input: "example.com", expect: "example.com", why: "bare hostname is a no-op" },
  { input: "https://example.com", expect: "example.com", why: "strip protocol" },
  { input: "https://www.example.com", expect: "example.com", why: "strip leading www." },
  { input: "https://example.com/path/to/page", expect: "example.com", why: "strip trailing path" },
  { input: "https://example.com:8080", expect: "example.com", why: "strip explicit port" },
  // Regression cases — these were the ~30 dropped YC rows in Task #15:
  { input: "https://sigmamind.ai?utm_source=yc&utm_medium=web", expect: "sigmamind.ai", why: "strip utm tracking params" },
  { input: "https://www.getofficely.com?utm_source=yc", expect: "getofficely.com", why: "strip utm + leading www" },
  { input: "https://munily.com/#/", expect: "munily.com", why: "strip hash fragment" },
  { input: "http://entvin.com?utm_source=yc", expect: "entvin.com", why: "strip utm on http://" },
  { input: "https://www.thesleepreset.com/?utm_source=yc", expect: "thesleepreset.com", why: "strip path + utm together" },
  { input: "https://co.dev/?ref=YC", expect: "co.dev", why: "strip ?ref param" },
  { input: "https://membo.ee?lang=en", expect: "membo.ee", why: "strip ?lang param" },
  // Co-listed URLs — YC sometimes lists multiple sites in one website field:
  { input: "https://pragmaticleaders.io, https://ostronaut.com", expect: "pragmaticleaders.io", why: "take first URL when comma-separated" },
  { input: "https:// , https://example.com", expect: "example.com", why: "skip empty leading URL with stray space" },
  { input: "https://a.com; https://b.com", expect: "a.com", why: "take first URL when semicolon-separated" },
  // Edge cases:
  { input: "  HTTPS://Example.COM/  ", expect: "example.com", why: "trim + lowercase" },
  { input: "", expect: "", why: "empty input returns empty (caller filters)" },
];

let failures = 0;
for (const c of cases) {
  try {
    const got = normalizeDomain(c.input);
    assert.equal(got, c.expect, `${c.why}\n   input:    ${JSON.stringify(c.input)}\n   got:      ${JSON.stringify(got)}\n   expected: ${JSON.stringify(c.expect)}`);
    console.log(`  ok  ${c.why}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL ${(err as Error).message}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures}/${cases.length} cases failed`);
  process.exit(1);
}
console.log(`\nall ${cases.length} normalizeDomain cases passed`);
process.exit(0);
