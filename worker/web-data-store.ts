import { DurableObject } from "cloudflare:workers";
import { createHash, timingSafeEqual } from "node:crypto";
import { Store } from "../services/web-data/src/store";
import { Billing } from "../services/web-data/src/billing";
import { AppError } from "../services/web-data/src/contracts";
import type { Database } from "../services/web-data/src/db";
import { CloudflareSqliteDatabase } from "./web-data-sqlite";
import { webDataSchema } from "./web-data-schema";
const methods = new Set([
  "provision",
  "issueKey",
  "key",
  "connection",
  "quote",
  "reserve",
  "claim",
  "heartbeat",
  "active",
  "unit",
  "settle",
  "reconcile",
  "getJob",
  "status",
  "cancel",
  "result",
  "cache",
  "cachePut",
  "usage",
  "batch",
  "linkOAuth",
]);
export class WebDataStore extends DurableObject<Env> {
  private store: Store;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(webDataSchema);
    });
    this.store = new Store(
      new CloudflareSqliteDatabase(ctx.storage) as unknown as Database,
    );
  }
  async fetch(request: Request) {
    const expected = this.env.WEB_DATA_STORAGE_TOKEN;
    const digest = (value: string) =>
      createHash("sha256").update(value).digest();
    if (
      !expected ||
      !timingSafeEqual(
        digest(expected),
        digest(request.headers.get("X-AIHackr-Storage") ?? ""),
      )
    )
      return Response.json(
        {
          error: {
            code: "AUTH_REQUIRED",
            message: "Private storage authentication required.",
            status: 401,
          },
        },
        { status: 401 },
      );
    if (request.method !== "POST")
      return new Response("Method Not Allowed", { status: 405 });
    try {
      const { method, args } = await request.json<{
        method: string;
        args: any[];
      }>();
      if (!Array.isArray(args) || args.length > 10)
        throw new AppError("INVALID_INPUT", "Invalid storage RPC.");
      let value;
      if (method === "query") {
        value = await this.store.db.tx((q) => q.query(args[0], args[1]));
      } else if (method === "billing.event") {
        value = await new Billing(this.store).event(args[0]);
      } else {
        if (!methods.has(method))
          throw new AppError("INVALID_INPUT", "Unknown storage operation.");
        value = await (this.store as any)[method](...args);
      }
      return Response.json({ value: value ?? null });
    } catch (e) {
      const error =
        e instanceof AppError
          ? e
          : new AppError(
              "STORAGE_ERROR",
              "Durable storage operation failed.",
              500,
            );
      if (!(e instanceof AppError))
        console.error(
          "web_data_storage_error",
          e instanceof Error ? e.message : "unknown",
        );
      return Response.json(
        {
          error: {
            code: error.code,
            message: error.message,
            status: error.status,
            retryable: error.retryable,
            details: error.details,
          },
        },
        { status: error.status },
      );
    }
  }
}
