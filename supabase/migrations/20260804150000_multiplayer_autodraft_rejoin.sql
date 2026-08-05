-- Autodraft toggle, missed-turn streak, paced ticks (one auto action per call), rejoin/leave.

ALTER TABLE public.multiplayer_draft_participants
  ADD COLUMN IF NOT EXISTS is_autodraft boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS missed_turns_streak integer NOT NULL DEFAULT 0;

-- Reset missed streak on a manual pick
CREATE OR REPLACE FUNCTION public.mp_make_pick(
  p_draft_id uuid,
  p_player_id uuid,
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
  v_participant public.multiplayer_draft_participants%ROWTYPE;
  v_pos text;
  v_pick public.multiplayer_draft_picks%ROWTYPE;
  v_keeper_round integer;
BEGIN
  SELECT * INTO v_draft FROM public.multiplayer_drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found'; END IF;
  IF v_draft.status <> 'drafting' THEN RAISE EXCEPTION 'Draft is not in progress'; END IF;

  v_team := public.mp_team_for_pick(v_draft.current_pick_number, v_draft.num_teams, v_draft.draft_order);
  v_round := public.mp_round_for_pick(v_draft.current_pick_number, v_draft.num_teams);

  SELECT * INTO v_participant
  FROM public.multiplayer_draft_participants
  WHERE draft_id = p_draft_id
    AND team_number = v_team
    AND (
      (auth.uid() IS NOT NULL AND user_id = auth.uid())
      OR (p_guest_session_id IS NOT NULL AND guest_session_id = p_guest_session_id)
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not your turn';
  END IF;

  SELECT round_number INTO v_keeper_round
  FROM public.multiplayer_draft_keepers
  WHERE draft_id = p_draft_id AND team_number = v_team AND round_number = v_round;

  IF FOUND THEN
    RAISE EXCEPTION 'Keeper auto-pick in progress for this round';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.multiplayer_draft_picks
    WHERE draft_id = p_draft_id AND player_id = p_player_id
  ) THEN
    RAISE EXCEPTION 'Player already drafted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.multiplayer_draft_keepers
    WHERE draft_id = p_draft_id AND player_id = p_player_id
  ) THEN
    RAISE EXCEPTION 'Player is a keeper';
  END IF;

  SELECT public.mp_normalize_pos(position) INTO v_pos
  FROM public.players WHERE id = p_player_id;
  IF v_pos IS NULL THEN RAISE EXCEPTION 'Player not found'; END IF;

  IF NOT public.mp_position_allowed(p_draft_id, v_team, v_pos) THEN
    RAISE EXCEPTION 'No roster spot for that position';
  END IF;

  UPDATE public.multiplayer_draft_participants
  SET missed_turns_streak = 0
  WHERE id = v_participant.id;

  v_pick := public.mp_insert_pick(p_draft_id, p_player_id, false, false);

  RETURN jsonb_build_object(
    'pick_id', v_pick.id,
    'pick_number', v_pick.pick_number,
    'team_number', v_pick.team_number,
    'player_id', v_pick.player_id
  );
END;
$$;

