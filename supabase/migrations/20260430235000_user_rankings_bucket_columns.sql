-- Store scoring/league/superflex/rookies bucket on each user_rankings row so changing league
-- settings does not reuse rankings saved under a different bucket.

ALTER TABLE public.user_rankings
  ADD COLUMN IF NOT EXISTS scoring_format text NOT NULL DEFAULT 'ppr',
  ADD COLUMN IF NOT EXISTS league_type text NOT NULL DEFAULT 'season',
  ADD COLUMN IF NOT EXISTS is_superflex boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rookies_only boolean NOT NULL DEFAULT false;

UPDATE public.user_rankings ur
SET
  scoring_format = COALESCE(l.scoring_format, 'ppr'),
  league_type = COALESCE(l.league_type, 'season'),
  is_superflex = COALESCE(l.is_superflex, false),
  rookies_only = COALESCE(l.rookies_only, false)
FROM public.leagues l
WHERE ur.league_id = l.id;

-- Rows with league_id NULL keep defaults (legacy global saves); callers now set explicit bucket columns.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'user_rankings'
      AND c.contype = 'u'
  ) LOOP
    EXECUTE format('ALTER TABLE public.user_rankings DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- Legacy name (often a UNIQUE INDEX, not a table constraint — skipped by the loop above)
ALTER TABLE public.user_rankings DROP CONSTRAINT IF EXISTS user_rankings_user_player_league_unique;
DROP INDEX IF EXISTS public.user_rankings_user_player_league_unique;

CREATE UNIQUE INDEX IF NOT EXISTS user_rankings_league_bucket_player_uidx
  ON public.user_rankings (user_id, league_id, player_id, scoring_format, league_type, is_superflex, rookies_only)
  WHERE league_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_rankings_null_league_bucket_player_uidx
  ON public.user_rankings (user_id, player_id, scoring_format, league_type, is_superflex, rookies_only)
  WHERE league_id IS NULL;
