import { test } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./helpers.js";
test("REST workflows use real SQL persistence and bounded fixture providers", async (t) => {
  const h = await harness();
  t.after(h.close);
  await t.test("auth challenge and API keys are enforced", async () => {
    const r = await fetch(h.origin + "/v1/usage");
    assert.equal(r.status, 401);
    assert.match(r.headers.get("www-authenticate") ?? "", /resource_metadata/);
  });
  await t.test(
    "search does not scrape results and polling is free",
    async () => {
      const r = await h.request("/v1/search", {
        query: "installation",
        maxCredits: 2,
      });
      assert.equal(r.status, 202);
      await h.service.processOne();
      const state = await h.request(`/v1/jobs/${r.body.jobId}`);
      assert.equal(state.body.usage.creditsCharged, 2);
      assert.equal(h.providers.calls.retrieval, 0);
      const result = await h.request(`/v1/results/${state.body.resultIds[0]}`);
      assert.equal(result.body.data.results.length, 1);
      const before = (await h.store.usage(h.a)).balance;
      await h.request(`/v1/jobs/${r.body.jobId}`);
      await h.request(`/v1/results/${state.body.resultIds[0]}`);
      assert.equal((await h.store.usage(h.a)).balance, before);
    },
  );
  await t.test(
    "quote bound to exact args; idempotency headers must agree",
    async () => {
      const q = await h.request("/v1/quote", {
        operation: "scrape",
        input: {
          url: "https://fixtures.aihackr.test/products/1",
          render: "http",
          maxCredits: 1,
        },
      });
      const mismatch = await h.request("/v1/scrape", {
        url: "https://fixtures.aihackr.test/products/2",
        render: "http",
        maxCredits: 1,
        quoteId: q.body.quoteId,
      });
      assert.equal(mismatch.status, 400);
      const conflict = await h.request(
        "/v1/scrape",
        {
          url: "https://fixtures.aihackr.test/products/1",
          idempotencyKey: "one",
        },
        h.keyA.key,
        "POST",
        { "Idempotency-Key": "two" },
      );
      assert.equal(conflict.status, 409);
    },
  );
  await t.test(
    "three product research returns observed price strings and source evidence",
    async () => {
      const r = await h.request("/v1/research", {
        objective: "Collect names and prices",
        startingUrls: [1, 2, 3].map(
          (n) => `https://fixtures.aihackr.test/products/${n}`,
        ),
        schema: {
          type: "object",
          properties: { name: { type: "string" }, price: { type: "string" } },
          required: ["name", "price"],
        },
        maxPages: 3,
        maxCredits: 24,
      });
      assert.equal(r.status, 202);
      await h.service.processOne();
      const s = await h.store.status(h.a, r.body.jobId);
      assert.equal(s.status, "completed");
      assert.equal(s.usage.creditsCharged, 12);
      const bodies = await Promise.all(
        s.resultIds.map((rid: string) => h.service.getResult(h.a, rid)),
      );
      const prices = bodies
        .filter((x) => x.data.json)
        .map((x) => x.data.json.price);
      assert.deepEqual(prices, ["$125", "€48", "£90"]);
      for (const x of bodies) assert.equal(x.sources.length, 1);
    },
  );
  await t.test(
    "crawl honors page bounds and returns partial status at limit",
    async () => {
      const r = await h.request("/v1/crawl", {
        url: "https://fixtures.aihackr.test/docs/0",
        maxPages: 3,
        maxDepth: 1,
        render: "http",
        maxCredits: 3,
      });
      assert.equal(r.status, 202);
      await h.service.processOne();
      const s = await h.store.status(h.a, r.body.jobId);
      assert.equal(s.progress.completedUnits, 3);
      assert.equal(s.status, "partial");
      assert.equal(s.stopReason, "PAGE_LIMIT");
      assert.equal(s.usage.creditsCharged, 3);
    },
  );
  await t.test(
    "known unsupported providers fail before reserving funds",
    async () => {
      const r = await h.request("/v1/scrape", {
        url: "https://example.com",
        render: "browser",
      });
      assert.equal(r.status, 503);
      assert.equal((await h.store.usage(h.a)).reserved, 0);
    },
  );
  await t.test("foreign jobs and private URLs fail safely", async () => {
    const r = await h.request("/v1/scrape", {
      url: "http://169.254.169.254",
      maxCredits: 5,
    });
    assert.equal(r.status, 403);
    const jobs = await h.request("/v1/jobs");
    const foreign = await h.request(
      `/v1/jobs/${jobs.body.jobs[0].id}`,
      undefined,
      h.keyB.key,
    );
    assert.equal(foreign.status, 404);
  });
  await t.test(
    "untrusted stored HTML is transported as data; original fixture instructions do not change charges",
    async () => {
      const start = await h.service.start(h.a, "scrape", {
        url: "https://fixtures.aihackr.test/injection",
        render: "http",
        maxCredits: 1,
      });
      await h.service.processOne();
      const s = await h.store.status(h.a, start.jobId),
        body = await h.service.getResult(h.a, s.resultIds[0]);
      assert.match(body.data.markdown, /buy credits/);
      assert.equal(s.usage.creditsCharged, 1);
      assert.equal(h.providers.calls.extraction, 3);
    },
  );
});
