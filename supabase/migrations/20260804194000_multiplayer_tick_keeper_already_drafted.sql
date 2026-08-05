-- Mirror advance_after_pick: if a reserved keeper is already gone, BPA-fill the seat.

CREATE OR REPLACE FUNCTION public.mp_tick_draft(
  p_draft_id uuid,
  p_guest_session_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft public.multiplayer_drafts%ROWTYPE;
  v_team integer;
  v_round integer;
  v_human boolean;
  v_keeper_player uuid;
  v_player_id uuid;
  v_pick public.multiplayer_draft_picks%ROWTYPE;
  v_actions jsonb := '[]'::jsonb;
  v_total integer;
  v_part public.multiplayer_draft_participants%ROWTYPE;
  v_force_auto boolean := false;
  v_timer_expired boolean := false;
  v_new_streak integer;
  v_stale boolean := false;
BEGIN
  IF NOT public.mp_caller_is_participant(p_draft_id, p_guest_session_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.multiplayer_drafts d
       WHERE d.id = p_draft_id AND d.host_user_id = auth.uid()
     ) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  SELECT * INTO v_draft FROM public.multiplayer_drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found'; END IF;
  IF v_draft.status <> 'drafting' THEN
    RETURN jsonb_build_object('status', v_draft.status, 'actions', v_actions, 'server_now', clock_timestamp());
  END IF;

  v_total := v_draft.num_teams * v_draft.num_rounds;
  IF v_draft.current_pick_number > v_total THEN
    UPDATE public.multiplayer_drafts
    SET status = 'completed', completed_at = coalesce(completed_at, clock_timestamp()), pick_deadline_at = NULL
    WHERE id = p_draft_id;
    RETURN jsonb_build_object('status', 'completed', 'actions', v_actions, 'server_now', clock_timestamp());
  END IF;

  v_team := public.mp_team_for_pick(v_draft.current_pick_number, v_draft.num_teams, v_draft.draft_order);
  v_round := public.mp_round_for_pick(v_draft.current_pick_number, v_draft.num_teams);
  v_human := public.mp_team_is_human(p_draft_id, v_team);

  SELECT player_id INTO v_keeper_player
  FROM public.multiplayer_draft_keepers
  WHERE draft_id = p_draft_id AND team_number = v_team AND round_number = v_round;

  IF FOUND THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.multiplayer_draft_picks WHERE draft_id = p_draft_id AND player_id = v_keeper_player
    ) THEN
      v_pick := public.mp_insert_pick(p_draft_id, v_keeper_player, true, true);
      v_actions := v_actions || jsonb_build_array(jsonb_build_object(
        'type', 'keeper', 'pick_number', v_pick.pick_number, 'player_id', v_keeper_player, 'team_number', v_team
      ));
    ELSE
      v_player_id := public.mp_select_bpa_player(p_draft_id, v_team);
      IF v_player_id IS NOT NULL THEN
        v_pick := public.mp_insert_pick(p_draft_id, v_player_id, true, false);
        v_actions := v_actions || jsonb_build_array(jsonb_build_object(
          'type', 'keeper_fallback', 'pick_number', v_pick.pick_number, 'player_id', v_player_id, 'team_number', v_team
        ));
      END IF;
    END IF;
    SELECT status, current_pick_number, pick_deadline_at INTO v_draft.status, v_draft.current_pick_number, v_draft.pick_deadline_at
    FROM public.multiplayer_drafts WHERE id = p_draft_id;
    RETURN jsonb_build_object('status', v_draft.status, 'current_pick_number', v_draft.current_pick_number, 'pick_deadline_at', v_draft.pick_deadline_at, 'actions', v_actions, 'server_now', clock_timestamp());
  END IF;

  IF NOT v_human THEN
    v_player_id := public.mp_select_bpa_player(p_draft_id, v_team);
    IF v_player_id IS NULL THEN RAISE EXCEPTION 'No available players for CPU pick'; END IF;
    v_pick := public.mp_insert_pick(p_draft_id, v_player_id, true, false);
    v_actions := v_actions || jsonb_build_array(jsonb_build_object('type', 'cpu', 'pick_number', v_pick.pick_number, 'player_id', v_player_id, 'team_number', v_team));
    SELECT status, current_pick_number, pick_deadline_at INTO v_draft.status, v_draft.current_pick_number, v_draft.pick_deadline_at
    FROM public.multiplayer_drafts WHERE id = p_draft_id;
    RETURN jsonb_build_object('status', v_draft.status, 'current_pick_number', v_draft.current_pick_number, 'pick_deadline_at', v_draft.pick_deadline_at, 'actions', v_actions, 'server_now', clock_timestamp());
  END IF;

  SELECT * INTO v_part FROM public.multiplayer_draft_participants
  WHERE draft_id = p_draft_id AND team_number = v_team LIMIT 1;

  v_stale := v_draft.pick_deadline_at IS NOT NULL
    AND v_draft.pick_deadline_at < clock_timestamp() - make_interval(secs => greatest(v_draft.pick_timer + 5, 35));

  IF v_draft.pick_timer > 0 AND (v_draft.pick_deadline_at IS NULL OR v_stale) THEN
    UPDATE public.multiplayer_drafts
    SET pick_deadline_at = clock_timestamp() + make_interval(secs => v_draft.pick_timer)
    WHERE id = p_draft_id RETURNING * INTO v_draft;
  END IF;

  v_force_auto := coalesce(v_part.is_autodraft, false) OR NOT coalesce(v_part.is_connected, true);
  v_timer_expired := v_draft.pick_timer > 0 AND v_draft.pick_deadline_at IS NOT NULL AND v_draft.pick_deadline_at <= clock_timestamp();

  IF v_force_auto OR v_timer_expired THEN
    v_player_id := public.mp_select_bpa_player(p_draft_id, v_team);
    IF v_player_id IS NULL THEN RAISE EXCEPTION 'No available players for autodraft'; END IF;
    v_pick := public.mp_insert_pick(p_draft_id, v_player_id, true, false);
    v_actions := v_actions || jsonb_build_array(jsonb_build_object('type', 'autodraft', 'pick_number', v_pick.pick_number, 'player_id', v_player_id, 'team_number', v_team));
    IF v_timer_expired AND NOT coalesce(v_part.is_autodraft, false) THEN
      v_new_streak := coalesce(v_part.missed_turns_streak, 0) + 1;
      UPDATE public.multiplayer_draft_participants
      SET missed_turns_streak = v_new_streak,
          is_autodraft = CASE WHEN v_new_streak >= 2 THEN true ELSE is_autodraft END
      WHERE id = v_part.id;
    END IF;
    SELECT status, current_pick_number, pick_deadline_at INTO v_draft.status, v_draft.current_pick_number, v_draft.pick_deadline_at
    FROM public.multiplayer_drafts WHERE id = p_draft_id;
    RETURN jsonb_build_object('status', v_draft.status, 'current_pick_number', v_draft.current_pick_number, 'pick_deadline_at', v_draft.pick_deadline_at, 'actions', v_actions, 'server_now', clock_timestamp());
  END IF;

  SELECT status, current_pick_number, pick_deadline_at INTO v_draft.status, v_draft.current_pick_number, v_draft.pick_deadline_at
  FROM public.multiplayer_drafts WHERE id = p_draft_id;

  RETURN jsonb_build_object(
    'status', v_draft.status,
    'current_pick_number', v_draft.current_pick_number,
    'pick_deadline_at', v_draft.pick_deadline_at,
    'actions', v_actions,
    'waiting_on_team', v_team,
    'server_now', clock_timestamp()
  );
END;
$$;
