-- Force dedicated starters to be filled before a draft can close out a roster.
-- Count undrafted keepers toward holes, skip board IDs missing from players,
-- and reject human picks that would leave a starter empty.

CREATE OR REPLACE FUNCTION public.mp_team_starter_holes(
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
  v_needed text[] := ARRAY[]::text[];
  v_qb integer; v_rb integer; v_wr integer; v_te integer; v_def integer; v_k integer;
  v_need_qb integer; v_need_rb integer; v_need_wr integer; v_need_te integer; v_need_def integer; v_need_k integer;
  v_starters jsonb;
  r record;
  i integer;
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

  FOR r IN
    SELECT public.mp_normalize_pos(pl.position) AS pos, count(*)::integer AS cnt
    FROM public.multiplayer_draft_keepers k
    JOIN public.players pl ON pl.id = k.player_id
    WHERE k.draft_id = p_draft_id
      AND k.team_number = p_team_number
      AND NOT EXISTS (
        SELECT 1 FROM public.multiplayer_draft_picks pk
        WHERE pk.draft_id = p_draft_id AND pk.player_id = k.player_id
      )
    GROUP BY 1
  LOOP
    v_counts := jsonb_set(
      v_counts,
      ARRAY[r.pos],
      to_jsonb(coalesce((v_counts->>r.pos)::integer, 0) + r.cnt)
    );
  END LOOP;

  v_qb := coalesce((v_counts->>'QB')::integer, 0);
  v_rb := coalesce((v_counts->>'RB')::integer, 0);
  v_wr := coalesce((v_counts->>'WR')::integer, 0);
  v_te := coalesce((v_counts->>'TE')::integer, 0);
  v_def := coalesce((v_counts->>'DEF')::integer, 0);
  v_k := coalesce((v_counts->>'K')::integer, 0);

  v_starters := coalesce(v_draft.position_limits->'starters', '{}'::jsonb);
  v_need_qb := coalesce((v_starters->>'QB')::integer, 1);
  v_need_rb := coalesce((v_starters->>'RB')::integer, 2);
  v_need_wr := coalesce((v_starters->>'WR')::integer, 2);
  v_need_te := coalesce((v_starters->>'TE')::integer, 1);
  v_need_def := coalesce((v_starters->>'DEF')::integer, 1);
  v_need_k := coalesce((v_starters->>'K')::integer, 1);

  FOR i IN 1..v_need_qb LOOP
    IF v_qb < i THEN v_needed := array_append(v_needed, 'QB'); END IF;
  END LOOP;
  FOR i IN 1..v_need_rb LOOP
    IF v_rb < i THEN v_needed := array_append(v_needed, 'RB'); END IF;
  END LOOP;
  FOR i IN 1..v_need_wr LOOP
    IF v_wr < i THEN v_needed := array_append(v_needed, 'WR'); END IF;
  END LOOP;
  FOR i IN 1..v_need_te LOOP
    IF v_te < i THEN v_needed := array_append(v_needed, 'TE'); END IF;
  END LOOP;
  FOR i IN 1..v_need_def LOOP
    IF v_def < i THEN v_needed := array_append(v_needed, 'DEF'); END IF;
  END LOOP;
  FOR i IN 1..v_need_k LOOP
    IF v_k < i THEN v_needed := array_append(v_needed, 'K'); END IF;
  END LOOP;

  RETURN v_needed;
END;
$$;

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
  v_needed text[];
  v_roster integer;
  v_remaining integer;
  v_need_qb integer; v_need_rb integer; v_need_wr integer; v_need_te integer; v_need_def integer; v_need_k integer;
  v_starters jsonb;
BEGIN
  SELECT * INTO v_draft FROM public.multiplayer_drafts WHERE id = p_draft_id;
  IF NOT FOUND THEN RETURN ARRAY[]::text[]; END IF;

  v_needed := public.mp_team_starter_holes(p_draft_id, p_team_number);

  SELECT count(*)::integer INTO v_roster
  FROM public.multiplayer_draft_picks
  WHERE draft_id = p_draft_id AND team_number = p_team_number;
  v_remaining := greatest(0, v_draft.num_rounds - v_roster);

  v_starters := coalesce(v_draft.position_limits->'starters', '{}'::jsonb);
  v_need_qb := coalesce((v_starters->>'QB')::integer, 1);
  v_need_rb := coalesce((v_starters->>'RB')::integer, 2);
  v_need_wr := coalesce((v_starters->>'WR')::integer, 2);
  v_need_te := coalesce((v_starters->>'TE')::integer, 1);
  v_need_def := coalesce((v_starters->>'DEF')::integer, 1);
  v_need_k := coalesce((v_starters->>'K')::integer, 1);

  -- Prefer filling holes in the last stretch; hard-force is in mp_position_allowed.
  IF v_remaining > greatest(5, v_need_qb + v_need_rb + v_need_wr + v_need_te + v_need_def + v_need_k) THEN
    RETURN ARRAY[]::text[];
  END IF;

  RETURN v_needed;
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_position_allowed(
  p_draft_id uuid,
  p_team_number integer,
  p_position text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits jsonb;
  v_pos text;
  v_limit integer;
  v_count integer;
  v_num_rounds integer;
  v_roster_count integer;
  v_remaining integer;
  v_needed text[];
BEGIN
  SELECT position_limits, num_rounds
  INTO v_limits, v_num_rounds
  FROM public.multiplayer_drafts
  WHERE id = p_draft_id;

  SELECT count(*)::integer INTO v_roster_count
  FROM public.multiplayer_draft_picks
  WHERE draft_id = p_draft_id AND team_number = p_team_number;

  IF v_roster_count >= v_num_rounds THEN
    RETURN false;
  END IF;

  v_pos := public.mp_normalize_pos(p_position);
  IF v_limits ? v_pos THEN
    v_limit := (v_limits ->> v_pos)::integer;
    IF v_limit IS NOT NULL THEN
      SELECT count(*)::integer INTO v_count
      FROM public.multiplayer_draft_picks pk
      JOIN public.players pl ON pl.id = pk.player_id
      WHERE pk.draft_id = p_draft_id
        AND pk.team_number = p_team_number
        AND public.mp_normalize_pos(pl.position) = v_pos;
      IF v_count >= v_limit THEN
        RETURN false;
      END IF;
    END IF;
  END IF;

  v_remaining := greatest(0, v_num_rounds - v_roster_count);
  v_needed := public.mp_team_starter_holes(p_draft_id, p_team_number);
  IF coalesce(array_length(v_needed, 1), 0) > 0
     AND v_remaining <= array_length(v_needed, 1)
     AND NOT (v_pos = ANY (v_needed)) THEN
    RETURN false;
  END IF;

  RETURN true;
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
  v_def_cnt integer;
  v_k_cnt integer;
  v_holes text[];
  v_roster integer;
  v_num_rounds integer;
  v_remaining integer;
BEGIN
  SELECT board_player_ids, board_player_positions, num_rounds
  INTO v_board, v_positions, v_num_rounds
  FROM public.multiplayer_drafts WHERE id = p_draft_id;
  IF v_board IS NULL OR array_length(v_board, 1) IS NULL THEN RETURN NULL; END IF;

  SELECT count(*)::integer INTO v_roster
  FROM public.multiplayer_draft_picks
  WHERE draft_id = p_draft_id AND team_number = p_team_number;
  v_remaining := greatest(0, v_num_rounds - v_roster);
  v_holes := public.mp_team_starter_holes(p_draft_id, p_team_number);

  SELECT count(*)::integer INTO v_def_cnt
  FROM public.multiplayer_draft_picks pk
  JOIN public.players pl ON pl.id = pk.player_id
  WHERE pk.draft_id = p_draft_id AND pk.team_number = p_team_number
    AND public.mp_normalize_pos(pl.position) = 'DEF';
  SELECT count(*)::integer INTO v_k_cnt
  FROM public.multiplayer_draft_picks pk
  JOIN public.players pl ON pl.id = pk.player_id
  WHERE pk.draft_id = p_draft_id AND pk.team_number = p_team_number
    AND public.mp_normalize_pos(pl.position) = 'K';

  -- Hard force: remaining picks are the last chance to fill starter holes.
  IF coalesce(array_length(v_holes, 1), 0) > 0 AND v_remaining <= array_length(v_holes, 1) THEN
    FOREACH v_need_pos IN ARRAY v_holes LOOP
      FOR i IN 1..array_length(v_board, 1) LOOP
        v_player_id := v_board[i];
        v_pos := public.mp_normalize_pos(COALESCE(v_positions[i], 'FLEX'));
        IF v_pos <> v_need_pos THEN CONTINUE; END IF;
        IF NOT EXISTS (SELECT 1 FROM public.players pl WHERE pl.id = v_player_id) THEN CONTINUE; END IF;
        IF EXISTS (SELECT 1 FROM public.multiplayer_draft_picks WHERE draft_id = p_draft_id AND player_id = v_player_id) THEN CONTINUE; END IF;
        IF EXISTS (SELECT 1 FROM public.multiplayer_draft_keepers k WHERE k.draft_id = p_draft_id AND k.player_id = v_player_id) THEN CONTINUE; END IF;
        IF public.mp_position_allowed(p_draft_id, p_team_number, v_pos) THEN RETURN v_player_id; END IF;
      END LOOP;
    END LOOP;
  END IF;

  v_needed := public.mp_team_needed_positions(p_draft_id, p_team_number);

  IF array_length(v_needed, 1) IS NOT NULL THEN
    FOREACH v_need_pos IN ARRAY v_needed LOOP
      FOR i IN 1..array_length(v_board, 1) LOOP
        v_player_id := v_board[i];
        v_pos := public.mp_normalize_pos(COALESCE(v_positions[i], 'FLEX'));
        IF v_pos <> v_need_pos THEN CONTINUE; END IF;
        IF NOT EXISTS (SELECT 1 FROM public.players pl WHERE pl.id = v_player_id) THEN CONTINUE; END IF;
        IF EXISTS (SELECT 1 FROM public.multiplayer_draft_picks WHERE draft_id = p_draft_id AND player_id = v_player_id) THEN CONTINUE; END IF;
        IF EXISTS (SELECT 1 FROM public.multiplayer_draft_keepers k WHERE k.draft_id = p_draft_id AND k.player_id = v_player_id) THEN CONTINUE; END IF;
        IF public.mp_position_allowed(p_draft_id, p_team_number, v_pos) THEN RETURN v_player_id; END IF;
      END LOOP;
    END LOOP;
  END IF;

  FOR i IN 1..array_length(v_board, 1) LOOP
    v_player_id := v_board[i];
    v_pos := public.mp_normalize_pos(COALESCE(v_positions[i], 'FLEX'));
    IF NOT EXISTS (SELECT 1 FROM public.players pl WHERE pl.id = v_player_id) THEN CONTINUE; END IF;
    IF v_pos = 'DEF' AND v_def_cnt >= 1 THEN CONTINUE; END IF;
    IF v_pos = 'K' AND v_k_cnt >= 1 THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.multiplayer_draft_picks WHERE draft_id = p_draft_id AND player_id = v_player_id) THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.multiplayer_draft_keepers k WHERE k.draft_id = p_draft_id AND k.player_id = v_player_id) THEN CONTINUE; END IF;
    IF public.mp_position_allowed(p_draft_id, p_team_number, v_pos) THEN RETURN v_player_id; END IF;
  END LOOP;

  FOR i IN 1..array_length(v_board, 1) LOOP
    v_player_id := v_board[i];
    IF NOT EXISTS (SELECT 1 FROM public.players pl WHERE pl.id = v_player_id) THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.multiplayer_draft_picks WHERE draft_id = p_draft_id AND player_id = v_player_id) THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.multiplayer_draft_keepers k WHERE k.draft_id = p_draft_id AND k.player_id = v_player_id) THEN CONTINUE; END IF;
    RETURN v_player_id;
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.mp_team_starter_holes(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mp_team_starter_holes(uuid, integer) FROM anon, authenticated;
