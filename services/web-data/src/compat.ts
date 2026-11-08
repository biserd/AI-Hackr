import type { Express } from "express";
import { z } from "zod";
import { AppError } from "./contracts.js";
import type { Service } from "./service.js";
const options = z
  .object({
    url: z.string().url(),
    formats: z
      .array(z.enum(["markdown", "html", "links"]))
      .min(1)
      .max(3)
      .default(["markdown"]),
    onlyMainContent: z.literal(true).optional(),
    waitFor: z.literal(0).optional(),
    timeout: z.literal(20000).optional(),
    maxAge: z.number().int().min(0).max(86400000).optional(),
    origin: z.string().max(100).optional(),
  })
  .strict();
export function mountCompatibility(app: Express, service: Service) {
  app.post("/compat/firecrawl/v2/scrape", async (req, res, next) => {
    try {
      const parsed = options.safeParse(req.body);
      if (!parsed.success)
        throw new AppError(
          "UNSUPPORTED_OPTION",
          "Supported subset: url, markdown/html/links, onlyMainContent=true, waitFor=0, timeout=20000, maxAge<=86400000 milliseconds.",
          422,
        );
      const a = parsed.data;
      const started = await service.start(res.locals.principal, "scrape", {
        url: a.url,
        formats: a.formats,
        render: "http",
        maxAgeSeconds:
          a.maxAge === undefined ? 3600 : Math.floor(a.maxAge / 1000),
        maxCredits: 1,
        idempotencyKey:
          typeof req.headers["idempotency-key"] === "string"
            ? req.headers["idempotency-key"]
            : undefined,
      });
      const deadline = Date.now() + 20000;
      let job = await service.store.status(res.locals.principal, started.jobId);
      while (
        ["queued", "running"].includes(job.status) &&
        Date.now() < deadline
      ) {
        await new Promise((r) => setTimeout(r, 50));
        job = await service.store.status(res.locals.principal, started.jobId);
      }
      if (["queued", "running"].includes(job.status)) {
        await service.store.cancel(res.locals.principal, started.jobId);
        throw new AppError(
          "UPSTREAM_TIMEOUT",
          "Compatibility deadline reached; inspect the retained job for final settlement.",
          504,
          true,
          { jobId: started.jobId },
        );
      }
      if (job.status !== "completed")
        throw new AppError(
          job.stopReason ?? "UPSTREAM_FAILURE",
          "Compatibility scrape did not complete.",
          422,
          false,
          { jobId: started.jobId, creditsCharged: job.usage.creditsCharged },
        );
      const result = await service.getResult(
        res.locals.principal,
        job.resultIds[0],
        undefined,
        32000,
      );
      res.json({
        success: true,
        data: {
          ...result.data,
          metadata: {
            sourceURL: a.url,
            url: result.sources[0].finalUrl,
            title: result.data.title,
            statusCode: 200,
          },
        },
        aihackr: {
          jobId: job.jobId,
          usage: job.usage,
          truncated: result.truncated,
          resultId: result.resultId,
          nextCursor: result.nextCursor,
        },
      });
    } catch (e) {
      next(e);
    }
  });
}
