/**
 * Build `data/yc-saas-1k.csv` from the public yc-oss API.
 *
 * Usage:
 *   tsx server/scripts/build-yc-seed.ts [--out=data/yc-saas-1k.csv] [--limit=1300]
 *
 * What it does
 *   - Fetches https://yc-oss.github.io/api/companies/all.json
 *   - Keeps Active companies in a curated set of YC industries
 *     (B2B / Consumer / Fintech / Healthcare / Education / Government /
 *     Real Estate and Construction).
 *   - Skips rows whose website is missing OR doesn't normalize to a bare
 *     hostname after `normalizeDomain` cleanup (utm tags, fragments,
 *     co-listed URLs are all handled by `normalizeDomain` now).
 *   - Ranks rows: AI/SaaS-tagged → top_company → larger team → newer batch.
 *   - Writes a CSV that the importer (`import-companies.ts`) can consume.
 *
 * Stability guarantee
 *   - If `--out` already exists, every row whose slug also appears in the
 *     fresh API pull is *preserved* in the output, even when it would
 *     otherwise rank below the cutoff. This keeps the seed monotonic so
 *     re-running the generator never silently drops a previously-imported
 *     row. The importer is idempotent on slug+domain so re-import only
 *     adds the newly-recoverable rows.
 */
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { normalizeDomain, normalizeSlug } from "./import-companies";

const YC_OSS_URL = "https://yc-oss.github.io/api/companies/all.json";

/** App-store / aggregator URLs that occasionally show up as a YC company's
 *  "website". Normalizing these gives us a generic host shared by thousands
 *  of unrelated apps, so we reject them outright rather than seeding the
 *  Stack Index with bogus rows. */
const BLOCKED_HOSTS = new Set([
  "play.google.com",
  "itunes.apple.com",
  "apps.apple.com",
  "apple.com",
  "facebook.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "github.com",
  "youtube.com",
  "instagram.com",
]);

const ALLOWED_INDUSTRIES = new Set([
  "B2B",
  "Consumer",
  "Fintech",
  "Healthcare",
  "Education",
  "Government",
  "Real Estate and Construction",
]);

const AI_SAAS_TAG_RE = /(^|\s)(ai|artificial intelligence|generative ai|llm|machine learning|saas|developer tools|api)(\s|$)/i;

interface YcCompany {
  slug: string;
  name: string;
  website: string | null;
  industry: string | null;
  subindustry: string | null;
  batch: string | null;
  status: string | null;
  team_size: number | null;
  top_company: boolean;
  tags: string[] | null;
  one_liner: string | null;
}

interface CliFlags {
  out: string;
  limit: number;
}

function parseArgs(argv: string[]): CliFlags {
  let out = "data/yc-saas-1k.csv";
  let limit = 1300;
  for (const arg of argv) {
    if (arg.startsWith("--out=")) out = arg.slice("--out=".length);
    else if (arg.startsWith("--limit=")) limit = parseInt(arg.slice("--limit=".length), 10) || limit;
  }
  return { out, limit };
}

/** YC subindustry strings look like "B2B -> Engineering, Product and Design".
 *  We keep the trailing leaf as the human-friendly category label, falling
 *  back to the top-level industry when there's no `->` separator.
 */
function deriveCategory(c: YcCompany): string {
  const sub = c.subindustry ?? "";
  const parts = sub.split(" -> ");
  return (parts.length > 1 ? parts[parts.length - 1] : parts[0] || c.industry || "Other").trim();
}

/** Convert "Winter 2022" → "W22", "Summer 2009" → "S09", etc.
 *  Returns null when the batch string doesn't fit the pattern (rare).
 */
function batchCode(batch: string | null): string | null {
  if (!batch) return null;
  const m = batch.match(/^(Winter|Summer|Spring|Fall|IK)\s+(\d{4})$/i);
  if (!m) return null;
  const season = m[1].toUpperCase().startsWith("W") ? "W"
    : m[1].toUpperCase().startsWith("S") && m[1].toLowerCase() === "summer" ? "S"
    : m[1].toUpperCase().startsWith("S") ? "X" // Spring → X to avoid colliding with Summer
    : m[1].toUpperCase().startsWith("F") ? "F"
    : "I";
  return `${season}${m[2].slice(2)}`;
}

