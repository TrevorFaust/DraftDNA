-- Claim a league team seat at join. One member per team_number.

ALTER TABLE public.league_members
  ADD COLUMN IF NOT EXISTS team_number integer;

ALTER TABLE public.league_members
  DROP CONSTRAINT IF EXISTS league_members_team_number_check;

ALTER TABLE public.league_members
  ADD CONSTRAINT league_members_team_number_check
  CHECK (team_number IS NULL OR team_number >= 1);

CREATE UNIQUE INDEX IF NOT EXISTS league_members_one_per_team
  ON public.league_members (league_id, team_number)
  WHERE team_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.league_seat_rows(p_league_id uuid)
RETURNS TABLE (
  team_number integer,
  team_name text,
  user_id uuid,
  username text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    gs.n AS team_number,
    COALESCE(NULLIF(trim(t.team_name), ''), 'Team ' || gs.n::text) AS team_name,
    m.user_id,
    NULLIF(trim(p.username), '') AS username
  FROM public.leagues l
  CROSS JOIN LATERAL generate_series(1, GREATEST(COALESCE(l.num_teams, 12), 1)) AS gs(n)
  LEFT JOIN public.league_teams t
    ON t.league_id = l.id AND t.team_number = gs.n
  LEFT JOIN public.league_members m
    ON m.league_id = l.id AND m.team_number = gs.n
  LEFT JOIN public.profiles p
    ON p.id = m.user_id
  WHERE l.id = p_league_id
  ORDER BY gs.n;
$$;

CREATE OR REPLACE FUNCTION public.league_invite_seats(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_code text := upper(trim(p_code));
  v_id uuid;
BEGIN
  IF v_code IS NULL OR v_code = '' THEN
    RAISE EXCEPTION 'Invite code is missing';
  END IF;

  SELECT i.league_id INTO v_id
  FROM public.league_invites i
  WHERE i.code = v_code;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'That invite link is invalid or expired';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(jsonb_build_object(
        'team_number', s.team_number,
        'team_name', s.team_name,
        'user_id', s.user_id,
        'username', s.username
      ) ORDER BY s.team_number)
      FROM public.league_seat_rows(v_id) s
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.league_list_seats(p_league_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to view teams';
  END IF;
  IF NOT (public.is_league_member(p_league_id) OR public.is_league_owner(p_league_id)) THEN
    RAISE EXCEPTION 'You are not in this league';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(jsonb_build_object(
        'team_number', s.team_number,
        'team_name', s.team_name,
        'user_id', s.user_id,
        'username', s.username
      ) ORDER BY s.team_number)
      FROM public.league_seat_rows(p_league_id) s
    ),
    '[]'::jsonb
  );
END;
$$;

DROP FUNCTION IF EXISTS public.league_join(text);

CREATE FUNCTION public.league_join(p_code text, p_team_number integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_league public.leagues%ROWTYPE;
  v_code text := upper(trim(p_code));
  v_member_count integer;
  v_existing integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to join a league';
  END IF;
  IF v_code IS NULL OR v_code = '' THEN
    RAISE EXCEPTION 'Invite code is missing';
  END IF;
  IF p_team_number IS NULL THEN
    RAISE EXCEPTION 'Pick a team to join';
  END IF;

  SELECT l.* INTO v_league
  FROM public.league_invites i
  JOIN public.leagues l ON l.id = i.league_id
  WHERE i.code = v_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That invite link is invalid or expired';
  END IF;

  IF p_team_number < 1 OR p_team_number > COALESCE(v_league.num_teams, 12) THEN
    RAISE EXCEPTION 'That team is not in this league';
  END IF;

  SELECT team_number INTO v_existing
  FROM public.league_members
  WHERE league_id = v_league.id AND user_id = auth.uid();

  IF FOUND THEN
    RETURN jsonb_build_object(
      'league_id', v_league.id,
      'name', v_league.name,
      'already_member', true,
      'team_number', v_existing
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.league_members
    WHERE league_id = v_league.id AND team_number = p_team_number
  ) THEN
    RAISE EXCEPTION 'That team is already taken';
  END IF;

  SELECT count(*) INTO v_member_count
  FROM public.league_members
  WHERE league_id = v_league.id;

  IF v_member_count >= 50 THEN
    RAISE EXCEPTION 'This league is full';
  END IF;

  INSERT INTO public.league_members (league_id, user_id, role, team_number)
  VALUES (v_league.id, auth.uid(), 'member', p_team_number);

  RETURN jsonb_build_object(
    'league_id', v_league.id,
    'name', v_league.name,
    'already_member', false,
    'team_number', p_team_number
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.league_claim_team(p_league_id uuid, p_team_number integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num integer;
  v_current integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to pick a team';
  END IF;
  IF NOT (public.is_league_member(p_league_id) OR public.is_league_owner(p_league_id)) THEN
    RAISE EXCEPTION 'You are not in this league';
  END IF;

  SELECT num_teams INTO v_num FROM public.leagues WHERE id = p_league_id;
  IF v_num IS NULL THEN
    RAISE EXCEPTION 'League not found';
  END IF;
  IF p_team_number IS NULL OR p_team_number < 1 OR p_team_number > v_num THEN
    RAISE EXCEPTION 'That team is not in this league';
  END IF;

  SELECT team_number INTO v_current
  FROM public.league_members
  WHERE league_id = p_league_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You are not in this league';
  END IF;
  IF v_current IS NOT NULL THEN
    RAISE EXCEPTION 'You already have a team. Ask the commissioner to move you.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.league_members
    WHERE league_id = p_league_id AND team_number = p_team_number
  ) THEN
    RAISE EXCEPTION 'That team is already taken';
  END IF;

  UPDATE public.league_members
  SET team_number = p_team_number
  WHERE league_id = p_league_id AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.league_set_member_team(
  p_league_id uuid,
  p_user_id uuid,
  p_team_number integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num integer;
  v_current integer;
  v_occupant uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to assign teams';
  END IF;
  IF NOT public.is_league_owner(p_league_id) THEN
    RAISE EXCEPTION 'Only the commissioner can move people';
  END IF;

  SELECT num_teams INTO v_num FROM public.leagues WHERE id = p_league_id;
  IF v_num IS NULL THEN
    RAISE EXCEPTION 'League not found';
  END IF;

  SELECT team_number INTO v_current
  FROM public.league_members
  WHERE league_id = p_league_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That person is not in this league';
  END IF;

  IF p_team_number IS NULL THEN
    UPDATE public.league_members
    SET team_number = NULL
    WHERE league_id = p_league_id AND user_id = p_user_id;
    RETURN;
  END IF;

  IF p_team_number < 1 OR p_team_number > v_num THEN
    RAISE EXCEPTION 'That team is not in this league';
  END IF;

  SELECT user_id INTO v_occupant
  FROM public.league_members
  WHERE league_id = p_league_id AND team_number = p_team_number;

  UPDATE public.league_members
  SET team_number = NULL
  WHERE league_id = p_league_id
    AND user_id IN (p_user_id, v_occupant);

  UPDATE public.league_members
  SET team_number = p_team_number
  WHERE league_id = p_league_id AND user_id = p_user_id;

  IF v_occupant IS NOT NULL AND v_occupant IS DISTINCT FROM p_user_id THEN
    UPDATE public.league_members
    SET team_number = v_current
    WHERE league_id = p_league_id AND user_id = v_occupant;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.league_add_member_by_username(uuid, text);

CREATE FUNCTION public.league_add_member_by_username(
  p_league_id uuid,
  p_username text,
  p_team_number integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_username text;
  v_member_count integer;
  v_num integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to add members';
  END IF;
  IF NOT public.is_league_owner(p_league_id) THEN
    RAISE EXCEPTION 'Only the league owner can add members';
  END IF;

  SELECT id, username INTO v_user_id, v_username
  FROM public.profiles
  WHERE lower(trim(username)) = lower(trim(p_username));

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No account with that username';
  END IF;

  IF v_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You already own this league';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.league_members
    WHERE league_id = p_league_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'That user is already in this league';
  END IF;

  SELECT num_teams INTO v_num FROM public.leagues WHERE id = p_league_id;

  IF p_team_number IS NOT NULL THEN
    IF p_team_number < 1 OR p_team_number > COALESCE(v_num, 12) THEN
      RAISE EXCEPTION 'That team is not in this league';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.league_members
      WHERE league_id = p_league_id AND team_number = p_team_number
    ) THEN
      RAISE EXCEPTION 'That team is already taken';
    END IF;
  END IF;

  SELECT count(*) INTO v_member_count
  FROM public.league_members
  WHERE league_id = p_league_id;

  IF v_member_count >= 50 THEN
    RAISE EXCEPTION 'This league is full';
  END IF;

  INSERT INTO public.league_members (league_id, user_id, role, team_number)
  VALUES (p_league_id, v_user_id, 'member', p_team_number);

  RETURN jsonb_build_object(
    'user_id', v_user_id,
    'username', v_username,
    'team_number', p_team_number
  );
END;
$$;

DROP FUNCTION IF EXISTS public.league_list_members(uuid);

CREATE FUNCTION public.league_list_members(p_league_id uuid)
RETURNS TABLE (
  user_id uuid,
  username text,
  role text,
  joined_at timestamptz,
  team_number integer
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to view members';
  END IF;
  IF NOT public.is_league_member(p_league_id) THEN
    RAISE EXCEPTION 'You are not in this league';
  END IF;

  RETURN QUERY
  SELECT
    m.user_id,
    COALESCE(p.username, 'Member') AS username,
    m.role,
    m.joined_at,
    m.team_number
  FROM public.league_members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.league_id = p_league_id
  ORDER BY
    CASE WHEN m.role = 'owner' THEN 0 ELSE 1 END,
    lower(COALESCE(p.username, '')),
    m.joined_at;
END;
$$;

REVOKE ALL ON FUNCTION public.league_seat_rows(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.league_invite_seats(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.league_list_seats(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.league_join(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.league_claim_team(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.league_set_member_team(uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.league_add_member_by_username(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.league_list_members(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.league_seat_rows(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.league_invite_seats(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_list_seats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.league_join(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.league_claim_team(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.league_set_member_team(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.league_add_member_by_username(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.league_list_members(uuid) TO authenticated;
