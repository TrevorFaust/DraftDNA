-- Shared team-rankings board. Members can read; only the league owner can write.

CREATE TABLE IF NOT EXISTS public.league_team_rankings (
  league_id uuid PRIMARY KEY REFERENCES public.leagues(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.league_team_rankings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_team_rankings TO authenticated;

DROP POLICY IF EXISTS "Members can view league team rankings" ON public.league_team_rankings;
CREATE POLICY "Members can view league team rankings"
  ON public.league_team_rankings FOR SELECT TO authenticated
  USING (public.is_league_member(league_id) OR public.is_league_owner(league_id));

DROP POLICY IF EXISTS "Owners can insert league team rankings" ON public.league_team_rankings;
CREATE POLICY "Owners can insert league team rankings"
  ON public.league_team_rankings FOR INSERT TO authenticated
  WITH CHECK (public.is_league_owner(league_id));

DROP POLICY IF EXISTS "Owners can update league team rankings" ON public.league_team_rankings;
CREATE POLICY "Owners can update league team rankings"
  ON public.league_team_rankings FOR UPDATE TO authenticated
  USING (public.is_league_owner(league_id))
  WITH CHECK (public.is_league_owner(league_id));

DROP POLICY IF EXISTS "Owners can delete league team rankings" ON public.league_team_rankings;
CREATE POLICY "Owners can delete league team rankings"
  ON public.league_team_rankings FOR DELETE TO authenticated
  USING (public.is_league_owner(league_id));
