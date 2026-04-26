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

export function normalizeSlug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Normalize a raw "website" string into a bare hostname suitable for
 * the `tracked_companies.domain` column.
 *
 * YC-sourced website fields are notoriously dirty:
 *   - tracking parameters: `https://example.com?utm_source=yc`
 *   - hash fragments:      `https://munily.com/#/`
 *   - co-listed URLs:      `https://a.com, https://b.com`
 *   - protocol + www:      `https://www.example.com/path`
 *   - trailing port:       `example.com:8080`
 *
 * We strip all of the above so the result matches the bare-hostname regex
 * used by the YC seed generator and downstream URL builders. If the input
 * has multiple URLs co-listed (separated by commas, semicolons, or
 * whitespace), we keep the first one — that's the canonical website per
 * YC convention.
 *
 * Exported so the seed generator (`build-yc-seed.ts`) and unit tests can
 * use the exact same logic the importer uses.
 */
export function normalizeDomain(d: string): string {
  if (!d) return "";
  // Take the first usable URL when multiple are co-listed in one cell.
  // Splitter handles "a, b", "a , b", "a; b", and "a b". We skip pieces
  // that are just a bare protocol (`https://` with nothing after, often
  // left behind by sloppy YC profile editing like "https:// , https://x").
  const pieces = d.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean);
  const first = pieces.find((p) => !/^https?:\/\/$/i.test(p)) ?? pieces[0] ?? d;
  return first
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[?#].*$/, "") // strip query string and hash fragment
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

// Only run main() when invoked directly (e.g. `tsx server/scripts/import-companies.ts ...`).
// This guard lets sibling scripts/tests `import { normalizeDomain }` from this
// file without accidentally triggering a CSV import.
const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  main().catch((err) => {
    console.error("[import] fatal:", err);
    process.exit(1);
  });
}
