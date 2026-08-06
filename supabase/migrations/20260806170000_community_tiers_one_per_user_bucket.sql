-- Community tier consensus is per rankings bucket (scoring / league type / SF / rookies).
-- One submission per user per bucket (latest row) so multiple leagues in the same
-- bucket do not double-count the same person.

CREATE OR REPLACE FUNCTION public.get_community_ranking_tier_submissions(
  p_scoring_format text DEFAULT 'ppr',
  p_league_type text DEFAULT 'season',
  p_is_superflex boolean DEFAULT false,
  p_rookies_only boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(sub.cuts), '[]'::jsonb)
  FROM (
    SELECT DISTINCT ON (urt.user_id) urt.cuts
    FROM public.user_ranking_tiers urt
    WHERE urt.scoring_format = p_scoring_format
      AND urt.league_type = p_league_type
      AND urt.is_superflex = p_is_superflex
      AND urt.rookies_only = p_rookies_only
      AND urt.cuts IS NOT NULL
      AND urt.cuts <> '{}'::jsonb
      AND EXISTS (
        SELECT 1
        FROM jsonb_each(urt.cuts) AS e(pos, cuts)
        WHERE jsonb_typeof(e.cuts) = 'array'
          AND jsonb_array_length(e.cuts) >= 1
      )
    ORDER BY urt.user_id, urt.updated_at DESC NULLS LAST
  ) AS sub;
$$;

GRANT EXECUTE ON FUNCTION public.get_community_ranking_tier_submissions(text, text, boolean, boolean)
  TO anon, authenticated;
