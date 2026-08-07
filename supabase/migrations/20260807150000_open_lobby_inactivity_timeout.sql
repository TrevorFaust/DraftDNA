-- Open lobbies auto-cancel after 10 minutes without join/leave/seat/ready/chat/rename activity.

ALTER TABLE public.multiplayer_drafts
  ADD COLUMN IF NOT EXISTS lobby_last_activity_at timestamptz NOT NULL DEFAULT now();

UPDATE public.multiplayer_drafts
SET lobby_last_activity_at = coalesce(lobby_last_activity_at, created_at, now())
WHERE lobby_last_activity_at IS NULL;

CREATE OR REPLACE FUNCTION public.mp_touch_lobby_activity(p_draft_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.multiplayer_drafts
  SET lobby_last_activity_at = now()
  WHERE id = p_draft_id
    AND status = 'lobby';
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_touch_lobby_activity_from_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft_id uuid;
BEGIN
  v_draft_id := coalesce(NEW.draft_id, OLD.draft_id);
  PERFORM public.mp_touch_lobby_activity(v_draft_id);
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mp_touch_lobby_activity_participants
  ON public.multiplayer_draft_participants;
CREATE TRIGGER trg_mp_touch_lobby_activity_participants
  AFTER INSERT OR UPDATE OR DELETE ON public.multiplayer_draft_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.mp_touch_lobby_activity_from_participant();

CREATE OR REPLACE FUNCTION public.mp_touch_lobby_activity_from_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.mp_touch_lobby_activity(NEW.draft_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mp_touch_lobby_activity_messages
  ON public.multiplayer_draft_messages;
CREATE TRIGGER trg_mp_touch_lobby_activity_messages
  AFTER INSERT ON public.multiplayer_draft_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.mp_touch_lobby_activity_from_message();

-- Team rename updates the draft row directly (not participants).
CREATE OR REPLACE FUNCTION public.mp_set_team_name(
  p_draft_id uuid,
  p_team_number integer,
  p_team_name text,
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
  v_is_host boolean := false;
  v_name text;
BEGIN
  SELECT * INTO v_draft
  FROM public.multiplayer_drafts
  WHERE id = p_draft_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found'; END IF;
  IF v_draft.status <> 'lobby' THEN
    RAISE EXCEPTION 'Team names can only be changed in the lobby';
  END IF;
  IF p_team_number IS NULL OR p_team_number < 1 OR p_team_number > v_draft.num_teams THEN
    RAISE EXCEPTION 'Invalid team number';
  END IF;

  v_is_host := v_draft.host_user_id IS NOT NULL AND v_draft.host_user_id = auth.uid();

  SELECT * INTO v_participant
  FROM public.multiplayer_draft_participants
  WHERE draft_id = p_draft_id
    AND (
      (auth.uid() IS NOT NULL AND user_id = auth.uid())
      OR (p_guest_session_id IS NOT NULL AND guest_session_id = p_guest_session_id)
    )
  LIMIT 1;

  IF NOT v_is_host THEN
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Join the lobby first';
    END IF;
    IF v_participant.team_number IS DISTINCT FROM p_team_number THEN
      RAISE EXCEPTION 'You can only rename your own seat';
    END IF;
  END IF;

  v_name := left(trim(coalesce(p_team_name, '')), 40);
  IF v_name = '' THEN
    v_name := 'Team ' || p_team_number::text;
  END IF;

  UPDATE public.multiplayer_drafts
  SET
    team_names = jsonb_set(
      coalesce(team_names, '{}'::jsonb),
      ARRAY[p_team_number::text],
      to_jsonb(v_name),
      true
    ),
    lobby_last_activity_at = now()
  WHERE id = p_draft_id
  RETURNING * INTO v_draft;

  RETURN jsonb_build_object(
    'ok', true,
    'team_number', p_team_number,
    'team_name', v_name,
    'team_names', v_draft.team_names
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mp_set_team_name(uuid, integer, text, text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.mp_expire_stale_open_lobbies()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.multiplayer_drafts
  SET status = 'cancelled',
      completed_at = coalesce(completed_at, now())
  WHERE status = 'lobby'
    AND visibility = 'open'
    AND lobby_last_activity_at < now() - interval '10 minutes';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mp_expire_stale_open_lobbies() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.mp_touch_lobby_activity(uuid) TO authenticated, anon;

-- List renews by expiring stale rooms first; expose activity for client countdown.
-- Drop first: return columns changed vs prior signature.
DROP FUNCTION IF EXISTS public.mp_list_open_lobbies(integer);

CREATE FUNCTION public.mp_list_open_lobbies(
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
  created_at timestamptz,
  lobby_last_activity_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.mp_expire_stale_open_lobbies();

  RETURN QUERY
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
    d.created_at,
    d.lobby_last_activity_at
  FROM public.multiplayer_drafts d
  WHERE d.status = 'lobby'
    AND d.visibility = 'open'
    AND d.lobby_last_activity_at >= now() - interval '10 minutes'
    AND (
      SELECT count(*)
      FROM public.multiplayer_draft_participants p
      WHERE p.draft_id = d.id
        AND p.team_number IS NOT NULL
    ) < d.num_teams
  ORDER BY d.created_at DESC
  LIMIT least(greatest(coalesce(p_limit, 40), 1), 100);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mp_list_open_lobbies(integer) TO authenticated, anon;

-- Let clients detect inactivity cancels (previously SELECT hid cancelled rows).
DROP POLICY IF EXISTS mp_drafts_select ON public.multiplayer_drafts;
CREATE POLICY mp_drafts_select ON public.multiplayer_drafts
  FOR SELECT USING (status IN ('lobby', 'drafting', 'completed', 'cancelled'));

DROP POLICY IF EXISTS mp_participants_select ON public.multiplayer_draft_participants;
CREATE POLICY mp_participants_select ON public.multiplayer_draft_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.multiplayer_drafts d
      WHERE d.id = draft_id AND d.status IN ('lobby', 'drafting', 'completed', 'cancelled')
    )
  );

DROP POLICY IF EXISTS mp_messages_select ON public.multiplayer_draft_messages;
CREATE POLICY mp_messages_select ON public.multiplayer_draft_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.multiplayer_drafts d
      WHERE d.id = draft_id AND d.status IN ('lobby', 'drafting', 'completed', 'cancelled')
    )
  );
