-- Add experience tracking to players and a dedicated 2026 rookie source table.
-- This lets us keep draft-board truth in one place, then sync into players for app usage.

ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS years_exp integer;

COMMENT ON COLUMN public.players.years_exp IS
  'NFL years of experience for this season row. 0 = rookie.';

CREATE TABLE IF NOT EXISTS public.rookies_2026 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round integer NOT NULL,
  pick integer NOT NULL,
  nfl_team text NOT NULL,
  player_name text NOT NULL,
  position text NOT NULL,
  college text,
  years_exp integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual_draft_board',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rookies_2026_pick_unique UNIQUE (pick),
  CONSTRAINT rookies_2026_round_pick_unique UNIQUE (round, pick)
);

CREATE INDEX IF NOT EXISTS idx_rookies_2026_player_name ON public.rookies_2026 (player_name);
CREATE INDEX IF NOT EXISTS idx_rookies_2026_position ON public.rookies_2026 (position);

CREATE OR REPLACE FUNCTION public.set_updated_at_rookies_2026()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rookies_2026_updated_at ON public.rookies_2026;
CREATE TRIGGER trg_rookies_2026_updated_at
BEFORE UPDATE ON public.rookies_2026
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_rookies_2026();

ALTER TABLE public.rookies_2026 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rookies_2026 read access" ON public.rookies_2026;
CREATE POLICY "rookies_2026 read access"
ON public.rookies_2026
FOR SELECT
USING (true);

