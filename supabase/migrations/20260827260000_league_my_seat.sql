-- Current user's claimed seat. Settings and rankings should both use this, not leagues.user_pick_position.

CREATE OR REPLACE FUNCTION public.league_my_seat(p_league_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_team integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to view your team';
  END IF;
  IF NOT (public.is_league_member(p_league_id) OR public.is_league_owner(p_league_id)) THEN
    RAISE EXCEPTION 'You are not in this league';
  END IF;

  SELECT m.role, m.team_number
  INTO v_role, v_team
  FROM public.league_members m
  WHERE m.league_id = p_league_id AND m.user_id = v_uid;

  IF NOT FOUND THEN
    IF public.is_league_owner(p_league_id) THEN
      RETURN jsonb_build_object('team_number', null, 'role', 'owner');
    END IF;
    RETURN jsonb_build_object('team_number', null, 'role', 'member');
  END IF;

  RETURN jsonb_build_object(
    'team_number', v_team,
    'role', COALESCE(v_role, 'member')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.league_my_seat(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.league_my_seat(uuid) TO authenticated;
