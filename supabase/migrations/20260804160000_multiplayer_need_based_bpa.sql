-- Prefer filling empty starter slots (incl. DEF/K) when rounds are running out.

CREATE OR REPLACE FUNCTION public.mp_team_needed_positions(
  p_draft_id uuid,
  p_team_number integer
)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft public.multiplayer_drafts%ROWTYPE;
  v_counts jsonb := '{}'::jsonb;
  v_pos text;
  v_needed text[] := ARRAY[]::text[];
  v_qb integer;
  v_rb integer;
  v_wr integer;
  v_te integer;
  v_def integer;
  v_k integer;
  v_roster integer;
  v_remaining integer;
  r record;
BEGIN
  SELECT * INTO v_draft FROM public.multiplayer_drafts WHERE id = p_draft_id;
  IF NOT FOUND THEN RETURN v_needed; END IF;

  FOR r IN
    SELECT public.mp_normalize_pos(pl.position) AS pos, count(*)::integer AS cnt
    FROM public.multiplayer_draft_picks pk
    JOIN public.players pl ON pl.id = pk.player_id
    WHERE pk.draft_id = p_draft_id AND pk.team_number = p_team_number
    GROUP BY 1
  LOOP
    v_counts := jsonb_set(v_counts, ARRAY[r.pos], to_jsonb(r.cnt));
  END LOOP;

  v_qb := coalesce((v_counts->>'QB')::integer, 0);
  v_rb := coalesce((v_counts->>'RB')::integer, 0);
  v_wr := coalesce((v_counts->>'WR')::integer, 0);
  v_te := coalesce((v_counts->>'TE')::integer, 0);
  v_def := coalesce((v_counts->>'DEF')::integer, 0);
  v_k := coalesce((v_counts->>'K')::integer, 0);

  SELECT count(*)::integer INTO v_roster
  FROM public.multiplayer_draft_picks
  WHERE draft_id = p_draft_id AND team_number = p_team_number;

  v_remaining := greatest(0, v_draft.num_rounds - v_roster);

  -- Required starters (standard + optional superflex QB)
  IF v_qb < 1 THEN v_needed := array_append(v_needed, 'QB'); END IF;
  IF v_draft.is_superflex AND v_qb < 2 THEN
    -- second QB only if no flex-eligible depth yet; keep simple: need another QB slot signal
    NULL;
  END IF;
  IF v_rb < 2 THEN
    v_needed := array_append(v_needed, 'RB');
    IF v_rb < 1 THEN v_needed := array_append(v_needed, 'RB'); END IF;
  END IF;
  IF v_wr < 2 THEN
    v_needed := array_append(v_needed, 'WR');
    IF v_wr < 1 THEN v_needed := array_append(v_needed, 'WR'); END IF;
  END IF;
  IF v_te < 1 THEN v_needed := array_append(v_needed, 'TE'); END IF;
  IF v_def < 1 THEN v_needed := array_append(v_needed, 'DEF'); END IF;
  IF v_k < 1 THEN v_needed := array_append(v_needed, 'K'); END IF;

  -- Only force need-based when remaining picks are tight vs missing starters
  IF v_remaining > greatest(array_length(v_needed, 1), 0) + 1 THEN
    RETURN ARRAY[]::text[];
  END IF;

  RETURN v_needed;
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_select_bpa_player(
  p_draft_id uuid,
  p_team_number integer
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_board uuid[];
  v_positions text[];
  v_player_id uuid;
  v_pos text;
  i integer;
  v_needed text[];
  v_need_pos text;
BEGIN
  SELECT board_player_ids, board_player_positions
  INTO v_board, v_positions
  FROM public.multiplayer_drafts
  WHERE id = p_draft_id;

  IF v_board IS NULL OR array_length(v_board, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  v_needed := public.mp_team_needed_positions(p_draft_id, p_team_number);

  -- Pass 1: fill critical starter holes (DEF/K/etc.) in late rounds
  IF array_length(v_needed, 1) IS NOT NULL THEN
    FOREACH v_need_pos IN ARRAY v_needed LOOP
      FOR i IN 1..array_length(v_board, 1) LOOP
        v_player_id := v_board[i];
        v_pos := public.mp_normalize_pos(COALESCE(v_positions[i], 'FLEX'));
        IF v_pos <> v_need_pos THEN CONTINUE; END IF;

        IF EXISTS (
          SELECT 1 FROM public.multiplayer_draft_picks
          WHERE draft_id = p_draft_id AND player_id = v_player_id
        ) THEN CONTINUE; END IF;

        IF EXISTS (
          SELECT 1 FROM public.multiplayer_draft_keepers k
          WHERE k.draft_id = p_draft_id AND k.player_id = v_player_id
        ) THEN CONTINUE; END IF;

        IF public.mp_position_allowed(p_draft_id, p_team_number, v_pos) THEN
          RETURN v_player_id;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  -- Pass 2: standard BPA
  FOR i IN 1..array_length(v_board, 1) LOOP
    v_player_id := v_board[i];
    v_pos := COALESCE(v_positions[i], 'FLEX');

    IF EXISTS (
      SELECT 1 FROM public.multiplayer_draft_picks
      WHERE draft_id = p_draft_id AND player_id = v_player_id
    ) THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.multiplayer_draft_keepers k
      WHERE k.draft_id = p_draft_id
        AND k.player_id = v_player_id
        AND NOT (k.team_number = p_team_number)
    ) THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.multiplayer_draft_keepers k
      WHERE k.draft_id = p_draft_id
        AND k.player_id = v_player_id
        AND k.team_number = p_team_number
    ) THEN
      CONTINUE;
    END IF;

    IF public.mp_position_allowed(p_draft_id, p_team_number, v_pos) THEN
      RETURN v_player_id;
    END IF;
  END LOOP;

  -- Fallback: first available non-keeper player ignoring position limits
  FOR i IN 1..array_length(v_board, 1) LOOP
    v_player_id := v_board[i];
    IF EXISTS (
      SELECT 1 FROM public.multiplayer_draft_picks
      WHERE draft_id = p_draft_id AND player_id = v_player_id
    ) THEN
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.multiplayer_draft_keepers k
      WHERE k.draft_id = p_draft_id AND k.player_id = v_player_id
    ) THEN
      CONTINUE;
    END IF;
    RETURN v_player_id;
  END LOOP;

  RETURN NULL;
END;
$$;
