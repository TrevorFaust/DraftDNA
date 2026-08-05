-- Use clock_timestamp() for pick deadlines; heal stale deadlines left from prior turns.

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
  v_human boolean;
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
  v_human := public.mp_team_is_human(p_draft_id, v_team);

  UPDATE public.multiplayer_drafts
  SET current_pick_number = v_next,
      pick_deadline_at = CASE
        WHEN v_human AND v_draft.pick_timer > 0
          THEN clock_timestamp() + make_interval(secs => v_draft.pick_timer)
        ELSE NULL
      END
  WHERE id = p_draft_id;
END;
$$;
