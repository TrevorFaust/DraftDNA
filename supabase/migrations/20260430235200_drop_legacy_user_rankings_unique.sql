-- The bucket migration only dropped UNIQUE CONSTRAINTS (pg_constraint contype 'u').
-- Legacy schemas often used CREATE UNIQUE INDEX ... user_rankings_user_player_league_unique
-- on (user_id, league_id, player_id) without bucket columns. That blocks saving the same
-- player twice for different buckets (e.g. rookies-only non-SF vs SF).

ALTER TABLE public.user_rankings DROP CONSTRAINT IF EXISTS user_rankings_user_player_league_unique;

DROP INDEX IF EXISTS public.user_rankings_user_player_league_unique;
