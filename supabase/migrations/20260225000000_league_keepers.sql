-- League keepers: players kept by teams for specific rounds in upcoming drafts
-- Each team can have 1-5 keepers, one per round. No player can be kept by multiple teams.
-- Keepers are removed from the draft pool and auto-assigned when that round is reached.

CREATE TABLE IF NOT EXISTS public.league_keepers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  team_number integer NOT NULL CHECK (team_number >= 1),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  round_number integer NOT NULL CHECK (round_number >= 1),
  created_at timestamptz DEFAULT now(),
  UNIQUE (league_id, player_id),  -- no player kept by multiple teams
  UNIQUE (league_id, team_number, round_number)  -- one keeper per team per round
);

CREATE INDEX IF NOT EXISTS idx_league_keepers_league_id ON public.league_keepers(league_id);
CREATE INDEX IF NOT EXISTS idx_league_keepers_player_id ON public.league_keepers(player_id);

-- RLS
ALTER TABLE public.league_keepers ENABLE ROW LEVEL SECURITY;

-- Users can only manage keepers for leagues they own
CREATE POLICY "Users can manage keepers for own leagues"
  ON public.league_keepers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = league_keepers.league_id
      AND l.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = league_keepers.league_id
      AND l.user_id = auth.uid()
    )
  );
