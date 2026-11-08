import express from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  AppError,
  id,
  prices,
  requireScope,
  type Principal,
  type Operation,
} from "./contracts.js";
import { keyHash } from "./store.js";
import { Billing } from "./billing.js";
import { mountMcp } from "./mcp.js";
import type { Service } from "./service.js";
import type { OAuth } from "./oauth.js";
import { mountCompatibility } from "./compat.js";
export type HttpConfig = {
  origin: string;
  dashboardOrigin: string;
  controlToken?: string;
  oauthIssuer?: string;
  oauthJwks?: string;
};
export function createApp(
  service: Service,
  config: HttpConfig,
  billing = new Billing(service.store),
  oauth?: OAuth,
) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.locals.requestId = id("req");
    res.setHeader("X-Request-Id", res.locals.requestId);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const origin = req.headers.origin;
    if (origin && ![config.origin, config.dashboardOrigin].includes(origin))
      return next(
        new AppError("TARGET_RESTRICTED", "Origin is not allowed.", 403),
      );
    next();
  });
  app.post(
    "/webhooks/stripe",
    express.raw({ type: "application/json", limit: "256kb" }),
    async (req, res, next) => {
      try {
        res.json(
          await billing.webhook(
            req.body,
            String(req.headers["stripe-signature"] ?? ""),
          ),
        );
      } catch (e) {
        next(e);
      }
    },
  );
  app.use(express.json({ limit: "64kb" }));
  app.get("/oauth/callback", async (req, res, next) => {
    try {
      if (!oauth)
        throw new AppError(
          "CAPABILITY_UNAVAILABLE",
          "OAuth linking unavailable.",
          503,
        );
      res.redirect(
        303,
        await oauth.callback(new URL(req.originalUrl, config.origin)),
      );
    } catch (e) {
      next(e);
    }
  });
  app.get("/health/live", (_req, res) => res.json({ ok: true }));
  app.get("/health/ready", async (_req, res, next) => {
    try {
      await service.store.db.tx((q) => q.query("SELECT 1"));
      res
        .status(service.draining ? 503 : 200)
        .json({ ready: !service.draining });
    } catch (e) {
      next(e);
    }
  });
  app.get("/v1/capabilities", (_req, res) =>
    res.json({
      ...service.capabilities(),
      available: {
        ...service.capabilities().available,
        checkout: Boolean(billing.stripe && billing.webhookSecret),
      },
    }),
  );
  app.get("/v1/prices", (_req, res) => res.json(prices));
  app.get("/.well-known/oauth-protected-resource", (_req, res) =>
    res.json({
      resource: `${config.origin}/mcp`,
      authorization_servers: config.oauthIssuer ? [config.oauthIssuer] : [],
      scopes_supported: ["web:read", "jobs:read", "jobs:write", "usage:read"],
      bearer_methods_supported: ["header"],
    }),
  );
  const jwks = config.oauthJwks
    ? createRemoteJWKSet(new URL(config.oauthJwks), { timeoutDuration: 5000 })
    : undefined;
  const quotas = new Map<string, { start: number; count: number }>();
  app.use(async (req, res, next) => {
    try {
      let principal: Principal | undefined;
      if (req.path.startsWith("/dashboard/") && config.controlToken) {
        const supplied = keyHash(
          String(req.headers["x-aihackr-control"] ?? ""),
        );
        if (
          timingSafeEqual(
            Buffer.from(supplied),
            Buffer.from(keyHash(config.controlToken)),
          )
        ) {
          const account = z
            .string()
            .uuid()
            .parse(req.headers["x-aihackr-verified-user"]);
          principal = await service.store.provision(`account:${account}`);
        }
      }
      if (!principal) {
        const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
        if (!token)
          throw new AppError(
            "AUTH_REQUIRED",
            "Bearer credentials required.",
            401,
          );
        if (token.startsWith("ahk_"))
          principal = await service.store.key(token);
        else if (jwks && config.oauthIssuer && oauth) {
          try {
            const { payload } = await jwtVerify(token, jwks, {
              issuer: config.oauthIssuer,
              audience: `${config.origin}/mcp`,
              algorithms: ["RS256", "ES256"],
            });
            if (
              !payload.exp ||
              typeof payload.sub !== "string" ||
              typeof payload.azp !== "string" ||
              typeof payload.scope !== "string"
            )
              throw new Error();
            principal = await oauth.principal(
              payload.sub,
              payload.azp,
              payload.scope.split(" "),
            );
          } catch {
            throw new AppError(
              "AUTH_REQUIRED",
              "Invalid, unlinked or revoked OAuth access token.",
              401,
            );
          }
        } else
          throw new AppError(
            "AUTH_REQUIRED",
            "Unsupported bearer credentials.",
            401,
          );
      }
      const now = Date.now(),
        quotaKey =
          principal.tenant +
          (req.path.endsWith("/quote") || req.path.endsWith("/capabilities")
            ? ":discovery"
            : ":operations"),
        entry = quotas.get(quotaKey);
      if (quotas.size > 10000)
        for (const [k, v] of quotas)
          if (now - v.start > 60000) quotas.delete(k);
      const quota =
        entry && now - entry.start < 60000 ? entry : { start: now, count: 0 };
      quota.count++;
      quotas.set(quotaKey, quota);
      if (quota.count > (quotaKey.endsWith(":discovery") ? 30 : 120)) {
        res.setHeader("Retry-After", "60");
        throw new AppError(
          "RATE_LIMITED",
          "Account request quota reached.",
          429,
          true,
        );
      }
      res.locals.principal = principal;
      if (req.path.startsWith("/dashboard/"))
        req.url = req.url.replace("/dashboard/", "/");
      next();
    } catch (e) {
      if (e instanceof AppError && e.status === 401)
        res.setHeader(
          "WWW-Authenticate",
          `Bearer resource_metadata="${config.origin}/.well-known/oauth-protected-resource"`,
        );
      next(e);
    }
  });
  const run =
    (fn: (req: express.Request, p: Principal) => Promise<unknown>) =>
    async (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      try {
        res.json(await fn(req, res.locals.principal));
      } catch (e) {
        next(e);
      }
    };
  app.post(
    "/v1/oauth/start",
    run((_req, p) => {
      if (!oauth)
        throw new AppError(
          "CAPABILITY_UNAVAILABLE",
          "Configure the OAuth issuer and exact callback first.",
          503,
        );
      return oauth.start(p);
    }),
  );
  app.get("/v1/capabilities", (_req, res) =>
    res.json({
      ...service.capabilities(),
      available: {
        ...service.capabilities().available,
        checkout: Boolean(billing.stripe && billing.webhookSecret),
      },
    }),
  );
  app.get("/v1/prices", (_req, res) => res.json(prices));
  app.post(
    "/v1/quote",
    run((req, p) => service.inspect(p, "quote", req.body)),
  );
  for (const op of [
    "search",
    "scrape",
    "extract",
    "map",
    "crawl",
    "research",
  ] as Operation[])
    app.post(`/v1/${op}`, async (req, res, next) => {
      try {
        const header = req.headers["idempotency-key"];
        if (header && typeof header !== "string")
          throw new AppError("INVALID_INPUT", "Invalid idempotency header.");
        if (
          header &&
          req.body.idempotencyKey &&
          header !== req.body.idempotencyKey
        )
          throw new AppError(
            "IDEMPOTENCY_CONFLICT",
            "Header and body idempotency keys differ.",
            409,
          );
        const result = await service.start(res.locals.principal, op, {
          ...req.body,
          ...(header ? { idempotencyKey: header } : {}),
        });
        res.status(202).json(result);
      } catch (e) {
        next(e);
      }
    });
  app.get(
    "/v1/jobs/:id",
    run((req, p) =>
      service.inspect(p, "job", { jobId: req.params.id, action: "status" }),
    ),
  );
  app.post(
    "/v1/jobs/:id/cancel",
    run((req, p) =>
      service.inspect(p, "job", { jobId: req.params.id, action: "cancel" }),
    ),
  );
  app.get(
    "/v1/results/:id",
    run((req, p) =>
      service.inspect(p, "get_result", {
        resultId: req.params.id,
        cursor: req.query.cursor,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : 12000,
      }),
    ),
  );
  app.get(
    "/v1/usage",
    run((_req, p) => service.inspect(p, "usage", {})),
  );
  app.get(
    "/v1/jobs",
    run(async (_req, p) => {
      requireScope(p, "jobs:read");
      return {
        jobs: (
          await service.store.db.tx((q) =>
            q.query(
              "SELECT id,operation,state,charged,created_at FROM wd_jobs WHERE tenant=$1 ORDER BY created_at DESC LIMIT 50",
              [p.tenant],
            ),
          )
        ).rows,
      };
    }),
  );
  app.post(
    "/v1/keys",
    run((req, p) =>
      service.store.issueKey(
        p,
        z.string().min(1).max(100).parse(req.body.label),
      ),
    ),
  );
  app.get(
    "/v1/connections",
    run(async (_req, p) => {
      if (!p.owner)
        throw new AppError("SCOPE_REQUIRED", "Dashboard owner required.", 403);
      return {
        connections: (
          await service.store.db.tx((q) =>
            q.query(
              "SELECT c.id,c.operation_cap,c.daily_cap,c.revoked,k.label,k.prefix,k.expires_at FROM wd_connections c LEFT JOIN wd_keys k ON k.connection=c.id AND k.tenant=c.tenant WHERE c.tenant=$1",
              [p.tenant],
            ),
          )
        ).rows,
      };
    }),
  );
  app.patch(
    "/v1/connections/:id",
    run(async (req, p) => {
      if (!p.owner)
        throw new AppError("SCOPE_REQUIRED", "Dashboard owner required.", 403);
      const a = z
        .object({
          maxCreditsPerOperation: z.number().int().min(0).max(100),
          maxCreditsPerDay: z.number().int().min(0).max(1000),
          revoked: z.boolean(),
        })
        .strict()
        .parse(req.body);
      const r = await service.store.db.tx((q) =>
        q.query(
          "UPDATE wd_connections SET operation_cap=$3,daily_cap=$4,revoked=$5 WHERE tenant=$1 AND id=$2 AND id<>$6 RETURNING id",
          [
            p.tenant,
            req.params.id,
            a.maxCreditsPerOperation,
            a.maxCreditsPerDay,
            a.revoked,
            "dashboard",
          ],
        ),
      );
      if (!r.rows.length)
        throw new AppError("NOT_FOUND", "Connection not found.", 404);
      return { updated: true };
    }),
  );
  app.post(
    "/v1/billing/checkout",
    run((_req, p) => billing.checkout(p)),
  );
  app.delete(
    "/v1/results/:id",
    run(async (req, p) => {
      if (!p.owner)
        throw new AppError("SCOPE_REQUIRED", "Dashboard owner required.", 403);
      await service.store.result(p, req.params.id);
      await service.store.db.tx(async (q) => {
        await q.query(
          "UPDATE wd_results SET body=NULL WHERE tenant=$1 AND id=$2",
          [p.tenant, req.params.id],
        );
        await q.query("DELETE FROM wd_cache WHERE tenant=$1", [p.tenant]);
      });
      return { deleted: true };
    }),
  );
  mountCompatibility(app, service);
  mountMcp(app, service);
  app.use((_req, _res, next) =>
    next(new AppError("NOT_FOUND", "Endpoint not found.", 404)),
  );
  app.use(
    (
      e: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const error =
        e instanceof AppError
          ? e
          : e instanceof z.ZodError
            ? new AppError("INVALID_INPUT", "Request validation failed.")
            : e.type === "entity.parse.failed" || e.type === "entity.too.large"
              ? new AppError("INVALID_INPUT", "Invalid or oversized JSON.")
              : new AppError("INTERNAL_ERROR", "Request failed.", 500);
      if (!res.headersSent)
        res.status(error.status).json(error.envelope(res.locals.requestId));
    },
  );
  return app;
}
