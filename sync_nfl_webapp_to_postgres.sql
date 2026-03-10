-- ============================================================================
-- SYNC CHANGES FROM nfl_webapp → postgres
-- ============================================================================
-- Run this when you want to push your nfl_webapp changes to postgres
-- so the website can see them
-- ============================================================================
-- 
-- IMPORTANT: This assumes you have dblink extension enabled
-- If not, use pg_dump/pg_restore method instead
-- ============================================================================

-- Enable dblink if not already enabled
CREATE EXTENSION IF NOT EXISTS dblink;

-- Connect to nfl_webapp database
SELECT dblink_connect('nfl_webapp_conn', 
  'host=db.pavehsrhmpoexcqoighb.supabase.co port=5432 dbname=nfl_webapp user=postgres password=YOUR_PASSWORD'
);

-- Sync players table (upsert - update existing, insert new)
INSERT INTO public.players (id, name, position, team, adp, bye_week, created_at, jersey_number, season)
SELECT * FROM dblink('nfl_webapp_conn', 
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

-- Repeat for other tables as needed
-- (user_rankings, mock_drafts, draft_picks, leagues, etc.)

-- Disconnect
SELECT dblink_disconnect('nfl_webapp_conn');

-- ============================================================================
-- ALTERNATIVE: Use pg_dump/pg_restore method
-- ============================================================================
-- This is more reliable if dblink doesn't work:
--
-- 1. Export from nfl_webapp:
--    pg_dump -h db.pavehsrhmpoexcqoighb.supabase.co -U postgres -d nfl_webapp --data-only --schema=public > nfl_webapp_data.sql
--
-- 2. Import to postgres (be careful - this will overwrite):
--    psql -h db.pavehsrhmpoexcqoighb.supabase.co -U postgres -d postgres -f nfl_webapp_data.sql
