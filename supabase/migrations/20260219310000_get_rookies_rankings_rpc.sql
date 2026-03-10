-- RPC to get rookies-only rankings for dynasty (players in baseline_rookies that exist in players table).
-- Used when league has rookies_only=true for Rankings and DraftRoom.

CREATE OR REPLACE FUNCTION public.get_rookies_rankings(
  p_scoring_format text DEFAULT 'ppr',
  p_league_type text DEFAULT 'dynasty',
  p_is_superflex boolean DEFAULT false
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
  -- Match baseline_rookies to players by name (with common aliases).
  -- scoring_format: match exact OR 'any' (shared rookies-only list across PPR/half-PPR/standard).
  WITH rookies AS (
    SELECT br.name, br.position, br.rank
    FROM public.baseline_rookies br
    WHERE (br.scoring_format = p_scoring_format OR br.scoring_format = 'any')
      AND br.league_type = p_league_type
      AND br.is_superflex = p_is_superflex
  ),
  -- Name mapping: input name -> db name (for players table)
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
  WHERE p.season = 2025
    AND p.position IS NOT NULL
    AND p.position NOT IN ('D/ST', 'K')
  ORDER BY m.rank ASC;
$$;
