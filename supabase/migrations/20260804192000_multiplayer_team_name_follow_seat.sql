-- Keep custom team names with the participant when they move seats;
-- reset vacated / kicked seats back to "Team N".

CREATE OR REPLACE FUNCTION public.mp_default_team_name(p_team_number integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'Team ' || p_team_number::text;
$$;

CREATE OR REPLACE FUNCTION public.mp_reset_seat_team_name(
  p_draft_id uuid,
  p_team_number integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_team_number IS NULL OR p_team_number < 1 THEN
    RETURN;
  END IF;

  UPDATE public.multiplayer_drafts
  SET team_names = jsonb_set(
    coalesce(team_names, '{}'::jsonb),
    ARRAY[p_team_number::text],
    to_jsonb(public.mp_default_team_name(p_team_number)),
    true
  )
  WHERE id = p_draft_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_relocate_seat_team_name(
  p_draft_id uuid,
  p_from_team integer,
  p_to_team integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_names jsonb;
  v_from_name text;
  v_from_default text;
  v_to_default text;
  v_moving text;
BEGIN
  IF p_from_team IS NULL OR p_to_team IS NULL OR p_from_team = p_to_team THEN
    RETURN;
  END IF;

  SELECT coalesce(team_names, '{}'::jsonb)
  INTO v_names
  FROM public.multiplayer_drafts
  WHERE id = p_draft_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_from_default := public.mp_default_team_name(p_from_team);
  v_to_default := public.mp_default_team_name(p_to_team);
  v_from_name := nullif(trim(coalesce(v_names ->> p_from_team::text, '')), '');

  -- Only carry a custom name; defaults stay seat-local ("Team 2" does not become seat 3's label).
  IF v_from_name IS NOT NULL AND v_from_name <> v_from_default THEN
    v_moving := v_from_name;
  ELSE
    v_moving := v_to_default;
  END IF;

  v_names := jsonb_set(v_names, ARRAY[p_to_team::text], to_jsonb(v_moving), true);
  v_names := jsonb_set(v_names, ARRAY[p_from_team::text], to_jsonb(v_from_default), true);

  UPDATE public.multiplayer_drafts
  SET team_names = v_names
  WHERE id = p_draft_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_claim_slot(
  p_draft_id uuid,
  p_team_number integer,
  p_guest_session_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft public.multiplayer_drafts%ROWTYPE;
  v_participant public.multiplayer_draft_participants%ROWTYPE;
  v_from_team integer;
BEGIN
  SELECT * INTO v_draft FROM public.multiplayer_drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found'; END IF;
  IF v_draft.status <> 'lobby' THEN RAISE EXCEPTION 'Seats locked after start'; END IF;
  IF p_team_number < 1 OR p_team_number > v_draft.num_teams THEN
    RAISE EXCEPTION 'Invalid team number';
  END IF;

  SELECT * INTO v_participant
  FROM public.multiplayer_draft_participants
  WHERE draft_id = p_draft_id
    AND (
      (auth.uid() IS NOT NULL AND user_id = auth.uid())
      OR (p_guest_session_id IS NOT NULL AND guest_session_id = p_guest_session_id)
    )
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Join the draft first'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.multiplayer_draft_participants
    WHERE draft_id = p_draft_id
      AND team_number = p_team_number
      AND id <> v_participant.id
  ) THEN
    RAISE EXCEPTION 'Seat already taken';
  END IF;

  v_from_team := v_participant.team_number;

  UPDATE public.multiplayer_draft_participants
  SET team_number = p_team_number,
      is_ready = CASE WHEN is_host THEN true ELSE false END
  WHERE id = v_participant.id
  RETURNING * INTO v_participant;

  IF v_from_team IS NOT NULL AND v_from_team <> p_team_number THEN
    PERFORM public.mp_relocate_seat_team_name(p_draft_id, v_from_team, p_team_number);
  END IF;

  RETURN jsonb_build_object(
    'participant_id', v_participant.id,
    'team_number', v_participant.team_number
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_release_slot(
  p_draft_id uuid,
  p_guest_session_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant public.multiplayer_draft_participants%ROWTYPE;
  v_from_team integer;
BEGIN
  IF (SELECT status FROM public.multiplayer_drafts WHERE id = p_draft_id) <> 'lobby' THEN
    RAISE EXCEPTION 'Seats locked after start';
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
  IF v_participant.is_host THEN
    RAISE EXCEPTION 'Host cannot release their seat; move instead';
  END IF;

  v_from_team := v_participant.team_number;

  UPDATE public.multiplayer_draft_participants
  SET team_number = NULL, is_ready = false
  WHERE id = v_participant.id;

  IF v_from_team IS NOT NULL THEN
    PERFORM public.mp_reset_seat_team_name(p_draft_id, v_from_team);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_host_move_kick(
  p_draft_id uuid,
  p_participant_id uuid,
  p_action text,
  p_new_team_number integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft public.multiplayer_drafts%ROWTYPE;
  v_target public.multiplayer_draft_participants%ROWTYPE;
  v_from_team integer;
  v_bumped public.multiplayer_draft_participants%ROWTYPE;
BEGIN
  SELECT * INTO v_draft FROM public.multiplayer_drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found'; END IF;
  IF v_draft.host_user_id <> auth.uid() THEN RAISE EXCEPTION 'Host only'; END IF;
  IF v_draft.status <> 'lobby' THEN RAISE EXCEPTION 'Lobby only'; END IF;

  SELECT * INTO v_target
  FROM public.multiplayer_draft_participants
  WHERE id = p_participant_id AND draft_id = p_draft_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Participant not found'; END IF;

  IF p_action = 'kick' THEN
    IF v_target.is_host THEN RAISE EXCEPTION 'Cannot kick host'; END IF;
    v_from_team := v_target.team_number;
    DELETE FROM public.multiplayer_draft_participants WHERE id = v_target.id;
    IF v_from_team IS NOT NULL THEN
      PERFORM public.mp_reset_seat_team_name(p_draft_id, v_from_team);
    END IF;
    RETURN jsonb_build_object('ok', true, 'action', 'kick');

  ELSIF p_action = 'move' THEN
    IF p_new_team_number IS NULL OR p_new_team_number < 1 OR p_new_team_number > v_draft.num_teams THEN
      RAISE EXCEPTION 'Invalid team number';
    END IF;

    v_from_team := v_target.team_number;

    SELECT * INTO v_bumped
    FROM public.multiplayer_draft_participants
    WHERE draft_id = p_draft_id
      AND team_number = p_new_team_number
      AND id <> v_target.id
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.multiplayer_draft_participants
      SET team_number = NULL, is_ready = false
      WHERE id = v_bumped.id;
      -- Destination seat name will be overwritten by the mover; bumped player is unseated.
    END IF;

    UPDATE public.multiplayer_draft_participants
    SET team_number = p_new_team_number,
        is_ready = CASE WHEN is_host THEN true ELSE false END
    WHERE id = v_target.id;

    IF v_from_team IS NOT NULL AND v_from_team <> p_new_team_number THEN
      PERFORM public.mp_relocate_seat_team_name(p_draft_id, v_from_team, p_new_team_number);
    END IF;

    RETURN jsonb_build_object('ok', true, 'action', 'move', 'team_number', p_new_team_number);

  ELSIF p_action = 'remove_seat' THEN
    IF v_target.is_host THEN RAISE EXCEPTION 'Host must stay seated'; END IF;
    v_from_team := v_target.team_number;
    UPDATE public.multiplayer_draft_participants
    SET team_number = NULL, is_ready = false
    WHERE id = v_target.id;
    IF v_from_team IS NOT NULL THEN
      PERFORM public.mp_reset_seat_team_name(p_draft_id, v_from_team);
    END IF;
    RETURN jsonb_build_object('ok', true, 'action', 'remove_seat');
  ELSE
    RAISE EXCEPTION 'Unknown action';
  END IF;
END;
$$;
