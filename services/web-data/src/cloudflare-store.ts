import { AppError } from "./contracts.js";
import { Store } from "./store.js";
import type { Database, Query } from "./db.js";
export function cloudflareStore(
  endpoint = "http://web-data.internal/rpc",
  storageToken = process.env.WEB_DATA_STORAGE_TOKEN,
): Store {
  const call = async (method: string, args: unknown[]) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AIHackr-Storage": storageToken ?? "",
      },
      body: JSON.stringify({ method, args }),
      signal: AbortSignal.timeout(30000),
    });
    const data = (await response.json()) as any;
    if (!response.ok || data.error)
      throw new AppError(
        data.error?.code ?? "STORAGE_UNAVAILABLE",
        data.error?.message ?? "Durable storage unavailable.",
        data.error?.status ?? 503,
        data.error?.retryable ?? true,
        data.error?.details ?? {},
      );
    return data.value;
  };
  const db = {
    tx: async <T>(fn: (q: Query) => Promise<T>) => {
      let queries = 0;
      return fn({
        query: async (sql: string, params?: any[]) => {
          if (++queries > 1)
            throw new Error(
              "Remote multi-statement transactions must use a domain RPC or Store.batch.",
            );
          return call("query", [sql, params ?? []]);
        },
      });
    },
    close: async () => {},
    migrate: async () => {
      await call("query", ["SELECT 1", []]);
    },
  } as unknown as Database;
  const store = new Store(db);
  return new Proxy(store, {
    get(target, key) {
      if (key === "remote") return call;
      if (key === "db") return db;
      if (typeof key === "string" && typeof (target as any)[key] === "function")
        return (...args: unknown[]) => call(key, args);
      return Reflect.get(target, key);
    },
  });
}
