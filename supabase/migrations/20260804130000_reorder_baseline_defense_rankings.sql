-- Seed fantasy D/ST order into players.adp and baseline_community_rankings.
-- Keeps existing DST overall rank slots from rankings/*.csv; assigns HOU…ARI order.

-- 1) ADP 150–199 by fantasy order (canonical 32 teams only)
WITH ordered(name, idx) AS (
  VALUES
    ('Houston Texans', 0),
    ('Denver Broncos', 1),
    ('Seattle Seahawks', 2),
    ('Los Angeles Rams', 3),
    ('Philadelphia Eagles', 4),
    ('Minnesota Vikings', 5),
    ('New England Patriots', 6),
    ('Jacksonville Jaguars', 7),
    ('Pittsburgh Steelers', 8),
    ('Los Angeles Chargers', 9),
    ('Baltimore Ravens', 10),
    ('Green Bay Packers', 11),
    ('Kansas City Chiefs', 12),
    ('Detroit Lions', 13),
    ('Buffalo Bills', 14),
    ('Cleveland Browns', 15),
    ('San Francisco 49ers', 16),
    ('Atlanta Falcons', 17),
    ('New Orleans Saints', 18),
    ('Indianapolis Colts', 19),
    ('Chicago Bears', 20),
    ('New York Giants', 21),
    ('Carolina Panthers', 22),
    ('Dallas Cowboys', 23),
    ('Tampa Bay Buccaneers', 24),
    ('Tennessee Titans', 25),
    ('Cincinnati Bengals', 26),
    ('Miami Dolphins', 27),
    ('Washington Commanders', 28),
    ('Las Vegas Raiders', 29),
    ('New York Jets', 30),
    ('Arizona Cardinals', 31)
)
UPDATE public.players p
SET adp = 150 + FLOOR((o.idx::numeric / 32) * 50)
FROM ordered o
WHERE p.position = 'D/ST'
  AND p.name = o.name;

-- 2) Clear any prior D/ST baseline rows for these teams
DELETE FROM public.baseline_community_rankings bcr
USING public.players p
WHERE bcr.player_id = p.id
  AND p.position = 'D/ST'
  AND p.name IN (
    'Houston Texans', 'Denver Broncos', 'Seattle Seahawks', 'Los Angeles Rams',
    'Philadelphia Eagles', 'Minnesota Vikings', 'New England Patriots', 'Jacksonville Jaguars',
    'Pittsburgh Steelers', 'Los Angeles Chargers', 'Baltimore Ravens', 'Green Bay Packers',
    'Kansas City Chiefs', 'Detroit Lions', 'Buffalo Bills', 'Cleveland Browns',
    'San Francisco 49ers', 'Atlanta Falcons', 'New Orleans Saints', 'Indianapolis Colts',
    'Chicago Bears', 'New York Giants', 'Carolina Panthers', 'Dallas Cowboys',
    'Tampa Bay Buccaneers', 'Tennessee Titans', 'Cincinnati Bengals', 'Miami Dolphins',
    'Washington Commanders', 'Las Vegas Raiders', 'New York Jets', 'Arizona Cardinals'
  );

-- 3) Insert into all 12 baseline buckets using CSV rank slots + HOU…ARI order
WITH teams(name, ord) AS (
  VALUES
    ('Houston Texans', 0),
    ('Denver Broncos', 1),
    ('Seattle Seahawks', 2),
    ('Los Angeles Rams', 3),
    ('Philadelphia Eagles', 4),
    ('Minnesota Vikings', 5),
    ('New England Patriots', 6),
    ('Jacksonville Jaguars', 7),
    ('Pittsburgh Steelers', 8),
    ('Los Angeles Chargers', 9),
    ('Baltimore Ravens', 10),
    ('Green Bay Packers', 11),
    ('Kansas City Chiefs', 12),
    ('Detroit Lions', 13),
    ('Buffalo Bills', 14),
    ('Cleveland Browns', 15),
    ('San Francisco 49ers', 16),
    ('Atlanta Falcons', 17),
    ('New Orleans Saints', 18),
    ('Indianapolis Colts', 19),
    ('Chicago Bears', 20),
    ('New York Giants', 21),
    ('Carolina Panthers', 22),
    ('Dallas Cowboys', 23),
    ('Tampa Bay Buccaneers', 24),
    ('Tennessee Titans', 25),
    ('Cincinnati Bengals', 26),
    ('Miami Dolphins', 27),
    ('Washington Commanders', 28),
    ('Las Vegas Raiders', 29),
    ('New York Jets', 30),
    ('Arizona Cardinals', 31)
),
dst_ids AS (
  SELECT DISTINCT ON (t.name)
    t.name,
    t.ord,
    p.id AS player_id
  FROM teams t
  JOIN public.players p
    ON p.position = 'D/ST'
   AND p.name = t.name
   AND p.season IN (2024, 2025, 2026)
  ORDER BY t.name, p.season DESC NULLS LAST
),
rank_maps(scoring_format, league_type, is_superflex, ranks) AS (
  VALUES
    ('half_ppr', 'season', false, ARRAY[194,195,196,197,202,203,204,205,211,212,213,217,233,235,253,255,294,295,296,297,418,424,431,439,444,453,460,465,472,481,488,497]::numeric[]),
    ('half_ppr', 'season', true,  ARRAY[194,195,196,197,202,203,204,205,211,212,213,217,233,235,253,255,294,295,296,297,418,424,431,439,444,453,460,465,472,481,488,497]::numeric[]),
    ('half_ppr', 'dynasty', false, ARRAY[194,195,196,197,202,203,204,205,211,212,213,217,233,235,253,255,294,295,296,297,418,424,431,439,444,453,460,465,472,481,488,497]::numeric[]),
    ('half_ppr', 'dynasty', true,  ARRAY[194,195,196,197,202,203,204,205,211,212,213,217,233,235,253,255,294,295,296,297,418,424,431,439,444,453,460,465,472,481,488,497]::numeric[]),
    ('ppr', 'season', false, ARRAY[194,195,196,197,202,203,204,205,211,212,213,217,234,235,254,255,294,295,296,297,418,424,431,438,445,453,460,466,472,480,488,497]::numeric[]),
    ('ppr', 'dynasty', false, ARRAY[194,195,196,197,202,203,204,205,211,212,213,217,234,235,254,255,294,295,296,297,418,424,431,438,445,453,460,466,472,480,488,497]::numeric[]),
    ('ppr', 'season', true, ARRAY[214,215,216,217,222,223,224,225,231,232,233,238,250,251,269,271,309,310,311,312,434,439,445,451,457,464,470,475,481,488,495,503]::numeric[]),
    ('ppr', 'dynasty', true, ARRAY[214,215,216,217,222,223,224,225,231,232,233,238,250,251,269,271,309,310,311,312,434,439,445,451,457,464,470,475,481,488,495,503]::numeric[]),
    ('standard', 'season', false, ARRAY[193,195,196,197,202,203,204,205,211,212,213,217,233,234,252,254,293,295,296,297,417,424,430,437,445,452,458,465,471,480,488,497]::numeric[]),
    ('standard', 'season', true,  ARRAY[193,195,196,197,202,203,204,205,211,212,213,217,233,234,252,254,293,295,296,297,417,424,430,437,445,452,458,465,471,480,488,497]::numeric[]),
    ('standard', 'dynasty', false, ARRAY[193,195,196,197,202,203,204,205,211,212,213,217,233,234,252,254,293,295,296,297,417,424,430,437,445,452,458,465,471,480,488,497]::numeric[]),
    ('standard', 'dynasty', true,  ARRAY[193,195,196,197,202,203,204,205,211,212,213,217,233,234,252,254,293,295,296,297,417,424,430,437,445,452,458,465,471,480,488,497]::numeric[])
)
INSERT INTO public.baseline_community_rankings (scoring_format, league_type, is_superflex, player_id, rank)
SELECT
  rm.scoring_format,
  rm.league_type,
  rm.is_superflex,
  d.player_id,
  rm.ranks[d.ord + 1]
FROM rank_maps rm
CROSS JOIN dst_ids d
WHERE d.player_id IS NOT NULL;
