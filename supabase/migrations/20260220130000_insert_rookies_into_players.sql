-- Insert rookies from baseline_rookies (dynasty non-SF) into players table
-- for rookies-only drafts. Only inserts those not already in players (season 2025).
-- ADP = 150 + rank so rookies appear after typical main-draft players.

WITH rookies_list AS (
  SELECT br.name, br.position, br.rank
  FROM public.baseline_rookies br
  WHERE br.scoring_format = 'any'
    AND br.league_type = 'dynasty'
    AND br.is_superflex = false
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
    ('Mike Washington', 'Mike Washington Jr.'),
    ('Robert Henry Jr.', 'Robert Henry')
  ) AS t(input_name, db_name)
),
already_in_players AS (
  SELECT r.name
  FROM rookies_list r
  WHERE EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.season = 2025
      AND (p.name = r.name OR p.name IN (
        SELECT a.db_name FROM aliases a WHERE a.input_name = r.name
      ))
  )
)
INSERT INTO public.players (name, position, team, season, adp, bye_week)
SELECT r.name, r.position, NULL, 2025, 150.0 + r.rank, NULL
FROM rookies_list r
WHERE r.name NOT IN (SELECT name FROM already_in_players);

-- Also insert rookies from superflex list that may not be in non-SF (e.g. Jake Retzlaff, Athan Kaliakmanis)
WITH sf_rookies AS (
  SELECT br.name, br.position, br.rank
  FROM public.baseline_rookies br
  WHERE br.scoring_format = 'any' AND br.league_type = 'dynasty' AND br.is_superflex = true
),
sf_aliases AS (
  SELECT * FROM (VALUES
    ('James Cook', 'James Cook III'), ('Marvin Harrison Jr', 'Marvin Harrison'),
    ('Harold Fannin', 'Harold Fannin Jr.'), ('Oronde Gadsden', 'Oronde Gadsden II'),
    ('Jonathon Brooks', 'Jonathan Brooks'), ('Travis Etienne', 'Travis Etienne Jr.'),
    ('Luther Burden', 'Luther Burden III'), ('Brian Thomas', 'Brian Thomas Jr.'),
    ('KC Concepcion', 'K.C. Concepcion'), ('Michael Pittman', 'Michael Pittman Jr.'),
    ('Brian Robinson', 'Brian Robinson Jr.'), ('LeQuint Allen', 'LeQuint Allen Jr.'),
    ('Dont''e Thornton', 'Dont''e Thornton Jr.'), ('Chris Rodriguez', 'Chris Rodriguez Jr.'),
    ('Ollie Gordon', 'Ollie Gordon II'), ('CJ Daniels', 'C.J. Daniels'),
    ('Mike Washington', 'Mike Washington Jr.'), ('Robert Henry Jr.', 'Robert Henry')
  ) AS t(input_name, db_name)
),
sf_already_in AS (
  SELECT r.name FROM sf_rookies r
  WHERE EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.season = 2025 AND (p.name = r.name OR p.name IN (SELECT a.db_name FROM sf_aliases a WHERE a.input_name = r.name))
  )
)
INSERT INTO public.players (name, position, team, season, adp, bye_week)
SELECT r.name, r.position, NULL, 2025, 250.0 + r.rank, NULL
FROM sf_rookies r
WHERE r.name NOT IN (SELECT name FROM sf_already_in);

-- Update adp for ALL rookies (including pre-existing ones) so they sort in correct rank order.
-- Rankings/DraftRoom order by adp; 150+rank ensures 1–111 order.
WITH rookies_list AS (
  SELECT br.name, br.position, br.rank
  FROM public.baseline_rookies br
  WHERE br.scoring_format = 'any' AND br.league_type = 'dynasty' AND br.is_superflex = false
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
    ('Mike Washington', 'Mike Washington Jr.'),
    ('Robert Henry Jr.', 'Robert Henry')
  ) AS t(input_name, db_name)
),
match_names AS (
  SELECT r.name, r.rank, r.name AS match_name FROM rookies_list r
  UNION
  SELECT r.name, r.rank, a.db_name FROM rookies_list r
  JOIN aliases a ON a.input_name = r.name
)
UPDATE public.players p
SET adp = 150.0 + m.rank
FROM match_names m
WHERE p.season = 2025
  AND p.name = m.match_name
  AND p.position IS NOT NULL
  AND p.position NOT IN ('D/ST', 'K');
