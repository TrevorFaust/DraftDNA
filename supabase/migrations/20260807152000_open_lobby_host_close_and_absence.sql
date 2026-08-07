-- Host can close a lobby immediately. Open lobbies also cancel if the host is away 10+ minutes
-- (even when other players are still active).

ALTER TABLE public.multiplayer_drafts
  ADD COLUMN IF NOT EXISTS host_absent_since timestamptz NULL;

ALTER TABLE public.multiplayer_drafts
  ADD COLUMN IF NOT EXISTS cancel_reason text NULL;

CREATE OR REPLACE FUNCTION public.mp_set_host_presence(
  p_draft_id uuid,
  p_present boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft public.multiplayer_drafts%ROWTYPE;
BEGIN
  SELECT * INTO v_draft
  FROM public.multiplayer_drafts
  WHERE id = p_draft_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;
  IF v_draft.host_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Host only';
  END IF;
  IF v_draft.status <> 'lobby' THEN
    RETURN jsonb_build_object('ok', true, 'status', v_draft.status);
  END IF;

  IF coalesce(p_present, false) THEN
    -- Do not bump lobby_last_activity_at — idle timeout stays independent of presence.
    UPDATE public.multiplayer_drafts
    SET host_absent_since = NULL
    WHERE id = p_draft_id
    RETURNING * INTO v_draft;
  ELSE
    UPDATE public.multiplayer_drafts
    SET host_absent_since = coalesce(host_absent_since, now())
    WHERE id = p_draft_id
    RETURNING * INTO v_draft;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'present', coalesce(p_present, false),
    'host_absent_since', v_draft.host_absent_since
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mp_set_host_presence(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.mp_close_lobby(p_draft_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft public.multiplayer_drafts%ROWTYPE;
  v_now timestamptz := clock_timestamp();
BEGIN
  SELECT * INTO v_draft
  FROM public.multiplayer_drafts
  WHERE id = p_draft_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;
  IF v_draft.host_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Host only';
  END IF;
  IF v_draft.status <> 'lobby' THEN
    RAISE EXCEPTION 'Lobby is not open';
  END IF;

  UPDATE public.multiplayer_drafts
  SET
    status = 'cancelled',
    completed_at = coalesce(completed_at, v_now),
    cancel_reason = 'host_closed',
    host_absent_since = NULL
  WHERE id = p_draft_id
  RETURNING * INTO v_draft;

  RETURN jsonb_build_object(
    'ok', true,
    'draft_id', v_draft.id,
    'status', v_draft.status,
    'cancel_reason', v_draft.cancel_reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mp_close_lobby(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.mp_expire_stale_open_lobbies();

CREATE FUNCTION public.mp_expire_stale_open_lobbies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_now timestamptz := clock_timestamp();
BEGIN
  UPDATE public.multiplayer_drafts
  SET
    status = 'cancelled',
    completed_at = coalesce(completed_at, v_now),
    cancel_reason = CASE
      WHEN host_absent_since IS NOT NULL
        AND host_absent_since < v_now - interval '10 minutes'
        THEN 'host_absent'
      ELSE 'idle'
    END,
    host_absent_since = NULL
  WHERE status = 'lobby'
    AND visibility = 'open'
    AND (
      lobby_last_activity_at < v_now - interval '10 minutes'
      OR (
        host_absent_since IS NOT NULL
        AND host_absent_since < v_now - interval '10 minutes'
      )
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'expired_count', v_count,
    'server_now', v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mp_expire_stale_open_lobbies() TO authenticated, anon;

-- Keep list in sync with host-absence expiry (still calls expire first).
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
  lobby_last_activity_at timestamptz,
  host_absent_since timestamptz
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
    d.lobby_last_activity_at,
    d.host_absent_since
  FROM public.multiplayer_drafts d
  WHERE d.status = 'lobby'
    AND d.visibility = 'open'
    AND d.lobby_last_activity_at >= now() - interval '10 minutes'
    AND (
      d.host_absent_since IS NULL
      OR d.host_absent_since >= now() - interval '10 minutes'
    )
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
