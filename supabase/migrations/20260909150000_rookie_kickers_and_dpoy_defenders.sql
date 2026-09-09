-- Allow K in get_rookies_rankings (still exclude D/ST).
CREATE OR REPLACE FUNCTION public.get_rookies_rankings(
  p_scoring_format text DEFAULT 'ppr',
  p_league_type text DEFAULT 'dynasty',
  p_is_superflex boolean DEFAULT false,
  p_season integer DEFAULT 2026
)
RETURNS TABLE (
  player_id uuid,
  name text,
  "position" text,
  rank numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH rookies AS (
    SELECT br.name, br.position, br.rank
    FROM public.baseline_rookies br
    WHERE (br.scoring_format = p_scoring_format OR br.scoring_format = 'any')
      AND br.league_type = p_league_type
      AND br.is_superflex = p_is_superflex
  ),
  aliases AS (
    SELECT * FROM (VALUES
      ('James Cook', 'James Cook III'),
      ('Marvin Harrison Jr', 'Marvin Harrison'),
      ('Harold Fannin', 'Harold Fannin Jr.'),
      ('Oronde Gadsden', 'Oronde Gadsden II'),
      ('Jonathon Brooks', 'Jonathan Brooks'),
      ('Travis Etienne', 'Travis Etienne Jr.'),
      ('Luther Burden', 'Luther Burden III'),
      ('Brian Thomas', 'Brian Thomas Jr.'),
      ('KC Concepcion', 'K.C. Concepcion'),
      ('Michael Pittman', 'Michael Pittman Jr.'),
      ('Brian Robinson', 'Brian Robinson Jr.'),
      ('LeQuint Allen', 'LeQuint Allen Jr.'),
      ('Dont''e Thornton', 'Dont''e Thornton Jr.'),
      ('Chris Rodriguez', 'Chris Rodriguez Jr.'),
      ('Ollie Gordon', 'Ollie Gordon II'),
      ('CJ Daniels', 'C.J. Daniels'),
      ('CJ Williams', 'C.J. Williams'),
      ('Mike Washington', 'Mike Washington Jr.'),
      ('Robert Henry Jr.', 'Robert Henry')
    ) AS t(input_name, db_name)
  ),
  match_names AS (
    SELECT r.name, r.position, r.rank, r.name AS match_name FROM rookies r
    UNION
    SELECT r.name, r.position, r.rank, a.db_name FROM rookies r
    JOIN aliases a ON a.input_name = r.name
  )
  SELECT p.id AS player_id, p.name, p.position, m.rank
  FROM public.players p
  INNER JOIN match_names m ON (p.name = m.match_name)
  WHERE p.season = p_season
    AND p.position IS NOT NULL
    AND p.position NOT IN ('D/ST')
  ORDER BY m.rank ASC;
$$;

-- Add 2026 rookie kickers to dynasty baseline boards.
WITH additions (name, position, rank_offset) AS (
  VALUES
    ('Trey Smack', 'K', 1),
    ('Maddux Trujillo', 'K', 2)
),
buckets AS (
  SELECT DISTINCT scoring_format, league_type, is_superflex
  FROM public.baseline_rookies
  WHERE league_type = 'dynasty'
),
max_ranks AS (
  SELECT scoring_format, league_type, is_superflex, MAX(rank) AS max_rank
  FROM public.baseline_rookies
  WHERE league_type = 'dynasty'
  GROUP BY 1, 2, 3
)
INSERT INTO public.baseline_rookies (name, position, rank, scoring_format, league_type, is_superflex)
SELECT
  a.name,
  a.position,
  m.max_rank + a.rank_offset,
  b.scoring_format,
  b.league_type,
  b.is_superflex
FROM additions a
CROSS JOIN buckets b
JOIN max_ranks m
  ON m.scoring_format = b.scoring_format
 AND m.league_type = b.league_type
 AND m.is_superflex = b.is_superflex
WHERE NOT EXISTS (
  SELECT 1
  FROM public.baseline_rookies br
  WHERE br.name = a.name
    AND br.scoring_format = b.scoring_format
    AND br.league_type = b.league_type
    AND br.is_superflex = b.is_superflex
);

-- DPOY pool: unique defensive players from rosters_2025 (fallback rosters_2026).
CREATE OR REPLACE FUNCTION public.get_defensive_players_for_awards(
  p_season integer DEFAULT NULL
)
RETURNS TABLE (
  player_id text,
  name text,
  "position" text,
  team text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  yr integer;
BEGIN
  yr := COALESCE(
    p_season,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rosters_2025')
        THEN 2025
      ELSE 2026
    END
  );

  IF yr = 2025 THEN
    RETURN QUERY
    SELECT DISTINCT ON (r.gsis_id)
      r.gsis_id::text,
      r.full_name::text,
      r.position::text,
      r.team::text
    FROM public.rosters_2025 r
    WHERE r.position IN ('DB', 'DL', 'LB')
      AND r.gsis_id IS NOT NULL
      AND COALESCE(r.full_name, '') <> ''
      AND COALESCE(r.status, 'ACT') IN ('ACT', 'RES')
    ORDER BY r.gsis_id, r.week DESC NULLS LAST;
  ELSE
    RETURN QUERY
    SELECT DISTINCT ON (r.gsis_id)
      r.gsis_id::text,
      r.full_name::text,
      r.position::text,
      r.team_abbr::text
    FROM public.rosters_2026 r
    WHERE r.position IN ('DB', 'DL', 'LB', 'DE', 'DT', 'NT', 'OLB', 'ILB', 'MLB', 'CB', 'S', 'FS', 'SS', 'EDGE')
      AND r.gsis_id IS NOT NULL
      AND COALESCE(r.full_name, '') <> ''
      AND COALESCE(r.status, 'ACT') IN ('ACT', 'RES')
    ORDER BY r.gsis_id, r.full_name;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_defensive_players_for_awards(integer) TO anon, authenticated;
