-- Pick Six: fetch all users' picks for one position (leaderboard). SECURITY DEFINER bypasses RLS.

CREATE OR REPLACE FUNCTION public.get_pick_six_position_entries(
  p_season integer DEFAULT 2026,
  p_position text DEFAULT 'QB'
)
RETURNS TABLE (
  user_id uuid,
  username text,
  rank integer,
  player_id uuid,
  player_name text,
  player_team text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    usp.user_id,
    COALESCE(
      NULLIF(TRIM(p.username), ''),
      TRIM(NULLIF(u.raw_user_meta_data->>'full_name', '')),
      TRIM(NULLIF(u.raw_user_meta_data->>'name', '')),
      split_part(u.email, '@', 1)
    ) AS username,
    usp.rank,
    usp.player_id,
    pl.name AS player_name,
    pl.team AS player_team
  FROM public.user_season_predictions usp
  LEFT JOIN auth.users u ON u.id = usp.user_id
  LEFT JOIN public.profiles p ON p.id = usp.user_id
  LEFT JOIN public.players pl ON pl.id = usp.player_id
  WHERE usp.season = p_season
    AND usp.position = p_position
  ORDER BY usp.user_id, usp.rank;
$$;

COMMENT ON FUNCTION public.get_pick_six_position_entries(integer, text) IS
  'All Pick Six picks for one position (for dashboard leaderboard).';

GRANT EXECUTE ON FUNCTION public.get_pick_six_position_entries(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pick_six_position_entries(integer, text) TO anon;
