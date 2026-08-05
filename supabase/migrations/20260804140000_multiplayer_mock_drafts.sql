-- Multiplayer mock drafts: lobby, invite join, server-authoritative picks.

-- ─── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.multiplayer_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'lobby'
    CHECK (status IN ('lobby', 'drafting', 'completed', 'cancelled')),
  num_teams integer NOT NULL CHECK (num_teams BETWEEN 4 AND 32),
  num_rounds integer NOT NULL CHECK (num_rounds BETWEEN 1 AND 40),
  draft_order text NOT NULL DEFAULT 'snake',
  pick_timer integer NOT NULL DEFAULT 30,
  cpu_speed text NOT NULL DEFAULT 'normal',
  scoring_format text,
  league_type text,
  is_superflex boolean NOT NULL DEFAULT false,
  position_limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  player_pool text DEFAULT 'all',
  team_names jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_league_id uuid REFERENCES public.leagues(id) ON DELETE SET NULL,
  board_player_ids uuid[] NOT NULL DEFAULT '{}',
  board_player_positions text[] NOT NULL DEFAULT '{}',
  current_pick_number integer NOT NULL DEFAULT 1,
  pick_deadline_at timestamptz,
  cpu_archetypes jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_mp_drafts_invite ON public.multiplayer_drafts(invite_code);
CREATE INDEX IF NOT EXISTS idx_mp_drafts_host ON public.multiplayer_drafts(host_user_id);
CREATE INDEX IF NOT EXISTS idx_mp_drafts_status ON public.multiplayer_drafts(status);

CREATE TABLE IF NOT EXISTS public.multiplayer_draft_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.multiplayer_drafts(id) ON DELETE CASCADE,
  team_number integer CHECK (team_number IS NULL OR team_number >= 1),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_session_id text,
  display_name text NOT NULL DEFAULT 'Guest',
  is_host boolean NOT NULL DEFAULT false,
  is_ready boolean NOT NULL DEFAULT false,
  is_connected boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mp_participant_identity CHECK (user_id IS NOT NULL OR guest_session_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mp_participants_user
  ON public.multiplayer_draft_participants(draft_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mp_participants_guest
  ON public.multiplayer_draft_participants(draft_id, guest_session_id)
  WHERE guest_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mp_participants_team
  ON public.multiplayer_draft_participants(draft_id, team_number)
  WHERE team_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.multiplayer_draft_keepers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.multiplayer_drafts(id) ON DELETE CASCADE,
  team_number integer NOT NULL CHECK (team_number >= 1),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  round_number integer NOT NULL CHECK (round_number >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, player_id),
  UNIQUE (draft_id, team_number, round_number)
);

CREATE INDEX IF NOT EXISTS idx_mp_keepers_draft ON public.multiplayer_draft_keepers(draft_id);

CREATE TABLE IF NOT EXISTS public.multiplayer_draft_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.multiplayer_drafts(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_number integer NOT NULL,
  round_number integer NOT NULL,
  pick_number integer NOT NULL,
  is_autodraft boolean NOT NULL DEFAULT false,
  is_keeper boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, player_id),
  UNIQUE (draft_id, pick_number)
);

CREATE INDEX IF NOT EXISTS idx_mp_picks_draft ON public.multiplayer_draft_picks(draft_id);

CREATE TABLE IF NOT EXISTS public.multiplayer_draft_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.multiplayer_drafts(id) ON DELETE CASCADE,
  team_number integer NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_session_id text,
  grade_letter text,
  grade_score numeric,
  grade_payload jsonb,
  detected_archetype text,
  detected_archetype_index integer,
  detected_chaos_archetype text,
  badge_awarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, team_number)
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.multiplayer_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multiplayer_draft_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multiplayer_draft_keepers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multiplayer_draft_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multiplayer_draft_results ENABLE ROW LEVEL SECURITY;

-- UUID / invite code is the access secret; allow read for realtime sync.
CREATE POLICY mp_drafts_select ON public.multiplayer_drafts
  FOR SELECT USING (status IN ('lobby', 'drafting', 'completed'));

