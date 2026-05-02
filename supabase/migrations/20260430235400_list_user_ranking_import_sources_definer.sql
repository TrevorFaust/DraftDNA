-- Import discovery RPC: SECURITY INVOKER + RLS often returned zero rows from DISTINCT even when rankings exist.
-- Run as definer to bypass RLS for this read; still scoped strictly to auth.uid().

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
