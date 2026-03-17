-- =============================================================================
-- Check for duplicate draft picks (same draft slot filled more than once)
-- Run in Supabase SQL Editor: https://supabase.com/dashboard → SQL Editor
-- =============================================================================

-- 1) List all duplicate slots: (mock_draft_id, round_number, pick_number) with count > 1
SELECT
  mock_draft_id,
  round_number,
  pick_number,
  COUNT(*) AS pick_count
FROM public.draft_picks
GROUP BY mock_draft_id, round_number, pick_number
HAVING COUNT(*) > 1
ORDER BY mock_draft_id, round_number, pick_number;

-- 2) Show full duplicate rows with draft name and player name (for inspection)
WITH duplicate_slots AS (
  SELECT mock_draft_id, round_number, pick_number
  FROM public.draft_picks
  GROUP BY mock_draft_id, round_number, pick_number
  HAVING COUNT(*) > 1
)
SELECT
  dp.id,
  dp.mock_draft_id,
  md.name AS draft_name,
  dp.team_number,
  dp.round_number,
  dp.pick_number,
  dp.player_id,
  p.name AS player_name,
  p.position,
  dp.created_at
FROM public.draft_picks dp
JOIN duplicate_slots ds
  ON dp.mock_draft_id = ds.mock_draft_id
  AND dp.round_number = ds.round_number
  AND dp.pick_number = ds.pick_number
LEFT JOIN public.mock_drafts md ON md.id = dp.mock_draft_id
LEFT JOIN public.players p ON p.id = dp.player_id
ORDER BY dp.mock_draft_id, dp.round_number, dp.pick_number, dp.created_at;

-- 3) Optional: delete duplicate picks, keeping the earliest created per slot
--    Run only after reviewing results of (1) and (2). Keeps one row per (mock_draft_id, round_number, pick_number).
/*
DELETE FROM public.draft_picks
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY mock_draft_id, round_number, pick_number
             ORDER BY created_at ASC, id ASC
           ) AS rn
    FROM public.draft_picks
  ) sub
  WHERE rn > 1
);
*/
