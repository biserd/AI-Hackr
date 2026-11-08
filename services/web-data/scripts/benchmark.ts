import { mkdir, writeFile } from "node:fs/promises";
import { cpus, totalmem } from "node:os";
import { harness } from "../test/helpers.js";
const count = Number(process.env.BENCHMARK_COUNT ?? 1000);
if (!Number.isInteger(count) || count < 1 || count > 10000)
  throw new Error("BENCHMARK_COUNT must be 1..10000");
if (process.env.BENCHMARK_LIVE === "true")
  throw new Error(
    "Live benchmark requires separately configured authorized target set and prepaid provider budget; fixture benchmark cannot establish live economics.",
  );
const h = await harness();
const rows: any[] = [];
await h.db.tx((q) =>
  q.query(
    "UPDATE wd_wallets SET balance=20000,daily_cap=20000 WHERE tenant=$1",
    [h.a.tenant],
  ),
);
try {
  for (let i = 0; i < count; i++) {
    const started = performance.now();
    const bad = i % 10 === 0;
    const job = await h.service.start(h.a, "scrape", {
      url: `https://fixtures.aihackr.test/${bad ? "missing" : `products/${(i % 3) + 1}`}`,
      render: "http",
      maxAgeSeconds: i % 4 === 0 ? 0 : 3600,
      maxCredits: 1,
      idempotencyKey: `benchmark-${i}`,
    });
    await h.service.processOne();
    const status = await h.store.status(h.a, job.jobId);
    rows.push({
      index: i,
      status: status.status,
      credits: status.usage.creditsCharged,
      milliseconds: performance.now() - started,
      trialFunded: true,
      fixture: true,
    });
  }
  const latencies = rows.map((x) => x.milliseconds).sort((a, b) => a - b);
  await mkdir("reports", { recursive: true });
  await writeFile(
    "reports/fixture-benchmark.json",
    JSON.stringify(
      {
        mode: "fixture",
        runAt: new Date().toISOString(),
        count,
        hardware: {
          cpu: cpus()[0]?.model,
          logicalCpus: cpus().length,
          memoryBytes: totalmem(),
          node: process.version,
          concurrency: 1,
        },
        summary: {
          completed: rows.filter((x) => x.status === "completed").length,
          failed: rows.filter((x) => x.status === "failed").length,
          p50Ms: latencies[Math.floor(latencies.length * 0.5)],
          p95Ms:
            latencies[
              Math.min(
                latencies.length - 1,
                Math.floor(latencies.length * 0.95),
              )
            ],
          creditsCharged: rows.reduce((s, x) => s + x.credits, 0),
        },
        economics: {
          liveRequestsRun: 0,
          providerCostPerUsableResult: null,
          contributionMargin: null,
          breakEven: null,
          reason:
            "Controlled fixtures measure SQL/control flow only. Provider costs, browser CPU/transfer, payment fees and hosting utilization have not been benchmarked.",
        },
        rows,
      },
      null,
      2,
    ),
  );
  console.info(
    `Measured ${count} fixture operations; live cost and margin gates remain unrun.`,
  );
} finally {
  await h.close();
}
