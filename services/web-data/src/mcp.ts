import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Express } from "express";
import { z } from "zod";
import {
  AppError,
  limits,
  opaque,
  schemas,
  type Args,
  type Principal,
} from "./contracts.js";
import type { Service } from "./service.js";
export const toolSchemas = {
  ...schemas,
  capabilities: z.object({}).strict(),
  quote: z
    .object({
      operation: z.enum([
        "scrape",
        "search",
        "extract",
        "map",
        "crawl",
        "research",
      ]),
      input: z.record(z.string(), z.unknown()),
    })
    .strict(),
  job: z
    .object({
      jobId: opaque,
      action: z.enum(["status", "cancel"]).default("status"),
    })
    .strict(),
  get_result: z
    .object({
      resultId: opaque,
      cursor: z.string().max(500).optional(),
      pageSize: z.number().int().min(1).max(8000).default(8000),
    })
    .strict(),
  usage: z.object({}).strict(),
};
export const descriptions: Record<string, string> = {
  capabilities:
    "Free discovery: inspect available providers, prices, hard limits, cache freshness and retention before choosing work.",
  quote:
    "Free quote for exact bounded arguments. Does not retrieve content or reserve credits; valid five minutes.",
  search:
    "Search unknown URLs without scraping the results. Uses prepaid credits; result limit 20. Poll the returned job handle.",
  scrape:
    "Read a known public URL as Markdown, text, bounded HTML or links. Paid fresh usable pages; cache hits free. No model call. Poll the returned job.",
  extract:
    "Extract source-supported JSON using a bounded schema from one URL or authorized result. Separate page and extraction charges. Missing evidence returns a partial job. Poll the returned job.",
  map: "Discover same-origin links from one page. Charges the discovery fetch; does not claim exhaustive site coverage. Poll the returned job.",
  crawl:
    "Start a bounded same-origin crawl. Max 100 pages and depth 3, prepaid ceiling covers all children. Poll with backoff and page results.",
  research:
    "Start bounded research: at most two searches and six public pages, optional schema extraction. Preserves partial sources; uses explicit prepaid cap. Poll with backoff.",
  job: "Inspect job status for free or request cancellation. Cancellation changes account state and lets already-started units settle. Tenant-owned handles only.",
  get_result:
    "Read retained authorized result content for free. Follow nextCursor to expand content; default output is compact. Expired content is unavailable.",
  usage:
    "Inspect your balance, reservations, posted charges and spending limits for free. Cannot purchase credits or change limits.",
};
const usageSchema = z
  .object({
    creditsCharged: z.number().int().nonnegative(),
    priceVersion: z.string(),
  })
  .passthrough();
const jobOutput = z
  .object({
    jobId: z.string(),
    status: z.enum([
      "queued",
      "running",
      "completed",
      "partial",
      "failed",
      "canceled",
    ]),
    operation: z.string(),
    usage: usageSchema,
    resultIds: z.array(z.string()).max(100),
    stopReason: z.string().nullable(),
    retryAfterSeconds: z.number().nullable(),
  })
  .passthrough();
