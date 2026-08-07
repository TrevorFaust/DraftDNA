-- Honor custom starter counts from position_limits.starters in need-based BPA.

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
  v_needed text[] := ARRAY[]::text[];
  v_qb integer; v_rb integer; v_wr integer; v_te integer; v_def integer; v_k integer;
  v_need_qb integer; v_need_rb integer; v_need_wr integer; v_need_te integer; v_need_def integer; v_need_k integer;
  v_starters jsonb;
  v_roster integer; v_remaining integer; r record; i integer;
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

  v_starters := coalesce(v_draft.position_limits->'starters', '{}'::jsonb);
  v_need_qb := coalesce((v_starters->>'QB')::integer, 1);
  v_need_rb := coalesce((v_starters->>'RB')::integer, 2);
  v_need_wr := coalesce((v_starters->>'WR')::integer, 2);
  v_need_te := coalesce((v_starters->>'TE')::integer, 1);
  v_need_def := coalesce((v_starters->>'DEF')::integer, 1);
  v_need_k := coalesce((v_starters->>'K')::integer, 1);

  SELECT count(*)::integer INTO v_roster
  FROM public.multiplayer_draft_picks
  WHERE draft_id = p_draft_id AND team_number = p_team_number;
  v_remaining := greatest(0, v_draft.num_rounds - v_roster);

  -- Late rounds only: force missing dedicated starters so DEF/K aren't skipped.
  IF v_remaining > greatest(5, v_need_qb + v_need_rb + v_need_wr + v_need_te + v_need_def + v_need_k) THEN
    RETURN ARRAY[]::text[];
  END IF;

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
