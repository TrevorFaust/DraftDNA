-- Open (public) multiplayer lobbies listed on Mock Draft without an invite code.
-- Invite-only lobbies remain the default; open lobbies still get an invite code for deep links / rejoin.

ALTER TABLE public.multiplayer_drafts
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'invite';

ALTER TABLE public.multiplayer_drafts
  DROP CONSTRAINT IF EXISTS multiplayer_drafts_visibility_check;

ALTER TABLE public.multiplayer_drafts
  ADD CONSTRAINT multiplayer_drafts_visibility_check
  CHECK (visibility IN ('invite', 'open'));

CREATE INDEX IF NOT EXISTS idx_mp_drafts_open_lobby
  ON public.multiplayer_drafts (created_at DESC)
  WHERE status = 'lobby' AND visibility = 'open';

-- Recreate create RPC with visibility (must drop — new arg changes signature).
DROP FUNCTION IF EXISTS public.mp_create_draft(
  text, integer, integer, integer, text, integer, text, text, text, boolean,
  jsonb, text, jsonb, uuid, uuid[], text[], jsonb, text
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
  p_visibility text DEFAULT 'invite'
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
    visibility
  ) VALUES (
    v_uid, v_code, coalesce(nullif(trim(p_name), ''), 'Multiplayer Mock'),
    'lobby', p_num_teams, p_num_rounds, coalesce(p_draft_order, 'snake'),
    coalesce(p_pick_timer, 30), coalesce(p_cpu_speed, 'normal'), p_scoring_format,
    p_league_type, coalesce(p_is_superflex, false), coalesce(p_position_limits, '{}'::jsonb),
    coalesce(p_player_pool, 'all'), coalesce(p_team_names, '{}'::jsonb), p_source_league_id,
    p_board_player_ids, p_board_player_positions, v_visibility
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
    'visibility', v_visibility
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mp_create_draft(
  text, integer, integer, integer, text, integer, text, text, text, boolean,
  jsonb, text, jsonb, uuid, uuid[], text[], jsonb, text, text
) TO authenticated;

-- Compact public list for the Mock Draft browser (no board arrays).
CREATE OR REPLACE FUNCTION public.mp_list_open_lobbies(
  p_limit integer DEFAULT 40
)
RETURNS TABLE (
  draft_id uuid,
  invite_code text,
  name text,
  num_teams integer,
  seats_filled integer,
  scoring_format text,
  league_type text,
  is_superflex boolean,
  pick_timer integer,
  position_limits jsonb,
  host_display_name text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id AS draft_id,
    d.invite_code,
    d.name,
    d.num_teams,
    (
      SELECT count(*)::integer
      FROM public.multiplayer_draft_participants p
      WHERE p.draft_id = d.id
        AND p.team_number IS NOT NULL
    ) AS seats_filled,
    d.scoring_format,
    d.league_type,
    d.is_superflex,
    d.pick_timer,
    d.position_limits,
    coalesce(
      (
        SELECT p.display_name
        FROM public.multiplayer_draft_participants p
        WHERE p.draft_id = d.id AND p.is_host
        ORDER BY p.joined_at
        LIMIT 1
      ),
      'Host'
    ) AS host_display_name,
    d.created_at
  FROM public.multiplayer_drafts d
  WHERE d.status = 'lobby'
    AND d.visibility = 'open'
    AND (
      SELECT count(*)
      FROM public.multiplayer_draft_participants p
      WHERE p.draft_id = d.id
        AND p.team_number IS NOT NULL
    ) < d.num_teams
  ORDER BY d.created_at DESC
  LIMIT least(greatest(coalesce(p_limit, 40), 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.mp_list_open_lobbies(integer) TO authenticated, anon;
