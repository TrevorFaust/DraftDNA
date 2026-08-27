-- Batch weekly pick'em saves. Static schedule rows share a unique matchup
-- key with ESPN scoreboard rows so scores attach to the same game.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nfl_games_season_week_matchup_key'
  ) THEN
    ALTER TABLE public.nfl_games
      ADD CONSTRAINT nfl_games_season_week_matchup_key
      UNIQUE (season, season_type, week, home_abbr, away_abbr);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.nfl_canon_abbr(p_abbr text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE upper(trim(COALESCE(p_abbr, '')))
    WHEN 'WSH' THEN 'WAS'
    WHEN 'LA' THEN 'LAR'
    WHEN 'JAC' THEN 'JAX'
    WHEN 'ARZ' THEN 'ARI'
    WHEN 'GNB' THEN 'GB'
    WHEN 'KAN' THEN 'KC'
    WHEN 'NWE' THEN 'NE'
    WHEN 'NOR' THEN 'NO'
    WHEN 'SFO' THEN 'SF'
    WHEN 'TAM' THEN 'TB'
    WHEN 'SD' THEN 'LAC'
    WHEN 'SDG' THEN 'LAC'
    ELSE upper(trim(COALESCE(p_abbr, '')))
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
    ON CONFLICT (league_id, user_id, game_id) DO UPDATE
      SET picked_abbr = EXCLUDED.picked_abbr,
          updated_at = now();

    v_saved := v_saved + 1;
  END LOOP;

  RETURN jsonb_build_object('saved', v_saved, 'skipped_locked', v_skipped);
END;
$$;

REVOKE ALL ON FUNCTION public.nfl_canon_abbr(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nfl_canon_abbr(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nfl_canon_abbr(text) TO service_role;

REVOKE ALL ON FUNCTION public.pickem_set_week_picks(uuid, integer, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pickem_set_week_picks(uuid, integer, integer, jsonb) TO authenticated;
