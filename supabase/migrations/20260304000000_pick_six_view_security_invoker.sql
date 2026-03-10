-- Fix security: v_pick_six_entries_verification was effectively SECURITY DEFINER.
-- Recreate as SECURITY INVOKER so RLS on user_season_predictions applies to the querying user.
DROP VIEW IF EXISTS public.v_pick_six_entries_verification;

CREATE VIEW public.v_pick_six_entries_verification
  WITH (security_invoker = on)
AS
SELECT
  usp.season,
  usp.user_id,
  usp.position,
  usp.rank,
  usp.player_id,
  p.name AS player_name,
  p.team AS player_team,
  ust.tiebreaker_value,
  usp.updated_at
FROM public.user_season_predictions usp
LEFT JOIN public.players p ON p.id = usp.player_id
LEFT JOIN public.user_season_tiebreakers ust
  ON ust.user_id = usp.user_id AND ust.season = usp.season AND ust.position = usp.position;

COMMENT ON VIEW public.v_pick_six_entries_verification IS
  'Pick Six entries with player names and tiebreakers. For verification: SELECT * FROM v_pick_six_entries_verification WHERE season = 2026 ORDER BY user_id, position, rank; compare predicted player_id order to actual results. Use service role to see all users.';
