import {
  AppError,
  ceiling,
  hash,
  id,
  limits,
  parse,
  prices,
  priceVersion,
  requireScope,
  type Args,
  type Operation,
  type Page,
  type Principal,
} from "./contracts.js";
import { canonicalUrl, target } from "./security.js";
import { Providers } from "./providers.js";
import { Store } from "./store.js";
export class Service {
  draining = false;
  constructor(
    public store: Store,
    public providers: Providers,
    public costCap = 50000,
  ) {}
  capabilities() {
    return {
      apiVersion: "v1",
      priceVersion,
      mode: this.providers.config.fixture ? "fixture" : "live",
      available: {
        scrape:
          this.providers.config.fixture || this.providers.config.httpEnabled,
        browser: this.providers.browserAvailable,
        search: this.providers.searchAvailable,
        extract: this.providers.extractAvailable,
        map: this.providers.config.fixture || this.providers.config.httpEnabled,
        crawl:
          this.providers.config.fixture || this.providers.config.httpEnabled,
        research:
          this.providers.config.fixture || this.providers.config.httpEnabled,
        oauth: Boolean(process.env.OAUTH_ISSUER),
        checkout: false,
      },
      formats: ["markdown", "text", "html", "links"],
      limits,
      retention: { contentHours: 24, metadataDays: 30, idempotencyDays: 30 },
      prices,
      sourceUrl:
        "https://github.com/biserd/AI-Hackr/tree/codex/agent-web-data/services/web-data",
      warnings: this.providers.config.fixture
        ? [
            "Fixture mode uses controlled synthetic sources; it does not retrieve arbitrary websites.",
          ]
        : [],
    };
  }
  async quote(p: Principal, input: Args) {
    const { operation, input: raw } = input;
    if (
      !["scrape", "search", "extract", "map", "crawl", "research"].includes(
        operation,
      )
    )
      throw new AppError("INVALID_INPUT", "Unknown operation.");
    return this.store.quote(p, operation, parse(operation, raw));
  }
  preflight(op: Operation, args: Args) {
    if (this.draining || process.env.WEB_DATA_KILL_SWITCH === "true")
      throw new AppError(
        "CAPABILITY_UNAVAILABLE",
        "New work is temporarily disabled.",
        503,
      );
    if (
      !this.providers.config.fixture &&
      !this.providers.config.httpEnabled &&
      op !== "search"
    )
      throw new AppError(
        "CAPABILITY_UNAVAILABLE",
        "Live retrieval is disabled.",
        503,
      );
    if (args.url) target(args.url);
    for (const url of args.startingUrls ?? []) target(url);
    if (
      (op === "search" && !this.providers.searchAvailable) ||
      (op === "research" &&
        !args.startingUrls.length &&
        !this.providers.searchAvailable)
    )
      throw new AppError("CAPABILITY_UNAVAILABLE", "Search unavailable.", 503);
    if ((op === "extract" || args.schema) && !this.providers.extractAvailable)
      throw new AppError(
        "CAPABILITY_UNAVAILABLE",
        "Extraction unavailable.",
        503,
      );
    if (args.render === "browser" && !this.providers.browserAvailable)
      throw new AppError("CAPABILITY_UNAVAILABLE", "Browser unavailable.", 503);
    if (op === "research" && !args.startingUrls.length && !args.maxSearches)
      throw new AppError(
        "INVALID_INPUT",
        "Research requires startingUrls or a search allowance.",
      );
    if (ceiling(op, args) > args.maxCredits)
      throw new AppError(
        "BUDGET_EXCEEDED",
        `Plan needs ${ceiling(op, args)} credits; raise the cap or reduce the plan.`,
        402,
      );
  }
  async start(p: Principal, op: Operation, raw: Args) {
    requireScope(p, "web:read");
    requireScope(p, "jobs:write");
    const args = parse(op, raw);
    this.preflight(op, args);
    if (args.resultId) await this.store.result(p, args.resultId);
    const r = await this.store.reserve(p, op, args, this.costCap);
    return {
      ...(await this.store.status(p, r.job.id)),
      requestId: r.job.id,
      replay: r.replay,
      warnings: args.idempotencyKey
        ? []
        : ["No idempotency key: retries can start separate paid operations."],
    };
  }
  async processOne() {
    const job = await this.store.claim();
    if (!job) return false;
    const heartbeat = setInterval(() => {
      void this.store.heartbeat(job).catch(() => {});
    }, 10000);
    heartbeat.unref();
    try {
      await this.execute(job);
      await this.store.settle(job.id, "completed", null, job.lease_token);
    } catch (e) {
      const error =
        e instanceof AppError
          ? e
          : new AppError(
              "UPSTREAM_FAILURE",
              "Upstream operation failed.",
              502,
              true,
            );
      const current = await this.store.getJob(
        { tenant: job.tenant } as Principal,
        job.id,
      );
      await this.store.db.tx((q) =>
        q.query(
          "INSERT INTO wd_events(job,tenant,kind,data) VALUES($1,$2,'operation_error',$3)",
          [
            job.id,
            job.tenant,
            JSON.stringify({
              code: error.code,
              ...(error.code === "EXTRACTION_INCOMPLETE"
                ? {
                    missingPaths: error.details.missingPaths,
                  }
                : {}),
            }),
          ],
        ),
      );
      await this.store.settle(
        job.id,
        current.charged ? "partial" : "failed",
        error.code,
        job.lease_token,
      );
    } finally {
      clearInterval(heartbeat);
    }
    return true;
  }
  async budget(job: any, worstCredits: number, worstCost: number, worstMs = 0) {
    if (job.deadline && Date.now() + worstMs > job.deadline)
      throw new AppError(
        "UPSTREAM_TIMEOUT",
        "Remaining job deadline cannot fund the next bounded call.",
        504,
      );
    const current = await this.store.active(job);
    if (
      current.charged + worstCredits > current.ceiling ||
      current.cost_micro_usd + worstCost > current.cost_cap
    )
      throw new AppError(
        "BUDGET_EXCEEDED",
        "Remaining customer or provider cost ceiling cannot fund the next unit.",
        402,
      );
  }
  async retrieve(
    job: any,
    url: string,
    a: Args,
    unit: string,
    sameOrigin?: string,
  ) {
    const p = { tenant: job.tenant } as Principal;
    const key = hash({
      url: canonicalUrl(url),
      formats: a.formats ?? ["markdown"],
      render: a.render ?? "http",
    });
    let page = (await this.store.cache(
      p,
      key,
      a.maxAgeSeconds ?? 3600,
    )) as Page | null;
    const cost = this.providers.config.fixture
      ? 0
      : this.providers.config.httpCost;
    if (!page) {
      await this.budget(
        job,
        (a.render ?? "http") === "http" ? 1 : 5,
        cost,
        this.providers.browserAvailable && a.render !== "http" ? 65000 : 20000,
      );
      page = await this.providers.retrieve(url, a.render ?? "http", sameOrigin);
      await this.store.cachePut(p, key, page);
    }
    const credits = page.cacheHit
      ? 0
      : page.source.method === "browser"
        ? 5
        : 1;
    if (sameOrigin && new URL(page.source.finalUrl).origin !== sameOrigin)
      throw new AppError(
        "TARGET_RESTRICTED",
        "Cached or retrieved page left the crawl origin.",
        403,
      );
    const data: Args = { title: page.title };
    for (const format of a.formats ?? ["markdown"])
      data[format] = page[format as keyof Page];
    const body = this.envelope(
      job,
      data,
      [page.source],
      credits,
      page.cacheHit ?? false,
      page.ageSeconds ?? 0,
    );
    const resultId = await this.store.unit(
      job,
      unit,
      credits,
      page.cacheHit ? 0 : cost,
      { ...body, _page: page },
      { method: page.source.method, cacheHit: page.cacheHit ?? false },
    );
    return { page, resultId };
  }
  envelope(
    job: any,
    data: Args,
    sources: unknown[],
    credits: number,
    cacheHit = false,
    age = 0,
  ) {
    return {
      requestId: job.id,
      status: "completed",
      data,
      sources,
      cache: { hit: cacheHit, ageSeconds: age },
      usage: { creditsCharged: credits, priceVersion: job.price_version },
      coverage: { complete: true, reason: null },
      warnings: [],
      truncated: false,
      nextCursor: null,
    };
  }
  async extraction(job: any, page: Page, schema: Args, unit: string) {
    const estimate = this.providers.config.fixture
      ? 0
      : this.providers.extraction!.plan(page, schema, job.args.instruction)
          .costCeiling;
    await this.budget(job, 3, estimate, 45000);
    try {
      const extracted = await this.providers.extract(
        page,
        schema,
        job.args.instruction,
      );
      await this.store.unit(
        job,
        unit,
        3,
        extracted.metrics?.providerCostMicroUsd ?? 0,
        {
          ...this.envelope(
            job,
            { json: extracted.json, fieldEvidence: extracted.fieldEvidence },
            [page.source],
            3,
          ),
          coverage: extracted.coverage ?? { complete: true, reason: null },
        },
        extracted.metrics ?? {},
      );
    } catch (e) {
      if (
        e instanceof AppError &&
        e.code === "EXTRACTION_INCOMPLETE" &&
        e.details.partialData
      )
        await this.store.unit(job, unit + ":partial", 0, 0, {
          ...this.envelope(
            job,
            {
              json: e.details.partialData,
              missingPaths: e.details.missingPaths,
              fieldEvidence: e.details.fieldEvidence ?? {},
            },
            [page.source],
            0,
          ),
          status: "partial",
          coverage: { complete: false, reason: "EXTRACTION_INCOMPLETE" },
          warnings: ["Unsupported required values were not invented."],
        });
      if (e instanceof AppError && e.details.providerCostMicroUsd)
        await this.store.batch([
          {
            sql: "UPDATE wd_jobs SET cost_micro_usd=cost_micro_usd+$2 WHERE id=$1 AND lease_token=$3 AND state=$4",
            params: [
              job.id,
              Math.min(estimate, Number(e.details.providerCostMicroUsd)),
              job.lease_token,
              "running",
            ],
          },
          {
            sql: "INSERT INTO wd_events(job,tenant,kind,data) VALUES($1,$2,'failed_extraction_cost',$3)",
            params: [job.id, job.tenant, JSON.stringify(e.details)],
          },
        ]);
      throw e;
    }
  }
  async execute(job: any) {
    if (["research", "crawl"].includes(job.operation))
      job.deadline = Date.now() + 180000;
    const a = job.args;
    if (job.operation === "search") {
      await this.budget(
        job,
        a.limit > 10 ? 4 : 2,
        this.providers.config.searchCost,
      );
      const results = await this.providers.search(a);
      await this.store.unit(
        job,
        "search",
        a.limit > 10 ? 4 : 2,
        this.providers.config.fixture ? 0 : this.providers.config.searchCost,
        this.envelope(
          job,
          { results },
          results.map((x: Args) => ({
            sourceId: id("src"),
            url: x.url,
            finalUrl: x.url,
            observedAt: new Date().toISOString(),
            publishedAt: x.publishedAt,
            method: "search",
          })),
          a.limit > 10 ? 4 : 2,
        ),
      );
      return;
    }
    if (job.operation === "scrape") {
      await this.retrieve(job, a.url, a, "page");
      return;
    }
    if (job.operation === "extract") {
      const page = a.resultId
        ? (
            await this.store.result(
              { tenant: job.tenant } as Principal,
              a.resultId,
            )
          ).body._page
        : (await this.retrieve(job, a.url, a, "page")).page;
      if (!page)
        throw new AppError(
          "INVALID_INPUT",
          "Result does not contain an extractable page.",
        );
      await this.extraction(job, page, a.schema, "extraction");
      return;
    }
    if (job.operation === "map") {
      const { page } = await this.retrieve(
        job,
        a.url,
        { render: "http", formats: ["links"] },
        "discovery",
      );
      const origin = new URL(page.source.finalUrl).origin;
      const links = page.links
        .filter((x) => new URL(x).origin === origin && allowedPath(x, a))
        .slice(0, a.limit);
      await this.store.unit(job, "map", 0, 0, {
        ...this.envelope(job, { links }, [page.source], 0),
        coverage: {
          complete: false,
          reason:
            "Bounded links from one public page; full-site coverage is not claimed.",
        },
      });
      return;
    }
    const start = Date.now();
    const queue: { url: string; depth: number }[] = a.url
      ? [{ url: a.url, depth: 0 }]
      : a.startingUrls.map((url: string) => ({ url, depth: 0 }));
    const origin = a.url ? new URL(a.url).origin : undefined;
    const visited = new Set<string>();
    const max = job.operation === "crawl" ? a.maxPages : a.maxPages;
    let failures = 0;
    let pages = 0;
    if (job.operation === "research" && !queue.length) {
      await this.budget(job, 2, this.providers.config.searchCost);
      const results = await this.providers.search({
        query: a.objective,
        limit: 10,
      });
      await this.store.unit(
        job,
        "research-search",
        2,
        this.providers.config.fixture ? 0 : this.providers.config.searchCost,
        this.envelope(job, { results }, [], 2),
      );
      queue.push(...results.map((x: Args) => ({ url: x.url, depth: 0 })));
    }
    while (queue.length && pages < max) {
      if (Date.now() - start >= limits.researchSeconds * 1000)
        throw new AppError(
          "UPSTREAM_TIMEOUT",
          "Job time budget exhausted.",
          504,
        );
      await this.store.active(job);
      const item = queue.shift()!;
      let url: string;
      try {
        url = canonicalUrl(item.url);
      } catch {
        failures++;
        continue;
      }
      if (
        visited.has(url) ||
        (origin && new URL(url).origin !== origin) ||
        (job.operation === "crawl" && !allowedPath(url, a))
      )
        continue;
      visited.add(url);
      pages++;
      try {
        const { page } = await this.retrieve(
          job,
          url,
          {
            ...a,
            render: a.render ?? "auto",
            formats: a.formats ?? ["markdown"],
          },
          `page:${pages}`,
          origin,
        );
        if (job.operation === "research" && a.schema)
          await this.extraction(job, page, a.schema, `extraction:${pages}`);
        if (job.operation === "crawl" && item.depth < a.maxDepth)
          for (const link of page.links) {
            if (queue.length < 1000)
              queue.push({ url: link, depth: item.depth + 1 });
          }
      } catch (e) {
        if (
          e instanceof AppError &&
          ["BUDGET_EXCEEDED", "JOB_CANCELED"].includes(e.code)
        )
          throw e;
        failures++;
        await this.store.db.tx((q) =>
          q.query(
            "INSERT INTO wd_events(job,tenant,kind,data) VALUES($1,$2,'page_failed',$3)",
            [
              job.id,
              job.tenant,
              JSON.stringify({
                unit: pages,
                code: e instanceof AppError ? e.code : "UPSTREAM_FAILURE",
              }),
            ],
          ),
        );
      }
    }
    if (failures || queue.length) {
      const current = await this.store.getJob(
        { tenant: job.tenant } as Principal,
        job.id,
      );
      await this.store.settle(
        job.id,
        current.charged ? "partial" : "failed",
        failures ? "SOME_PAGES_FAILED" : "PAGE_LIMIT",
        job.lease_token,
      );
    }
  }
  async getResult(
    p: Principal,
    resultId: string,
    cursor?: string,
    length = 12000,
  ) {
    const r = await this.store.result(p, resultId);
    let offset = 0;
    if (cursor) {
      try {
        const c = JSON.parse(Buffer.from(cursor, "base64url").toString());
        if (c.id !== resultId || !Number.isInteger(c.offset) || c.offset < 0)
          throw new Error();
        offset = c.offset;
      } catch {
        throw new AppError("INVALID_INPUT", "Invalid result cursor.");
      }
    }
    if (
      !Number.isInteger(length) ||
      length < 1 ||
      length > limits.resultCharacters
    )
      throw new AppError("INVALID_INPUT", "Invalid result page size.");
    const { _page: _private, ...body } = r.body;
    const data = { ...body.data };
    const fields = ["markdown", "text", "html"];
    const content = fields.filter((f) => typeof data[f] === "string");
    const perField = Math.max(
      1,
      Math.floor(length / Math.max(1, content.length)),
    );
    const total = Math.max(0, ...content.map((f) => data[f].length));
    if (offset > total)
      throw new AppError(
        "INVALID_INPUT",
        "Cursor is outside retained content.",
      );
    for (const f of content) data[f] = data[f].slice(offset, offset + perField);
    const more = offset + perField < total;
    return {
      ...body,
      resultId,
      data,
      expiresAt: new Date(r.expires_at).toISOString(),
      coverage: more
        ? {
            complete: false,
            reason: "Content is paginated. Follow nextCursor.",
          }
        : body.coverage,
      truncated: more,
      nextCursor: more
        ? Buffer.from(
            JSON.stringify({ id: resultId, offset: offset + perField }),
          ).toString("base64url")
        : null,
    };
  }
  async inspect(p: Principal, kind: string, args: Args) {
    if (kind === "capabilities") return this.capabilities();
    if (kind === "quote") {
      requireScope(p, "web:read");
      return this.quote(p, args);
    }
    if (kind === "usage") {
      requireScope(p, "usage:read");
      return this.store.usage(p);
    }
    if (kind === "get_result") {
      requireScope(p, "jobs:read");
      return this.getResult(p, args.resultId, args.cursor, args.pageSize);
    }
    if (kind === "job") {
      requireScope(p, args.action === "cancel" ? "jobs:write" : "jobs:read");
      return args.action === "cancel"
        ? this.store.cancel(p, args.jobId)
        : this.store.status(p, args.jobId);
    }
    return this.start(p, kind as Operation, args);
  }
}
function allowedPath(url: string, args: Args) {
  const path = new URL(url).pathname;
  return (
    (!args.includePaths?.length ||
      args.includePaths.some((p: string) => path.startsWith(p))) &&
    !args.excludePaths?.some((p: string) => path.startsWith(p))
  );
}
