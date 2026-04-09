-- Sleeper API player_id for stable references and team/roster sync.
-- Backfill example (adjust season/join as needed):
--   UPDATE public.players p
--   SET sleeper_id = c.sleeper_id
--   FROM public.players_clean c
--   WHERE p.sleeper_id IS NULL
--     AND c.sleeper_id IS NOT NULL
--     AND c.espn_id IS NOT NULL
--     AND p.espn_id::text = c.espn_id;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS sleeper_id text;

COMMENT ON COLUMN public.players.sleeper_id IS 'Sleeper fantasy API player_id; use for sync and external lookups.';

CREATE UNIQUE INDEX IF NOT EXISTS players_sleeper_id_unique
  ON public.players (sleeper_id)
  WHERE sleeper_id IS NOT NULL;
