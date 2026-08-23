import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import pg from "pg";

const { Client } = pg;
const root = resolve(import.meta.dirname, "..");
const sourceUrlPath = resolve(root, "exports/replit-production-database-url.txt");
const jsonPath = resolve(root, "exports/aihackr-production.json");
const sqlPath = resolve(root, "exports/aihackr-production-d1.sql");

// Parent tables precede their dependants so D1 can keep foreign-key checks on.
const tables = [
  "users",
  "magic_links",
  "scans",
  "sessions",
  "subscriptions",
  "change_events",
  "user_settings",
  "show_hn_products",
  "show_hn_reports",
  "tracked_companies",
  "provider_rollups",
  "leaderboard_snapshots",
];

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function quoteValue(value) {
  if (value == null) return "NULL";
  if (value instanceof Date) return String(Math.floor(value.getTime() / 1000));
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (Buffer.isBuffer(value)) return `X'${value.toString("hex")}'`;
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `'${text.replaceAll("\0", "").replaceAll("'", "''")}'`;
}

await mkdir(dirname(jsonPath), { recursive: true });
const connectionString = (await readFile(sourceUrlPath, "utf8")).trim();
const client = new Client({
  connectionString,
  connectionTimeoutMillis: 20_000,
  ssl: { rejectUnauthorized: false },
});

const backup = {};
const sql = ["PRAGMA foreign_keys = ON;"];

try {
  await client.connect();
  for (const table of tables) {
    const result = await client.query(`SELECT * FROM ${quoteIdentifier(table)}`);
    backup[table] = result.rows;
    for (const row of result.rows) {
      const columns = Object.keys(row);
      sql.push(
        `INSERT INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(", ")}) VALUES (${columns.map((column) => quoteValue(row[column])).join(", ")});`,
      );
    }
    console.log(`${table}: ${result.rowCount}`);
  }
} finally {
  await client.end().catch(() => undefined);
}

await writeFile(jsonPath, JSON.stringify(backup, null, 2), { mode: 0o600 });
await writeFile(sqlPath, `${sql.join("\n")}\n`, { mode: 0o600 });
console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${sqlPath}`);
