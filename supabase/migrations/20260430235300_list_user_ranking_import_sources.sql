-- Distinct (league, bucket) combinations for ranking import UI.
-- Needed because selecting raw user_rankings is capped (~1000 rows) and misses other leagues/buckets.

CREATE OR REPLACE FUNCTION public.list_user_ranking_import_sources()
RETURNS TABLE (
  league_id uuid,
  scoring_format text,
  league_type text,
  is_superflex boolean,
  rookies_only boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT
    ur.league_id,
    ur.scoring_format,
    ur.league_type,
    ur.is_superflex,
    ur.rookies_only
  FROM public.user_rankings ur
  WHERE ur.user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.list_user_ranking_import_sources() TO authenticated;
