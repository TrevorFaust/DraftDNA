-- Daily automated call to Edge Function `sync-player-teams` (Sleeper → players.team / jersey_number).
-- Keeps the manual “Sync player teams” button; this job is the automatic ~24h refresh (fixed UTC time = once per calendar day).
--
-- PREREQUISITES (Supabase Dashboard → Database):
--   1) Extensions: enable `pg_cron` and `pg_net`.
--   2) Vault secrets (SQL editor or Vault UI). Use your real values:
--        `project_url` MUST be the project root only (Project Settings → API → URL): https://YOUR_REF.supabase.co
--        Do NOT append /rest/v1, /v1, or /functions — that breaks the path and PostgREST returns PGRST125 "Invalid path".
--        SELECT vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
--        SELECT vault.create_secret('YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY', 'publishable_key');
--        SELECT vault.create_secret('SAME_STRING_AS_EDGE_SECRET_SYNC_PLAYER_TEAMS_SECRET', 'sync_player_teams_cron_secret');
--      Edge Functions → `sync-player-teams` → secret `SYNC_PLAYER_TEAMS_SECRET` must equal `sync_player_teams_cron_secret`.
--   3) Season in the JSON body below should match `DEFAULT_SEASON` in `src/components/admin/SyncPlayersButton.tsx` when you bump years.
--
-- After `vault` secrets exist, run this migration (or re-run the DO block in SQL editor if you added secrets later).

DO $$
DECLARE
  jid bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'player_teams_daily_cron: pg_cron is not enabled — skipping. Enable Database → Extensions → pg_cron, then re-apply this migration or run the schedule block manually.';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'player_teams_daily_cron: pg_net is not enabled — skipping. Enable Database → Extensions → pg_net.';
    RETURN;
  END IF;

  FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'player_teams_sleeper_daily'
  LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;

  PERFORM cron.schedule(
    'player_teams_sleeper_daily',
    '0 11 * * *',
    $CRON$
SELECT net.http_post(
  url := trim(trailing '/' FROM (SELECT decrypted_secret::text FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1))
    || '/functions/v1/sync-player-teams',
  body := '{"season": 2025}'::jsonb,
  params := '{}'::jsonb,
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (SELECT decrypted_secret::text FROM vault.decrypted_secrets WHERE name = 'publishable_key' LIMIT 1),
    'apikey', (SELECT decrypted_secret::text FROM vault.decrypted_secrets WHERE name = 'publishable_key' LIMIT 1),
    'x-sync-secret', (SELECT decrypted_secret::text FROM vault.decrypted_secrets WHERE name = 'sync_player_teams_cron_secret' LIMIT 1)
  ),
  timeout_milliseconds := 600000
);
$CRON$
  );
END $$;
