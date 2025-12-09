-- Create table for player game stats (past performance)
CREATE TABLE public.player_game_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  week INTEGER NOT NULL,
  opponent TEXT NOT NULL,
  fantasy_points NUMERIC(6,2) DEFAULT 0,
  passing_yards INTEGER DEFAULT 0,
  passing_tds INTEGER DEFAULT 0,
  interceptions INTEGER DEFAULT 0,
  rushing_yards INTEGER DEFAULT 0,
  rushing_tds INTEGER DEFAULT 0,
  rushing_attempts INTEGER DEFAULT 0,
  receptions INTEGER DEFAULT 0,
  receiving_yards INTEGER DEFAULT 0,
  receiving_tds INTEGER DEFAULT 0,
  targets INTEGER DEFAULT 0,
  fumbles INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(player_id, season, week)
);

-- Create table for NFL schedule (future games)
CREATE TABLE public.nfl_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season INTEGER NOT NULL,
  week INTEGER NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  game_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(season, week, home_team, away_team)
);

-- Enable RLS
ALTER TABLE public.player_game_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfl_schedule ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view stats and schedule (public data)
CREATE POLICY "Anyone can view player game stats" 
ON public.player_game_stats 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can view NFL schedule" 
ON public.nfl_schedule 
FOR SELECT 
USING (true);

-- Create indexes for performance
CREATE INDEX idx_player_game_stats_player_id ON public.player_game_stats(player_id);
CREATE INDEX idx_player_game_stats_season_week ON public.player_game_stats(season, week);
CREATE INDEX idx_nfl_schedule_team ON public.nfl_schedule(home_team, away_team);
CREATE INDEX idx_nfl_schedule_season_week ON public.nfl_schedule(season, week);