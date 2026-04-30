-- Expand players_info so nflverse sync can store richer player profile fields.
-- This keeps age lookup in one table while allowing broader player metadata.

ALTER TABLE public.players_info
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS team text,
ADD COLUMN IF NOT EXISTS college text,
ADD COLUMN IF NOT EXISTS rookie_year integer,
ADD COLUMN IF NOT EXISTS years_exp integer,
ADD COLUMN IF NOT EXISTS season integer;

COMMENT ON COLUMN public.players_info.name IS 'Player full display name (usually nflverse display_name).';
COMMENT ON COLUMN public.players_info.team IS 'Latest known team abbreviation.';
COMMENT ON COLUMN public.players_info.college IS 'College name (source-dependent).';
COMMENT ON COLUMN public.players_info.rookie_year IS 'NFL rookie season year.';
COMMENT ON COLUMN public.players_info.years_exp IS 'NFL years of experience; 0 indicates rookie.';
COMMENT ON COLUMN public.players_info.season IS 'Snapshot season for this row update.';

CREATE INDEX IF NOT EXISTS idx_players_info_team ON public.players_info (team);
CREATE INDEX IF NOT EXISTS idx_players_info_rookie_year ON public.players_info (rookie_year);
CREATE INDEX IF NOT EXISTS idx_players_info_years_exp ON public.players_info (years_exp);

