#!/bin/bash
# ============================================================================
# Script to sync everything from postgres to nfl_webapp
# ============================================================================

DB_HOST="db.pavehsrhmpoexcqoighb.supabase.co"
DB_USER="postgres"
POSTGRES_DB="postgres"
NFL_WEBAPP_DB="nfl_webapp"

echo "============================================================================"
echo "Syncing postgres database to nfl_webapp database"
echo "============================================================================"

# Step 1: Export schema and data from postgres
echo "Step 1: Exporting schema and data from postgres..."
pg_dump -h $DB_HOST -U $DB_USER -d $POSTGRES_DB \
  --schema=public \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  > postgres_export.sql

if [ $? -eq 0 ]; then
  echo "✓ Export successful"
else
  echo "✗ Export failed"
  exit 1
fi

# Step 2: Import to nfl_webapp
echo "Step 2: Importing to nfl_webapp..."
psql -h $DB_HOST -U $DB_USER -d $NFL_WEBAPP_DB -f postgres_export.sql

if [ $? -eq 0 ]; then
  echo "✓ Import successful"
else
  echo "✗ Import failed"
  exit 1
fi

echo "============================================================================"
echo "Sync complete!"
echo "============================================================================"
echo ""
echo "Note: Your website will continue reading from 'postgres' through Supabase."
echo "To make changes visible on the website, you'll need to sync back from"
echo "nfl_webapp to postgres when ready."
echo ""
