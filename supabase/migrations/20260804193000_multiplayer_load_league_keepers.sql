-- Load ALL league keepers server-side when creating a multiplayer draft.
-- Client-passed keepers were incomplete (only the host seat), so other teams'
-- keepers stayed on the board and got drafted by someone else.

CREATE OR REPLACE FUNCTION public.mp_create_draft(
  p_name text,
  p_num_teams integer,
  p_num_rounds integer,
  p_host_team_number integer,
  p_draft_order text DEFAULT 'snake',
  p_pick_timer integer DEFAULT 30,
  p_cpu_speed text DEFAULT 'normal',
  p_scoring_format text DEFAULT NULL,
  p_league_type text DEFAULT NULL,
  p_is_superflex boolean DEFAULT false,
  p_position_limits jsonb DEFAULT '{}'::jsonb,
  p_player_pool text DEFAULT 'all',
  p_team_names jsonb DEFAULT '{}'::jsonb,
  p_source_league_id uuid DEFAULT NULL,
  p_board_player_ids uuid[] DEFAULT '{}'::uuid[],
  p_board_player_positions text[] DEFAULT '{}'::text[],
  p_keepers jsonb DEFAULT '[]'::jsonb,
  p_display_name text DEFAULT 'Host'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text;
  v_draft_id uuid;
  v_attempts integer := 0;
  v_keeper jsonb;
  v_keeper_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Host must be logged in';
  END IF;
  IF p_num_teams < 4 OR p_num_teams > 32 THEN
    RAISE EXCEPTION 'num_teams must be between 4 and 32';
  END IF;
  IF p_host_team_number < 1 OR p_host_team_number > p_num_teams THEN
    RAISE EXCEPTION 'Invalid host team number';
  END IF;
  IF coalesce(array_length(p_board_player_ids, 1), 0) < p_num_teams * p_num_rounds THEN
    RAISE EXCEPTION 'Player board too small for this draft';
  END IF;

  LOOP
    v_code := public.mp_generate_invite_code();
    v_attempts := v_attempts + 1;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.multiplayer_drafts WHERE invite_code = v_code);
    IF v_attempts > 20 THEN
      RAISE EXCEPTION 'Could not generate invite code';
    END IF;
  END LOOP;

  INSERT INTO public.multiplayer_drafts (
    host_user_id, invite_code, name, status, num_teams, num_rounds, draft_order,
    pick_timer, cpu_speed, scoring_format, league_type, is_superflex, position_limits,
    player_pool, team_names, source_league_id, board_player_ids, board_player_positions
  ) VALUES (
    v_uid, v_code, coalesce(nullif(trim(p_name), ''), 'Multiplayer Mock'),
    'lobby', p_num_teams, p_num_rounds, coalesce(p_draft_order, 'snake'),
    coalesce(p_pick_timer, 30), coalesce(p_cpu_speed, 'normal'), p_scoring_format,
    p_league_type, coalesce(p_is_superflex, false), coalesce(p_position_limits, '{}'::jsonb),
    coalesce(p_player_pool, 'all'), coalesce(p_team_names, '{}'::jsonb), p_source_league_id,
    p_board_player_ids, p_board_player_positions
  )
  RETURNING id INTO v_draft_id;

  INSERT INTO public.multiplayer_draft_participants (
    draft_id, team_number, user_id, display_name, is_host, is_ready
  ) VALUES (
    v_draft_id, p_host_team_number, v_uid, coalesce(nullif(trim(p_display_name), ''), 'Host'),
    true, true
  );

  -- Prefer league keepers from DB (SECURITY DEFINER sees every team).
  IF p_source_league_id IS NOT NULL THEN
    INSERT INTO public.multiplayer_draft_keepers (draft_id, team_number, player_id, round_number)
    SELECT v_draft_id, k.team_number, k.player_id, k.round_number
    FROM public.league_keepers k
    WHERE k.league_id = p_source_league_id
      AND k.team_number >= 1
      AND k.team_number <= p_num_teams
      AND k.round_number >= 1
      AND k.round_number <= p_num_rounds;

    GET DIAGNOSTICS v_keeper_count = ROW_COUNT;
  END IF;

  -- Fallback / supplement from client payload when no league source (or league had none).
  IF v_keeper_count = 0 AND p_keepers IS NOT NULL AND jsonb_typeof(p_keepers) = 'array' THEN
    FOR v_keeper IN SELECT * FROM jsonb_array_elements(p_keepers)
    LOOP
      BEGIN
        INSERT INTO public.multiplayer_draft_keepers (draft_id, team_number, player_id, round_number)
        VALUES (
          v_draft_id,
          (v_keeper->>'team_number')::integer,
          (v_keeper->>'player_id')::uuid,
          (v_keeper->>'round_number')::integer
        );
        v_keeper_count := v_keeper_count + 1;
      EXCEPTION
        WHEN unique_violation THEN
          NULL; -- skip duplicate team/round or player
      END;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'draft_id', v_draft_id,
    'invite_code', v_code,
    'keeper_count', v_keeper_count
  );
END;
$$;

-- If a reserved keeper was somehow already drafted, still resolve the seat
-- (BPA) so the human isn't stuck on a keeper round with no player to receive.
CREATE OR REPLACE FUNCTION public.mp_advance_after_pick(p_draft_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft public.multiplayer_drafts%ROWTYPE;
  v_total integer;
  v_next integer;
  v_team integer;
  v_round integer;
  v_human boolean;
  v_keeper_player uuid;
  v_fallback uuid;
BEGIN
  SELECT * INTO v_draft FROM public.multiplayer_drafts WHERE id = p_draft_id FOR UPDATE;
  v_total := v_draft.num_teams * v_draft.num_rounds;
  v_next := v_draft.current_pick_number + 1;

  IF v_next > v_total THEN
    UPDATE public.multiplayer_drafts
    SET status = 'completed',
        completed_at = clock_timestamp(),
        pick_deadline_at = NULL,
        current_pick_number = v_next
    WHERE id = p_draft_id;
    RETURN;
  END IF;

  v_team := public.mp_team_for_pick(v_next, v_draft.num_teams, v_draft.draft_order);
  v_round := public.mp_round_for_pick(v_next, v_draft.num_teams);
  v_human := public.mp_team_is_human(p_draft_id, v_team);

  SELECT player_id INTO v_keeper_player
  FROM public.multiplayer_draft_keepers
  WHERE draft_id = p_draft_id
    AND team_number = v_team
    AND round_number = v_round;

  UPDATE public.multiplayer_drafts
  SET current_pick_number = v_next,
      pick_deadline_at = CASE
        WHEN v_keeper_player IS NOT NULL THEN NULL
        WHEN v_human AND v_draft.pick_timer > 0
          THEN clock_timestamp() + make_interval(secs => v_draft.pick_timer)
        ELSE NULL
      END
  WHERE id = p_draft_id;

  IF v_keeper_player IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.multiplayer_draft_picks
      WHERE draft_id = p_draft_id AND player_id = v_keeper_player
    ) THEN
      PERFORM public.mp_insert_pick(p_draft_id, v_keeper_player, true, true);
    ELSE
      -- Reserved keeper already gone; fill the seat so the draft doesn't stall.
      v_fallback := public.mp_select_bpa_player(p_draft_id, v_team);
      IF v_fallback IS NOT NULL THEN
        PERFORM public.mp_insert_pick(p_draft_id, v_fallback, true, false);
      END IF;
    END IF;
  END IF;
END;
$$;
