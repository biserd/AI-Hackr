import { randomBytes, createHash } from "node:crypto";
import type { Database, Query } from "./db.js";
import {
  AppError,
  billableArgs,
  ceiling,
  hash,
  id,
  priceVersion,
  prices,
  limits,
  type Args,
  type Operation,
  type Principal,
} from "./contracts.js";
export const allScopes = ["web:read", "jobs:read", "jobs:write", "usage:read"];
export const keyHash = (s: string) =>
  createHash("sha256").update(s).digest("hex");
const date = (s: unknown) => new Date(s as string).getTime();
const terminal = ["completed", "partial", "failed", "canceled"];
export class Store {
  remote?: (method: string, args: unknown[]) => Promise<any>;
  constructor(public db: Database) {}
  async batch(statements: { sql: string; params?: any[] }[]) {
    return this.db.tx(async (q) => {
      const results = [];
      for (const s of statements) results.push(await q.query(s.sql, s.params));
      return results;
    });
  }
  async linkOAuth(
    issuer: string,
    subject: string,
    client: string,
    tenant: string,
  ) {
    return this.db.tx(async (q) => {
      const prior = (
        await q.query(
          "SELECT * FROM wd_oauth_bindings WHERE issuer=$1 AND subject=$2 AND client=$3",
          [issuer, subject, client],
        )
      ).rows[0];
      if (prior && prior.tenant !== tenant)
        throw new AppError(
          "IDEMPOTENCY_CONFLICT",
          "Unlink the prior workspace before linking this identity to another.",
          409,
        );
      if (!prior) {
        const connection = id("oauth");
        await q.query(
          "INSERT INTO wd_connections(tenant,id,scopes) VALUES($1,$2,$3)",
          [tenant, connection, JSON.stringify(allScopes)],
        );
        await q.query("INSERT INTO wd_oauth_bindings VALUES($1,$2,$3,$4,$5)", [
          issuer,
          subject,
          client,
          tenant,
          connection,
        ]);
      }
    });
  }
  async provision(tenant: string) {
    return this.db.tx(async (q) => {
      const r = await q.query(
        "INSERT INTO wd_wallets(tenant,balance) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING tenant",
        [tenant, prices.trial],
      );
      if (r.rows.length)
        await this.ledger(q, tenant, "grant", prices.trial, "verified-trial");
      await q.query(
        "INSERT INTO wd_connections(tenant,id,scopes,operation_cap,daily_cap) VALUES($1,$2,$3,100,1000) ON CONFLICT DO NOTHING",
        [tenant, "dashboard", JSON.stringify(allScopes)],
      );
      return {
        tenant,
        connection: "dashboard",
        scopes: allScopes,
        owner: true,
      } as Principal;
    });
  }
  async ledger(
    q: Query,
    tenant: string,
    kind: string,
    credits: number,
    reference: string,
  ) {
    await q.query(
      "INSERT INTO wd_ledger(tenant,kind,credits,reference,price_version) VALUES($1,$2,$3,$4,$5)",
      [tenant, kind, credits, reference, priceVersion],
    );
  }
  async issueKey(p: Principal, label: string) {
    if (!p.owner)
      throw new AppError("SCOPE_REQUIRED", "Dashboard owner required.", 403);
    const secret = `ahk_${randomBytes(32).toString("base64url")}`,
      connection = id("client");
    await this.db.tx(async (q) => {
      await q.query(
        "INSERT INTO wd_connections(tenant,id,scopes) VALUES($1,$2,$3)",
        [p.tenant, connection, JSON.stringify(allScopes)],
      );
      await q.query(
        "INSERT INTO wd_keys(hash,tenant,connection,label,prefix) VALUES($1,$2,$3,$4,$5)",
        [keyHash(secret), p.tenant, connection, label, secret.slice(0, 12)],
      );
    });
    return { key: secret, connection, expiresInDays: 90 };
  }
  async key(token: string): Promise<Principal> {
    return this.db.tx(async (q) => {
      const r = await q.query(
        "SELECT k.tenant,k.connection,c.scopes FROM wd_keys k JOIN wd_connections c ON c.tenant=k.tenant AND c.id=k.connection WHERE k.hash=$1 AND k.expires_at>now() AND c.revoked=false",
        [keyHash(token)],
      );
      if (!r.rows[0])
        throw new AppError(
          "AUTH_REQUIRED",
          "Invalid or expired credentials.",
          401,
        );
      return r.rows[0];
    });
  }
  async connection(p: Principal) {
    return this.db.tx(async (q) => {
      const r = await q.query(
        "SELECT * FROM wd_connections WHERE tenant=$1 AND id=$2 AND revoked=false",
        [p.tenant, p.connection],
      );
      if (!r.rows[0])
        throw new AppError(
          "AUTH_REQUIRED",
          "Connection revoked or unlinked.",
          401,
        );
      return r.rows[0];
    });
  }
  async quote(p: Principal, op: Operation, args: Args) {
    const quoteId = id("quote"),
      max = ceiling(op, args),
      expiresAt = new Date(Date.now() + 300000).toISOString();
    if (max > args.maxCredits)
      throw new AppError(
        "BUDGET_EXCEEDED",
        `Plan requires a ${max}-credit ceiling.`,
        402,
      );
    await this.db.tx((q) =>
      q.query("INSERT INTO wd_quotes VALUES($1,$2,$3,$4,$5,$6,$7)", [
        quoteId,
        p.tenant,
        op,
        hash(billableArgs(args)),
        max,
        priceVersion,
        expiresAt,
      ]),
    );
    return {
      quoteId,
      operation: op,
      normalizedArgs: args,
      plan: { maxUnits: args.maxPages ?? 1, render: args.render ?? null },
      minCredits: 0,
      maxCredits: max,
      expiresAt,
      priceVersion,
    };
  }
  async reserve(p: Principal, op: Operation, args: Args, costCap: number) {
    return this.db.tx(async (q) => {
      const wallet = (
        await q.query("SELECT * FROM wd_wallets WHERE tenant=$1 FOR UPDATE", [
          p.tenant,
        ])
      ).rows[0];
      const fingerprint = hash(billableArgs(args)),
        key = args.idempotencyKey ?? id("once");
      const prior = (
        await q.query(
          "SELECT * FROM wd_jobs WHERE tenant=$1 AND operation=$2 AND idempotency_key=$3",
          [p.tenant, op, key],
        )
      ).rows[0];
      if (prior) {
        if (prior.args_hash !== fingerprint)
          throw new AppError(
            "IDEMPOTENCY_CONFLICT",
            "Key was used with different arguments.",
            409,
          );
        return { job: prior, replay: true };
      }
      const max = ceiling(op, args);
      if (args.quoteId) {
        const quote = (
          await q.query("SELECT * FROM wd_quotes WHERE id=$1 AND tenant=$2", [
            args.quoteId,
            p.tenant,
          ])
        ).rows[0];
        if (!quote) throw new AppError("NOT_FOUND", "Quote not found.", 404);
        if (
          date(quote.expires_at) < Date.now() ||
          quote.price_version !== priceVersion
        )
          throw new AppError("QUOTE_EXPIRED", "Request a new quote.");
        if (quote.args_hash !== fingerprint || quote.operation !== op)
          throw new AppError("INVALID_INPUT", "Quote arguments differ.");
      }
      const conn = (
        await q.query(
          "SELECT * FROM wd_connections WHERE tenant=$1 AND id=$2 AND revoked=false",
          [p.tenant, p.connection],
        )
      ).rows[0];
      if (!wallet || !conn)
        throw new AppError(
          "AUTH_REQUIRED",
          "Account or connection not found.",
          401,
        );
      if (wallet.blocked)
        throw new AppError(
          "TARGET_RESTRICTED",
          "Account spending suspended.",
          403,
        );
      if (
        max > args.maxCredits ||
        max > wallet.operation_cap ||
        max > conn.operation_cap
      )
        throw new AppError(
          "BUDGET_EXCEEDED",
          `Plan requires ${max} credits within operation and connection limits.`,
          402,
        );
      const daily = (
        await q.query(
          "SELECT COALESCE(SUM(CASE WHEN state IN ('queued','running') THEN ceiling ELSE charged END),0)::integer AS total, COALESCE(SUM(CASE WHEN connection=$2 THEN CASE WHEN state IN ('queued','running') THEN ceiling ELSE charged END ELSE 0 END),0)::integer AS connection_total FROM wd_jobs WHERE tenant=$1 AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'",
          [p.tenant, p.connection],
        )
      ).rows[0];
      if (
        daily.total + max > wallet.daily_cap ||
        daily.connection_total + max > conn.daily_cap
      )
        throw new AppError("BUDGET_EXCEEDED", "UTC daily limit reached.", 402);
      if (wallet.balance - wallet.reserved < max)
        throw new AppError(
          "INSUFFICIENT_CREDITS",
          "Insufficient spendable prepaid credits.",
          402,
        );
      const jobId = id("job");
      await q.query(
        "UPDATE wd_wallets SET reserved=reserved+$2 WHERE tenant=$1",
        [p.tenant, max],
      );
      await q.query(
        "INSERT INTO wd_jobs(id,tenant,connection,operation,args,args_hash,idempotency_key,state,ceiling,cost_cap,price_version) VALUES($1,$2,$3,$4,$5,$6,$7,'queued',$8,$9,$10)",
        [
          jobId,
          p.tenant,
          p.connection,
          op,
          JSON.stringify(args),
          fingerprint,
          key,
          max,
          costCap,
          priceVersion,
        ],
      );
      await q.query("INSERT INTO wd_outbox(job) VALUES($1)", [jobId]);
      await this.ledger(q, p.tenant, "reserve", max, jobId);
      return {
        job: (await q.query("SELECT * FROM wd_jobs WHERE id=$1", [jobId]))
          .rows[0],
        replay: false,
      };
    });
  }
  async claim() {
    return this.db.tx(async (q) => {
      const lease = id("lease");
      const r = await q.query(
        "UPDATE wd_jobs SET state='running',lease_token=$1,lease_until=now()+interval '90 seconds',updated_at=now() WHERE id=(SELECT id FROM wd_jobs WHERE state='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *",
        [lease],
      );
      if (r.rows[0])
        await q.query("UPDATE wd_outbox SET published_at=now() WHERE job=$1", [
          r.rows[0].id,
        ]);
      return r.rows[0];
    });
  }
  async heartbeat(job: any) {
    return this.db.tx(
      async (q) =>
        (
          await q.query(
            "UPDATE wd_jobs SET lease_until=now()+interval '90 seconds' WHERE id=$1 AND lease_token=$2 AND state='running' AND lease_until>now() RETURNING id",
            [job.id, job.lease_token],
          )
        ).rows.length > 0,
    );
  }
  async active(job: any) {
    const connection = await this.connection({
      tenant: job.tenant,
      connection: job.connection,
    } as Principal);
    if (connection.revoked)
      throw new AppError("JOB_CANCELED", "Connection revoked.", 409);
    const j = await this.getJob({ tenant: job.tenant } as Principal, job.id);
    if (
      j.state !== "running" ||
      j.cancel_requested ||
      date(j.lease_until) < Date.now() ||
      j.lease_token !== job.lease_token
    )
      throw new AppError("JOB_CANCELED", "Job no longer accepts work.", 409);
    return j;
  }
  async unit(
    job: any,
    unit: string,
    credits: number,
    cost: number,
    body: any,
    metrics: Args = {},
  ) {
    if (Buffer.byteLength(JSON.stringify(body)) > limits.resultStorageBytes)
      throw new AppError(
        "UNSUPPORTED_CONTENT",
        "Retained result exceeds the storage size limit.",
        422,
      );
    return this.db.tx(async (q) => {
      const j = (
        await q.query("SELECT * FROM wd_jobs WHERE id=$1 FOR UPDATE", [job.id])
      ).rows[0];
      if (
        j.state !== "running" ||
        j.lease_token !== job.lease_token ||
        date(j.lease_until) < Date.now()
      )
        throw new AppError("JOB_CANCELED", "Worker lease expired.", 409);
      const old = (
        await q.query("SELECT result FROM wd_units WHERE job=$1 AND unit=$2", [
          job.id,
          unit,
        ])
      ).rows[0];
      if (old) return old.result;
      if (
        j.charged + credits > j.ceiling ||
        j.cost_micro_usd + cost > j.cost_cap
      )
        throw new AppError(
          "BUDGET_EXCEEDED",
          "Operation budget exhausted.",
          402,
        );
      const resultId = id("res");
      await q.query(
        "INSERT INTO wd_results(id,tenant,job,unit,body) VALUES($1,$2,$3,$4,$5)",
        [resultId, job.tenant, job.id, unit, JSON.stringify(body)],
      );
      await q.query(
        "INSERT INTO wd_units(job,unit,credits,cost_micro_usd,result,metrics,price_version) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          job.id,
          unit,
          credits,
          cost,
          resultId,
          JSON.stringify(metrics),
          job.price_version,
        ],
      );
      await q.query(
        "UPDATE wd_jobs SET charged=charged+$2,cost_micro_usd=cost_micro_usd+$3,updated_at=now() WHERE id=$1",
        [job.id, credits, cost],
      );
      await q.query(
        "INSERT INTO wd_events(job,tenant,kind,data) VALUES($1,$2,'unit_completed',$3)",
        [
          job.id,
          job.tenant,
          JSON.stringify({
            unit,
            resultId,
            credits,
            observedAt: new Date().toISOString(),
          }),
        ],
      );
      return resultId;
    });
  }
  async settle(
    jobId: string,
    state: string,
    reason: string | null,
    lease?: string,
  ) {
    return this.db.tx(async (q) => {
      // Wallet-first locking matches reservations and prevents cross-job deadlocks.
      const meta = (
        await q.query("SELECT tenant FROM wd_jobs WHERE id=$1", [jobId])
      ).rows[0];
      if (!meta) return;
      await q.query(
        "SELECT tenant FROM wd_wallets WHERE tenant=$1 FOR UPDATE",
        [meta.tenant],
      );
      const j = (
        await q.query("SELECT * FROM wd_jobs WHERE id=$1 FOR UPDATE", [jobId])
      ).rows[0];
      if (terminal.includes(j.state)) return;
      if (lease && lease !== j.lease_token) return;
      if (reason === "WORKER_LEASE_EXPIRED" && date(j.lease_until) > Date.now())
        return;
      if (reason === "QUEUED_CANCEL" && j.state !== "queued") return;
      if (j.cancel_requested) {
        state = "canceled";
        reason = "JOB_CANCELED";
      }
      await q.query(
        "UPDATE wd_wallets SET balance=balance-$2,reserved=reserved-$3 WHERE tenant=$1",
        [j.tenant, j.charged, j.ceiling],
      );
      await this.ledger(q, j.tenant, "settle", -j.charged, j.id);
      await this.ledger(q, j.tenant, "release", j.ceiling - j.charged, j.id);
      await q.query(
        "UPDATE wd_jobs SET state=$2,stop_reason=$3,lease_until=NULL,updated_at=now() WHERE id=$1",
        [j.id, state, reason],
      );
    });
  }
  async reconcile() {
    const stale = await this.db.tx((q) =>
      q.query(
        "SELECT id,charged FROM wd_jobs WHERE state='running' AND lease_until<now()",
      ),
    );
    for (const j of stale.rows)
      await this.settle(
        j.id,
        j.charged ? "partial" : "failed",
        "WORKER_LEASE_EXPIRED",
      );
    await this.db.tx(async (q) => {
      await q.query(
        "UPDATE wd_results SET body=NULL WHERE expires_at<now() AND body IS NOT NULL",
      );
      await q.query("DELETE FROM wd_cache WHERE expires_at<now()");
      await q.query("DELETE FROM wd_quotes WHERE expires_at<now()");
      await q.query("DELETE FROM wd_oauth_states WHERE expires_at<now()");
      const old =
        "SELECT id FROM wd_jobs WHERE state IN ('completed','partial','failed','canceled') AND updated_at<now()-interval '30 days'";
      for (const table of ["wd_events", "wd_outbox", "wd_units", "wd_results"])
        await q.query(`DELETE FROM ${table} WHERE job IN (${old})`);
      await q.query(`DELETE FROM wd_jobs WHERE id IN (${old})`);
    });
  }
  async getJob(p: Principal, jobId: string) {
    return this.db.tx(async (q) => {
      const j = (
        await q.query("SELECT * FROM wd_jobs WHERE tenant=$1 AND id=$2", [
          p.tenant,
          jobId,
        ])
      ).rows[0];
      if (!j) throw new AppError("NOT_FOUND", "Job not found.", 404);
      return j;
    });
  }
  async status(p: Principal, jobId: string) {
    const j = await this.getJob(p, jobId);
    const trace = await this.db.tx((q) =>
      q.query(
        "SELECT kind,data,created_at FROM wd_events WHERE tenant=$1 AND job=$2 AND kind IN ('unit_completed','operation_error','page_failed') ORDER BY id DESC LIMIT 20",
        [p.tenant, jobId],
      ),
    );
    const results = await this.db.tx((q) =>
      q.query(
        "SELECT id,expires_at FROM wd_results WHERE tenant=$1 AND job=$2 ORDER BY created_at,id",
        [p.tenant, jobId],
      ),
    );
    return {
      jobId: j.id,
      status: j.state,
      operation: j.operation,
      progress: { completedUnits: results.rows.length },
      usage: {
        creditsCharged: j.charged,
        creditsReserved: terminal.includes(j.state) ? 0 : j.ceiling,
        priceVersion: j.price_version,
      },
      resultIds: results.rows.map((x) => x.id),
      expiresAt: results.rows[0]?.expires_at ?? null,
      stopReason: j.stop_reason,
      cancelRequested: j.cancel_requested,
      retryAfterSeconds: terminal.includes(j.state) ? null : 2,
      trace: trace.rows.reverse(),
    };
  }
  async cancel(p: Principal, jobId: string) {
    await this.getJob(p, jobId);
    const j = await this.db.tx(
      async (q) =>
        (
          await q.query(
            "UPDATE wd_jobs SET cancel_requested=true WHERE tenant=$1 AND id=$2 AND state IN ('queued','running') RETURNING state",
            [p.tenant, jobId],
          )
        ).rows[0],
    );
    if (j?.state === "queued")
      await this.settle(jobId, "canceled", "QUEUED_CANCEL");
    return this.status(p, jobId);
  }
  async result(p: Principal, resultId: string) {
    return this.db.tx(async (q) => {
      const r = (
        await q.query("SELECT * FROM wd_results WHERE id=$1 AND tenant=$2", [
          resultId,
          p.tenant,
        ])
      ).rows[0];
      if (!r) throw new AppError("NOT_FOUND", "Result not found.", 404);
      if (!r.body || date(r.expires_at) < Date.now())
        throw new AppError("RESULT_EXPIRED", "Content retention expired.", 410);
      return r;
    });
  }
  async cache(p: Principal, key: string, maxAge: number) {
    if (!maxAge) return null;
    return this.db.tx(async (q) => {
      const r = (
        await q.query(
          "SELECT * FROM wd_cache WHERE tenant=$1 AND key=$2 AND expires_at>now()",
          [p.tenant, key],
        )
      ).rows[0];
      if (!r) return null;
      const age = (Date.now() - date(r.observed_at)) / 1000;
      return age <= maxAge
        ? { ...r.body, cacheHit: true, ageSeconds: Math.floor(age) }
        : null;
    });
  }
  async cachePut(p: Principal, key: string, body: any) {
    if (Buffer.byteLength(JSON.stringify(body)) > limits.resultStorageBytes)
      throw new AppError(
        "UNSUPPORTED_CONTENT",
        "Page exceeds the retained content limit.",
        422,
      );
    await this.db.tx((q) =>
      q.query(
        "INSERT INTO wd_cache VALUES($1,$2,$3,$4,now()+interval '24 hours') ON CONFLICT(tenant,key) DO UPDATE SET body=EXCLUDED.body,observed_at=EXCLUDED.observed_at,expires_at=EXCLUDED.expires_at",
        [p.tenant, key, JSON.stringify(body), body.source.observedAt],
      ),
    );
  }
  async usage(p: Principal) {
    return this.db.tx(async (q) => {
      const w = (
        await q.query("SELECT * FROM wd_wallets WHERE tenant=$1", [p.tenant])
      ).rows[0];
      const ledger = (
        await q.query(
          "SELECT kind,credits,reference,created_at FROM wd_ledger WHERE tenant=$1 ORDER BY id DESC LIMIT 100",
          [p.tenant],
        )
      ).rows;
      return {
        balance: w.balance,
        reserved: w.reserved,
        spendable: w.balance - w.reserved,
        limits: {
          maxCreditsPerOperation: w.operation_cap,
          maxCreditsPerDay: w.daily_cap,
          dailyResetTimezone: "UTC",
        },
        ledger,
      };
    });
  }
}
