-- For existing installs: change rank check from top 10 to top 6
ALTER TABLE public.user_season_predictions
  DROP CONSTRAINT IF EXISTS user_season_predictions_rank_check;

ALTER TABLE public.user_season_predictions
  ADD CONSTRAINT user_season_predictions_rank_check CHECK (rank >= 1 AND rank <= 6);
