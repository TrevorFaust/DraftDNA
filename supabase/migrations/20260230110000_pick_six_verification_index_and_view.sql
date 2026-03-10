-- Pick Six Challenge: index and view for reliable save/override and end-of-season verification.
-- Entries are stored in user_season_predictions (one row per user/season/position/rank 1-6).
-- On edit, the app deletes all rows for that (user, season, position) then inserts the new 6 rows,
-- so each user has exactly one entry per position group (counted by distinct position in leaderboard).

-- Index for fast "all predictions for a season/position" queries (verification export).
CREATE INDEX IF NOT EXISTS idx_user_season_predictions_season_position
  ON public.user_season_predictions(season, position);

-- View for easy end-of-season verification: one row per prediction with player name.
-- Use with service role to export all entries: SELECT * FROM v_pick_six_entries_verification WHERE season = 2026 ORDER BY user_id, position, rank;
-- RLS on user_season_predictions applies to this view, so clients only see their own rows.
CREATE OR REPLACE VIEW public.v_pick_six_entries_verification AS
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