/** Numeric score for ranking: higher = newer / bigger / more relevant. */
function rankScore(c: YcCompany): [number, number, number, number] {
  const tagsBlob = `${(c.tags ?? []).join(" ")} ${c.one_liner ?? ""}`;
  const aiSaas = AI_SAAS_TAG_RE.test(tagsBlob) ? 1 : 0;
  const top = c.top_company ? 1 : 0;
  const team = c.team_size ?? 0;
  const yearMatch = (c.batch ?? "").match(/(\d{4})$/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : 0;
  return [aiSaas, top, team, year];
}

function compareScore(a: [number, number, number, number], b: [number, number, number, number]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return b[i] - a[i];
  }
  return 0;
}

/** Quote a CSV cell only when it contains commas, quotes, or newlines. */
function csvCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** Read the slugs in an existing CSV (slug column is always first). */
async function readExistingSlugs(file: string): Promise<Set<string>> {
  try {
    const text = await readFile(file, "utf-8");
    const out = new Set<string>();
    const lines = text.split(/\r?\n/);
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      // First field; quoted fields are unusual for the slug column but
      // we handle them anyway by stopping at the first unquoted comma.
      const slug = line.startsWith('"')
        ? line.slice(1, line.indexOf('"', 1))
        : line.slice(0, line.indexOf(","));
      if (slug) out.add(slug);
    }
    return out;
  } catch {
    return new Set();
  }
}

