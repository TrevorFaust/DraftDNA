-- Season long prediction challenge: users submit top N players per position for a given season.
-- One row per (user, season, position, rank) with player_id.

CREATE TABLE IF NOT EXISTS public.user_season_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  season integer NOT NULL CHECK (season >= 2020 AND season <= 2030),
  position text NOT NULL CHECK (position IN ('QB', 'RB', 'WR', 'TE', 'K', 'D/ST')),
  rank integer NOT NULL CHECK (rank >= 1 AND rank <= 6),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, season, position, rank)
);

CREATE INDEX IF NOT EXISTS idx_user_season_predictions_user_season
  ON public.user_season_predictions(user_id, season);

CREATE INDEX IF NOT EXISTS idx_user_season_predictions_player_id
  ON public.user_season_predictions(player_id);

-- RLS: users can only read/insert/update/delete their own predictions
ALTER TABLE public.user_season_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own season predictions"
  ON public.user_season_predictions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Optional: keep updated_at in sync
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_user_season_predictions_updated_at ON public.user_season_predictions;
CREATE TRIGGER set_user_season_predictions_updated_at
  BEFORE UPDATE ON public.user_season_predictions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
