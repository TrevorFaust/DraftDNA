-- Allow get_player_2025_season_stats (and other heavy RPCs) to run up to 60s for anon/authenticated.
-- Default is 3s for anon and 8s for authenticated; this avoids "canceling statement due to statement timeout".
-- See: https://supabase.com/docs/guides/database/postgres/timeouts

ALTER ROLE anon SET statement_timeout = '60s';
ALTER ROLE authenticated SET statement_timeout = '60s';

-- Indexes to speed up get_player_2025_season_stats so it often finishes well under 60s.
CREATE INDEX IF NOT EXISTS idx_weekly_stats_2025_season_week_player
  ON public.weekly_stats_2025 (season, week, player_id);

CREATE INDEX IF NOT EXISTS idx_players_espn_id_season
  ON public.players (espn_id, season);

-- Tell PostgREST to reload role config (optional; next request will use new timeout either way).
NOTIFY pgrst, 'reload config';
