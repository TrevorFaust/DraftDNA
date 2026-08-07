-- Expire RPC returns server_now so clients can sync the 10-minute idle countdown.

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
  SET status = 'cancelled',
      completed_at = coalesce(completed_at, v_now)
  WHERE status = 'lobby'
    AND visibility = 'open'
    AND lobby_last_activity_at < v_now - interval '10 minutes';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'expired_count', v_count,
    'server_now', v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mp_expire_stale_open_lobbies() TO authenticated, anon;
