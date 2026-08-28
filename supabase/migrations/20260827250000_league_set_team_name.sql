-- Shared league team names. Owner can rename any seat; a member can rename only the team they claimed.

CREATE OR REPLACE FUNCTION public.league_set_team_name(
  p_league_id uuid,
  p_team_number integer,
  p_team_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_num integer;
  v_seat integer;
  v_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to rename a team';
  END IF;

  v_name := left(trim(coalesce(p_team_name, '')), 50);
  IF v_name = '' THEN
    v_name := 'Team ' || p_team_number::text;
  END IF;

  SELECT l.num_teams INTO v_num
  FROM public.leagues l
  WHERE l.id = p_league_id;

  IF v_num IS NULL THEN
    RAISE EXCEPTION 'League not found';
  END IF;

  IF p_team_number IS NULL OR p_team_number < 1 OR p_team_number > v_num THEN
    RAISE EXCEPTION 'That team is not in this league';
  END IF;

  IF public.is_league_owner(p_league_id) THEN
    NULL;
  ELSIF public.is_league_member(p_league_id) THEN
    SELECT m.team_number INTO v_seat
    FROM public.league_members m
    WHERE m.league_id = p_league_id AND m.user_id = v_uid;

    IF v_seat IS DISTINCT FROM p_team_number THEN
      RAISE EXCEPTION 'You can only rename the team you claimed';
    END IF;
  ELSE
    RAISE EXCEPTION 'You are not in this league';
  END IF;

  INSERT INTO public.league_teams (league_id, team_number, team_name)
  VALUES (p_league_id, p_team_number, v_name)
  ON CONFLICT (league_id, team_number)
  DO UPDATE SET team_name = EXCLUDED.team_name;
END;
$$;

REVOKE ALL ON FUNCTION public.league_set_team_name(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.league_set_team_name(uuid, integer, text) TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.league_teams;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
