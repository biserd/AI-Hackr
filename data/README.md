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

## Stub pages

Until a row is scanned, `/stack/<slug>` renders a stub: the company name,
description, "We haven't scanned this yet" CTA, breadcrumb back to the
category, and a strip of similar companies. The JSON-LD never claims a
provider for unscanned rows.
