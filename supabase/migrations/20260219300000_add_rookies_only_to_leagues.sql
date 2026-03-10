-- Add rookies_only to leagues for dynasty leagues that want rookie-only drafts/rankings
ALTER TABLE public.leagues
ADD COLUMN IF NOT EXISTS rookies_only boolean DEFAULT false;
