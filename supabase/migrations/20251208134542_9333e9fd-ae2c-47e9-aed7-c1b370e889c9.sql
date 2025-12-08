-- Add league_id column to user_rankings table (nullable for backwards compatibility)
ALTER TABLE public.user_rankings 
ADD COLUMN league_id uuid REFERENCES public.leagues(id) ON DELETE CASCADE;

-- Create unique constraint for user + player + league combination
ALTER TABLE public.user_rankings 
DROP CONSTRAINT IF EXISTS user_rankings_pkey;

-- Add new primary key
ALTER TABLE public.user_rankings 
ADD CONSTRAINT user_rankings_pkey PRIMARY KEY (id);

-- Add unique constraint to prevent duplicate rankings per player per league
ALTER TABLE public.user_rankings 
ADD CONSTRAINT user_rankings_user_player_league_unique 
UNIQUE (user_id, player_id, league_id);

-- Create index for faster league-based queries
CREATE INDEX idx_user_rankings_league_id ON public.user_rankings(league_id);
CREATE INDEX idx_user_rankings_user_league ON public.user_rankings(user_id, league_id);