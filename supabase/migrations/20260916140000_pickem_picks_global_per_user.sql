-- Pick'em entries are per user + game, not per league. NFL results don't
-- change with PPR vs standard, so one pick card should score the same
-- everywhere. Also stop counting the same person once per league membership.

DELETE FROM public.pickem_picks pk
WHERE pk.id NOT IN (
  SELECT DISTINCT ON (user_id, game_id) id
  FROM public.pickem_picks
  ORDER BY user_id, game_id, updated_at DESC, id DESC
);

ALTER TABLE public.pickem_picks
  DROP CONSTRAINT IF EXISTS pickem_picks_league_id_user_id_game_id_key;

ALTER TABLE public.pickem_picks
  DROP CONSTRAINT IF EXISTS pickem_picks_league_id_fkey;

ALTER TABLE public.pickem_picks
  ALTER COLUMN league_id DROP NOT NULL;

ALTER TABLE public.pickem_picks
  ADD CONSTRAINT pickem_picks_league_id_fkey
  FOREIGN KEY (league_id) REFERENCES public.leagues(id) ON DELETE SET NULL;

ALTER TABLE public.pickem_picks
  ADD CONSTRAINT pickem_picks_user_game_key UNIQUE (user_id, game_id);

DROP POLICY IF EXISTS pickem_picks_own_select ON public.pickem_picks;
CREATE POLICY pickem_picks_own_select ON public.pickem_picks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

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
  ON CONFLICT (user_id, game_id) DO UPDATE
    SET picked_abbr = EXCLUDED.picked_abbr,
        league_id = EXCLUDED.league_id,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.pickem_set_week_picks(
  p_league_id uuid,
  p_season integer,
  p_week integer,
  p_picks jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_away text;
  v_home text;
  v_pick text;
  v_game public.nfl_games%ROWTYPE;
  v_kickoff timestamptz;
  v_saved integer := 0;
  v_skipped integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to make a pick';
  END IF;
  IF NOT public.is_league_member(p_league_id) THEN
    RAISE EXCEPTION 'Join this league to pick games';
  END IF;
  IF p_season < 2020 OR p_season > 2100 THEN
    RAISE EXCEPTION 'That season is not on the board';
  END IF;
  IF p_week < 1 OR p_week > 18 THEN
    RAISE EXCEPTION 'Pick a regular-season week';
  END IF;
  IF p_picks IS NULL OR jsonb_typeof(p_picks) <> 'array' THEN
    RAISE EXCEPTION 'Send this week''s picks as a list';
  END IF;
  IF jsonb_array_length(p_picks) > 20 THEN
    RAISE EXCEPTION 'Too many picks for one week';
  END IF;

  v_kickoff := make_timestamptz(p_season, 9, 13, 13, 0, 0, 'America/New_York')
    + ((p_week - 1) * interval '7 days');

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_picks)
  LOOP
    v_away := public.nfl_canon_abbr(v_item->>'away');
    v_home := public.nfl_canon_abbr(v_item->>'home');
    v_pick := public.nfl_canon_abbr(v_item->>'picked');

    IF v_away = '' OR v_home = '' OR v_away = v_home THEN
      RAISE EXCEPTION 'Each pick needs a home and away team';
    END IF;
    IF v_pick IS DISTINCT FROM v_home AND v_pick IS DISTINCT FROM v_away THEN
      RAISE EXCEPTION 'Pick one of the two teams in this game';
    END IF;

    SELECT * INTO v_game
    FROM public.nfl_games
    WHERE season = p_season
      AND season_type = 2
      AND week = p_week
      AND home_abbr = v_home
      AND away_abbr = v_away;

    IF NOT FOUND THEN
      INSERT INTO public.nfl_games (
        espn_event_id,
        season,
        week,
        season_type,
        home_abbr,
        away_abbr,
        kickoff_at,
        status
      ) VALUES (
        'static-' || p_season::text || '-w' || p_week::text || '-' || v_away || '-' || v_home,
        p_season,
        p_week,
        2,
        v_home,
        v_away,
        v_kickoff,
        'scheduled'
      )
      ON CONFLICT (season, season_type, week, home_abbr, away_abbr)
      DO UPDATE SET updated_at = public.nfl_games.updated_at
      RETURNING * INTO v_game;
    END IF;

    IF v_game.kickoff_at <= now() OR v_game.status <> 'scheduled' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.pickem_picks (league_id, user_id, game_id, picked_abbr, updated_at)
    VALUES (p_league_id, auth.uid(), v_game.id, v_pick, now())
    ON CONFLICT (user_id, game_id) DO UPDATE
      SET picked_abbr = EXCLUDED.picked_abbr,
          league_id = EXCLUDED.league_id,
          updated_at = now();

    v_saved := v_saved + 1;
  END LOOP;

  RETURN jsonb_build_object('saved', v_saved, 'skipped_locked', v_skipped);
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
      AND g.kickoff_at <= now()
    ORDER BY g.kickoff_at DESC
    LIMIT 1;

    IF v_week IS NULL THEN
      SELECT g.week INTO v_week
      FROM public.nfl_games g
      WHERE g.season = p_season
        AND g.season_type = 2
        AND g.kickoff_at >= now()
      ORDER BY g.kickoff_at
      LIMIT 1;
    END IF;

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
          INNER JOIN public.pickem_picks pk
            ON pk.user_id = m.user_id
           AND pk.game_id = g.id
          LEFT JOIN public.profiles p ON p.id = m.user_id
          WHERE m.league_id = p_league_id
        ), '[]'::jsonb)
        ELSE '[]'::jsonb
      END AS member_picks
    FROM public.nfl_games g
    LEFT JOIN public.pickem_picks mine
      ON mine.user_id = auth.uid()
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
      ON pk.user_id = m.user_id
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
