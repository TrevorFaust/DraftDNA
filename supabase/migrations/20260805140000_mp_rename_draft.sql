-- Allow a participant (or host) to rename a multiplayer draft for History auto-name repair.
CREATE OR REPLACE FUNCTION public.mp_rename_draft(
  p_draft_id uuid,
  p_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_name = '' OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'Invalid draft name';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.multiplayer_drafts d
    WHERE d.id = p_draft_id
      AND (
        d.host_user_id = v_uid
        OR EXISTS (
          SELECT 1
          FROM public.multiplayer_draft_participants p
          WHERE p.draft_id = d.id
            AND p.user_id = v_uid
        )
      )
  ) THEN
    RAISE EXCEPTION 'Not allowed to rename this draft';
  END IF;

  UPDATE public.multiplayer_drafts
  SET name = v_name
  WHERE id = p_draft_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mp_rename_draft(uuid, text) TO authenticated;
