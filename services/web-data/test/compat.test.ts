import { test } from "node:test";
import assert from "node:assert/strict";
import Firecrawl from "@mendable/firecrawl-js";
import { harness } from "./helpers.js";
test("pinned Firecrawl SDK base URL override and strict compatibility subset", async (t) => {
  const h = await harness();
  t.after(h.close);
  let busy = false;
  const worker = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await h.service.processOne();
    } finally {
      busy = false;
    }
  }, 25);
  t.after(() => clearInterval(worker));
  const client = new Firecrawl({
    apiKey: h.keyA.key,
    apiUrl: `${h.origin}/compat/firecrawl`,
  });
  const result = await client.scrape(
    "https://fixtures.aihackr.test/products/1",
    { formats: ["markdown"], onlyMainContent: true, maxAge: 0 },
  );
  assert.match(result.markdown ?? "", /Copper lamp/);
  const bad = await h.request("/compat/firecrawl/v2/scrape", {
    url: "https://fixtures.aihackr.test",
    actions: [{ type: "click", selector: "button" }],
  });
  assert.equal(bad.status, 422);
  assert.equal(bad.body.error.code, "UNSUPPORTED_OPTION");
  const u = await h.store.usage(h.a);
  assert.equal(u.balance, 99);
});
