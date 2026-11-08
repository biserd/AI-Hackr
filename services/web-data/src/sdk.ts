import { randomUUID } from "node:crypto";
import type { Args, Operation } from "./contracts.js";
export class AIHackr {
  constructor(
    public apiKey: string,
    public baseUrl = "http://127.0.0.1:4100",
  ) {}
  async request(path: string, body?: Args) {
    const key = body?.idempotencyKey;
    for (let attempt = 0; ; attempt++) {
      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/v1/${path}`, {
          method: body ? "POST" : "GET",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            ...(key ? { "Idempotency-Key": key } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(15000),
        });
      } catch (e) {
        if (attempt >= 2 || (body && !key)) throw e;
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
        continue;
      }
      const result = (await response.json()) as Args;
      if (!response.ok) {
        if (
          attempt < 2 &&
          key &&
          [429, 502, 503, 504].includes(response.status)
        ) {
          await new Promise((r) =>
            setTimeout(
              r,
              Number(response.headers.get("retry-after") ?? 2) * 1000,
            ),
          );
          continue;
        }
        throw Object.assign(
          new Error(result.error?.message ?? "AIHackr request failed"),
          { status: response.status, ...result.error },
        );
      }
      return result;
    }
  }
  run(operation: Operation, args: Args) {
    return this.request(operation, {
      ...args,
      idempotencyKey: args.idempotencyKey ?? randomUUID(),
    });
  }
  quote(operation: Operation, input: Args) {
    return this.request("quote", { operation, input });
  }
  usage() {
    return this.request("usage");
  }
  job(id: string) {
    return this.request(`jobs/${encodeURIComponent(id)}`);
  }
  result(id: string, cursor?: string) {
    return this.request(
      `results/${encodeURIComponent(id)}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
  }
  async wait(jobId: string, timeoutMs = 180000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const job = await this.job(jobId);
      if (!["queued", "running"].includes(job.status)) return job;
      if (Date.now() >= deadline)
        throw new Error("Polling deadline exceeded; job may still be running.");
      await new Promise((r) =>
        setTimeout(r, (job.retryAfterSeconds ?? 2) * 1000),
      );
    }
  }
}
