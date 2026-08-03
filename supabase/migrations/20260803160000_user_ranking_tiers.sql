-- Personal position tiers (cut points) per rankings bucket / league.

CREATE TABLE IF NOT EXISTS public.user_ranking_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  league_id uuid REFERENCES public.leagues (id) ON DELETE CASCADE,
  scoring_format text NOT NULL DEFAULT 'ppr',
  league_type text NOT NULL DEFAULT 'season',
  is_superflex boolean NOT NULL DEFAULT false,
  rookies_only boolean NOT NULL DEFAULT false,
  -- map of position -> sorted cut-after positional ranks, e.g. {"RB":[5,15],"WR":[8]}
  cuts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_ranking_tiers_league_bucket_uidx
  ON public.user_ranking_tiers (user_id, league_id, scoring_format, league_type, is_superflex, rookies_only)
  WHERE league_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_ranking_tiers_null_league_bucket_uidx
  ON public.user_ranking_tiers (user_id, scoring_format, league_type, is_superflex, rookies_only)
  WHERE league_id IS NULL;

ALTER TABLE public.user_ranking_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own ranking tiers"
  ON public.user_ranking_tiers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ranking tiers"
  ON public.user_ranking_tiers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ranking tiers"
  ON public.user_ranking_tiers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own ranking tiers"
  ON public.user_ranking_tiers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
