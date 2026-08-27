-- Shared Team Rankings rosters so every member sees the same starters and bench.

CREATE TABLE IF NOT EXISTS public.league_ranker_rosters (
  league_id uuid PRIMARY KEY REFERENCES public.leagues(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.league_ranker_rosters ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.league_ranker_rosters TO authenticated;

DROP POLICY IF EXISTS "Members can view ranker rosters" ON public.league_ranker_rosters;
CREATE POLICY "Members can view ranker rosters"
  ON public.league_ranker_rosters FOR SELECT TO authenticated
  USING (public.is_league_member(league_id) OR public.is_league_owner(league_id));

DROP POLICY IF EXISTS "Members can insert ranker rosters" ON public.league_ranker_rosters;
CREATE POLICY "Members can insert ranker rosters"
  ON public.league_ranker_rosters FOR INSERT TO authenticated
  WITH CHECK (public.is_league_member(league_id) OR public.is_league_owner(league_id));

DROP POLICY IF EXISTS "Members can update ranker rosters" ON public.league_ranker_rosters;
CREATE POLICY "Members can update ranker rosters"
  ON public.league_ranker_rosters FOR UPDATE TO authenticated
  USING (public.is_league_member(league_id) OR public.is_league_owner(league_id))
  WITH CHECK (public.is_league_member(league_id) OR public.is_league_owner(league_id));

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.league_ranker_rosters;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
