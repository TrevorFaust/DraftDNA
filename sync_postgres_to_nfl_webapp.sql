-- ============================================================================
-- SYNC ALL DATA FROM postgres DATABASE TO nfl_webapp DATABASE
-- ============================================================================
-- This script should be run from a PostgreSQL client that can access both databases
-- OR run the sections separately: first from postgres, then from nfl_webapp
--
-- IMPORTANT: Supabase uses the 'postgres' database by default.
-- This script copies everything to nfl_webapp for your local work.
-- The website will continue to use 'postgres' through Supabase's API.
-- ============================================================================

-- STEP 1: Connect to postgres database and export schema
-- Run this section while connected to 'postgres' database

-- First, let's get the table creation statements
-- You'll need to run pg_dump or use the migration files

-- STEP 2: Connect to nfl_webapp database and create/update tables
-- Run this section while connected to 'nfl_webapp' database

-- Note: This is a template. You'll need to:
-- 1. Export schema from postgres
-- 2. Import to nfl_webapp
-- 3. Copy data

-- For now, here's a script to copy data using dblink (if available)
-- Or use manual INSERT statements
