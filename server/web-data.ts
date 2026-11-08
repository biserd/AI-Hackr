import type { Express } from "express";
import type { AuthenticatedRequest } from "./auth";

/** Server-to-server bridge. Only the existing verified session chooses account identity. */
export function registerWebData(app: Express) {
  app.use("/api/web-data", async (req: AuthenticatedRequest, res) => {
    const upstream = process.env.WEB_DATA_API_URL,
      token = process.env.WEB_DATA_CONTROL_TOKEN;
    if (!upstream || !token) {
      res.status(503).json({
        error: {
          code: "CAPABILITY_UNAVAILABLE",
          message: "Web data service is not configured.",
        },
      });
      return;
    }
    if (!req.user?.emailVerified) {
      res.status(401).json({
        error: {
          code: "AUTH_REQUIRED",
          message: "Sign in with a verified email first.",
        },
      });
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      const allowed =
        process.env.WEB_DATA_DASHBOARD_ORIGIN ?? "https://aihackr.com";
      if (req.headers.origin !== allowed) {
        res.status(403).json({
          error: {
            code: "TARGET_RESTRICTED",
            message: "Dashboard origin check failed.",
          },
        });
        return;
      }
    }
    if (
      !/^\/v1\/(capabilities|prices|usage|quote|search|scrape|extract|map|crawl|research|jobs|results|keys|connections|billing|oauth)(\/|\?|$)/.test(
        req.url,
      )
    ) {
      res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Endpoint not found." } });
      return;
    }
    try {
      const response = await fetch(
        `${upstream.replace(/\/$/, "")}/dashboard${req.url}`,
        {
          method: req.method,
          headers: {
            "Content-Type": "application/json",
            "X-AIHackr-Control": token,
            "X-AIHackr-Verified-User": req.user.id,
          },
          body: ["GET", "HEAD"].includes(req.method)
            ? undefined
            : JSON.stringify(req.body),
          signal: AbortSignal.timeout(10000),
          redirect: "error",
        },
      );
      res
        .status(response.status)
        .type("json")
        .send(await response.text());
    } catch {
      res.status(503).json({
        error: {
          code: "CAPABILITY_UNAVAILABLE",
          message: "Web data service is unreachable.",
        },
      });
    }
  });
}
