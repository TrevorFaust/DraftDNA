-- Show league size, scoring, and owner on the public join page.

CREATE OR REPLACE FUNCTION public.league_preview_invite(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_code text := upper(trim(p_code));
  v_id uuid;
  v_name text;
  v_num_teams integer;
  v_scoring text;
  v_league_type text;
  v_superflex boolean;
  v_owner text;
  v_members integer;
BEGIN
  IF v_code IS NULL OR v_code = '' THEN
    RAISE EXCEPTION 'Invite code is missing';
  END IF;

  SELECT
    l.id,
    l.name,
    l.num_teams,
    l.scoring_format,
    l.league_type,
    l.is_superflex
  INTO
    v_id,
    v_name,
    v_num_teams,
    v_scoring,
    v_league_type,
    v_superflex
  FROM public.league_invites i
  JOIN public.leagues l ON l.id = i.league_id
  WHERE i.code = v_code;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'That invite link is invalid or expired';
  END IF;

  SELECT COALESCE(p.username, 'Commissioner')
  INTO v_owner
  FROM public.leagues l
  LEFT JOIN public.profiles p ON p.id = l.user_id
  WHERE l.id = v_id;

  SELECT count(*)::int
  INTO v_members
  FROM public.league_members
  WHERE league_id = v_id;

  RETURN jsonb_build_object(
    'league_id', v_id,
    'name', v_name,
    'already_member', CASE
      WHEN auth.uid() IS NULL THEN false
      ELSE EXISTS (
        SELECT 1 FROM public.league_members
        WHERE league_id = v_id AND user_id = auth.uid()
      )
    END,
    'num_teams', v_num_teams,
    'scoring_format', v_scoring,
    'league_type', v_league_type,
    'is_superflex', COALESCE(v_superflex, false),
    'owner_username', v_owner,
    'member_count', v_members
  );
END;
$$;
