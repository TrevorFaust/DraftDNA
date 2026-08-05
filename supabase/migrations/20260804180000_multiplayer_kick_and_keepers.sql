-- 1) Auto-apply keepers as soon as their pick is on the clock (no 30s wait).
-- 2) Drop unseated lobby queue sitters when the draft starts.

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
        -- Keeper rounds resolve immediately; never start a human clock for them.
        WHEN v_keeper_player IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.multiplayer_draft_picks
            WHERE draft_id = p_draft_id AND player_id = v_keeper_player
          )
          THEN NULL
        WHEN v_human AND v_draft.pick_timer > 0
          THEN clock_timestamp() + make_interval(secs => v_draft.pick_timer)
        ELSE NULL
      END
  WHERE id = p_draft_id;

  IF v_keeper_player IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.multiplayer_draft_picks
       WHERE draft_id = p_draft_id AND player_id = v_keeper_player
     ) THEN
    PERFORM public.mp_insert_pick(p_draft_id, v_keeper_player, true, true);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_start_draft(p_draft_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft public.multiplayer_drafts%ROWTYPE;
  v_unready integer;
  v_team integer;
  v_round integer;
  v_human boolean;
  v_keeper_player uuid;
BEGIN
  SELECT * INTO v_draft FROM public.multiplayer_drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found'; END IF;
  IF v_draft.host_user_id <> auth.uid() THEN RAISE EXCEPTION 'Host only'; END IF;
  IF v_draft.status <> 'lobby' THEN RAISE EXCEPTION 'Already started'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.multiplayer_draft_participants
    WHERE draft_id = p_draft_id AND is_host AND team_number IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Host must claim a seat';
  END IF;

  SELECT count(*)::integer INTO v_unready
  FROM public.multiplayer_draft_participants
  WHERE draft_id = p_draft_id
    AND team_number IS NOT NULL
    AND is_ready = false;

  IF v_unready > 0 THEN
    RAISE EXCEPTION 'All seated humans must ready up';
  END IF;

  -- Drop anyone still in the lobby queue without a seat (incl. kicked flow leftovers).
  DELETE FROM public.multiplayer_draft_participants
  WHERE draft_id = p_draft_id
    AND team_number IS NULL;

  v_team := public.mp_team_for_pick(1, v_draft.num_teams, v_draft.draft_order);
  v_round := 1;
  v_human := public.mp_team_is_human(p_draft_id, v_team);

  SELECT player_id INTO v_keeper_player
  FROM public.multiplayer_draft_keepers
  WHERE draft_id = p_draft_id
    AND team_number = v_team
    AND round_number = v_round;

  UPDATE public.multiplayer_drafts
  SET status = 'drafting',
      started_at = clock_timestamp(),
      current_pick_number = 1,
      pick_deadline_at = CASE
        WHEN v_keeper_player IS NOT NULL THEN NULL
        WHEN v_human AND pick_timer > 0
          THEN clock_timestamp() + make_interval(secs => pick_timer)
        ELSE NULL
      END
  WHERE id = p_draft_id;

  IF v_keeper_player IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.multiplayer_draft_picks
       WHERE draft_id = p_draft_id AND player_id = v_keeper_player
     ) THEN
    PERFORM public.mp_insert_pick(p_draft_id, v_keeper_player, true, true);
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', 'drafting');
END;
$$;
