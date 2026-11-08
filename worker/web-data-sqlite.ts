import type { Query } from "../services/web-data/src/db";
export function sqliteSql(sql: string) {
  return sql
    .replace(
      /date_trunc\('day',now\(\) AT TIME ZONE 'UTC'\) AT TIME ZONE 'UTC'/g,
      "strftime('%Y-%m-%dT00:00:00.000Z','now')",
    )
    .replace(
      /now\(\)\s*([+-])\s*interval\s*'([^']+)'/g,
      (_m, sign, interval) =>
        `(strftime('%Y-%m-%dT%H:%M:%fZ','now','${sign}${interval}'))`,
    )
    .replace(/now\(\)/g, "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))")
    .replace(/\s+FOR UPDATE(?: SKIP LOCKED)?/g, "")
    .replace(/::integer/g, "")
    .replace(/GREATEST\(/g, "MAX(")
    .replace(/\$(\d+)/g, "?$1");
}
const jsonColumns = new Set(["scopes", "args", "body", "metrics", "data"]);
const boolColumns = new Set([
  "blocked",
  "revoked",
  "cancel_requested",
  "granted",
]);
export function sqliteRows(rows: Record<string, any>[]) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        value !== null && jsonColumns.has(key) && typeof value === "string"
          ? JSON.parse(value)
          : boolColumns.has(key)
            ? Boolean(value)
            : value,
      ]),
    ),
  );
}
export class CloudflareSqliteDatabase {
  constructor(private storage: DurableObjectStorage) {}
  async tx<T>(fn: (q: Query) => Promise<T>): Promise<T> {
    return this.storage.transaction(async () =>
      fn({
        query: async <T = any>(sql: string, params: any[] = []) => ({
          rows: sqliteRows(
            this.storage.sql
              .exec(
                sqliteSql(sql),
                ...params.map((v) =>
                  typeof v === "boolean" ? Number(v) : (v ?? null),
                ),
              )
              .toArray(),
          ) as T[],
        }),
      }),
    );
  }
  async close() {}
}
