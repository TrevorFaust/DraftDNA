-- Merge duplicate players who appear as multiple rows due to multi-position roles
-- (e.g. Taysom Hill as QB/TE/RB, Connor Heyward as RB/TE).
-- Keeps one player per (name, espn_id), preferring lowest ADP. Reassigns references and deletes extras.

-- 1. Find duplicate groups: same espn_id (when present) or same name (when espn_id null)
-- Exclude D/ST and K - they're identified by name only and handled separately
WITH duplicate_groups AS (
  SELECT
    COALESCE(espn_id, 'name:' || LOWER(TRIM(name))) AS identity_key,
    ARRAY_AGG(id ORDER BY (adp::numeric) NULLS LAST, id) AS player_ids,
    (array_agg(espn_id ORDER BY (adp::numeric) NULLS LAST, id))[1] AS best_espn_id
  FROM public.players
  WHERE season = 2025
    AND position IS NOT NULL
    AND position NOT IN ('D/ST', 'K')
  GROUP BY COALESCE(espn_id, 'name:' || LOWER(TRIM(name)))
  HAVING COUNT(*) > 1
),
ids_to_delete AS (
  SELECT unnest(player_ids[2:array_length(player_ids, 1)]) AS dup_id
  FROM duplicate_groups
),
ids_to_keep AS (
  SELECT (player_ids)[1] AS keep_id
  FROM duplicate_groups
),
-- Ensure kept players have espn_id if any duplicate had it
updates AS (
  SELECT dg.identity_key, (dg.player_ids)[1] AS keep_id, dg.best_espn_id
  FROM duplicate_groups dg
  WHERE dg.best_espn_id IS NOT NULL
    AND (SELECT espn_id FROM public.players WHERE id = (dg.player_ids)[1]) IS NULL
)
-- Update kept players to have espn_id when missing
UPDATE public.players p
SET espn_id = u.best_espn_id
FROM updates u
WHERE p.id = u.keep_id;

-- 2. Reassign user_rankings from duplicate ids to kept id
-- (user_id, player_id, league_id) is unique - delete dup rows that would conflict before updating
WITH duplicate_groups AS (
  SELECT
    COALESCE(espn_id, 'name:' || LOWER(TRIM(name))) AS identity_key,
    ARRAY_AGG(id ORDER BY (adp::numeric) NULLS LAST, id) AS player_ids
  FROM public.players
  WHERE season = 2025
    AND position IS NOT NULL
    AND position NOT IN ('D/ST', 'K')
  GROUP BY COALESCE(espn_id, 'name:' || LOWER(TRIM(name)))
  HAVING COUNT(*) > 1
),
remap AS (
  SELECT unnest(player_ids[2:array_length(player_ids, 1)]) AS old_id, (player_ids)[1] AS new_id
  FROM duplicate_groups
)
-- Delete user_rankings for dup players where (user, kept_id, league) already exists
DELETE FROM public.user_rankings ur
USING remap r
WHERE ur.player_id = r.old_id
  AND EXISTS (
    SELECT 1 FROM public.user_rankings ex
    WHERE ex.user_id = ur.user_id
      AND ex.league_id IS NOT DISTINCT FROM ur.league_id
      AND ex.player_id = r.new_id
  );

WITH duplicate_groups AS (
  SELECT
    COALESCE(espn_id, 'name:' || LOWER(TRIM(name))) AS identity_key,
    ARRAY_AGG(id ORDER BY (adp::numeric) NULLS LAST, id) AS player_ids
  FROM public.players
  WHERE season = 2025
    AND position IS NOT NULL
    AND position NOT IN ('D/ST', 'K')
  GROUP BY COALESCE(espn_id, 'name:' || LOWER(TRIM(name)))
  HAVING COUNT(*) > 1
),
remap AS (
  SELECT unnest(player_ids[2:array_length(player_ids, 1)]) AS old_id, (player_ids)[1] AS new_id
  FROM duplicate_groups
)
UPDATE public.user_rankings ur
SET player_id = r.new_id
FROM remap r
WHERE ur.player_id = r.old_id;

