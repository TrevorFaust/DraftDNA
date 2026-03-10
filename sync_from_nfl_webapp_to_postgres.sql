-- SYNC DATA FROM nfl_webapp DATABASE TO postgres DATABASE
-- Run this script while connected to the nfl_webapp database
-- This will copy 2025 players from nfl_webapp to postgres

-- Step 1: Connect to postgres database and sync players
-- Note: You'll need to run this from nfl_webapp, but target postgres
-- If you have dblink extension, you can use it, otherwise use the manual approach below

-- MANUAL APPROACH: Run these commands from nfl_webapp database
-- First, export the data you want to sync:

-- Export 2025 players from nfl_webapp.players (if that table exists)
-- Or export from nfl_webapp.nfl_players_historical

-- Then connect to postgres database and run the INSERT statements

-- ALTERNATIVE: Use this approach if you can switch databases
-- 1. Connect to nfl_webapp and run:
/*
SELECT 
  'INSERT INTO public.players (name, position, team, season, jersey_number, adp, bye_week) VALUES ' ||
  '(''' || name || ''', ''' || position || ''', ' || 
  COALESCE('''' || team || '''', 'NULL') || ', ' ||
  COALESCE(season::text, 'NULL') || ', ' ||
  COALESCE(jersey_number::text, 'NULL') || ', 999.00, NULL);'
FROM players
WHERE season = 2025
  AND position IN ('QB', 'RB', 'WR', 'TE', 'K');
*/

-- Then copy the output and run it in postgres database
