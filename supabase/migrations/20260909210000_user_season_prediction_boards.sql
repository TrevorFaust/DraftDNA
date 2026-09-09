-- Cloud sync for Season Predictions (picks, bracket, awards) per signed-in user.

CREATE TABLE IF NOT EXISTS public.user_season_prediction_boards (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  season integer NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, season)
);

CREATE INDEX IF NOT EXISTS idx_user_season_prediction_boards_updated
  ON public.user_season_prediction_boards (updated_at DESC);

ALTER TABLE public.user_season_prediction_boards ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_season_prediction_boards TO authenticated;

DROP POLICY IF EXISTS "Users can read own season prediction boards" ON public.user_season_prediction_boards;
CREATE POLICY "Users can read own season prediction boards"
  ON public.user_season_prediction_boards FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own season prediction boards" ON public.user_season_prediction_boards;
CREATE POLICY "Users can insert own season prediction boards"
  ON public.user_season_prediction_boards FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own season prediction boards" ON public.user_season_prediction_boards;
CREATE POLICY "Users can update own season prediction boards"
  ON public.user_season_prediction_boards FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own season prediction boards" ON public.user_season_prediction_boards;
CREATE POLICY "Users can delete own season prediction boards"
  ON public.user_season_prediction_boards FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