export const outputSchemas: Record<string, z.ZodObject<any>> = {
  ...Object.fromEntries(Object.keys(schemas).map((k) => [k, jobOutput])),
  job: jobOutput,
  capabilities: z
    .object({
      apiVersion: z.string(),
      priceVersion: z.string(),
      mode: z.enum(["fixture", "live"]),
      available: z.record(z.string(), z.boolean()),
      limits: z.record(z.string(), z.number()),
      retention: z.object({
        contentHours: z.number(),
        metadataDays: z.number(),
        idempotencyDays: z.number(),
      }),
    })
    .passthrough(),
  quote: z
    .object({
      quoteId: z.string(),
      operation: z.string(),
      normalizedArgs: z.record(z.string(), z.unknown()),
      minCredits: z.number(),
      maxCredits: z.number(),
      expiresAt: z.string(),
      priceVersion: z.string(),
    })
    .passthrough(),
  usage: z
    .object({
      balance: z.number().int(),
      reserved: z.number().int().nonnegative(),
      spendable: z.number().int(),
      limits: z.record(z.string(), z.union([z.number(), z.string()])),
      ledger: z.array(z.record(z.string(), z.unknown())).max(100),
    })
    .passthrough(),
  get_result: z
    .object({
      requestId: z.string(),
      resultId: z.string(),
      status: z.enum(["completed", "partial"]),
      data: z.record(z.string(), z.unknown()),
      sources: z.array(
        z
          .object({
            sourceId: z.string(),
            url: z.string(),
            finalUrl: z.string(),
            observedAt: z.string(),
            method: z.string(),
          })
          .passthrough(),
      ),
      cache: z.object({ hit: z.boolean(), ageSeconds: z.number() }),
      usage: usageSchema,
      coverage: z.object({
        complete: z.boolean(),
        reason: z.string().nullable(),
      }),
      warnings: z.array(z.string()),
      truncated: z.boolean(),
      nextCursor: z.string().nullable(),
      expiresAt: z.string(),
    })
    .passthrough(),
};
const errorOutput = z.object({
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      retryable: z.boolean(),
      requestId: z.string(),
      creditsCharged: z.number(),
    })
    .passthrough(),
});
// The published root stays an object and explicitly permits recoverable domain errors.
export const protocolOutputSchemas = Object.fromEntries(
  Object.entries(outputSchemas).map(([kind, success]) => [
    kind,
    z
      .object({})
      .passthrough()
      .meta({
        anyOf: [
          z.toJSONSchema(success, { target: "draft-7" }),
          z.toJSONSchema(errorOutput, { target: "draft-7" }),
        ],
      }),
  ]),
);
export function makeMcp(service: Service, principal: Principal) {
  const server = new McpServer({ name: "AIHackr", version: "0.1.0" });
  for (const [kind, schema] of Object.entries(toolSchemas))
    server.registerTool(
      `aihackr_${kind}`,
      {
        description: descriptions[kind],
        inputSchema: schema,
        outputSchema: protocolOutputSchemas[kind],
        annotations: {
          readOnlyHint: ![
            "job",
            "scrape",
            "extract",
            "map",
            "crawl",
            "research",
            "search",
          ].includes(kind),
          destructiveHint: false,
          idempotentHint: [
            "capabilities",
            "quote",
            "get_result",
            "usage",
          ].includes(kind),
          openWorldHint: [
            "scrape",
            "extract",
            "map",
            "crawl",
            "research",
            "search",
          ].includes(kind),
        },
      },
      async (args: Args) => {
        try {
          const result = await service.inspect(
            principal,
            kind,
            schema.parse(args),
          );
          outputSchemas[kind].parse(result);
          const structuredContent = compact(result);
          return {
            structuredContent,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(structuredContent),
              },
            ],
          };
        } catch (e) {
          const error =
            e instanceof AppError
              ? e
              : new AppError(
                  "INVALID_INPUT",
                  "Tool request could not be completed.",
                );
          const envelope = error.envelope();
          return {
            isError: true,
            structuredContent: envelope,
            content: [
              { type: "text" as const, text: JSON.stringify(envelope) },
            ],
          };
        }
      },
    );
  return server;
}
function compact(result: Args) {
  if (JSON.stringify(result).length <= limits.mcpCharacters) return result;
  const trim = (x: any): any =>
    typeof x === "string"
      ? x.slice(0, 500)
      : Array.isArray(x)
        ? x.slice(0, 10).map(trim)
        : x && typeof x === "object"
          ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, trim(v)]))
          : x;
  let value = trim(result);
  if (JSON.stringify(value).length > limits.mcpCharacters)
    value = {
      ...result,
      data: {},
      trace: [],
      sources: result.sources?.slice(0, 1),
      ledger: result.ledger?.slice(0, 3),
      coverage: {
        complete: false,
        reason:
          "Compact MCP output; inspect retained result through REST for the complete structured payload.",
      },
    };
  return {
    ...value,
    truncated: true,
    warnings: [
      ...(result.warnings ?? []),
      "Compact MCP output. Use retained result pagination for full content.",
    ],
  };
}
export function mountMcp(app: Express, service: Service) {
  app.post("/mcp", async (req, res, next) => {
    const server = makeMcp(service, res.locals.principal);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      next(e);
    }
  });
  app.all("/mcp", (_req, res) => {
    res.setHeader("Allow", "POST");
    res.status(405).json({
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Use Streamable HTTP POST.",
      },
    });
  });
}
