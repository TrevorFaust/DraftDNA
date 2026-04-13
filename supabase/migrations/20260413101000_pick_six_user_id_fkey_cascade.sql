-- Remove Pick Six rows for deleted auth users (orphans), then tie user_id to auth.users so
-- auth.admin.deleteUser cascades predictions and tiebreakers.

DELETE FROM public.user_season_tiebreakers ust
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ust.user_id);

DELETE FROM public.user_season_predictions usp
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = usp.user_id);

DO $$
BEGIN
  ALTER TABLE public.user_season_predictions
    ADD CONSTRAINT user_season_predictions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.user_season_tiebreakers
    ADD CONSTRAINT user_season_tiebreakers_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
