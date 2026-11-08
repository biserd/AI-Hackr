import { test } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./helpers.js";
import { parse } from "../src/contracts.js";
import { Billing } from "../src/billing.js";
test("transactional wallet, jobs, retention, payment replay and failure recovery", async (t) => {
  const h = await harness();
  t.after(h.close);
  await t.test("verified trial is granted once", async () => {
    await h.store.provision(h.a.tenant);
    assert.equal((await h.store.usage(h.a)).balance, 100);
  });
  await t.test("quote does not launch retrieval or reserve funds", async () => {
    const q = await h.service.quote(h.a, {
      operation: "scrape",
      input: {
        url: "https://fixtures.aihackr.test/products/1",
        render: "http",
        maxCredits: 1,
      },
    });
    assert.equal(q.maxCredits, 1);
    assert.equal(h.providers.calls.retrieval, 0);
    assert.equal((await h.store.usage(h.a)).reserved, 0);
  });
  let jobId = "";
  await t.test(
    "same idempotency hash replays and changed arguments conflict",
    async () => {
      const args = {
        url: "https://fixtures.aihackr.test/products/1",
        render: "http",
        maxCredits: 1,
        idempotencyKey: "stable-one",
      };
      const first = await h.service.start(h.a, "scrape", args);
      jobId = first.jobId;
      const second = await h.service.start(h.a, "scrape", args);
      assert.equal(first.jobId, second.jobId);
      await assert.rejects(
        h.service.start(h.a, "scrape", {
          ...args,
          url: "https://fixtures.aihackr.test/products/2",
        }),
        (e: any) => e.code === "IDEMPOTENCY_CONFLICT",
      );
    },
  );
  await t.test(
    "duplicate workers cannot settle the same job twice",
    async () => {
      const job = await h.store.claim();
      await h.service.execute(job);
      await Promise.all([
        h.store.settle(job.id, "completed", null, job.lease_token),
        h.store.settle(job.id, "completed", null, job.lease_token),
      ]);
      const usage = await h.store.usage(h.a);
      assert.equal(usage.balance, 99);
      assert.equal(usage.reserved, 0);
      const status = await h.store.status(h.a, jobId);
      assert.equal(status.usage.creditsCharged, 1);
    },
  );
  await t.test("tenant B cannot inspect A job/result/quote", async () => {
    await assert.rejects(
      h.store.status(h.b, jobId),
      (e: any) => e.status === 404,
    );
    const s = await h.store.status(h.a, jobId);
    await assert.rejects(
      h.service.getResult(h.b, s.resultIds[0]),
      (e: any) => e.status === 404,
    );
    const q = await h.store.quote(
      h.a,
      "scrape",
      parse("scrape", {
        url: "https://fixtures.aihackr.test/products/1",
        render: "http",
        maxCredits: 1,
      }),
    );
    await assert.rejects(
      h.service.start(h.b, "scrape", {
        url: "https://fixtures.aihackr.test/products/1",
        render: "http",
        maxCredits: 1,
        quoteId: q.quoteId,
      }),
      (e: any) => e.status === 404,
    );
  });
  await t.test(
    "cache preserves observation time; fresh-only retrieves again",
    async () => {
      const old = (
        await h.service.getResult(
          h.a,
          (await h.store.status(h.a, jobId)).resultIds[0],
        )
      ).sources[0].observedAt;
      const calls = h.providers.calls.retrieval;
      const started = await h.service.start(h.a, "scrape", {
        url: "https://fixtures.aihackr.test/products/1",
        render: "http",
        maxCredits: 1,
      });
      await h.service.processOne();
      const cached = await h.service.getResult(
        h.a,
        (await h.store.status(h.a, started.jobId)).resultIds[0],
      );
      assert.equal(cached.cache.hit, true);
      assert.equal(cached.sources[0].observedAt, old);
      assert.equal(cached.usage.creditsCharged, 0);
      assert.equal(h.providers.calls.retrieval, calls);
      await h.service.start(h.a, "scrape", {
        url: "https://fixtures.aihackr.test/products/1",
        render: "http",
        maxAgeSeconds: 0,
        maxCredits: 1,
      });
      await h.service.processOne();
      assert.equal(h.providers.calls.retrieval, calls + 1);
    },
  );
  await t.test("concurrent reservations cannot overdraw funds", async () => {
    const p = await h.store.provision("concurrency");
    await h.db.tx((q) =>
      q.query("UPDATE wd_wallets SET balance=3 WHERE tenant=$1", [p.tenant]),
    );
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) =>
        h.service.start(p, "scrape", {
          url: "https://fixtures.aihackr.test/products/1",
          render: "http",
          maxCredits: 1,
          idempotencyKey: `concurrent-${i}`,
        }),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 3);
    assert.equal((await h.store.usage(p)).spendable, 0);
    for (const r of results)
      if (r.status === "fulfilled") await h.store.cancel(p, r.value.jobId);
    assert.equal((await h.store.usage(p)).reserved, 0);
  });
  await t.test(
    "canceled queued jobs release the full reservation",
    async () => {
      const start = await h.service.start(h.a, "crawl", {
        url: "https://fixtures.aihackr.test",
        render: "http",
        maxPages: 3,
        maxCredits: 3,
      });
      await h.store.cancel(h.a, start.jobId);
      assert.equal((await h.store.status(h.a, start.jobId)).status, "canceled");
      assert.equal((await h.store.usage(h.a)).reserved, 0);
    },
  );
  await t.test(
    "lease expiry settles successful units and blocks a late worker",
    async () => {
      const start = await h.service.start(h.a, "scrape", {
        url: "https://fixtures.aihackr.test/products/2",
        render: "http",
        maxCredits: 1,
      });
      const worker = await h.store.claim();
      assert.equal(worker.id, start.jobId);
      await h.db.tx((q) =>
        q.query(
          "UPDATE wd_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",
          [worker.id],
        ),
      );
      await h.store.reconcile();
      assert.equal((await h.store.status(h.a, start.jobId)).status, "failed");
      await assert.rejects(h.store.unit(worker, "late", 1, 0, {}));
      assert.equal((await h.store.usage(h.a)).reserved, 0);
    },
  );
  await t.test(
    "expired owned results are distinct from tenant-safe missing results",
    async () => {
      const s = await h.store.status(h.a, jobId);
      await h.db.tx((q) =>
        q.query(
          "UPDATE wd_results SET expires_at=now()-interval '1 second' WHERE id=$1",
          [s.resultIds[0]],
        ),
      );
      await assert.rejects(
        h.service.getResult(h.a, s.resultIds[0]),
        (e: any) => e.code === "RESULT_EXPIRED",
      );
      await assert.rejects(
        h.service.getResult(h.b, s.resultIds[0]),
        (e: any) => e.status === 404,
      );
    },
  );
  await t.test(
    "signed webhooks grant once across duplicate and out-of-order events",
    async () => {
      const billing = new Billing(
        h.store,
        "sk_test_fixture_value",
        "whsec_fixture",
      );
      await h.db.tx((q) =>
        q.query("INSERT INTO wd_payments(session,tenant) VALUES($1,$2)", [
          "cs_fixture",
          h.b.tenant,
        ]),
      );
      const evt: any = {
        id: "evt_fixture",
        type: "checkout.session.completed",
        livemode: false,
        data: {
          object: {
            id: "cs_fixture",
            payment_status: "paid",
            amount_total: 1000,
            currency: "usd",
            metadata: { tenant: h.b.tenant },
            payment_intent: "pi_fixture",
          },
        },
      };
      const raw = Buffer.from(JSON.stringify(evt));
      const signature = billing.stripe!.webhooks.generateTestHeaderString({
        payload: raw.toString(),
        secret: "whsec_fixture",
      });
      await billing.webhook(raw, signature);
      await billing.webhook(raw, signature);
      await billing.event({
        ...evt,
        id: "evt_async",
        type: "checkout.session.async_payment_succeeded",
      });
      assert.equal((await h.store.usage(h.b)).balance, 12600);
      await assert.rejects(billing.webhook(raw, "invalid"));
      await billing.event({
        id: "evt_refund",
        type: "charge.refunded",
        livemode: false,
        data: {
          object: { payment_intent: "pi_fixture", amount_refunded: 1000 },
        },
      } as any);
      await billing.event({ ...evt, id: "evt_paid_replay" });
      assert.equal((await h.store.usage(h.b)).balance, 100);
    },
  );
  await t.test("ledger history cannot be rewritten", async () => {
    await assert.rejects(h.db.tx((q) => q.query("DELETE FROM wd_ledger")));
  });
  await t.test(
    "quote expiry and connection daily limits reject before external work",
    async () => {
      const quote = await h.store.quote(
        h.a,
        "scrape",
        parse("scrape", {
          url: "https://fixtures.aihackr.test/products/1",
          render: "http",
          maxCredits: 1,
        }),
      );
      await h.db.tx((q) =>
        q.query(
          "UPDATE wd_quotes SET expires_at=now()-interval '1 second' WHERE id=$1",
          [quote.quoteId],
        ),
      );
      await assert.rejects(
        h.service.start(h.a, "scrape", {
          url: "https://fixtures.aihackr.test/products/1",
          render: "http",
          maxCredits: 1,
          quoteId: quote.quoteId,
        }),
        (e: any) => e.code === "QUOTE_EXPIRED",
      );
      const p = await h.store.provision("daily-test");
      await h.db.tx((q) =>
        q.query("UPDATE wd_connections SET daily_cap=0 WHERE tenant=$1", [
          p.tenant,
        ]),
      );
      await assert.rejects(
        h.service.start(p, "scrape", {
          url: "https://fixtures.aihackr.test/products/1",
          render: "http",
          maxCredits: 1,
        }),
        (e: any) => e.code === "BUDGET_EXCEEDED",
      );
      assert.equal((await h.store.usage(p)).reserved, 0);
    },
  );
  await t.test(
    "running cancellation settles started successful units once",
    async () => {
      const p = await h.store.provision("running-cancel");
      const start = await h.service.start(p, "scrape", {
        url: "https://fixtures.aihackr.test/products/1",
        render: "http",
        maxCredits: 1,
      });
      const job = await h.store.claim();
      await h.store.cancel(p, start.jobId);
      assert.equal((await h.store.status(p, start.jobId)).status, "running");
      await h.store.unit(
        job,
        "started-before-cancel",
        1,
        0,
        h.service.envelope(job, { text: "already started" }, [], 1),
      );
      await h.store.settle(job.id, "completed", null, job.lease_token);
      const state = await h.store.status(p, start.jobId);
      assert.equal(state.status, "canceled");
      assert.equal(state.usage.creditsCharged, 1);
      assert.equal((await h.store.usage(p)).reserved, 0);
    },
  );
  await t.test(
    "content pagination is stable, bounded and free across representations",
    async () => {
      const p = await h.store.provision("pagination");
      const start = await h.service.start(p, "scrape", {
        url: "https://fixtures.aihackr.test/products/1",
        render: "http",
        maxCredits: 1,
      });
      const job = await h.store.claim();
      const resultId = await h.store.unit(
        job,
        "long",
        1,
        0,
        h.service.envelope(
          job,
          { markdown: "a".repeat(18000), text: "b".repeat(18000) },
          [],
          1,
        ),
      );
      await h.store.settle(job.id, "completed", null, job.lease_token);
      const first = await h.service.getResult(p, resultId, undefined, 12000),
        second = await h.service.getResult(
          p,
          resultId,
          first.nextCursor,
          12000,
        );
      assert.equal(first.data.markdown.length + first.data.text.length, 12000);
      assert.equal(second.data.markdown.length, 6000);
      assert.equal(first.truncated, true);
      assert.equal((await h.store.usage(p)).balance, 99);
      await assert.rejects(
        h.service.getResult(
          p,
          resultId,
          Buffer.from(JSON.stringify({ id: "other", offset: 6000 })).toString(
            "base64url",
          ),
        ),
      );
      assert.equal(start.jobId, job.id);
    },
  );
});
