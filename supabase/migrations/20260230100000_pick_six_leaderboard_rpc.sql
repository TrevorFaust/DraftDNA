-- RPC to fetch Pick Six Challenge leaderboard: users ranked by number of positions submitted.
-- Uses SECURITY DEFINER to bypass RLS (we only expose aggregate counts, not predictions).
-- Returns rank, user_id, positions_submitted for display.

CREATE OR REPLACE FUNCTION public.get_pick_six_leaderboard(p_season integer DEFAULT 2026)
RETURNS TABLE (
  rank bigint,
  user_id uuid,
  positions_submitted bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH counts AS (
    SELECT
      usp.user_id,
      COUNT(DISTINCT usp.position)::bigint AS positions_submitted
    FROM public.user_season_predictions usp
    WHERE usp.season = p_season
    GROUP BY usp.user_id
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY c.positions_submitted DESC, c.user_id)::bigint AS rank,
    c.user_id,
    c.positions_submitted
  FROM counts c
  ORDER BY c.positions_submitted DESC, c.user_id;
$$;
