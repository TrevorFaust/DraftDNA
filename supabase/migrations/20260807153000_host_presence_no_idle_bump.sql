-- Host presence should not reset the open-lobby idle clock.
-- Idle (no joins/seats/ready/chat) and host-absence remain independent.

CREATE OR REPLACE FUNCTION public.mp_set_host_presence(
  p_draft_id uuid,
  p_present boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft public.multiplayer_drafts%ROWTYPE;
BEGIN
  SELECT * INTO v_draft
  FROM public.multiplayer_drafts
  WHERE id = p_draft_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;
  IF v_draft.host_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Host only';
  END IF;
  IF v_draft.status <> 'lobby' THEN
    RETURN jsonb_build_object('ok', true, 'status', v_draft.status);
  END IF;

  IF coalesce(p_present, false) THEN
    UPDATE public.multiplayer_drafts
    SET host_absent_since = NULL
    WHERE id = p_draft_id
    RETURNING * INTO v_draft;
  ELSE
    UPDATE public.multiplayer_drafts
    SET host_absent_since = coalesce(host_absent_since, now())
    WHERE id = p_draft_id
    RETURNING * INTO v_draft;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'present', coalesce(p_present, false),
    'host_absent_since', v_draft.host_absent_since
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mp_set_host_presence(uuid, boolean) TO authenticated;