CREATE POLICY mp_participants_select ON public.multiplayer_draft_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.multiplayer_drafts d
      WHERE d.id = draft_id AND d.status IN ('lobby', 'drafting', 'completed')
    )
  );

CREATE POLICY mp_keepers_select ON public.multiplayer_draft_keepers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.multiplayer_drafts d
      WHERE d.id = draft_id AND d.status IN ('lobby', 'drafting', 'completed')
    )
  );

CREATE POLICY mp_picks_select ON public.multiplayer_draft_picks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.multiplayer_drafts d
      WHERE d.id = draft_id AND d.status IN ('lobby', 'drafting', 'completed')
    )
  );

CREATE POLICY mp_results_select ON public.multiplayer_draft_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.multiplayer_drafts d
      WHERE d.id = draft_id AND d.status IN ('lobby', 'drafting', 'completed')
    )
  );

-- Mutations go through SECURITY DEFINER RPCs only (no direct INSERT/UPDATE/DELETE policies).

-- ─── Helpers ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mp_generate_invite_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_team_for_pick(
  p_pick_number integer,
  p_num_teams integer,
  p_draft_order text
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_round integer;
  v_pick_in_round integer;
BEGIN
  IF p_num_teams < 1 OR p_pick_number < 1 THEN
    RETURN 1;
  END IF;
  v_round := ceil(p_pick_number::numeric / p_num_teams)::integer;
  v_pick_in_round := ((p_pick_number - 1) % p_num_teams) + 1;
  IF p_draft_order = 'snake' AND v_round % 2 = 0 THEN
    RETURN p_num_teams - v_pick_in_round + 1;
  END IF;
  RETURN v_pick_in_round;
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_round_for_pick(
  p_pick_number integer,
  p_num_teams integer
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ceil(p_pick_number::numeric / greatest(p_num_teams, 1))::integer;
$$;

CREATE OR REPLACE FUNCTION public.mp_normalize_pos(p_pos text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN upper(coalesce(p_pos, '')) IN ('D/ST', 'DST', 'DEF') THEN 'DEF'
    ELSE upper(coalesce(p_pos, ''))
  END;
$$;

CREATE OR REPLACE FUNCTION public.mp_caller_is_participant(
  p_draft_id uuid,
  p_guest_session_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.multiplayer_draft_participants p
    WHERE p.draft_id = p_draft_id
      AND (
        (auth.uid() IS NOT NULL AND p.user_id = auth.uid())
        OR (p_guest_session_id IS NOT NULL AND p.guest_session_id = p_guest_session_id)
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_team_is_human(
  p_draft_id uuid,
  p_team_number integer
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.multiplayer_draft_participants p
    WHERE p.draft_id = p_draft_id
      AND p.team_number = p_team_number
  );
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
BEGIN
  SELECT board_player_ids, board_player_positions
  INTO v_board, v_positions
  FROM public.multiplayer_drafts
  WHERE id = p_draft_id;

  IF v_board IS NULL OR array_length(v_board, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  FOR i IN 1..array_length(v_board, 1) LOOP
    v_player_id := v_board[i];
    v_pos := COALESCE(v_positions[i], 'FLEX');

    IF EXISTS (
      SELECT 1 FROM public.multiplayer_draft_picks
      WHERE draft_id = p_draft_id AND player_id = v_player_id
    ) THEN
      CONTINUE;
    END IF;

    -- Skip keepers reserved for other teams/rounds (still on board until assigned)
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
      -- Keeper for this team: only selectable when it's that keeper's round (handled elsewhere)
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
BEGIN
  SELECT * INTO v_draft FROM public.multiplayer_drafts WHERE id = p_draft_id FOR UPDATE;
  v_total := v_draft.num_teams * v_draft.num_rounds;
  v_next := v_draft.current_pick_number + 1;

  IF v_next > v_total THEN
    UPDATE public.multiplayer_drafts
    SET status = 'completed',
        completed_at = now(),
        pick_deadline_at = NULL,
        current_pick_number = v_next
    WHERE id = p_draft_id;
    RETURN;
  END IF;

  v_team := public.mp_team_for_pick(v_next, v_draft.num_teams, v_draft.draft_order);
  v_human := public.mp_team_is_human(p_draft_id, v_team);
  v_round := public.mp_round_for_pick(v_next, v_draft.num_teams);

  UPDATE public.multiplayer_drafts
  SET current_pick_number = v_next,
      pick_deadline_at = CASE
        WHEN v_human AND v_draft.pick_timer > 0 THEN now() + make_interval(secs => v_draft.pick_timer)
        ELSE NULL
      END
  WHERE id = p_draft_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_insert_pick(
  p_draft_id uuid,
  p_player_id uuid,
  p_is_autodraft boolean DEFAULT false,
  p_is_keeper boolean DEFAULT false
)
RETURNS public.multiplayer_draft_picks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft public.multiplayer_drafts%ROWTYPE;
  v_team integer;
  v_round integer;
  v_pick public.multiplayer_draft_picks%ROWTYPE;
BEGIN
  SELECT * INTO v_draft FROM public.multiplayer_drafts WHERE id = p_draft_id FOR UPDATE;
  IF v_draft.status <> 'drafting' THEN
    RAISE EXCEPTION 'Draft is not in progress';
  END IF;

  v_team := public.mp_team_for_pick(v_draft.current_pick_number, v_draft.num_teams, v_draft.draft_order);
  v_round := public.mp_round_for_pick(v_draft.current_pick_number, v_draft.num_teams);

  INSERT INTO public.multiplayer_draft_picks (
    draft_id, player_id, team_number, round_number, pick_number, is_autodraft, is_keeper
  ) VALUES (
    p_draft_id, p_player_id, v_team, v_round, v_draft.current_pick_number, p_is_autodraft, p_is_keeper
  )
  RETURNING * INTO v_pick;

  PERFORM public.mp_advance_after_pick(p_draft_id);
  RETURN v_pick;
END;
$$;

-- ─── RPCs ─────────────────────────────────────────────────────────────────────

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
  p_board_player_ids uuid[] DEFAULT '{}',
  p_board_player_positions text[] DEFAULT '{}',
  p_keepers jsonb DEFAULT '[]'::jsonb,
  p_display_name text DEFAULT 'Host'
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
    player_pool, team_names, source_league_id, board_player_ids, board_player_positions
  ) VALUES (
    v_uid, v_code, coalesce(nullif(trim(p_name), ''), 'Multiplayer Mock'),
    'lobby', p_num_teams, p_num_rounds, coalesce(p_draft_order, 'snake'),
    coalesce(p_pick_timer, 30), coalesce(p_cpu_speed, 'normal'), p_scoring_format,
    p_league_type, coalesce(p_is_superflex, false), coalesce(p_position_limits, '{}'::jsonb),
    coalesce(p_player_pool, 'all'), coalesce(p_team_names, '{}'::jsonb), p_source_league_id,
    p_board_player_ids, p_board_player_positions
  )
  RETURNING id INTO v_draft_id;

  INSERT INTO public.multiplayer_draft_participants (
    draft_id, team_number, user_id, display_name, is_host, is_ready
  ) VALUES (
    v_draft_id, p_host_team_number, v_uid, coalesce(nullif(trim(p_display_name), ''), 'Host'),
    true, true
  );

  IF p_keepers IS NOT NULL AND jsonb_typeof(p_keepers) = 'array' THEN
    FOR v_keeper IN SELECT * FROM jsonb_array_elements(p_keepers)
    LOOP
      INSERT INTO public.multiplayer_draft_keepers (draft_id, team_number, player_id, round_number)
      VALUES (
        v_draft_id,
        (v_keeper->>'team_number')::integer,
        (v_keeper->>'player_id')::uuid,
        (v_keeper->>'round_number')::integer
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('draft_id', v_draft_id, 'invite_code', v_code);
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_join_draft(
  p_invite_code text,
  p_guest_session_id text DEFAULT NULL,
  p_display_name text DEFAULT 'Guest'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_draft public.multiplayer_drafts%ROWTYPE;
  v_participant public.multiplayer_draft_participants%ROWTYPE;
  v_human_count integer;
BEGIN
  SELECT * INTO v_draft
  FROM public.multiplayer_drafts
  WHERE invite_code = upper(trim(p_invite_code));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;
  IF v_draft.status <> 'lobby' THEN
    RAISE EXCEPTION 'Draft is not open for joining';
  END IF;
  IF v_uid IS NULL AND (p_guest_session_id IS NULL OR length(trim(p_guest_session_id)) < 4) THEN
    RAISE EXCEPTION 'Guest session required';
  END IF;

  -- Already joined?
  SELECT * INTO v_participant
  FROM public.multiplayer_draft_participants
  WHERE draft_id = v_draft.id
    AND (
      (v_uid IS NOT NULL AND user_id = v_uid)
      OR (p_guest_session_id IS NOT NULL AND guest_session_id = p_guest_session_id)
    );

  IF FOUND THEN
    RETURN jsonb_build_object(
      'draft_id', v_draft.id,
      'invite_code', v_draft.invite_code,
      'participant_id', v_participant.id,
      'team_number', v_participant.team_number
    );
  END IF;

  SELECT count(*)::integer INTO v_human_count
  FROM public.multiplayer_draft_participants
  WHERE draft_id = v_draft.id;

  IF v_human_count >= v_draft.num_teams THEN
    RAISE EXCEPTION 'Draft is full';
  END IF;

  INSERT INTO public.multiplayer_draft_participants (
    draft_id, user_id, guest_session_id, display_name, is_host, is_ready
  ) VALUES (
    v_draft.id,
    v_uid,
    CASE WHEN v_uid IS NULL THEN p_guest_session_id ELSE NULL END,
    coalesce(nullif(trim(p_display_name), ''), 'Guest'),
    false,
    false
  )
  RETURNING * INTO v_participant;

  RETURN jsonb_build_object(
    'draft_id', v_draft.id,
    'invite_code', v_draft.invite_code,
    'participant_id', v_participant.id,
    'team_number', v_participant.team_number
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_claim_slot(
  p_draft_id uuid,
  p_team_number integer,
  p_guest_session_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft public.multiplayer_drafts%ROWTYPE;
  v_participant public.multiplayer_draft_participants%ROWTYPE;
BEGIN
  SELECT * INTO v_draft FROM public.multiplayer_drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found'; END IF;
  IF v_draft.status <> 'lobby' THEN RAISE EXCEPTION 'Seats locked after start'; END IF;
  IF p_team_number < 1 OR p_team_number > v_draft.num_teams THEN
    RAISE EXCEPTION 'Invalid team number';
  END IF;

  SELECT * INTO v_participant
  FROM public.multiplayer_draft_participants
  WHERE draft_id = p_draft_id
    AND (
      (auth.uid() IS NOT NULL AND user_id = auth.uid())
      OR (p_guest_session_id IS NOT NULL AND guest_session_id = p_guest_session_id)
    )
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Join the draft first'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.multiplayer_draft_participants
    WHERE draft_id = p_draft_id
      AND team_number = p_team_number
      AND id <> v_participant.id
  ) THEN
    RAISE EXCEPTION 'Seat already taken';
  END IF;

  UPDATE public.multiplayer_draft_participants
  SET team_number = p_team_number,
      is_ready = CASE WHEN is_host THEN true ELSE false END
  WHERE id = v_participant.id
  RETURNING * INTO v_participant;

  RETURN jsonb_build_object(
    'participant_id', v_participant.id,
    'team_number', v_participant.team_number
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_release_slot(
  p_draft_id uuid,
  p_guest_session_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant public.multiplayer_draft_participants%ROWTYPE;
BEGIN
  IF (SELECT status FROM public.multiplayer_drafts WHERE id = p_draft_id) <> 'lobby' THEN
    RAISE EXCEPTION 'Seats locked after start';
  END IF;

  SELECT * INTO v_participant
  FROM public.multiplayer_draft_participants
  WHERE draft_id = p_draft_id
    AND (
      (auth.uid() IS NOT NULL AND user_id = auth.uid())
      OR (p_guest_session_id IS NOT NULL AND guest_session_id = p_guest_session_id)
    )
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Not a participant'; END IF;
  IF v_participant.is_host THEN
    RAISE EXCEPTION 'Host cannot release their seat; move instead';
  END IF;

  UPDATE public.multiplayer_draft_participants
  SET team_number = NULL, is_ready = false
  WHERE id = v_participant.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_host_move_kick(
  p_draft_id uuid,
  p_participant_id uuid,
  p_action text,
  p_new_team_number integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft public.multiplayer_drafts%ROWTYPE;
  v_target public.multiplayer_draft_participants%ROWTYPE;
BEGIN
  SELECT * INTO v_draft FROM public.multiplayer_drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found'; END IF;
  IF v_draft.host_user_id <> auth.uid() THEN RAISE EXCEPTION 'Host only'; END IF;
  IF v_draft.status <> 'lobby' THEN RAISE EXCEPTION 'Lobby only'; END IF;

  SELECT * INTO v_target
  FROM public.multiplayer_draft_participants
  WHERE id = p_participant_id AND draft_id = p_draft_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Participant not found'; END IF;

  IF p_action = 'kick' THEN
    IF v_target.is_host THEN RAISE EXCEPTION 'Cannot kick host'; END IF;
    DELETE FROM public.multiplayer_draft_participants WHERE id = v_target.id;
    RETURN jsonb_build_object('ok', true, 'action', 'kick');
  ELSIF p_action = 'move' THEN
    IF p_new_team_number IS NULL OR p_new_team_number < 1 OR p_new_team_number > v_draft.num_teams THEN
      RAISE EXCEPTION 'Invalid team number';
    END IF;
    -- Swap if occupied
    UPDATE public.multiplayer_draft_participants
    SET team_number = NULL
    WHERE draft_id = p_draft_id AND team_number = p_new_team_number AND id <> v_target.id;

    UPDATE public.multiplayer_draft_participants
    SET team_number = p_new_team_number,
        is_ready = CASE WHEN is_host THEN true ELSE false END
    WHERE id = v_target.id;

    RETURN jsonb_build_object('ok', true, 'action', 'move', 'team_number', p_new_team_number);
  ELSIF p_action = 'remove_seat' THEN
    IF v_target.is_host THEN RAISE EXCEPTION 'Host must stay seated'; END IF;
    UPDATE public.multiplayer_draft_participants
    SET team_number = NULL, is_ready = false
    WHERE id = v_target.id;
    RETURN jsonb_build_object('ok', true, 'action', 'remove_seat');
  ELSE
    RAISE EXCEPTION 'Unknown action';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_set_ready(
  p_draft_id uuid,
  p_ready boolean,
  p_guest_session_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant public.multiplayer_draft_participants%ROWTYPE;
BEGIN
  IF (SELECT status FROM public.multiplayer_drafts WHERE id = p_draft_id) <> 'lobby' THEN
    RAISE EXCEPTION 'Lobby only';
  END IF;

  SELECT * INTO v_participant
  FROM public.multiplayer_draft_participants
  WHERE draft_id = p_draft_id
    AND (
      (auth.uid() IS NOT NULL AND user_id = auth.uid())
      OR (p_guest_session_id IS NOT NULL AND guest_session_id = p_guest_session_id)
    )
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Not a participant'; END IF;
  IF v_participant.team_number IS NULL THEN
    RAISE EXCEPTION 'Claim a seat before ready-up';
  END IF;

  UPDATE public.multiplayer_draft_participants
  SET is_ready = coalesce(p_ready, false)
  WHERE id = v_participant.id
  RETURNING * INTO v_participant;

  RETURN jsonb_build_object(
    'participant_id', v_participant.id,
    'is_ready', v_participant.is_ready
  );
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
  v_human boolean;
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

  v_team := public.mp_team_for_pick(1, v_draft.num_teams, v_draft.draft_order);
  v_human := public.mp_team_is_human(p_draft_id, v_team);

  UPDATE public.multiplayer_drafts
  SET status = 'drafting',
      started_at = now(),
      current_pick_number = 1,
      pick_deadline_at = CASE
        WHEN v_human AND pick_timer > 0 THEN now() + make_interval(secs => pick_timer)
        ELSE NULL
      END
  WHERE id = p_draft_id;

  RETURN jsonb_build_object('ok', true, 'status', 'drafting');
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_make_pick(
  p_draft_id uuid,
  p_player_id uuid,
  p_guest_session_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft public.multiplayer_drafts%ROWTYPE;
  v_team integer;
  v_round integer;
  v_participant public.multiplayer_draft_participants%ROWTYPE;
  v_pos text;
  v_pick public.multiplayer_draft_picks%ROWTYPE;
  v_keeper_round integer;
BEGIN
  SELECT * INTO v_draft FROM public.multiplayer_drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found'; END IF;
  IF v_draft.status <> 'drafting' THEN RAISE EXCEPTION 'Draft is not in progress'; END IF;

  v_team := public.mp_team_for_pick(v_draft.current_pick_number, v_draft.num_teams, v_draft.draft_order);
  v_round := public.mp_round_for_pick(v_draft.current_pick_number, v_draft.num_teams);

  SELECT * INTO v_participant
  FROM public.multiplayer_draft_participants
  WHERE draft_id = p_draft_id
    AND team_number = v_team
    AND (
      (auth.uid() IS NOT NULL AND user_id = auth.uid())
      OR (p_guest_session_id IS NOT NULL AND guest_session_id = p_guest_session_id)
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not your turn';
  END IF;

  -- Keeper lock for this round
  SELECT round_number INTO v_keeper_round
  FROM public.multiplayer_draft_keepers
  WHERE draft_id = p_draft_id AND team_number = v_team AND round_number = v_round;

  IF FOUND THEN
    RAISE EXCEPTION 'Keeper auto-pick in progress for this round';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.multiplayer_draft_picks
    WHERE draft_id = p_draft_id AND player_id = p_player_id
  ) THEN
    RAISE EXCEPTION 'Player already drafted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.multiplayer_draft_keepers
    WHERE draft_id = p_draft_id AND player_id = p_player_id
  ) THEN
    RAISE EXCEPTION 'Player is a keeper';
  END IF;

  SELECT public.mp_normalize_pos(position) INTO v_pos
  FROM public.players WHERE id = p_player_id;
  IF v_pos IS NULL THEN RAISE EXCEPTION 'Player not found'; END IF;

  IF NOT public.mp_position_allowed(p_draft_id, v_team, v_pos) THEN
    RAISE EXCEPTION 'No roster spot for that position';
  END IF;

  v_pick := public.mp_insert_pick(p_draft_id, p_player_id, false, false);

  RETURN jsonb_build_object(
    'pick_id', v_pick.id,
    'pick_number', v_pick.pick_number,
    'team_number', v_pick.team_number,
    'player_id', v_pick.player_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_tick_draft(
  p_draft_id uuid,
  p_guest_session_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft public.multiplayer_drafts%ROWTYPE;
  v_team integer;
  v_round integer;
  v_human boolean;
  v_keeper_player uuid;
  v_player_id uuid;
  v_pick public.multiplayer_draft_picks%ROWTYPE;
  v_actions jsonb := '[]'::jsonb;
  v_guard integer := 0;
  v_total integer;
BEGIN
  -- Allow any participant (or host) to tick
  IF NOT public.mp_caller_is_participant(p_draft_id, p_guest_session_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.multiplayer_drafts d
       WHERE d.id = p_draft_id AND d.host_user_id = auth.uid()
     ) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  LOOP
    v_guard := v_guard + 1;
    IF v_guard > 64 THEN
      EXIT;
    END IF;

    SELECT * INTO v_draft FROM public.multiplayer_drafts WHERE id = p_draft_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found'; END IF;
    IF v_draft.status <> 'drafting' THEN
      RETURN jsonb_build_object('status', v_draft.status, 'actions', v_actions);
    END IF;

    v_total := v_draft.num_teams * v_draft.num_rounds;
    IF v_draft.current_pick_number > v_total THEN
      UPDATE public.multiplayer_drafts
      SET status = 'completed', completed_at = coalesce(completed_at, now()), pick_deadline_at = NULL
      WHERE id = p_draft_id;
      RETURN jsonb_build_object('status', 'completed', 'actions', v_actions);
    END IF;

    v_team := public.mp_team_for_pick(v_draft.current_pick_number, v_draft.num_teams, v_draft.draft_order);
    v_round := public.mp_round_for_pick(v_draft.current_pick_number, v_draft.num_teams);
    v_human := public.mp_team_is_human(p_draft_id, v_team);

    -- Keeper for this team/round?
    SELECT player_id INTO v_keeper_player
    FROM public.multiplayer_draft_keepers
    WHERE draft_id = p_draft_id AND team_number = v_team AND round_number = v_round;

    IF FOUND THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.multiplayer_draft_picks
        WHERE draft_id = p_draft_id AND player_id = v_keeper_player
      ) THEN
        v_pick := public.mp_insert_pick(p_draft_id, v_keeper_player, true, true);
        v_actions := v_actions || jsonb_build_array(jsonb_build_object(
          'type', 'keeper', 'pick_number', v_pick.pick_number, 'player_id', v_keeper_player, 'team_number', v_team
        ));
        CONTINUE;
      END IF;
    END IF;

    IF NOT v_human THEN
      v_player_id := public.mp_select_bpa_player(p_draft_id, v_team);
      IF v_player_id IS NULL THEN
        RAISE EXCEPTION 'No available players for CPU pick';
      END IF;
      v_pick := public.mp_insert_pick(p_draft_id, v_player_id, true, false);
      v_actions := v_actions || jsonb_build_array(jsonb_build_object(
        'type', 'cpu', 'pick_number', v_pick.pick_number, 'player_id', v_player_id, 'team_number', v_team
      ));
      CONTINUE;
    END IF;

    -- Human turn: autodraft only if timer expired
    IF v_draft.pick_timer > 0
       AND v_draft.pick_deadline_at IS NOT NULL
       AND v_draft.pick_deadline_at <= now() THEN
      v_player_id := public.mp_select_bpa_player(p_draft_id, v_team);
      IF v_player_id IS NULL THEN
        RAISE EXCEPTION 'No available players for autodraft';
      END IF;
      v_pick := public.mp_insert_pick(p_draft_id, v_player_id, true, false);
      v_actions := v_actions || jsonb_build_array(jsonb_build_object(
        'type', 'autodraft', 'pick_number', v_pick.pick_number, 'player_id', v_player_id, 'team_number', v_team
      ));
      CONTINUE;
    END IF;

    -- Waiting on human
    EXIT;
  END LOOP;

  SELECT status, current_pick_number, pick_deadline_at
  INTO v_draft.status, v_draft.current_pick_number, v_draft.pick_deadline_at
  FROM public.multiplayer_drafts WHERE id = p_draft_id;

  RETURN jsonb_build_object(
    'status', v_draft.status,
    'current_pick_number', v_draft.current_pick_number,
    'pick_deadline_at', v_draft.pick_deadline_at,
    'actions', v_actions
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_save_results(
  p_draft_id uuid,
  p_results jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft public.multiplayer_drafts%ROWTYPE;
  v_row jsonb;
  v_badge boolean;
BEGIN
  SELECT * INTO v_draft FROM public.multiplayer_drafts WHERE id = p_draft_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found'; END IF;
  IF v_draft.status <> 'completed' THEN RAISE EXCEPTION 'Draft not completed'; END IF;

  IF NOT public.mp_caller_is_participant(p_draft_id, NULL)
     AND v_draft.host_user_id <> auth.uid() THEN
    -- Allow guest via any result row matching later; require participant check with guest in payload
    IF NOT EXISTS (
      SELECT 1 FROM public.multiplayer_draft_participants p
      WHERE p.draft_id = p_draft_id
    ) THEN
      RAISE EXCEPTION 'Not allowed';
    END IF;
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(coalesce(p_results, '[]'::jsonb))
  LOOP
    v_badge := coalesce((v_row->>'badge_awarded')::boolean, false)
      AND (v_row->>'user_id') IS NOT NULL;

    INSERT INTO public.multiplayer_draft_results (
      draft_id, team_number, user_id, guest_session_id,
      grade_letter, grade_score, grade_payload,
      detected_archetype, detected_archetype_index, detected_chaos_archetype,
      badge_awarded
    ) VALUES (
      p_draft_id,
      (v_row->>'team_number')::integer,
      NULLIF(v_row->>'user_id', '')::uuid,
      NULLIF(v_row->>'guest_session_id', ''),
      v_row->>'grade_letter',
      NULLIF(v_row->>'grade_score', '')::numeric,
      coalesce(v_row->'grade_payload', '{}'::jsonb),
      v_row->>'detected_archetype',
      NULLIF(v_row->>'detected_archetype_index', '')::integer,
      v_row->>'detected_chaos_archetype',
      v_badge
    )
    ON CONFLICT (draft_id, team_number) DO UPDATE SET
      grade_letter = EXCLUDED.grade_letter,
      grade_score = EXCLUDED.grade_score,
      grade_payload = EXCLUDED.grade_payload,
      detected_archetype = EXCLUDED.detected_archetype,
      detected_archetype_index = EXCLUDED.detected_archetype_index,
      detected_chaos_archetype = EXCLUDED.detected_chaos_archetype,
      badge_awarded = EXCLUDED.badge_awarded;
  END LOOP;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_replace_keepers(
  p_draft_id uuid,
  p_keepers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft public.multiplayer_drafts%ROWTYPE;
  v_keeper jsonb;
BEGIN
  SELECT * INTO v_draft FROM public.multiplayer_drafts WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found'; END IF;
  IF v_draft.host_user_id <> auth.uid() THEN RAISE EXCEPTION 'Host only'; END IF;
  IF v_draft.status <> 'lobby' THEN RAISE EXCEPTION 'Lobby only'; END IF;

  DELETE FROM public.multiplayer_draft_keepers WHERE draft_id = p_draft_id;

  IF p_keepers IS NOT NULL AND jsonb_typeof(p_keepers) = 'array' THEN
    FOR v_keeper IN SELECT * FROM jsonb_array_elements(p_keepers)
    LOOP
      INSERT INTO public.multiplayer_draft_keepers (draft_id, team_number, player_id, round_number)
      VALUES (
        p_draft_id,
        (v_keeper->>'team_number')::integer,
        (v_keeper->>'player_id')::uuid,
        (v_keeper->>'round_number')::integer
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT SELECT ON public.multiplayer_drafts TO anon, authenticated;
GRANT SELECT ON public.multiplayer_draft_participants TO anon, authenticated;
GRANT SELECT ON public.multiplayer_draft_keepers TO anon, authenticated;
GRANT SELECT ON public.multiplayer_draft_picks TO anon, authenticated;
GRANT SELECT ON public.multiplayer_draft_results TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mp_create_draft TO authenticated;
GRANT EXECUTE ON FUNCTION public.mp_join_draft TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.mp_claim_slot TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.mp_release_slot TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.mp_host_move_kick TO authenticated;
GRANT EXECUTE ON FUNCTION public.mp_set_ready TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.mp_start_draft TO authenticated;
GRANT EXECUTE ON FUNCTION public.mp_make_pick TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.mp_tick_draft TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.mp_save_results TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.mp_replace_keepers TO authenticated;

-- Realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.multiplayer_drafts;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.multiplayer_draft_participants;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.multiplayer_draft_picks;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.multiplayer_draft_keepers;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.multiplayer_draft_results;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