async function main() {
  const { out, limit } = parseArgs(process.argv.slice(2));

  const previousSlugs = await readExistingSlugs(path.resolve(process.cwd(), out));
  if (previousSlugs.size > 0) {
    console.log(`[seed] preserving ${previousSlugs.size} slugs from existing ${out}`);
  }

  console.log(`[seed] fetching ${YC_OSS_URL}`);
  const res = await fetch(YC_OSS_URL);
  if (!res.ok) throw new Error(`yc-oss fetch failed: ${res.status} ${res.statusText}`);
  const all = (await res.json()) as YcCompany[];
  console.log(`[seed] fetched ${all.length} YC companies total`);

  const dedupedBySlug = new Map<string, YcCompany>();
  const dedupedByDomain = new Map<string, YcCompany>();
  const preserved = new Map<string, YcCompany>(); // previously-shipped, kept regardless of curation
  const rescued = new Map<string, YcCompany>(); // rows whose raw website needed query/fragment/multi-URL cleanup
  let droppedNoWebsite = 0;
  let droppedNoDomain = 0;
  let droppedIndustry = 0;
  let droppedInactive = 0;

  for (const c of all) {
    const slug = normalizeSlug(c.slug);
    if (!slug) continue;

    // Even preserved rows need a usable domain — without one we can't
    // import them anyway. Applies to all rows, preserved or new.
    if (!c.website) {
      if (!previousSlugs.has(slug)) droppedNoWebsite++;
      continue;
    }
    const domain = normalizeDomain(c.website);
    if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) || BLOCKED_HOSTS.has(domain)) {
      if (!previousSlugs.has(slug)) droppedNoDomain++;
      continue;
    }

    // Always preserve rows shipped in the previous CSV — even if their
    // status flipped to Inactive or industry changed, we don't want to
    // silently drop them from the seed (the DB keeps them anyway).
    if (previousSlugs.has(slug)) {
      if (!preserved.has(slug) && !dedupedByDomain.has(domain)) {
        preserved.set(slug, c);
        dedupedByDomain.set(domain, c);
      }
      continue;
    }

    if (c.status !== "Active") {
      droppedInactive++;
      continue;
    }
    if (!c.industry || !ALLOWED_INDUSTRIES.has(c.industry)) {
      droppedIndustry++;
      continue;
    }

    // Active row in an allowed industry: this is a regular candidate.
    // We also flag it as "rescued" when its raw website needed the
    // query-string / fragment / co-listed-URL cleanup that this task
    // (Task #15) added — those rows were silently dropped before and
    // we want to force-include them so a re-run actually recovers them
    // (rather than leaving them at the mercy of the rank cutoff).
    const needsRescue = /[?#,]/.test(c.website) || /\s/.test(c.website.trim());
    if (!dedupedBySlug.has(slug) && !dedupedByDomain.has(domain)) {
      dedupedBySlug.set(slug, c);
      dedupedByDomain.set(domain, c);
      if (needsRescue) rescued.set(slug, c);
    }
  }

  console.log(
    `[seed] preserved=${preserved.size} rescued=${rescued.size} new-candidates=${dedupedBySlug.size} ` +
      `(dropped new: inactive=${droppedInactive}, ` +
      `industry=${droppedIndustry}, ` +
      `no-website=${droppedNoWebsite}, ` +
      `bad-domain=${droppedNoDomain})`,
  );

  const ranked = Array.from(dedupedBySlug.values()).sort((a, b) =>
    compareScore(rankScore(a), rankScore(b)),
  );

  // Pick order:
  //  1. Preserved rows from the existing CSV (never lose history).
  //  2. Rescued rows whose raw website needed query/fragment/multi-URL
  //     cleanup — these were the ones the importer used to silently
  //     drop, so we force-include them regardless of where they rank.
  //  3. Top-ranked new candidates to fill out to `limit`.
  // If preserved alone exceeds the limit, we keep them all anyway —
  // never silently drop.
  const finalSlugs = new Set<string>();
  const picked: YcCompany[] = [];
  for (const c of Array.from(preserved.values())) {
    if (!finalSlugs.has(c.slug)) {
      finalSlugs.add(c.slug);
      picked.push(c);
    }
  }
  let rescuedAdded = 0;
  for (const c of Array.from(rescued.values())) {
    if (!finalSlugs.has(c.slug)) {
      finalSlugs.add(c.slug);
      picked.push(c);
      rescuedAdded++;
    }
  }
  let newAdded = 0;
  for (const c of ranked) {
    if (picked.length >= limit) break;
    if (finalSlugs.has(c.slug)) continue;
    finalSlugs.add(c.slug);
    picked.push(c);
    newAdded++;
  }
  console.log(
    `[seed] writing ${picked.length} rows ` +
      `(preserved=${preserved.size}, rescued=${rescuedAdded}, new=${newAdded}, limit=${limit})`,
  );

  const header = "slug,name,domain,category,ycBatch,description,source";
  const lines = [header];
  for (const c of picked) {
    const slug = normalizeSlug(c.slug);
    const domain = normalizeDomain(c.website ?? "");
    const category = deriveCategory(c);
    const yc = batchCode(c.batch);
    const desc = (c.one_liner ?? "").trim();
    const source = yc ? `yc-${yc.toLowerCase()}` : "yc-oss";
    lines.push(
      [slug, c.name, domain, category, yc ?? "", desc, source]
        .map((v) => csvCell(String(v ?? "")))
        .join(","),
    );
  }

  const abs = path.resolve(process.cwd(), out);
  await writeFile(abs, lines.join("\n") + "\n", "utf-8");
  console.log(`[seed] wrote ${picked.length} rows to ${abs}`);

  // Post-build assertion: a known set of YC slugs whose website fields had
  // tracking parameters / fragments / co-listed URLs (Task #15) MUST appear
  // in the output. If yc-oss later drops any of these slugs entirely, we
  // log a warning instead of failing — but if they're present in the API
  // and missing from our CSV, that means our rescue path regressed and we
  // hard-fail the build.
  const KNOWN_RESCUED_SLUGS = [
    "officely",
    "sigmamind-ai",
    "munily",
    "flightcontrol",
    "hyperbeam",
    "laudspeaker",
  ];
  const apiSlugs = new Set(all.map((c) => normalizeSlug(c.slug)));
  const missing = KNOWN_RESCUED_SLUGS.filter(
    (s) => apiSlugs.has(s) && !finalSlugs.has(s),
  );
  if (missing.length > 0) {
    console.error(
      `[seed] FAIL: known rescued slugs missing from output: ${missing.join(", ")}\n` +
        `       The Task #15 rescue path likely regressed. Check normalizeDomain ` +
        `and the rescue branch in build-yc-seed.ts.`,
    );
    process.exit(1);
  }
  const dropped = KNOWN_RESCUED_SLUGS.filter((s) => !apiSlugs.has(s));
  if (dropped.length > 0) {
    console.warn(
      `[seed] note: ${dropped.length} known rescued slugs no longer in yc-oss ` +
        `(likely renamed or removed): ${dropped.join(", ")}`,
    );
  }
  console.log(
    `[seed] rescue check ok: ${KNOWN_RESCUED_SLUGS.length - dropped.length}/${KNOWN_RESCUED_SLUGS.length} known dirty-URL slugs present in output`,
  );
}

main().catch((err) => {
  console.error("[seed] fatal:", err);
  process.exit(1);
});
