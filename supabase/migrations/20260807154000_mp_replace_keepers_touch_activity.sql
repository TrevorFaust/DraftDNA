-- Keeper edits in lobby count as activity for open-lobby idle timeout.

CREATE OR REPLACE FUNCTION public.mp_replace_keepers(
  p_draft_id uuid,
  p_keepers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft public.multiplayer_drafts%ROWTYPE;
  v_keeper jsonb;
BEGIN
  SELECT * INTO v_draft FROM public.multiplayer_drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found'; END IF;
  IF v_draft.host_user_id <> auth.uid() THEN RAISE EXCEPTION 'Host only'; END IF;
  IF v_draft.status <> 'lobby' THEN RAISE EXCEPTION 'Lobby only'; END IF;

  DELETE FROM public.multiplayer_draft_keepers WHERE draft_id = p_draft_id;

  IF p_keepers IS NOT NULL AND jsonb_typeof(p_keepers) = 'array' THEN
    FOR v_keeper IN SELECT * FROM jsonb_array_elements(p_keepers)
    LOOP
      INSERT INTO public.multiplayer_draft_keepers (draft_id, team_number, player_id, round_number)
      VALUES (
        p_draft_id,
        (v_keeper->>'team_number')::integer,
        (v_keeper->>'player_id')::uuid,
        (v_keeper->>'round_number')::integer
      );
    END LOOP;
  END IF;

  PERFORM public.mp_touch_lobby_activity(p_draft_id);

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mp_replace_keepers(uuid, jsonb) TO authenticated;
