-- Add optional p_exclude_user_id to get_community_rankings.
-- When in edit mode, call with current user's ID so community = baseline + others (excludes own rankings).
-- When finalized, call without exclude so community includes everyone.

CREATE OR REPLACE FUNCTION public.get_community_rankings(
  p_scoring_format text DEFAULT 'ppr',
  p_league_type text DEFAULT 'season',
  p_is_superflex boolean DEFAULT false,
  p_exclude_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  player_id uuid,
  avg_rank numeric,
  rank_position bigint,
  sample_count bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH baseline_ranks AS (
    SELECT bcr.player_id, bcr.rank AS r
    FROM public.baseline_community_rankings bcr
    WHERE bcr.scoring_format = p_scoring_format
      AND bcr.league_type = p_league_type
      AND bcr.is_superflex = p_is_superflex
  ),
  user_ranks AS (
    SELECT ur.player_id, ur.rank::numeric AS r
    FROM public.user_rankings ur
    INNER JOIN public.leagues l ON ur.league_id = l.id
    WHERE ur.league_id IS NOT NULL
      AND COALESCE(l.scoring_format, 'ppr') = p_scoring_format
      AND COALESCE(l.league_type, 'season') = p_league_type
      AND COALESCE(l.is_superflex, false) = p_is_superflex
      AND (p_exclude_user_id IS NULL OR ur.user_id != p_exclude_user_id)
  ),
  all_ranks AS (
    SELECT player_id, r FROM baseline_ranks
    UNION ALL
    SELECT player_id, r FROM user_ranks
  ),
  agg AS (
    SELECT
      ar.player_id,
      AVG(ar.r) AS avg_rank,
      COUNT(*)::bigint AS sample_count
    FROM all_ranks ar
    GROUP BY ar.player_id
  )
  SELECT
    a.player_id,
    a.avg_rank,
    ROW_NUMBER() OVER (ORDER BY a.avg_rank ASC)::bigint AS rank_position,
    a.sample_count
  FROM agg a
  ORDER BY a.avg_rank ASC;
$$;
