-- Chaos archetypes: analytics queries for player age and first 2 RBs per team.
-- Run these in the SQL editor (or via psql) to inspect data. Adjust table names if your schema differs.
--
-- Handcuffs: Designation deferred until after NFL free agency when player team
-- data is updated. The "first 2 RBs per team" query below is for reference only;
-- do not use for Handcuff Army until rosters are finalized.

-- =============================================================================
-- 1. Player age: counts for 31+ (Time Traveler), 34+ (Retirement Watch)
-- Uses birth_date from nfl_players_historical (or players_info / players_clean).
-- Age = current date - birth_date. Replace 'nfl_players_historical' with
-- 'players_info' or 'players_clean' if that's where birth_date lives.
-- =============================================================================

-- Option A: If you have nfl_players_historical with birth_date and espn_id
-- (use the latest season row per espn_id if there are multiple)
/*
WITH player_birth AS (
  SELECT DISTINCT ON (espn_id)
    espn_id,
    birth_date::date AS dob
  FROM nfl_players_historical
  WHERE birth_date IS NOT NULL AND espn_id IS NOT NULL
  ORDER BY espn_id, season DESC NULLS LAST
),
player_age AS (
  SELECT
    p.id,
    p.name,
    p.position,
    p.team,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, pb.dob))::int AS age
  FROM players p
  JOIN player_birth pb ON p.espn_id::text = pb.espn_id::text
  WHERE p.season = 2025
)
SELECT
  COUNT(*) FILTER (WHERE age >= 31) AS count_31_plus,
  COUNT(*) FILTER (WHERE age >= 34) AS count_34_plus,
  COUNT(*) AS total_with_age
FROM player_age;
*/

-- Option B: If birth_date is in players_info (espn_id link)
/*
WITH player_birth AS (
  SELECT espn_id, birth_date::date AS dob
  FROM players_info
  WHERE birth_date IS NOT NULL AND espn_id IS NOT NULL
),
player_age AS (
  SELECT
    p.id,
    p.name,
    p.position,
    p.team,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, pb.dob))::int AS age
  FROM players p
  JOIN player_birth pb ON p.espn_id::text = pb.espn_id::text
  WHERE p.season = 2025
)
SELECT
  COUNT(*) FILTER (WHERE age >= 31) AS count_31_plus,
  COUNT(*) FILTER (WHERE age >= 34) AS count_34_plus,
  COUNT(*) AS total_with_age
FROM player_age;
*/

-- List players 34+ (Retirement Watch) or 31+ (Time Traveler) for review
-- Uncomment and run after choosing the correct birth table (players_info or nfl_players_historical).
/*
WITH player_birth AS (
  SELECT espn_id, birth_date::date AS dob
  FROM players_info  -- or nfl_players_historical with DISTINCT ON (espn_id) ... ORDER BY espn_id, season DESC
  WHERE birth_date IS NOT NULL AND espn_id IS NOT NULL
),
player_age AS (
  SELECT
    p.id,
    p.name,
    p.position,
    p.team,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, pb.dob))::int AS age
  FROM players p
  JOIN player_birth pb ON p.espn_id::text = pb.espn_id::text
  WHERE p.season = 2025
)
SELECT name, position, team, age
FROM player_age
WHERE age >= 34
ORDER BY age DESC, name;
*/

-- =============================================================================
-- 2. First 2 RBs per team (for handcuff designation when rosters are final)
-- Uses players table: position = 'RB', ordered by adp per team.
-- Deferred until after free agency; team data not yet updated. Reference only.
-- =============================================================================

-- First 2 RBs per team by ADP (RB1 and RB2 per team for handcuff logic)
WITH rb_ranked AS (
  SELECT
    id,
    name,
    position,
    team,
    adp,
    ROW_NUMBER() OVER (PARTITION BY COALESCE(NULLIF(trim(team), ''), 'FA') ORDER BY adp ASC NULLS LAST, name) AS rn
  FROM players
  WHERE season = 2025
    AND UPPER(TRIM(position)) = 'RB'
    AND team IS NOT NULL
    AND TRIM(team) <> ''
)
SELECT
  team,
  rn AS rb_rank,
  name,
  adp,
  id AS player_id
FROM rb_ranked
WHERE rn <= 2
ORDER BY team, rn;

-- Same but include all RBs with rank (to see who is RB1 vs RB2 per team)
/*
WITH rb_ranked AS (
  SELECT
    id,
    name,
    position,
    team,
    adp,
    ROW_NUMBER() OVER (PARTITION BY COALESCE(NULLIF(trim(team), ''), 'FA') ORDER BY adp ASC NULLS LAST, name) AS rn
  FROM players
  WHERE season = 2025
    AND UPPER(TRIM(position)) = 'RB'
    AND team IS NOT NULL
    AND TRIM(team) <> ''
)
SELECT team, rn, name, adp, id
FROM rb_ranked
ORDER BY team, rn;
*/

-- =============================================================================
-- 3. Player age summary (all players with age, for Old Boys Club / Time Traveler)
-- Run after confirming which table has birth_date (players_info vs nfl_players_historical).
-- =============================================================================

-- Count by age bucket (30+ Old Boys, 31+ Time Traveler, 34+ Retirement Watch)
/*
WITH player_birth AS (
  SELECT espn_id, birth_date::date AS dob
  FROM players_info
  WHERE birth_date IS NOT NULL AND espn_id IS NOT NULL
),
player_age AS (
  SELECT
    p.id,
    p.name,
    p.position,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, pb.dob))::int AS age
  FROM players p
  JOIN player_birth pb ON p.espn_id::text = pb.espn_id::text
  WHERE p.season = 2025
)
SELECT
  COUNT(*) FILTER (WHERE age >= 30) AS age_30_plus,
  COUNT(*) FILTER (WHERE age >= 31) AS age_31_plus,
  COUNT(*) FILTER (WHERE age >= 34) AS age_34_plus,
  COUNT(*) AS total_with_age
FROM player_age;
*/
