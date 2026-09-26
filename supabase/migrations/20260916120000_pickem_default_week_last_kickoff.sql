-- Default pick'em week stays on the latest slate that has already kicked off
-- until the next week's first game starts, so a finished week still shows results.

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
