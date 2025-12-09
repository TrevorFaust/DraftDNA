-- Drop the old unique constraint that doesn't include league_id
ALTER TABLE public.user_rankings DROP CONSTRAINT IF EXISTS user_rankings_user_id_player_id_key;

-- Ensure the new constraint exists (recreate if needed)
ALTER TABLE public.user_rankings DROP CONSTRAINT IF EXISTS user_rankings_user_player_league_unique;
ALTER TABLE public.user_rankings ADD CONSTRAINT user_rankings_user_player_league_unique UNIQUE (user_id, player_id, league_id);