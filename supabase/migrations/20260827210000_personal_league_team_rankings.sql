-- Personal team-rankings boards. Each member ranks rooms independently.

ALTER TABLE public.league_team_rankings
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

UPDATE public.league_team_rankings r
SET user_id = COALESCE(r.updated_by, l.user_id)
FROM public.leagues l
WHERE l.id = r.league_id
  AND r.user_id IS NULL;

DELETE FROM public.league_team_rankings
WHERE user_id IS NULL;

ALTER TABLE public.league_team_rankings
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.league_team_rankings
  DROP CONSTRAINT IF EXISTS league_team_rankings_pkey;

ALTER TABLE public.league_team_rankings
  ADD PRIMARY KEY (league_id, user_id);

CREATE INDEX IF NOT EXISTS idx_league_team_rankings_user
  ON public.league_team_rankings(user_id);

DROP POLICY IF EXISTS "Members can view league team rankings" ON public.league_team_rankings;
DROP POLICY IF EXISTS "Owners can insert league team rankings" ON public.league_team_rankings;
DROP POLICY IF EXISTS "Owners can update league team rankings" ON public.league_team_rankings;
DROP POLICY IF EXISTS "Owners can delete league team rankings" ON public.league_team_rankings;

CREATE POLICY "Members can view own or commissioner team rankings"
  ON public.league_team_rankings FOR SELECT TO authenticated
  USING (
    (public.is_league_member(league_id) OR public.is_league_owner(league_id))
    AND (
      user_id = auth.uid()
      OR user_id = (SELECT l.user_id FROM public.leagues l WHERE l.id = league_id)
    )
  );

CREATE POLICY "Members can insert own team rankings"
  ON public.league_team_rankings FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (public.is_league_member(league_id) OR public.is_league_owner(league_id))
  );

CREATE POLICY "Members can update own team rankings"
  ON public.league_team_rankings FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND (public.is_league_member(league_id) OR public.is_league_owner(league_id))
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (public.is_league_member(league_id) OR public.is_league_owner(league_id))
  );

CREATE POLICY "Members can delete own team rankings"
  ON public.league_team_rankings FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND (public.is_league_member(league_id) OR public.is_league_owner(league_id))
  );
