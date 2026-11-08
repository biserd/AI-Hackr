import { test } from "node:test";
import assert from "node:assert/strict";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFile } from "node:fs/promises";
import { parse } from "../services/web-data/src/contracts";
import { cloudflareStore } from "../services/web-data/src/cloudflare-store";
import { Service } from "../services/web-data/src/service";
import { Providers } from "../services/web-data/src/providers";
import { Billing } from "../services/web-data/src/billing";
test("real workerd SQLite Durable Object: atomic wallets, jobs, replay, persistence, tenant isolation and refunds", async (t) => {
  const manifest = JSON.parse(
    await readFile(".wrangler/web-data-test/bundle-meta.json", "utf8"),
  );
  const script = Object.keys(manifest.outputs).find((n) => n.endsWith(".js"));
  if (!script) throw new Error("Missing Worker bundle");
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: "web-data-test",
          bindings: { WEB_DATA_STORAGE_TOKEN: "local-storage-test-token" },
          modules: true,
          scriptPath: "worker/" + script,
          compatibilityDate: "2026-08-23",
          compatibilityFlags: ["nodejs_compat"],
          durableObjects: {
            WEB_DATA_STORE: { className: "WebDataStore", useSQLite: true },
          },
        },
      ],
    }),
  );
  t.after(() => mf.dispose());
  const rpc = async (method: string, ...args: any[]) => {
    const r = await mf.dispatchFetch("https://local.test/rpc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AIHackr-Storage": "local-storage-test-token",
      },
      body: JSON.stringify({ method, args }),
    });
    const body = (await r.json()) as any;
    if (!r.ok) throw Object.assign(new Error(body.error?.message), body.error);
    return body.value;
  };
  const unauthorized = await mf.dispatchFetch("https://local.test/rpc", {
    method: "POST",
    body: JSON.stringify({ method: "query", args: ["SELECT 1", []] }),
  });
  assert.equal(unauthorized.status, 401);
  const a = await rpc("provision", "cf-a"),
    b = await rpc("provision", "cf-b");
  await rpc("provision", "cf-a");
  assert.equal((await rpc("usage", a)).balance, 100);
  const args = parse("scrape", {
    url: "https://example.com",
    render: "http",
    maxCredits: 1,
    idempotencyKey: "cf-once",
  });
  const first = await rpc("reserve", a, "scrape", args, 50000);
  assert.equal(
    (await rpc("reserve", a, "scrape", args, 50000)).job.id,
    first.job.id,
  );
  await assert.rejects(
    rpc(
      "reserve",
      a,
      "scrape",
      { ...args, url: "https://other.example" },
      50000,
    ),
    (e: any) => e.code === "IDEMPOTENCY_CONFLICT",
  );
  assert.equal((await rpc("usage", a)).reserved, 1);
  const job = await rpc("claim");
  await rpc("unit", job, "page", 1, 100, {
    data: { title: "Real SQLite transaction" },
  });
  await rpc("settle", job.id, "completed", null, job.lease_token);
  await rpc("settle", job.id, "completed", null, job.lease_token);
  assert.equal((await rpc("usage", a)).balance, 99);
  assert.equal((await rpc("usage", a)).reserved, 0);
  await assert.rejects(rpc("getJob", b, job.id), (e: any) => e.status === 404);
  const batch = Array.from({ length: 6 }, (_, i) =>
    rpc(
      "reserve",
      a,
      "crawl",
      parse("crawl", {
        url: "https://example.com",
        maxPages: 20,
        render: "http",
        maxCredits: 20,
        idempotencyKey: `cf-concurrent-${i}`,
      }),
      50000,
    ),
  );
  const results = await Promise.allSettled(batch);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 4);
  assert.equal((await rpc("usage", a)).reserved, 80);
  for (const r of results)
    if (r.status === "fulfilled") await rpc("cancel", a, r.value.job.id);
  assert.equal((await rpc("usage", a)).reserved, 0);
  const result = (await rpc("status", a, job.id)).resultIds[0];
  await assert.rejects(rpc("result", b, result), (e: any) => e.status === 404);
  assert.equal(
    (await rpc("result", a, result)).body.data.title,
    "Real SQLite transaction",
  );
  await assert.rejects(
    rpc("batch", [
      {
        sql: "UPDATE wd_wallets SET balance=500 WHERE tenant=$1",
        params: [a.tenant],
      },
      { sql: "DELETE FROM wd_ledger" },
    ]),
  );
  assert.equal((await rpc("usage", a)).balance, 99);
  const cached = {
    source: { observedAt: new Date().toISOString() },
    text: "durable cache",
  };
  await rpc("cachePut", a, "cache-key", cached);
  assert.equal(
    (await rpc("cache", a, "cache-key", 3600)).text,
    "durable cache",
  );
  await rpc("reconcile");
  const remote = cloudflareStore(
    new URL("/rpc", await mf.ready).href,
    "local-storage-test-token",
  );
  const principal = await remote.provision("cf-service");
  const service = new Service(
    remote,
    new Providers({
      fixture: true,
      httpEnabled: false,
      httpCost: 0,
      searchCost: 0,
      engineVerified: false,
    }),
  );
  const started = await service.start(principal, "research", {
    objective: "Compare product prices",
    startingUrls: [1, 2, 3].map(
      (i) => `https://fixtures.aihackr.test/products/${i}`,
    ),
    maxPages: 3,
    schema: {
      type: "object",
      properties: { name: { type: "string" }, price: { type: "string" } },
      required: ["name", "price"],
    },
    maxCredits: 24,
  });
  await service.processOne();
  const status = await remote.status(principal, started.jobId);
  assert.equal(status.status, "completed");
  assert.equal(status.usage.creditsCharged, 12);
  const bodies = await Promise.all(
    status.resultIds.map((result: string) =>
      service.getResult(principal, result),
    ),
  );
  assert.deepEqual(
    bodies.filter((x) => x.data.json).map((x) => x.data.json.price),
    ["$125", "€48", "£90"],
  );
  await remote.batch([
    {
      sql: "INSERT INTO wd_payments(session,tenant) VALUES($1,$2)",
      params: ["cs_cf_test", principal.tenant],
    },
  ]);
  const event: any = {
    id: "evt_cf_test",
    type: "checkout.session.completed",
    livemode: false,
    data: {
      object: {
        id: "cs_cf_test",
        payment_status: "paid",
        amount_total: 1000,
        currency: "usd",
        metadata: { tenant: principal.tenant },
        payment_intent: "pi_cf_test",
      },
    },
  };
  const billing = new Billing(remote);
  await billing.event(event);
  await billing.event(event);
  assert.equal((await remote.usage(principal)).balance, 12588);
  await remote.linkOAuth(
    "https://issuer.test",
    "subject",
    "client",
    principal.tenant,
  );
  await assert.rejects(
    remote.linkOAuth("https://issuer.test", "subject", "client", "cf-a"),
  );
});
