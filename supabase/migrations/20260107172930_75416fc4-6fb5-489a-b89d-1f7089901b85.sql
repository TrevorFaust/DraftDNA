-- Update default position limits to include BENCH
ALTER TABLE public.leagues 
ALTER COLUMN position_limits SET DEFAULT '{"K": 3, "QB": 4, "RB": 8, "TE": 3, "WR": 8, "DEF": 3, "BENCH": 7}'::jsonb;