import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalUrl,
  publicAddress,
  resolvePublic,
  target,
} from "../src/security.js";
import { ceiling, parse, validateSchema, hash } from "../src/contracts.js";
import { fixturePage, normalizeHtml, Providers } from "../src/providers.js";
test("SSRF blocks encoded IPv4, IPv6, metadata, credentials, ports and query secrets", () => {
  for (const url of [
    "http://127.0.0.1",
    "http://2130706433",
    "http://0x7f000001",
    "http://0177.0.0.1",
    "http://[::1]",
    "http://[::ffff:127.0.0.1]",
    "http://169.254.169.254/latest",
    "http://10.1.2.3",
    "http://224.1.1.1",
    "http://100.64.0.1",
    "http://192.0.0.1",
    "http://example.com:8080",
    "file:///etc/passwd",
    "https://user:pass@example.com",
    "https://example.com?access_token=secret",
    "https://metadata.google.internal",
  ])
    assert.throws(() => target(url), url);
  assert.equal(publicAddress("8.8.8.8"), true);
  assert.equal(publicAddress("2001:db8::1"), false);
});
test("mixed DNS answers and simulated DNS rebinding are rejected", async () => {
  await assert.rejects(
    resolvePublic(new URL("https://example.com"), (async () => [
      { address: "8.8.8.8", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]) as any),
  );
  await assert.rejects(
    resolvePublic(new URL("https://example.com"), (async () => [
      { address: "169.254.169.254", family: 4 },
    ]) as any),
  );
});
test("canonicalization preserves meaningful queries and drops trackers", () =>
  assert.equal(
    canonicalUrl("https://EXAMPLE.com/a?b=2&utm_source=test&a=1#frag"),
    "https://example.com/a?a=1&b=2",
  ));
test("strict operation bounds reject oversize requests and unknown options", () => {
  assert.throws(() => parse("search", { query: "x", limit: 21 }));
  assert.throws(() =>
    parse("crawl", { url: "https://example.com", maxPages: 101 }),
  );
  assert.throws(() =>
    parse("scrape", { url: "https://example.com", headers: { cookie: "x" } }),
  );
  assert.throws(() =>
    parse("extract", {
      url: "https://example.com",
      resultId: "x",
      schema: { type: "object" },
    }),
  );
  assert.equal(
    ceiling(
      "scrape",
      parse("scrape", { url: "https://example.com", render: "browser" }),
    ),
    5,
  );
});
test("schema rejects remote refs, unbounded arrays, recursion and excessive depth", () => {
  for (const s of [
    { $ref: "https://evil.example/schema" },
    { type: "array", items: { type: "string" } },
    { $defs: { x: { $ref: "#/$defs/x" } } },
  ])
    assert.throws(() => validateSchema(s));
});
test("canonical hashes ignore object property insertion order", () =>
  assert.equal(
    hash({ b: 1, a: { y: 2, x: 3 } }),
    hash({ a: { x: 3, y: 2 }, b: 1 }),
  ));
test("challenge/login/error fixtures fail rather than returning usable results", () => {
  for (const path of [
    "login",
    "challenge",
    "missing",
    "robots-blocked",
    "javascript",
  ])
    assert.throws(() => fixturePage(`https://fixtures.aihackr.test/${path}`));
  assert.throws(() =>
    normalizeHtml(
      "<title>Just a moment</title><main>Verify you are human with captcha.</main>",
      "https://example.com",
      "https://example.com",
      "http",
    ),
  );
});
test("extraction missingness returns supported partial data without invention", async () => {
  const p = new Providers({
    fixture: true,
    httpEnabled: false,
    httpCost: 0,
    searchCost: 0,
    engineVerified: false,
  });
  const page = fixturePage("https://fixtures.aihackr.test/products/1");
  await assert.rejects(
    p.extract(page, {
      type: "object",
      properties: { name: { type: "string" }, rating: { type: "number" } },
      required: ["name", "rating"],
    }),
    (e: any) =>
      e.code === "EXTRACTION_INCOMPLETE" &&
      e.details.partialData.name === "Copper lamp" &&
      e.details.missingPaths.includes("/rating"),
  );
  const r = await p.extract(page, {
    type: "object",
    properties: {
      name: { type: "string" },
      rating: { type: ["number", "null"] },
    },
    required: ["name", "rating"],
  });
  assert.equal(r.json.rating, null);
  assert.equal(r.fieldEvidence["/name"].excerpt, "Copper lamp");
});
test("web prompt injection cannot invoke providers or billing", async () => {
  const p = new Providers({
    fixture: true,
    httpEnabled: false,
    httpCost: 0,
    searchCost: 0,
    engineVerified: false,
  });
  const page = await p.retrieve(
    "https://fixtures.aihackr.test/injection",
    "http",
  );
  assert.match(page.text, /reveal credentials/);
  assert.equal(p.calls.search, 0);
  assert.equal(p.calls.extraction, 0);
});
