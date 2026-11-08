import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";

export const priceVersion = "beta-1";
export const prices = {
  priceVersion,
  creditsPerPack: 12500,
  packCents: 1000,
  trial: 100,
  http: 1,
  browser: 5,
  extraction: 3,
  search10: 2,
  search20: 4,
  cache: 0,
} as const;
export const limits = {
  fetchSeconds: 20,
  browserSeconds: 45,
  redirects: 5,
  responseBytes: 5 * 1024 * 1024,
  decodedBytes: 10 * 1024 * 1024,
  searchResults: 20,
  crawlPages: 100,
  crawlDepth: 3,
  researchSearches: 2,
  researchPages: 6,
  researchSeconds: 180,
  mcpCharacters: 12000,
  resultCharacters: 32000,
  retentionHours: 24,
};
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public retryable = false,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
  envelope(requestId = id("req")) {
    return {
      error: {
        code: this.code,
        message: this.message,
        retryable: this.retryable,
        retryAfterSeconds: this.retryable ? 2 : null,
        suggestedAction:
          this.status === 503
            ? "Configure this capability or choose an available operation."
            : null,
        requestId,
        creditsCharged: 0,
        ...this.details,
      },
    };
  }
}
export const id = (prefix: string) => `${prefix}_${randomUUID()}`;
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
}
export const hash = (value: unknown) =>
  createHash("sha256").update(canonical(value)).digest("hex");
export const opaque = z.string().min(1).max(200);
const url = z.string().url().max(2048);
const common = {
  maxCredits: z.number().int().min(0).max(10000),
  quoteId: opaque.optional(),
  idempotencyKey: opaque.optional(),
};
const retrieval = {
  formats: z
    .array(z.enum(["markdown", "text", "html", "links"]))
    .min(1)
    .max(4)
    .default(["markdown"]),
  render: z.enum(["http", "auto", "browser"]).default("auto"),
  maxAgeSeconds: z.number().int().min(0).max(86400).default(3600),
};
const paths = z.array(z.string().startsWith("/").max(300)).max(20).default([]);
export const schemas = {
  scrape: z
    .object({
      url,
      ...retrieval,
      ...common,
      maxCredits: common.maxCredits.default(5),
    })
    .strict(),
  search: z
    .object({
      query: z.string().min(1).max(500),
      limit: z.number().int().min(1).max(20).default(10),
      country: z
        .string()
        .regex(/^[A-Z]{2}$/)
        .optional(),
      language: z
        .string()
        .regex(/^[a-z]{2}$/)
        .optional(),
      ...common,
      maxCredits: common.maxCredits.default(4),
    })
    .strict(),
  extract: z
    .object({
      url: url.optional(),
      resultId: opaque.optional(),
      schema: z.record(z.string(), z.unknown()),
      instruction: z.string().max(2000).optional(),
      ...retrieval,
      ...common,
      maxCredits: common.maxCredits.default(10),
    })
    .strict()
    .refine(
      (x) => Boolean(x.url) !== Boolean(x.resultId),
      "Provide exactly one of url or resultId",
    ),
  map: z
    .object({
      url,
      limit: z.number().int().min(1).max(100).default(20),
      includePaths: paths,
      excludePaths: paths,
      ...common,
      maxCredits: common.maxCredits.default(5),
    })
    .strict(),
  crawl: z
    .object({
      url,
      maxPages: z.number().int().min(1).max(100).default(20),
      maxDepth: z.number().int().min(0).max(3).default(2),
      includePaths: paths,
      excludePaths: paths,
      ...retrieval,
      ...common,
      maxCredits: common.maxCredits.default(100),
    })
    .strict(),
  research: z
    .object({
      objective: z.string().min(1).max(2000),
      startingUrls: z.array(url).max(6).default([]),
      schema: z.record(z.string(), z.unknown()).optional(),
      maxSearches: z.number().int().min(0).max(2).default(2),
      maxPages: z.number().int().min(1).max(6).default(6),
      ...common,
      maxCredits: common.maxCredits.default(50),
    })
    .strict(),
};
export type Operation = keyof typeof schemas;
export type Args = Record<string, any>;
export type Principal = {
  tenant: string;
  connection: string;
  scopes: string[];
  owner?: boolean;
};
export type Source = {
  sourceId: string;
  url: string;
  finalUrl: string;
  observedAt: string;
  publishedAt: null;
  contentHash: string;
  method: "http" | "browser" | "fixture";
};
export type Page = {
  title: string;
  markdown: string;
  text: string;
  html: string;
  links: string[];
  source: Source;
  cacheHit?: boolean;
  ageSeconds?: number;
  fixtureJson?: Record<string, unknown>;
};
export function parse(operation: Operation, input: unknown): Args {
  const r = schemas[operation].safeParse(input);
  if (!r.success)
    throw new AppError(
      "INVALID_INPUT",
      r.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; "),
    );
  const data = r.data as Args;
  if (data.schema) validateSchema(data.schema);
  return data;
}
export function billableArgs(args: Args) {
  const { quoteId: _q, idempotencyKey: _i, ...rest } = args;
  return rest;
}
export function ceiling(op: Operation, a: Args) {
  const page = a.render === "http" ? 1 : 5;
  switch (op) {
    case "search":
      return a.limit > 10 ? 4 : 2;
    case "scrape":
      return page;
    case "extract":
      return (a.url ? page : 0) + 3;
    case "map":
      return 1;
    case "crawl":
      return a.maxPages * page;
    case "research":
      return (
        (a.startingUrls.length ? 0 : a.maxSearches * 2) +
        a.maxPages * (a.schema ? 8 : 5)
      );
  }
}
export function validateSchema(schema: unknown, depth = 0): void {
  if (
    depth > 8 ||
    !schema ||
    typeof schema !== "object" ||
    Array.isArray(schema)
  )
    throw new AppError(
      "INVALID_INPUT",
      "Schema must be a bounded JSON Schema object.",
    );
  const s = schema as Args;
  const allowed = [
    "type",
    "properties",
    "required",
    "additionalProperties",
    "items",
    "maxItems",
    "minItems",
    "enum",
    "description",
    "maxLength",
    "minLength",
    "minimum",
    "maximum",
    "anyOf",
    "const",
    "title",
  ];
  for (const key of Object.keys(s))
    if (!allowed.includes(key))
      throw new AppError("INVALID_INPUT", `Unsupported schema keyword: ${key}`);
  if (
    s.type === "array" &&
    (!Number.isInteger(s.maxItems) || s.maxItems > 100 || s.maxItems < 0)
  )
    throw new AppError("INVALID_INPUT", "Arrays require maxItems <= 100.");
  if (s.properties) {
    if (Object.keys(s.properties).length > 50)
      throw new AppError("INVALID_INPUT", "Too many schema properties.");
    for (const v of Object.values(s.properties)) validateSchema(v, depth + 1);
  }
  if (s.items) validateSchema(s.items, depth + 1);
  if (s.anyOf) {
    if (!Array.isArray(s.anyOf) || s.anyOf.length > 5)
      throw new AppError("INVALID_INPUT", "Too many schema branches.");
    for (const v of s.anyOf) validateSchema(v, depth + 1);
  }
  if (Buffer.byteLength(JSON.stringify(schema)) > 16000)
    throw new AppError("INVALID_INPUT", "Schema is too large.");
}
export function requireScope(p: Principal, scope: string) {
  if (!p.scopes.includes(scope))
    throw new AppError("SCOPE_REQUIRED", `Requires ${scope}.`, 403);
}
