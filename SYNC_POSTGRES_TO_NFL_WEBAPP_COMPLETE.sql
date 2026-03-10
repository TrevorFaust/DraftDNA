-- ============================================================================
-- COMPLETE SYNC: postgres DATABASE → nfl_webapp DATABASE
-- ============================================================================
-- This script syncs all tables, data, and schema from 'postgres' to 'nfl_webapp'
--
-- IMPORTANT NOTES:
-- 1. Supabase's API always uses the 'postgres' database
-- 2. Your website will continue reading from 'postgres' through Supabase
-- 3. This sync ensures 'nfl_webapp' has a complete copy for your local work
-- 4. Run this from a PostgreSQL client that can access both databases
-- ============================================================================

-- ============================================================================
-- PART 1: EXPORT FROM postgres DATABASE
-- ============================================================================
-- Connect to 'postgres' database and run these queries to export data
-- Then use the output in PART 2

-- Step 1: Export all table schemas (run from postgres)
-- You can use: pg_dump -h db.pavehsrhmpoexcqoighb.supabase.co -U postgres -d postgres --schema-only -t public.* > schema_export.sql

-- Step 2: Export all data (run from postgres)  
-- You can use: pg_dump -h db.pavehsrhmpoexcqoighb.supabase.co -U postgres -d postgres --data-only -t public.* > data_export.sql

-- ============================================================================
-- PART 2: IMPORT TO nfl_webapp DATABASE  
-- ============================================================================
-- Connect to 'nfl_webapp' database and run the migration files in order
-- OR use the exported SQL from PART 1

-- ============================================================================
-- ALTERNATIVE: Manual sync using dblink (if extension is available)
-- ============================================================================

-- First, enable dblink extension in nfl_webapp (if not already enabled)
-- CREATE EXTENSION IF NOT EXISTS dblink;

-- Then you can copy data like this:
/*
SELECT dblink_connect('postgres_conn', 'host=db.pavehsrhmpoexcqoighb.supabase.co port=5432 dbname=postgres user=postgres password=YOUR_PASSWORD');

-- Copy players table
INSERT INTO public.players (id, name, position, team, adp, bye_week, created_at, jersey_number, season)
SELECT * FROM dblink('postgres_conn', 
  'SELECT id, name, position, team, adp, bye_week, created_at, jersey_number, season FROM public.players'
) AS t(
  id UUID,
  name TEXT,
  position TEXT,
  team TEXT,
  adp NUMERIC,
  bye_week INTEGER,
  created_at TIMESTAMPTZ,
  jersey_number INTEGER,
  season INTEGER
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  position = EXCLUDED.position,
  team = EXCLUDED.team,
  adp = EXCLUDED.adp,
  bye_week = EXCLUDED.bye_week,
  jersey_number = EXCLUDED.jersey_number,
  season = EXCLUDED.season;

SELECT dblink_disconnect('postgres_conn');
*/

-- ============================================================================
-- RECOMMENDED APPROACH: Use pg_dump and pg_restore
-- ============================================================================
-- This is the most reliable method:

-- 1. Export from postgres:
--    pg_dump -h db.pavehsrhmpoexcqoighb.supabase.co -U postgres -d postgres --schema=public --clean --if-exists > postgres_export.sql

-- 2. Import to nfl_webapp:
--    psql -h db.pavehsrhmpoexcqoighb.supabase.co -U postgres -d nfl_webapp -f postgres_export.sql

-- ============================================================================
-- MANUAL TABLE-BY-TABLE SYNC (if above methods don't work)
-- ============================================================================

-- The following sections show how to sync each table manually
-- Run these while connected to nfl_webapp database

-- Note: You'll need to first create the tables in nfl_webapp using the migration files
-- Then copy the data using INSERT statements generated from postgres
