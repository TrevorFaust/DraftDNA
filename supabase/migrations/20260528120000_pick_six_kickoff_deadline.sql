-- Pick Six entry / visibility deadline → 8:20 PM ET Wed Sep 9, 2026 (NFL kickoff).

CREATE OR REPLACE FUNCTION public.get_pick_six_user_picks(
  p_season integer DEFAULT 2026,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  "position" text,
  rank integer,
  player_id uuid,
  player_name text,
  player_team text,
  tiebreaker_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_deadline timestamptz := '2026-09-10 00:20:00+00';  -- 8:20 PM ET Sep 9, 2026
  v_target_user_id uuid := COALESCE(p_user_id, auth.uid());
BEGIN
  IF v_target_user_id IS NULL THEN
    RETURN;
  END IF;

  IF current_timestamp < v_deadline AND auth.uid() IS DISTINCT FROM v_target_user_id THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    usp.position::text AS "position",
    usp.rank,
    usp.player_id,
    pl.name AS player_name,
    pl.team AS player_team,
    usp.tiebreaker_value
  FROM public.user_season_predictions usp
  LEFT JOIN public.players pl ON pl.id = usp.player_id
  WHERE usp.season = p_season
    AND usp.user_id = v_target_user_id
  ORDER BY usp.position, usp.rank;
END;
$$;

COMMENT ON FUNCTION public.get_pick_six_user_picks(integer, uuid) IS
  'Returns one user''s Pick Six picks (with player names). Before kickoff, only that user can see their own; after kickoff, anyone can view any user''s picks.';
