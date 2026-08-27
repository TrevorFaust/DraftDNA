-- Shared league membership + weekly NFL pick'em.
-- Personal rankings/mocks stay per-user; members share league tools and pick'em standings.

-- ─── Membership ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.league_members (
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_league_members_user ON public.league_members(user_id);

CREATE TABLE IF NOT EXISTS public.league_invites (
  league_id uuid PRIMARY KEY REFERENCES public.leagues(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_league_invites_code ON public.league_invites(code);

INSERT INTO public.league_members (league_id, user_id, role, joined_at)
SELECT id, user_id, 'owner', created_at
FROM public.leagues
ON CONFLICT (league_id, user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_league_member(p_league_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.league_members
    WHERE league_id = p_league_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_league_owner(p_league_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leagues
    WHERE id = p_league_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.add_league_owner_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.league_members (league_id, user_id, role)
  VALUES (NEW.id, NEW.user_id, 'owner')
  ON CONFLICT (league_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leagues_add_owner_member ON public.leagues;
CREATE TRIGGER trg_leagues_add_owner_member
  AFTER INSERT ON public.leagues
  FOR EACH ROW
  EXECUTE FUNCTION public.add_league_owner_member();

CREATE OR REPLACE FUNCTION public.league_generate_invite_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY league_members_select ON public.league_members
  FOR SELECT TO authenticated
  USING (public.is_league_member(league_id));

CREATE POLICY league_invites_select ON public.league_invites
  FOR SELECT TO authenticated
  USING (public.is_league_owner(league_id));

DROP POLICY IF EXISTS "Users can view their own leagues" ON public.leagues;
CREATE POLICY "Users can view their own leagues"
  ON public.leagues FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_league_member(id));

DROP POLICY IF EXISTS "Users can view teams in their leagues" ON public.league_teams;
CREATE POLICY "Users can view teams in their leagues"
  ON public.league_teams FOR SELECT TO authenticated
  USING (public.is_league_member(league_id) OR public.is_league_owner(league_id));

DROP POLICY IF EXISTS "Users can manage keepers for own leagues" ON public.league_keepers;
CREATE POLICY "Members can view keepers"
  ON public.league_keepers FOR SELECT TO authenticated
  USING (public.is_league_member(league_id) OR public.is_league_owner(league_id));
CREATE POLICY "Owners can manage keepers"
  ON public.league_keepers FOR ALL TO authenticated
  USING (public.is_league_owner(league_id))
  WITH CHECK (public.is_league_owner(league_id));

-- ─── Membership RPCs ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.league_get_or_create_invite(p_league_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_try integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to invite people';
  END IF;
  IF NOT public.is_league_owner(p_league_id) THEN
    RAISE EXCEPTION 'Only the league owner can create an invite link';
  END IF;

  SELECT code INTO v_code FROM public.league_invites WHERE league_id = p_league_id;
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  FOR v_try IN 1..12 LOOP
    v_code := public.league_generate_invite_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.league_invites WHERE code = v_code);
  END LOOP;

  INSERT INTO public.league_invites (league_id, code, created_by)
  VALUES (p_league_id, v_code, auth.uid());
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.league_rotate_invite(p_league_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_try integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to rotate the invite link';
  END IF;
  IF NOT public.is_league_owner(p_league_id) THEN
    RAISE EXCEPTION 'Only the league owner can rotate the invite link';
  END IF;

  FOR v_try IN 1..12 LOOP
    v_code := public.league_generate_invite_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.league_invites WHERE code = v_code);
  END LOOP;

  INSERT INTO public.league_invites (league_id, code, created_by, updated_at)
  VALUES (p_league_id, v_code, auth.uid(), now())
  ON CONFLICT (league_id) DO UPDATE
    SET code = EXCLUDED.code,
        created_by = EXCLUDED.created_by,
        updated_at = now();

  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.league_join(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_league public.leagues%ROWTYPE;
  v_code text := upper(trim(p_code));
  v_member_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to join a league';
  END IF;
  IF v_code IS NULL OR v_code = '' THEN
    RAISE EXCEPTION 'Invite code is missing';
  END IF;

  SELECT l.* INTO v_league
  FROM public.league_invites i
  JOIN public.leagues l ON l.id = i.league_id
  WHERE i.code = v_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That invite link is invalid or expired';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.league_members
    WHERE league_id = v_league.id AND user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('league_id', v_league.id, 'name', v_league.name, 'already_member', true);
  END IF;

  SELECT count(*) INTO v_member_count
  FROM public.league_members
  WHERE league_id = v_league.id;

  IF v_member_count >= 50 THEN
    RAISE EXCEPTION 'This league is full';
  END IF;

  INSERT INTO public.league_members (league_id, user_id, role)
  VALUES (v_league.id, auth.uid(), 'member');

  RETURN jsonb_build_object('league_id', v_league.id, 'name', v_league.name, 'already_member', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.league_add_member_by_username(p_league_id uuid, p_username text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_username text;
  v_member_count integer;
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

  SELECT count(*) INTO v_member_count
  FROM public.league_members
  WHERE league_id = p_league_id;

  IF v_member_count >= 50 THEN
    RAISE EXCEPTION 'This league is full';
  END IF;

  INSERT INTO public.league_members (league_id, user_id, role)
  VALUES (p_league_id, v_user_id, 'member');

  RETURN jsonb_build_object('user_id', v_user_id, 'username', v_username);
END;
$$;

CREATE OR REPLACE FUNCTION public.league_remove_member(p_league_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to remove members';
  END IF;
  IF NOT public.is_league_owner(p_league_id) THEN
    RAISE EXCEPTION 'Only the league owner can remove members';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'The owner cannot be removed';
  END IF;

  DELETE FROM public.league_members
  WHERE league_id = p_league_id
    AND user_id = p_user_id
    AND role = 'member';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That member is not in this league';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.league_leave(p_league_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to leave a league';
  END IF;
  IF public.is_league_owner(p_league_id) THEN
    RAISE EXCEPTION 'The owner cannot leave. Delete the league instead.';
  END IF;

  DELETE FROM public.league_members
  WHERE league_id = p_league_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You are not in this league';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.league_list_members(p_league_id uuid)
RETURNS TABLE (
  user_id uuid,
  username text,
  role text,
  joined_at timestamptz
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
    m.joined_at
  FROM public.league_members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.league_id = p_league_id
  ORDER BY
    CASE WHEN m.role = 'owner' THEN 0 ELSE 1 END,
    lower(COALESCE(p.username, '')),
    m.joined_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.league_preview_invite(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_code text := upper(trim(p_code));
  v_name text;
  v_id uuid;
BEGIN
  IF v_code IS NULL OR v_code = '' THEN
    RAISE EXCEPTION 'Invite code is missing';
  END IF;

  SELECT l.id, l.name INTO v_id, v_name
  FROM public.league_invites i
  JOIN public.leagues l ON l.id = i.league_id
  WHERE i.code = v_code;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'That invite link is invalid or expired';
  END IF;

  RETURN jsonb_build_object(
    'league_id', v_id,
    'name', v_name,
    'already_member', CASE
      WHEN auth.uid() IS NULL THEN false
      ELSE EXISTS (
        SELECT 1 FROM public.league_members
        WHERE league_id = v_id AND user_id = auth.uid()
      )
    END
  );
END;
$$;

-- ─── NFL games + pick'em ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.nfl_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  espn_event_id text NOT NULL UNIQUE,
  season integer NOT NULL,
  week integer NOT NULL CHECK (week BETWEEN 1 AND 22),
  season_type integer NOT NULL DEFAULT 2,
  home_abbr text NOT NULL,
  away_abbr text NOT NULL,
  home_name text,
  away_name text,
  kickoff_at timestamptz NOT NULL,
  home_score integer,
  away_score integer,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'final')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nfl_games_season_week
  ON public.nfl_games(season, season_type, week, kickoff_at);

CREATE TABLE IF NOT EXISTS public.pickem_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.nfl_games(id) ON DELETE CASCADE,
  picked_abbr text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_pickem_picks_league ON public.pickem_picks(league_id);
CREATE INDEX IF NOT EXISTS idx_pickem_picks_game ON public.pickem_picks(game_id);

ALTER TABLE public.nfl_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickem_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY nfl_games_select ON public.nfl_games
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY pickem_picks_own_select ON public.pickem_picks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_league_member(league_id));

REVOKE ALL ON TABLE public.nfl_games FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.nfl_games TO authenticated;
GRANT ALL ON TABLE public.nfl_games TO service_role;

REVOKE ALL ON TABLE public.pickem_picks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.pickem_picks TO authenticated;
GRANT ALL ON TABLE public.pickem_picks TO service_role;

REVOKE ALL ON TABLE public.league_members FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.league_members TO authenticated;
GRANT ALL ON TABLE public.league_members TO service_role;

REVOKE ALL ON TABLE public.league_invites FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.league_invites TO authenticated;
GRANT ALL ON TABLE public.league_invites TO service_role;

CREATE OR REPLACE FUNCTION public.pickem_game_winner(p_game public.nfl_games)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_game.status <> 'final' THEN NULL
    WHEN p_game.home_score IS NULL OR p_game.away_score IS NULL THEN NULL
    WHEN p_game.home_score > p_game.away_score THEN p_game.home_abbr
    WHEN p_game.away_score > p_game.home_score THEN p_game.away_abbr
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.pickem_set_pick(p_league_id uuid, p_game_id uuid, p_picked_abbr text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game public.nfl_games%ROWTYPE;
  v_pick text := upper(trim(p_picked_abbr));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to make a pick';
  END IF;
  IF NOT public.is_league_member(p_league_id) THEN
    RAISE EXCEPTION 'Join this league to pick games';
  END IF;

  SELECT * INTO v_game FROM public.nfl_games WHERE id = p_game_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That game is not on the board';
  END IF;
  IF v_game.kickoff_at <= now() OR v_game.status <> 'scheduled' THEN
    RAISE EXCEPTION 'Picks lock at kickoff';
  END IF;
  IF v_pick IS DISTINCT FROM v_game.home_abbr AND v_pick IS DISTINCT FROM v_game.away_abbr THEN
    RAISE EXCEPTION 'Pick one of the two teams in this game';
  END IF;

  INSERT INTO public.pickem_picks (league_id, user_id, game_id, picked_abbr, updated_at)
  VALUES (p_league_id, auth.uid(), p_game_id, v_pick, now())
  ON CONFLICT (league_id, user_id, game_id) DO UPDATE
    SET picked_abbr = EXCLUDED.picked_abbr,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.pickem_get_week(p_league_id uuid, p_season integer, p_week integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_week integer := p_week;
  v_games jsonb;
  v_standings jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to view pick''em';
  END IF;
  IF NOT public.is_league_member(p_league_id) THEN
    RAISE EXCEPTION 'Join this league to view pick''em';
  END IF;

  IF v_week IS NULL THEN
    SELECT g.week INTO v_week
    FROM public.nfl_games g
    WHERE g.season = p_season
      AND g.season_type = 2
      AND g.kickoff_at >= now() - interval '8 hours'
    ORDER BY g.kickoff_at
    LIMIT 1;

    IF v_week IS NULL THEN
      SELECT max(g.week) INTO v_week
      FROM public.nfl_games g
      WHERE g.season = p_season AND g.season_type = 2;
    END IF;

    v_week := COALESCE(v_week, 1);
  END IF;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(game_row) ORDER BY game_row.kickoff_at, game_row.away_abbr),
    '[]'::jsonb
  )
  INTO v_games
  FROM (
    SELECT
      g.id,
      g.espn_event_id,
      g.kickoff_at,
      g.status,
      g.home_abbr,
      g.away_abbr,
      g.home_name,
      g.away_name,
      g.home_score,
      g.away_score,
      public.pickem_game_winner(g) AS winner_abbr,
      (g.kickoff_at <= now() OR g.status <> 'scheduled') AS locked,
      mine.picked_abbr AS my_pick,
      CASE
        WHEN g.kickoff_at <= now() OR g.status <> 'scheduled' THEN COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'user_id', m.user_id,
            'username', COALESCE(p.username, 'Member'),
            'picked_abbr', pk.picked_abbr
          ) ORDER BY lower(COALESCE(p.username, '')))
          FROM public.league_members m
          LEFT JOIN public.pickem_picks pk
            ON pk.league_id = p_league_id
           AND pk.user_id = m.user_id
           AND pk.game_id = g.id
          LEFT JOIN public.profiles p ON p.id = m.user_id
        ), '[]'::jsonb)
        ELSE '[]'::jsonb
      END AS member_picks
    FROM public.nfl_games g
    LEFT JOIN public.pickem_picks mine
      ON mine.league_id = p_league_id
     AND mine.user_id = auth.uid()
     AND mine.game_id = g.id
    WHERE g.season = p_season
      AND g.season_type = 2
      AND g.week = v_week
  ) game_row;

  SELECT COALESCE(
    jsonb_agg(
      to_jsonb(standing_row)
      ORDER BY standing_row.wins DESC, standing_row.losses ASC, standing_row.pushes DESC, lower(standing_row.username)
    ),
    '[]'::jsonb
  )
  INTO v_standings
  FROM (
    SELECT
      m.user_id,
      COALESCE(p.username, 'Member') AS username,
      m.role,
      count(*) FILTER (
        WHERE pk.picked_abbr IS NOT NULL
          AND public.pickem_game_winner(g) IS NOT NULL
          AND pk.picked_abbr = public.pickem_game_winner(g)
      )::int AS wins,
      count(*) FILTER (
        WHERE pk.picked_abbr IS NOT NULL
          AND public.pickem_game_winner(g) IS NOT NULL
          AND pk.picked_abbr <> public.pickem_game_winner(g)
      )::int AS losses,
      count(*) FILTER (
        WHERE pk.picked_abbr IS NOT NULL
          AND g.status = 'final'
          AND g.home_score IS NOT NULL
          AND g.away_score IS NOT NULL
          AND g.home_score = g.away_score
      )::int AS pushes,
      (m.user_id = auth.uid()) AS is_you
    FROM public.league_members m
    LEFT JOIN public.profiles p ON p.id = m.user_id
    LEFT JOIN public.pickem_picks pk
      ON pk.league_id = p_league_id AND pk.user_id = m.user_id
    LEFT JOIN public.nfl_games g
      ON g.id = pk.game_id AND g.season = p_season AND g.season_type = 2
    WHERE m.league_id = p_league_id
    GROUP BY m.user_id, p.username, m.role
  ) standing_row;

  RETURN jsonb_build_object(
    'season', p_season,
    'week', v_week,
    'games', v_games,
    'standings', v_standings
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_league_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_league_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_league_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_league_owner(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.add_league_owner_member() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_league_owner_member() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_league_owner_member() TO service_role;

REVOKE ALL ON FUNCTION public.league_generate_invite_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.league_generate_invite_code() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_generate_invite_code() TO service_role;

REVOKE ALL ON FUNCTION public.pickem_game_winner(public.nfl_games) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pickem_game_winner(public.nfl_games) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pickem_game_winner(public.nfl_games) TO service_role;

REVOKE ALL ON FUNCTION public.league_get_or_create_invite(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.league_rotate_invite(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.league_join(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.league_add_member_by_username(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.league_remove_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.league_leave(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.league_list_members(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.league_preview_invite(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pickem_set_pick(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pickem_get_week(uuid, integer, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.league_get_or_create_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.league_rotate_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.league_join(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.league_add_member_by_username(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.league_remove_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.league_leave(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.league_list_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.league_preview_invite(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pickem_set_pick(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pickem_get_week(uuid, integer, integer) TO authenticated;
