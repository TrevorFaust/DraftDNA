-- Shared chat for multiplayer draft lobbies and live rooms.

CREATE TABLE IF NOT EXISTS public.multiplayer_draft_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.multiplayer_drafts(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.multiplayer_draft_participants(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_session_id text,
  display_name text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mp_message_body_len CHECK (char_length(body) BETWEEN 1 AND 500)
);

CREATE INDEX IF NOT EXISTS idx_mp_messages_draft_created
  ON public.multiplayer_draft_messages(draft_id, created_at);

ALTER TABLE public.multiplayer_draft_messages ENABLE ROW LEVEL SECURITY;

-- Invite/UUID is the access secret (same pattern as other MP tables).
CREATE POLICY mp_messages_select ON public.multiplayer_draft_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.multiplayer_drafts d
      WHERE d.id = draft_id AND d.status IN ('lobby', 'drafting', 'completed')
    )
  );

CREATE OR REPLACE FUNCTION public.mp_send_message(
  p_draft_id uuid,
  p_body text,
  p_guest_session_id text DEFAULT NULL
)
RETURNS public.multiplayer_draft_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft public.multiplayer_drafts%ROWTYPE;
  v_participant public.multiplayer_draft_participants%ROWTYPE;
  v_body text;
  v_row public.multiplayer_draft_messages%ROWTYPE;
BEGIN
  SELECT * INTO v_draft
  FROM public.multiplayer_drafts
  WHERE id = p_draft_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;
  IF v_draft.status NOT IN ('lobby', 'drafting', 'completed') THEN
    RAISE EXCEPTION 'Chat is closed for this draft';
  END IF;

  SELECT * INTO v_participant
  FROM public.multiplayer_draft_participants
  WHERE draft_id = p_draft_id
    AND (
      (auth.uid() IS NOT NULL AND user_id = auth.uid())
      OR (p_guest_session_id IS NOT NULL AND guest_session_id = p_guest_session_id)
    )
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Join the draft to chat';
  END IF;

  -- Strip ASCII control chars (keep tab/newline as spaces), then cap length.
  v_body := left(
    trim(
      regexp_replace(
        coalesce(p_body, ''),
        '[[:cntrl:]]',
        ' ',
        'g'
      )
    ),
    500
  );
  IF v_body = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  INSERT INTO public.multiplayer_draft_messages (
    draft_id,
    participant_id,
    user_id,
    guest_session_id,
    display_name,
    body
  )
  VALUES (
    p_draft_id,
    v_participant.id,
    v_participant.user_id,
    v_participant.guest_session_id,
    left(trim(v_participant.display_name), 40),
    v_body
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT SELECT ON public.multiplayer_draft_messages TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mp_send_message(uuid, text, text) TO authenticated, anon;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.multiplayer_draft_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