-- 3. Reassign draft_picks from duplicate ids to kept id
WITH duplicate_groups AS (
  SELECT
    COALESCE(espn_id, 'name:' || LOWER(TRIM(name))) AS identity_key,
    ARRAY_AGG(id ORDER BY (adp::numeric) NULLS LAST, id) AS player_ids
  FROM public.players
  WHERE season = 2025
    AND position IS NOT NULL
    AND position NOT IN ('D/ST', 'K')
  GROUP BY COALESCE(espn_id, 'name:' || LOWER(TRIM(name)))
  HAVING COUNT(*) > 1
),
remap AS (
  SELECT
    unnest(player_ids[2:array_length(player_ids, 1)]) AS old_id,
    (player_ids)[1] AS new_id
  FROM duplicate_groups
)
UPDATE public.draft_picks dp
SET player_id = r.new_id
FROM remap r
WHERE dp.player_id = r.old_id;

-- 4. Handle baseline_community_rankings - unique on (scoring_format, league_type, is_superflex, player_id)
-- Update dup rows to kept id where no conflict; delete where conflict (kept already has a row)
WITH duplicate_groups AS (
  SELECT
    COALESCE(espn_id, 'name:' || LOWER(TRIM(name))) AS identity_key,
    ARRAY_AGG(id ORDER BY (adp::numeric) NULLS LAST, id) AS player_ids
  FROM public.players
  WHERE season = 2025
    AND position IS NOT NULL
    AND position NOT IN ('D/ST', 'K')
  GROUP BY COALESCE(espn_id, 'name:' || LOWER(TRIM(name)))
  HAVING COUNT(*) > 1
),
remap AS (
  SELECT unnest(player_ids[2:array_length(player_ids, 1)]) AS old_id, (player_ids)[1] AS new_id
  FROM duplicate_groups
)
-- First delete rows where updating would cause unique violation (kept already has row for that bucket)
DELETE FROM public.baseline_community_rankings bcr
USING remap r
WHERE bcr.player_id = r.old_id
  AND EXISTS (
    SELECT 1 FROM public.baseline_community_rankings ex
    WHERE ex.scoring_format = bcr.scoring_format
      AND ex.league_type = bcr.league_type
      AND ex.is_superflex = bcr.is_superflex
      AND ex.player_id = r.new_id
  );

-- Then update remaining dup rows to point to kept id
WITH duplicate_groups AS (
  SELECT
    COALESCE(espn_id, 'name:' || LOWER(TRIM(name))) AS identity_key,
    ARRAY_AGG(id ORDER BY (adp::numeric) NULLS LAST, id) AS player_ids
  FROM public.players
  WHERE season = 2025
    AND position IS NOT NULL
    AND position NOT IN ('D/ST', 'K')
  GROUP BY COALESCE(espn_id, 'name:' || LOWER(TRIM(name)))
  HAVING COUNT(*) > 1
),
remap AS (
  SELECT unnest(player_ids[2:array_length(player_ids, 1)]) AS old_id, (player_ids)[1] AS new_id
  FROM duplicate_groups
)
UPDATE public.baseline_community_rankings bcr
SET player_id = r.new_id
FROM remap r
WHERE bcr.player_id = r.old_id;

-- 5. Update kept player: use primary position (lowest ADP) and merge team/bye if useful
-- For multi-position, keep the position from the lowest-ADP row (already the one we kept)
-- No update needed - we're keeping that row as-is.

-- 6. Delete duplicate player rows
WITH duplicate_groups AS (
  SELECT
    COALESCE(espn_id, 'name:' || LOWER(TRIM(name))) AS identity_key,
    ARRAY_AGG(id ORDER BY (adp::numeric) NULLS LAST, id) AS player_ids
  FROM public.players
  WHERE season = 2025
    AND position IS NOT NULL
    AND position NOT IN ('D/ST', 'K')
  GROUP BY COALESCE(espn_id, 'name:' || LOWER(TRIM(name)))
  HAVING COUNT(*) > 1
),
ids_to_delete AS (
  SELECT unnest(player_ids[2:array_length(player_ids, 1)]) AS dup_id
  FROM duplicate_groups
)
DELETE FROM public.players
WHERE id IN (SELECT dup_id FROM ids_to_delete);
