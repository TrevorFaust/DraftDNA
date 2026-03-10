-- Pick Six: leaderboard with display name; RPC to fetch a user's picks (allowed for all after deadline).

-- 1) Extend leaderboard to return a display name (from auth.users).
--    SECURITY DEFINER so we can read auth.users; we only expose id, rank, positions_submitted, and a display label.
--    Drop first because return type (added username) cannot be changed with CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.get_pick_six_leaderboard(integer);

CREATE OR REPLACE FUNCTION public.get_pick_six_leaderboard(p_season integer DEFAULT 2026)
RETURNS TABLE (
  rank bigint,
  user_id uuid,
  positions_submitted bigint,
  username text
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
    c.positions_submitted,
    COALESCE(
      TRIM(NULLIF(u.raw_user_meta_data->>'full_name', '')),
      TRIM(NULLIF(u.raw_user_meta_data->>'name', '')),
      split_part(u.email, '@', 1)
    ) AS username
  FROM counts c
  LEFT JOIN auth.users u ON u.id = c.user_id
  ORDER BY c.positions_submitted DESC, c.user_id;
$$;

-- 2) RPC to fetch one user's Pick Six entries (with player names and tiebreakers).
--    Before deadline: only the requesting user can see their own picks.
--    After deadline: anyone can view any user's picks (for public leaderboard / "view picks").
--    8:00 PM ET, Thursday September 3, 2026 = 2026-09-04 00:00:00 UTC (EDT = UTC-4).
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
  v_deadline timestamptz := '2026-09-04 00:00:00+00';  -- 8pm ET Sep 3, 2026
  v_target_user_id uuid := COALESCE(p_user_id, auth.uid());
BEGIN
  IF v_target_user_id IS NULL THEN
    RETURN;  -- anon and no p_user_id: nothing to return
  END IF;

  -- Before deadline: only allow viewing your own picks.
  IF current_timestamp < v_deadline AND auth.uid() IS DISTINCT FROM v_target_user_id THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    usp.position::text AS "position",
    usp.rank,
    usp.player_id,
    p.name::text AS player_name,
    p.team::text AS player_team,
    ust.tiebreaker_value
  FROM public.user_season_predictions usp
  LEFT JOIN public.players p ON p.id = usp.player_id
  LEFT JOIN public.user_season_tiebreakers ust
    ON ust.user_id = usp.user_id AND ust.season = usp.season AND ust.position = usp.position
  WHERE usp.user_id = v_target_user_id
    AND usp.season = p_season
  ORDER BY usp.position, usp.rank;
END;
$$;

COMMENT ON FUNCTION public.get_pick_six_user_picks(integer, uuid) IS
  'Returns one user''s Pick Six picks (with player names). Before entry deadline, only that user can see their own; after deadline, anyone can view any user''s picks.';
