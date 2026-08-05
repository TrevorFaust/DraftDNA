-- Allow seated participants (and the host) to set team names while the lobby is open.

CREATE OR REPLACE FUNCTION public.mp_set_team_name(
  p_draft_id uuid,
  p_team_number integer,
  p_team_name text,
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
  v_is_host boolean := false;
  v_name text;
BEGIN
  SELECT * INTO v_draft
  FROM public.multiplayer_drafts
  WHERE id = p_draft_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found'; END IF;
  IF v_draft.status <> 'lobby' THEN
    RAISE EXCEPTION 'Team names can only be changed in the lobby';
  END IF;
  IF p_team_number IS NULL OR p_team_number < 1 OR p_team_number > v_draft.num_teams THEN
    RAISE EXCEPTION 'Invalid team number';
  END IF;

  v_is_host := v_draft.host_user_id IS NOT NULL AND v_draft.host_user_id = auth.uid();

  SELECT * INTO v_participant
  FROM public.multiplayer_draft_participants
  WHERE draft_id = p_draft_id
    AND (
      (auth.uid() IS NOT NULL AND user_id = auth.uid())
      OR (p_guest_session_id IS NOT NULL AND guest_session_id = p_guest_session_id)
    )
  LIMIT 1;

  IF NOT v_is_host THEN
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Join the lobby first';
    END IF;
    IF v_participant.team_number IS DISTINCT FROM p_team_number THEN
      RAISE EXCEPTION 'You can only rename your own seat';
    END IF;
  END IF;

  v_name := left(trim(coalesce(p_team_name, '')), 40);
  IF v_name = '' THEN
    v_name := 'Team ' || p_team_number::text;
  END IF;

  UPDATE public.multiplayer_drafts
  SET team_names = jsonb_set(
    coalesce(team_names, '{}'::jsonb),
    ARRAY[p_team_number::text],
    to_jsonb(v_name),
    true
  )
  WHERE id = p_draft_id
  RETURNING * INTO v_draft;

  RETURN jsonb_build_object(
    'ok', true,
    'team_number', p_team_number,
    'team_name', v_name,
    'team_names', v_draft.team_names
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mp_set_team_name(uuid, integer, text, text) TO authenticated, anon;
