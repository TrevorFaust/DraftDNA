-- Empty 2026 weekly stats table, same shape as 2025, ready for nflverse ingest at kickoff.
CREATE TABLE IF NOT EXISTS public.weekly_stats_2026 (
  LIKE public.weekly_stats_2025 INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING COMMENTS
);

CREATE INDEX IF NOT EXISTS idx_weekly_stats_2026_season_week_player
  ON public.weekly_stats_2026 (season, week, player_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_weekly_stats_2026_player_season_week_type
  ON public.weekly_stats_2026 (player_id, season, week, season_type);

ALTER TABLE public.weekly_stats_2026 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.weekly_stats_2026;
CREATE POLICY "Allow public read access"
  ON public.weekly_stats_2026
  FOR SELECT
  TO public
  USING (true);

GRANT SELECT ON public.weekly_stats_2026 TO anon, authenticated;

COMMENT ON TABLE public.weekly_stats_2026 IS
  '2026 weekly player stats (nflverse stats_player_week). Empty until season starts; sync via scripts/sync-weekly-stats-2026-from-nflverse.ts';
