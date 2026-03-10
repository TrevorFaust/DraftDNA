-- Tiebreakers for Pick Six Challenge: one value per (user, season, position) for the #1 pick.
-- Used when two or more users have the same picks and tie for the win.
-- QB: passing yards, RB: rushing yards, WR/TE: receiving yards, K: field goals, D/ST: points allowed.

CREATE TABLE IF NOT EXISTS public.user_season_tiebreakers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  season integer NOT NULL CHECK (season >= 2020 AND season <= 2030),
  position text NOT NULL CHECK (position IN ('QB', 'RB', 'WR', 'TE', 'K', 'D/ST')),
  tiebreaker_value numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, season, position)
);

CREATE INDEX IF NOT EXISTS idx_user_season_tiebreakers_user_season
  ON public.user_season_tiebreakers(user_id, season);

-- RLS: users can only manage their own tiebreakers
ALTER TABLE public.user_season_tiebreakers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own season tiebreakers"
  ON public.user_season_tiebreakers
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_user_season_tiebreakers_updated_at ON public.user_season_tiebreakers;
CREATE TRIGGER set_user_season_tiebreakers_updated_at
  BEFORE UPDATE ON public.user_season_tiebreakers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
