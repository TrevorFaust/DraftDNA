-- Members may only write their claimed team's lineup. Commissioner writes the full board.

REVOKE INSERT, UPDATE ON public.league_ranker_rosters FROM authenticated;

DROP POLICY IF EXISTS "Members can insert ranker rosters" ON public.league_ranker_rosters;
DROP POLICY IF EXISTS "Members can update ranker rosters" ON public.league_ranker_rosters;

CREATE OR REPLACE FUNCTION public.league_save_ranker_rosters(
  p_league_id uuid,
  p_teams jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_team integer;
  v_existing jsonb;
  v_teams jsonb;
  v_slot jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to save rosters';
  END IF;
  IF p_teams IS NULL OR jsonb_typeof(p_teams) <> 'array' THEN
    RAISE EXCEPTION 'Roster payload is invalid';
  END IF;
  IF NOT (public.is_league_member(p_league_id) OR public.is_league_owner(p_league_id)) THEN
    RAISE EXCEPTION 'You are not in this league';
  END IF;

  IF public.is_league_owner(p_league_id) THEN
    INSERT INTO public.league_ranker_rosters (league_id, payload, updated_at, updated_by)
    VALUES (
      p_league_id,
      jsonb_build_object('teams', p_teams),
      now(),
      v_uid
    )
    ON CONFLICT (league_id) DO UPDATE
    SET
      payload = jsonb_build_object('teams', p_teams),
      updated_at = now(),
      updated_by = v_uid;
    RETURN;
  END IF;

  SELECT m.team_number INTO v_team
  FROM public.league_members m
  WHERE m.league_id = p_league_id AND m.user_id = v_uid;

  IF v_team IS NULL THEN
    RAISE EXCEPTION 'Claim a team before you change a lineup';
  END IF;

  SELECT r.payload INTO v_existing
  FROM public.league_ranker_rosters r
  WHERE r.league_id = p_league_id;

  v_teams := COALESCE(v_existing -> 'teams', '[]'::jsonb);
  IF jsonb_typeof(v_teams) <> 'array' THEN
    v_teams := '[]'::jsonb;
  END IF;

  WHILE jsonb_array_length(v_teams) < v_team LOOP
    v_teams := v_teams || '[[]]'::jsonb;
  END LOOP;

  v_slot := p_teams -> (v_team - 1);
  IF v_slot IS NULL OR jsonb_typeof(v_slot) <> 'array' THEN
    RAISE EXCEPTION 'Missing your roster';
  END IF;

  v_teams := jsonb_set(v_teams, ARRAY[(v_team - 1)::text], v_slot, true);

  INSERT INTO public.league_ranker_rosters (league_id, payload, updated_at, updated_by)
  VALUES (
    p_league_id,
    COALESCE(v_existing, '{}'::jsonb) || jsonb_build_object('teams', v_teams),
    now(),
    v_uid
  )
  ON CONFLICT (league_id) DO UPDATE
  SET
    payload = EXCLUDED.payload,
    updated_at = now(),
    updated_by = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.league_save_ranker_rosters(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.league_save_ranker_rosters(uuid, jsonb) TO authenticated;
