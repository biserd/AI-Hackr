/**
 * Bulk-import tracked companies from a CSV file.
 *
 * Usage:
 *   tsx server/scripts/import-companies.ts <path/to/file.csv> [--dry-run] [--source=<label>]
 *
 * CSV columns (header row required):
 *   slug,name,domain,category[,ycBatch][,description][,url][,source]
 *
 *  - `url` is auto-derived from `domain` if omitted (https://<domain>).
 *  - `source` per-row beats the --source flag; both are optional.
 *  - The script is idempotent: rows whose slug OR domain already exist
 *    in `tracked_companies` are skipped.
 *
 * The importer normalizes slugs (lowercase, alnum + dashes only) and
 * domains (strip protocol, trailing slash, www. prefix). It dedupes
 * within the input batch as well so a single CSV with duplicates won't
 * race against itself.
 */
import { readFile } from "fs/promises";
import path from "path";
import { storage } from "../storage";
import type { InsertTrackedCompany } from "@shared/schema";

interface CliFlags {
  dryRun: boolean;
  source?: string;
  file: string;
}

function parseArgs(argv: string[]): CliFlags {
  let file = "";
  let dryRun = false;
  let source: string | undefined;
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--source=")) source = arg.slice("--source=".length);
    else if (!arg.startsWith("--")) file = arg;
  }
  if (!file) {
    console.error("usage: tsx server/scripts/import-companies.ts <file.csv> [--dry-run] [--source=<label>]");
    process.exit(1);
  }
  return { dryRun, source, file };
}

function normalizeSlug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeDomain(d: string): string {
  return d
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

/**
 * Tiny CSV parser that handles quoted fields and embedded commas.
 * We deliberately avoid pulling in a CSV dep — the format we accept is
 * narrow (no embedded newlines), so a line-based parser is plenty.
 */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const splitRow = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else {
        if (ch === ",") {
          out.push(cur);
          cur = "";
        } else if (ch === '"') {
          inQuotes = true;
        } else {
          cur += ch;
        }
      }
    }
    out.push(cur);
    return out.map((v) => v.trim());
  };

  const headers = splitRow(lines[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitRow(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

async function main() {
  const { dryRun, source, file } = parseArgs(process.argv.slice(2));
  const abs = path.resolve(process.cwd(), file);
  const text = await readFile(abs, "utf-8");
  const raw = parseCsv(text);

  const required = ["slug", "name", "domain", "category"];
  const headerKeys = Object.keys(raw[0] ?? {});
  for (const r of required) {
    if (!headerKeys.includes(r)) {
      console.error(`CSV missing required column: ${r} (have: ${headerKeys.join(", ")})`);
      process.exit(1);
    }
  }

  const now = new Date();
  const rows: InsertTrackedCompany[] = [];
  const malformed: Array<{ idx: number; reason: string }> = [];

  raw.forEach((r, idx) => {
    const slug = normalizeSlug(r.slug);
    const name = r.name.trim();
    const domain = normalizeDomain(r.domain);
    const category = r.category.trim();
    if (!slug || !name || !domain || !category) {
      malformed.push({ idx: idx + 2, reason: "missing slug/name/domain/category" });
      return;
    }
    rows.push({
      slug,
      name,
      domain,
      url: r.url?.trim() || `https://${domain}`,
      category,
      ycBatch: r.ycBatch?.trim() || null,
      description: r.description?.trim() || null,
      source: r.source?.trim() || source || null,
      importedAt: now,
      status: "live",
      scanStatus: "pending",
    });
  });

  console.log(`[import] parsed ${rows.length} rows (${malformed.length} malformed skipped) from ${abs}`);
  if (malformed.length > 0) {
    console.warn(`[import] malformed rows:`, malformed.slice(0, 10));
  }

  if (dryRun) {
    console.log(`[import] DRY RUN — would attempt to insert ${rows.length} rows`);
    console.log(`[import] sample row:`, rows[0]);
    process.exit(0);
  }

  const result = await storage.bulkImportCompanies(rows);
  console.log(
    `[import] inserted=${result.inserted} skipped=${result.skipped} total=${result.total}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[import] fatal:", err);
  process.exit(1);
});
