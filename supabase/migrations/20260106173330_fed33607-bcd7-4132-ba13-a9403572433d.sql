-- Add position limits to leagues table
ALTER TABLE public.leagues
ADD COLUMN position_limits jsonb DEFAULT '{"QB": 4, "RB": 8, "WR": 8, "TE": 3, "K": 3, "DEF": 3}'::jsonb;

-- Create league_teams table for storing team names
CREATE TABLE public.league_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  team_number integer NOT NULL,
  team_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(league_id, team_number)
);

-- Enable RLS
ALTER TABLE public.league_teams ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - users can only access teams in their own leagues
CREATE POLICY "Users can view teams in their leagues"
ON public.league_teams
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.leagues
  WHERE leagues.id = league_teams.league_id
  AND leagues.user_id = auth.uid()
));

CREATE POLICY "Users can insert teams in their leagues"
ON public.league_teams
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.leagues
  WHERE leagues.id = league_teams.league_id
  AND leagues.user_id = auth.uid()
));

CREATE POLICY "Users can update teams in their leagues"
ON public.league_teams
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.leagues
  WHERE leagues.id = league_teams.league_id
  AND leagues.user_id = auth.uid()
));

CREATE POLICY "Users can delete teams in their leagues"
ON public.league_teams
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.leagues
  WHERE leagues.id = league_teams.league_id
  AND leagues.user_id = auth.uid()
));