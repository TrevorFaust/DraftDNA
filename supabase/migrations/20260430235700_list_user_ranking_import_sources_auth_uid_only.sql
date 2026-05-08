-- Import sources RPC: filter only with auth.uid() (no client parameter).
-- The previous (uuid) variant required p_user_id = auth.uid(); some callers saw empty results
-- even when user_rankings rows existed (JWT vs parameter edge cases).

DROP FUNCTION IF EXISTS public.list_user_ranking_import_sources(uuid);

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
SECURITY DEFINER
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

REVOKE ALL ON FUNCTION public.list_user_ranking_import_sources() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_user_ranking_import_sources() TO authenticated;
