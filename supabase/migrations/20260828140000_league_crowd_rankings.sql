-- League crowd rankings: members fetch vote payloads; aggregation runs client-side with self-rank excluded.

CREATE OR REPLACE FUNCTION public.fetch_league_crowd_ranking_votes(p_league_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_votes jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (public.is_league_member(p_league_id) OR public.is_league_owner(p_league_id)) THEN
    RAISE EXCEPTION 'Not a league member';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'team_number', lm.team_number,
        'payload', lr.payload
      )
      ORDER BY lm.joined_at NULLS LAST, lm.user_id
    ),
    '[]'::jsonb
  )
  INTO v_votes
  FROM public.league_team_rankings lr
  INNER JOIN public.league_members lm
    ON lm.league_id = lr.league_id AND lm.user_id = lr.user_id
  WHERE lr.league_id = p_league_id
    AND lr.payload IS NOT NULL;

  RETURN jsonb_build_object('votes', v_votes);
END;
$$;

REVOKE ALL ON FUNCTION public.fetch_league_crowd_ranking_votes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fetch_league_crowd_ranking_votes(uuid) TO authenticated;
