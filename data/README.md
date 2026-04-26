# `data/` — bulk-ingestion CSVs for the Stack Index

This directory holds CSVs that get imported into `tracked_companies` via the
ingestion script. CSVs here are tracked in git so the seed list is versioned
alongside the code that consumes it.

## CSV format

Required header row, columns in any order:

| column        | required | notes                                                              |
|---------------|----------|--------------------------------------------------------------------|
| `slug`        | yes      | URL-safe id (`a-z0-9-`). Lower-cased and dash-collapsed on import. |
| `name`        | yes      | Display name (`Notion`, `Stripe`).                                 |
| `domain`      | yes      | Bare hostname (`notion.so`). `https://` and `www.` are stripped.   |
| `category`    | yes      | Free-form label (`Productivity`, `Developer Tools`).               |
| `ycBatch`     | no       | `W26`, `S25` etc — leave empty for non-YC companies.               |
| `description` | no       | One-sentence blurb shown in the index card.                        |
| `url`         | no       | Override URL; defaults to `https://<domain>`.                      |
| `logoUrl`     | no       | Absolute URL to a small square thumbnail for the index card. Re-imports backfill `logo_url` on existing rows when the DB value is null. |
| `source`      | no       | Provenance label (`yc-w26`, `g2-top-200`). Falls back to `--source` flag. |

## Importing

```bash
# Dry run first — parses, normalizes, and prints sample row.
tsx server/scripts/import-companies.ts data/sample-companies.csv --dry-run

# Real import. Idempotent: rows whose slug OR domain already exist are skipped
# (but their `logo_url` is backfilled from the CSV when the DB value is null).
tsx server/scripts/import-companies.ts data/sample-companies.csv

# Tag every row in this file with a source label (per-row column wins if present).
tsx server/scripts/import-companies.ts data/yc-w26.csv --source=yc-w26
```

After import, new rows land in `tracked_companies` with:
- `lastScanId IS NULL` and `scanStatus = 'pending'` — i.e. stub mode
- `importedAt` = ingestion timestamp
- The background "stub drain" loop picks them up at most
  `STUB_DRAIN_PER_TICK` rows / tick (default 5) with at most
  `STUB_DRAIN_PER_HOST_MAX` (default 1) in-flight per host. See
  `server/background-worker.ts → runStubDrainCycle`.

## Bundled seed CSVs

| file                       | rows  | notes                                                                                                  |
|----------------------------|-------|--------------------------------------------------------------------------------------------------------|
| `sample-companies.csv`     | 5     | Tiny smoke-test fixture used by the docs above.                                                         |
| `yc-saas-1k.csv`           | ~1,300| Curated slice of active YC companies in B2B / Consumer / Fintech / Healthcare / Education / Gov / RE&C, sourced from the public yc-oss API (`https://yc-oss.github.io/api/companies/all.json`). Rows are ranked AI/SaaS-tagged → top-company → larger team → newer batch, normalized through the same slug/domain rules the importer uses. Tagged `source=yc-<batch>` per row. |

The seed populates `tracked_companies` to ~1,360 rows; the drain worker grinds
those `pending` rows down to scanned state at the cadence configured by
`STUB_DRAIN_PER_TICK`.

### Regenerating `yc-saas-1k.csv`

The CSV is produced by `server/scripts/build-yc-seed.ts`, which fetches the
public yc-oss API, applies the curation rules above, and writes the CSV in
place. Re-running is monotonic — every slug already in the existing CSV is
preserved (so old rows can never be silently dropped), and any row whose raw
website needs query-string / fragment / co-listed-URL cleanup is force-included
(so future tracking-parameter additions on YC profiles don't get dropped
again):

```bash
# Refresh the seed from yc-oss. Uses the existing CSV as a baseline.
tsx server/scripts/build-yc-seed.ts --out=data/yc-saas-1k.csv --limit=1300

# Then re-import. Idempotent — only newly-recoverable rows are inserted.
tsx server/scripts/import-companies.ts data/yc-saas-1k.csv --source=yc-oss-saas
```

A short assertion-style unit test for the URL cleanup lives at
`server/scripts/normalize-domain.test.ts` and can be run with
`tsx server/scripts/normalize-domain.test.ts`.

## Stub pages

Until a row is scanned, `/stack/<slug>` renders a stub: the company name,
description, "We haven't scanned this yet" CTA, breadcrumb back to the
category, and a strip of similar companies. The JSON-LD never claims a
provider for unscanned rows.