-- One automated action per tick so clients can pace CPU like solo drafts
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
    RETURN jsonb_build_object('status', v_draft.status, 'actions', v_actions);
  END IF;

  v_total := v_draft.num_teams * v_draft.num_rounds;
  IF v_draft.current_pick_number > v_total THEN
    UPDATE public.multiplayer_drafts
    SET status = 'completed', completed_at = coalesce(completed_at, now()), pick_deadline_at = NULL
    WHERE id = p_draft_id;
    RETURN jsonb_build_object('status', 'completed', 'actions', v_actions);
  END IF;

  v_team := public.mp_team_for_pick(v_draft.current_pick_number, v_draft.num_teams, v_draft.draft_order);
  v_round := public.mp_round_for_pick(v_draft.current_pick_number, v_draft.num_teams);
  v_human := public.mp_team_is_human(p_draft_id, v_team);

  -- Keeper for this team/round?
  SELECT player_id INTO v_keeper_player
  FROM public.multiplayer_draft_keepers
  WHERE draft_id = p_draft_id AND team_number = v_team AND round_number = v_round;

  IF FOUND THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.multiplayer_draft_picks
      WHERE draft_id = p_draft_id AND player_id = v_keeper_player
    ) THEN
      v_pick := public.mp_insert_pick(p_draft_id, v_keeper_player, true, true);
      v_actions := v_actions || jsonb_build_array(jsonb_build_object(
        'type', 'keeper', 'pick_number', v_pick.pick_number, 'player_id', v_keeper_player, 'team_number', v_team
      ));
    END IF;

    SELECT status, current_pick_number, pick_deadline_at
    INTO v_draft.status, v_draft.current_pick_number, v_draft.pick_deadline_at
    FROM public.multiplayer_drafts WHERE id = p_draft_id;

    RETURN jsonb_build_object(
      'status', v_draft.status,
      'current_pick_number', v_draft.current_pick_number,
      'pick_deadline_at', v_draft.pick_deadline_at,
      'actions', v_actions
    );
  END IF;

  IF NOT v_human THEN
    v_player_id := public.mp_select_bpa_player(p_draft_id, v_team);
    IF v_player_id IS NULL THEN
      RAISE EXCEPTION 'No available players for CPU pick';
    END IF;
    v_pick := public.mp_insert_pick(p_draft_id, v_player_id, true, false);
    v_actions := v_actions || jsonb_build_array(jsonb_build_object(
      'type', 'cpu', 'pick_number', v_pick.pick_number, 'player_id', v_player_id, 'team_number', v_team
    ));

    SELECT status, current_pick_number, pick_deadline_at
    INTO v_draft.status, v_draft.current_pick_number, v_draft.pick_deadline_at
    FROM public.multiplayer_drafts WHERE id = p_draft_id;

    RETURN jsonb_build_object(
      'status', v_draft.status,
      'current_pick_number', v_draft.current_pick_number,
      'pick_deadline_at', v_draft.pick_deadline_at,
      'actions', v_actions
    );
  END IF;

  -- Human turn
  SELECT * INTO v_part
  FROM public.multiplayer_draft_participants
  WHERE draft_id = p_draft_id AND team_number = v_team
  LIMIT 1;

  v_force_auto := coalesce(v_part.is_autodraft, false) OR NOT coalesce(v_part.is_connected, true);
  v_timer_expired :=
    v_draft.pick_timer > 0
    AND v_draft.pick_deadline_at IS NOT NULL
    AND v_draft.pick_deadline_at <= now();

  IF v_force_auto OR v_timer_expired THEN
    v_player_id := public.mp_select_bpa_player(p_draft_id, v_team);
    IF v_player_id IS NULL THEN
      RAISE EXCEPTION 'No available players for autodraft';
    END IF;
    v_pick := public.mp_insert_pick(p_draft_id, v_player_id, true, false);
    v_actions := v_actions || jsonb_build_array(jsonb_build_object(
      'type', 'autodraft', 'pick_number', v_pick.pick_number, 'player_id', v_player_id, 'team_number', v_team
    ));

    -- Missed clock (not voluntary autodraft / leave): count toward auto-enable
    IF v_timer_expired AND NOT coalesce(v_part.is_autodraft, false) THEN
      v_new_streak := coalesce(v_part.missed_turns_streak, 0) + 1;
      UPDATE public.multiplayer_draft_participants
      SET missed_turns_streak = v_new_streak,
          is_autodraft = CASE WHEN v_new_streak >= 2 THEN true ELSE is_autodraft END
      WHERE id = v_part.id;
    END IF;

    SELECT status, current_pick_number, pick_deadline_at
    INTO v_draft.status, v_draft.current_pick_number, v_draft.pick_deadline_at
    FROM public.multiplayer_drafts WHERE id = p_draft_id;

    RETURN jsonb_build_object(
      'status', v_draft.status,
      'current_pick_number', v_draft.current_pick_number,
      'pick_deadline_at', v_draft.pick_deadline_at,
      'actions', v_actions
    );
  END IF;

  -- Waiting on human
  SELECT status, current_pick_number, pick_deadline_at
  INTO v_draft.status, v_draft.current_pick_number, v_draft.pick_deadline_at
  FROM public.multiplayer_drafts WHERE id = p_draft_id;

  RETURN jsonb_build_object(
    'status', v_draft.status,
    'current_pick_number', v_draft.current_pick_number,
    'pick_deadline_at', v_draft.pick_deadline_at,
    'actions', v_actions
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_set_autodraft(
  p_draft_id uuid,
  p_enabled boolean,
  p_guest_session_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant public.multiplayer_draft_participants%ROWTYPE;
BEGIN
  IF NOT public.mp_caller_is_participant(p_draft_id, p_guest_session_id) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  SELECT * INTO v_participant
  FROM public.multiplayer_draft_participants
  WHERE draft_id = p_draft_id
    AND (
      (auth.uid() IS NOT NULL AND user_id = auth.uid())
      OR (p_guest_session_id IS NOT NULL AND guest_session_id = p_guest_session_id)
    )
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Not a participant'; END IF;

  UPDATE public.multiplayer_draft_participants
  SET is_autodraft = coalesce(p_enabled, false),
      missed_turns_streak = CASE WHEN coalesce(p_enabled, false) THEN missed_turns_streak ELSE 0 END
  WHERE id = v_participant.id
  RETURNING * INTO v_participant;

  RETURN jsonb_build_object(
    'ok', true,
    'is_autodraft', v_participant.is_autodraft
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_set_connected(
  p_draft_id uuid,
  p_connected boolean,
  p_guest_session_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant public.multiplayer_draft_participants%ROWTYPE;
BEGIN
  SELECT * INTO v_participant
  FROM public.multiplayer_draft_participants
  WHERE draft_id = p_draft_id
    AND (
      (auth.uid() IS NOT NULL AND user_id = auth.uid())
      OR (p_guest_session_id IS NOT NULL AND guest_session_id = p_guest_session_id)
    )
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Not a participant'; END IF;

  UPDATE public.multiplayer_draft_participants
  SET is_connected = coalesce(p_connected, true)
  WHERE id = v_participant.id
  RETURNING * INTO v_participant;

  RETURN jsonb_build_object(
    'ok', true,
    'is_connected', v_participant.is_connected
  );
END;
$$;

-- Allow existing participants to rejoin lobby/draft/completed via invite code
CREATE OR REPLACE FUNCTION public.mp_join_draft(
  p_invite_code text,
  p_guest_session_id text DEFAULT NULL,
  p_display_name text DEFAULT 'Guest'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_draft public.multiplayer_drafts%ROWTYPE;
  v_participant public.multiplayer_draft_participants%ROWTYPE;
  v_human_count integer;
BEGIN
  SELECT * INTO v_draft
  FROM public.multiplayer_drafts
  WHERE invite_code = upper(trim(p_invite_code));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;
  IF v_uid IS NULL AND (p_guest_session_id IS NULL OR length(trim(p_guest_session_id)) < 4) THEN
    RAISE EXCEPTION 'Guest session required';
  END IF;

  -- Already joined? Rejoin any status.
  SELECT * INTO v_participant
  FROM public.multiplayer_draft_participants
  WHERE draft_id = v_draft.id
    AND (
      (v_uid IS NOT NULL AND user_id = v_uid)
      OR (p_guest_session_id IS NOT NULL AND guest_session_id = p_guest_session_id)
    );

  IF FOUND THEN
    UPDATE public.multiplayer_draft_participants
    SET is_connected = true
    WHERE id = v_participant.id
    RETURNING * INTO v_participant;

    RETURN jsonb_build_object(
      'draft_id', v_draft.id,
      'invite_code', v_draft.invite_code,
      'participant_id', v_participant.id,
      'team_number', v_participant.team_number,
      'status', v_draft.status,
      'rejoined', true
    );
  END IF;

  IF v_draft.status <> 'lobby' THEN
    RAISE EXCEPTION 'Draft is not open for joining';
  END IF;

  SELECT count(*)::integer INTO v_human_count
  FROM public.multiplayer_draft_participants
  WHERE draft_id = v_draft.id;

  IF v_human_count >= v_draft.num_teams THEN
    RAISE EXCEPTION 'Draft is full';
  END IF;

  INSERT INTO public.multiplayer_draft_participants (
    draft_id, user_id, guest_session_id, display_name, is_host, is_ready, is_connected
  ) VALUES (
    v_draft.id,
    v_uid,
    CASE WHEN v_uid IS NULL THEN p_guest_session_id ELSE NULL END,
    coalesce(nullif(trim(p_display_name), ''), 'Guest'),
    false,
    false,
    true
  )
  RETURNING * INTO v_participant;

  RETURN jsonb_build_object(
    'draft_id', v_draft.id,
    'invite_code', v_draft.invite_code,
    'participant_id', v_participant.id,
    'team_number', v_participant.team_number,
    'status', v_draft.status,
    'rejoined', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mp_set_autodraft TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.mp_set_connected TO authenticated, anon;
