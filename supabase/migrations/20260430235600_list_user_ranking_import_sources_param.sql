-- Replace zero-arg RPC with explicit p_user_id so PostgREST always binds the caller id correctly.
-- Keeps SECURITY DEFINER + auth check: only return rows when p_user_id = auth.uid().

DROP FUNCTION IF EXISTS public.list_user_ranking_import_sources();

CREATE OR REPLACE FUNCTION public.list_user_ranking_import_sources(p_user_id uuid)
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
  WHERE ur.user_id = p_user_id
    AND p_user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.list_user_ranking_import_sources(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_user_ranking_import_sources(uuid) TO authenticated;
