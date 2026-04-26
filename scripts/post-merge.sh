#!/bin/bash
set -e

# Post-merge setup for AIHackr.
# - Installs any new npm deps the merged task added.
# - Pushes the Drizzle schema (force) so any new columns/tables on
#   tracked_companies, scans, watchlists, alerts etc. land in the DB.
# - Imports the bundled YC SaaS CSV if it ships with the merged code
#   AND the live tracked_companies row count is below the seeded baseline.
#   The importer is idempotent on slug+domain so re-running is a no-op.

npm install --no-audit --no-fund

npm run db:push -- --force

if [ -f "data/yc-saas-1k.csv" ]; then
  CURRENT=$(psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM tracked_companies WHERE status='live'" 2>/dev/null || echo 0)
  if [ "${CURRENT:-0}" -lt 1000 ]; then
    echo "[post-merge] tracked_companies has $CURRENT live rows — importing data/yc-saas-1k.csv"
    tsx server/scripts/import-companies.ts data/yc-saas-1k.csv --source=yc-oss-saas
  else
    echo "[post-merge] tracked_companies already has $CURRENT live rows — skipping bulk import"
  fi
fi

echo "[post-merge] done"
