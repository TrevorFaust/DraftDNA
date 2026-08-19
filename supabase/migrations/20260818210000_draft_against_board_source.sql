-- Solo CPU board + multiplayer host room board (consensus / espn / yahoo / sleeper).

ALTER TABLE public.mock_drafts
  ADD COLUMN IF NOT EXISTS cpu_board_source text;

ALTER TABLE public.multiplayer_drafts
  ADD COLUMN IF NOT EXISTS board_source text;

DROP FUNCTION IF EXISTS public.mp_create_draft(
  text, integer, integer, integer, text, integer, text, text, text, boolean,
  jsonb, text, jsonb, uuid, uuid[], text[], jsonb, text, text
);

DROP FUNCTION IF EXISTS public.mp_create_draft(
  text, integer, integer, integer, text, integer, text, text, text, boolean,
  jsonb, text, jsonb, uuid, uuid[], text[], jsonb, text, text, text
);

CREATE OR REPLACE FUNCTION public.mp_create_draft(
  p_name text,
  p_num_teams integer,
  p_num_rounds integer,
  p_host_team_number integer,
  p_draft_order text DEFAULT 'snake',
  p_pick_timer integer DEFAULT 30,
  p_cpu_speed text DEFAULT 'normal',
  p_scoring_format text DEFAULT NULL,
  p_league_type text DEFAULT NULL,
  p_is_superflex boolean DEFAULT false,
  p_position_limits jsonb DEFAULT '{}'::jsonb,
  p_player_pool text DEFAULT 'all',
  p_team_names jsonb DEFAULT '{}'::jsonb,
  p_source_league_id uuid DEFAULT NULL,
  p_board_player_ids uuid[] DEFAULT '{}'::uuid[],
  p_board_player_positions text[] DEFAULT '{}'::text[],
  p_keepers jsonb DEFAULT '[]'::jsonb,
  p_display_name text DEFAULT 'Host',
  p_visibility text DEFAULT 'invite',
  p_board_source text DEFAULT 'consensus'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text;
  v_draft_id uuid;
  v_attempts integer := 0;
  v_keeper jsonb;
  v_keeper_count integer := 0;
  v_visibility text;
  v_board_source text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Host must be logged in';
  END IF;
  IF p_num_teams < 4 OR p_num_teams > 32 THEN
    RAISE EXCEPTION 'num_teams must be between 4 and 32';
  END IF;
  IF p_host_team_number < 1 OR p_host_team_number > p_num_teams THEN
    RAISE EXCEPTION 'Invalid host team number';
  END IF;
  IF coalesce(array_length(p_board_player_ids, 1), 0) < p_num_teams * p_num_rounds THEN
    RAISE EXCEPTION 'Player board too small for this draft';
  END IF;

  v_visibility := lower(trim(coalesce(p_visibility, 'invite')));
  IF v_visibility NOT IN ('invite', 'open') THEN
    RAISE EXCEPTION 'visibility must be invite or open';
  END IF;

  v_board_source := lower(trim(coalesce(p_board_source, 'consensus')));
  IF v_board_source = 'community' THEN
    v_board_source := 'consensus';
  END IF;

  LOOP
    v_code := public.mp_generate_invite_code();
    v_attempts := v_attempts + 1;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.multiplayer_drafts WHERE invite_code = v_code);
    IF v_attempts > 20 THEN
      RAISE EXCEPTION 'Could not generate invite code';
    END IF;
  END LOOP;

  INSERT INTO public.multiplayer_drafts (
    host_user_id, invite_code, name, status, num_teams, num_rounds, draft_order,
    pick_timer, cpu_speed, scoring_format, league_type, is_superflex, position_limits,
    player_pool, team_names, source_league_id, board_player_ids, board_player_positions,
    visibility, board_source
  ) VALUES (
    v_uid, v_code, coalesce(nullif(trim(p_name), ''), 'Multiplayer Mock'),
    'lobby', p_num_teams, p_num_rounds, coalesce(p_draft_order, 'snake'),
    coalesce(p_pick_timer, 30), coalesce(p_cpu_speed, 'normal'), p_scoring_format,
    p_league_type, coalesce(p_is_superflex, false), coalesce(p_position_limits, '{}'::jsonb),
    coalesce(p_player_pool, 'all'), coalesce(p_team_names, '{}'::jsonb), p_source_league_id,
    p_board_player_ids, p_board_player_positions, v_visibility, v_board_source
  )
  RETURNING id INTO v_draft_id;

  INSERT INTO public.multiplayer_draft_participants (
    draft_id, team_number, user_id, display_name, is_host, is_ready
  ) VALUES (
    v_draft_id, p_host_team_number, v_uid, coalesce(nullif(trim(p_display_name), ''), 'Host'),
    true, true
  );

  IF p_source_league_id IS NOT NULL THEN
    INSERT INTO public.multiplayer_draft_keepers (draft_id, team_number, player_id, round_number)
    SELECT v_draft_id, k.team_number, k.player_id, k.round_number
    FROM public.league_keepers k
    WHERE k.league_id = p_source_league_id
      AND k.team_number >= 1
      AND k.team_number <= p_num_teams
      AND k.round_number >= 1
      AND k.round_number <= p_num_rounds;

    GET DIAGNOSTICS v_keeper_count = ROW_COUNT;
  END IF;

  IF v_keeper_count = 0 AND p_keepers IS NOT NULL AND jsonb_typeof(p_keepers) = 'array' THEN
    FOR v_keeper IN SELECT * FROM jsonb_array_elements(p_keepers)
    LOOP
      BEGIN
        INSERT INTO public.multiplayer_draft_keepers (draft_id, team_number, player_id, round_number)
        VALUES (
          v_draft_id,
          (v_keeper->>'team_number')::integer,
          (v_keeper->>'player_id')::uuid,
          (v_keeper->>'round_number')::integer
        );
        v_keeper_count := v_keeper_count + 1;
      EXCEPTION
        WHEN unique_violation THEN
          NULL;
      END;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'draft_id', v_draft_id,
    'invite_code', v_code,
    'keeper_count', v_keeper_count,
    'visibility', v_visibility,
    'board_source', v_board_source
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mp_create_draft(
  text, integer, integer, integer, text, integer, text, text, text, boolean,
  jsonb, text, jsonb, uuid, uuid[], text[], jsonb, text, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.mp_set_lobby_board(
  p_draft_id uuid,
  p_board_source text,
  p_board_player_ids uuid[],
  p_board_player_positions text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_host uuid;
  v_status text;
  v_num_teams integer;
  v_num_rounds integer;
  v_board_source text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  SELECT host_user_id, status, num_teams, num_rounds
    INTO v_host, v_status, v_num_teams, v_num_rounds
  FROM public.multiplayer_drafts
  WHERE id = p_draft_id;

  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;
  IF v_host <> v_uid THEN
    RAISE EXCEPTION 'Only the host can change the draft board';
  END IF;
  IF v_status <> 'lobby' THEN
    RAISE EXCEPTION 'Board can only be changed in lobby';
  END IF;
  IF coalesce(array_length(p_board_player_ids, 1), 0) < v_num_teams * v_num_rounds THEN
    RAISE EXCEPTION 'Player board too small for this draft';
  END IF;
  IF coalesce(array_length(p_board_player_positions, 1), 0) <> coalesce(array_length(p_board_player_ids, 1), 0) THEN
    RAISE EXCEPTION 'Board ids and positions must match';
  END IF;

  v_board_source := lower(trim(coalesce(p_board_source, 'consensus')));
  IF v_board_source = 'community' THEN
    v_board_source := 'consensus';
  END IF;

  UPDATE public.multiplayer_drafts
  SET
    board_source = v_board_source,
    board_player_ids = p_board_player_ids,
    board_player_positions = p_board_player_positions,
    lobby_last_activity_at = now()
  WHERE id = p_draft_id;

  RETURN jsonb_build_object('ok', true, 'board_source', v_board_source);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mp_set_lobby_board(uuid, text, uuid[], text[]) TO authenticated;
