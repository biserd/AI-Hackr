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
| `source`      | no       | Provenance label (`yc-w26`, `g2-top-200`). Falls back to `--source` flag. |

## Importing

```bash
# Dry run first — parses, normalizes, and prints sample row.
tsx server/scripts/import-companies.ts data/sample-companies.csv --dry-run

# Real import. Idempotent: rows whose slug OR domain already exist are skipped.
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
| `yc-saas-1k.csv`           | 1,200 | Curated 1.2k slice of active YC companies in B2B / Consumer / Fintech / Healthcare / Education / Gov / RE&C, sourced from the public yc-oss API (`https://yc-oss.github.io/api/companies/all.json`). Rows are ranked AI/SaaS-tagged → top-company → larger team → newer batch, normalized through the same slug/domain rules the importer uses. Tagged `source=yc-<batch>` per row. |

The 1k seed already imported in this environment populates `tracked_companies`
to ~1,247 rows; the drain worker grinds those `pending` rows down to scanned
state at the cadence configured by `STUB_DRAIN_PER_TICK`.

## Stub pages

Until a row is scanned, `/stack/<slug>` renders a stub: the company name,
description, "We haven't scanned this yet" CTA, breadcrumb back to the
category, and a strip of similar companies. The JSON-LD never claims a
provider for unscanned rows.
