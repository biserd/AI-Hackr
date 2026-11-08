import type { Express } from "express";
export function registerWebDataPublic(app: Express) {
  const paths = [
    "/v1",
    "/mcp",
    "/.well-known/oauth-protected-resource",
    "/oauth/callback",
    "/webhooks/stripe",
    "/compat/firecrawl",
    "/health",
  ];
  app.use(paths, async (req, res) => {
    if (!process.env.WEB_DATA_API_URL) {
      res
        .status(503)
        .json({
          error: {
            code: "CAPABILITY_UNAVAILABLE",
            message: "Web data service not configured.",
          },
        });
      return;
    }
    try {
      const headers: Record<string, string> = {};
      for (const name of [
        "authorization",
        "content-type",
        "accept",
        "origin",
        "mcp-protocol-version",
        "mcp-session-id",
        "idempotency-key",
        "stripe-signature",
      ]) {
        const value = req.headers[name];
        if (typeof value === "string") headers[name] = value;
      }
      const body = ["GET", "HEAD"].includes(req.method)
        ? undefined
        : req.originalUrl.startsWith("/webhooks/stripe")
          ? (req as any).rawBody
          : JSON.stringify(req.body);
      const response = await fetch(
        process.env.WEB_DATA_API_URL + req.originalUrl,
        {
          method: req.method,
          headers,
          body,
          redirect: "manual",
          signal: AbortSignal.timeout(25000),
        },
      );
      for (const name of [
        "content-type",
        "www-authenticate",
        "retry-after",
        "x-request-id",
        "location",
        "allow",
        "cache-control",
      ]) {
        const value = response.headers.get(name);
        if (value) res.setHeader(name, value);
      }
      res
        .status(response.status)
        .send(Buffer.from(await response.arrayBuffer()));
    } catch {
      res
        .status(503)
        .json({
          error: {
            code: "CAPABILITY_UNAVAILABLE",
            message: "Web data service is starting; retry shortly.",
            retryable: true,
          },
        });
    }
  });
}
