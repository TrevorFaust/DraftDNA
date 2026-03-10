-- Guest rankings: store anonymous rankings so they count toward community consensus.
-- Same weight as signed-in user rankings (1 vote each). Baseline remains 100x.

-- Table for guest submissions (bucket + player_id, rank). One submission per guest_session_id per bucket.
CREATE TABLE IF NOT EXISTS public.guest_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_session_id uuid NOT NULL,
  scoring_format text NOT NULL,
  league_type text NOT NULL,
  is_superflex boolean NOT NULL,
  rookies_only boolean NOT NULL DEFAULT false,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  rank integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_rankings_bucket ON public.guest_rankings (scoring_format, league_type, is_superflex, rookies_only);
CREATE INDEX IF NOT EXISTS idx_guest_rankings_session_bucket ON public.guest_rankings (guest_session_id, scoring_format, league_type, is_superflex, rookies_only);

ALTER TABLE public.guest_rankings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (needed for get_community_rankings).
CREATE POLICY "Allow read guest_rankings"
  ON public.guest_rankings FOR SELECT
  TO anon, authenticated
  USING (true);

-- Inserts/deletes only via RPC (SECURITY DEFINER).

-- RPC: save guest rankings for a bucket. Replaces any existing submission for this session+bucket.
CREATE OR REPLACE FUNCTION public.save_guest_rankings(
  p_guest_session_id uuid,
  p_scoring_format text,
  p_league_type text,
  p_is_superflex boolean,
  p_rookies_only boolean,
  p_rankings jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  idx int := 0;
BEGIN
  -- Delete existing submission for this guest + bucket
  DELETE FROM public.guest_rankings
  WHERE guest_session_id = p_guest_session_id
    AND scoring_format = p_scoring_format
    AND league_type = p_league_type
    AND is_superflex = p_is_superflex
    AND rookies_only = p_rookies_only;

  -- Insert new rankings (p_rankings: array of { "id": "player_uuid" })
  FOR r IN SELECT * FROM jsonb_array_elements(p_rankings)
  LOOP
    idx := idx + 1;
    INSERT INTO public.guest_rankings (guest_session_id, scoring_format, league_type, is_superflex, rookies_only, player_id, rank)
    VALUES (
      p_guest_session_id,
      p_scoring_format,
      p_league_type,
      p_is_superflex,
      p_rookies_only,
      (r->>'id')::uuid,
      idx
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_guest_rankings(uuid, text, text, boolean, boolean, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.save_guest_rankings(uuid, text, text, boolean, boolean, jsonb) TO authenticated;

-- Include guest_rankings in community consensus (same weight as user_rankings: 1 vote each).
CREATE OR REPLACE FUNCTION public.get_community_rankings(
  p_scoring_format text DEFAULT 'ppr',
  p_league_type text DEFAULT 'season',
  p_is_superflex boolean DEFAULT false,
  p_exclude_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  player_id uuid,
  avg_rank numeric,
  rank_position bigint,
  sample_count bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH baseline_ranks AS (
    SELECT bcr.player_id, bcr.rank AS r
    FROM public.baseline_community_rankings bcr
    WHERE bcr.scoring_format = p_scoring_format
      AND bcr.league_type = p_league_type
      AND bcr.is_superflex = p_is_superflex
  ),
  user_ranks AS (
    SELECT ur.player_id, ur.rank::numeric AS r
    FROM public.user_rankings ur
    INNER JOIN public.leagues l ON ur.league_id = l.id
    WHERE ur.league_id IS NOT NULL
      AND COALESCE(l.scoring_format, 'ppr') = p_scoring_format
      AND COALESCE(l.league_type, 'season') = p_league_type
      AND COALESCE(l.is_superflex, false) = p_is_superflex
      AND (p_exclude_user_id IS NULL OR ur.user_id != p_exclude_user_id)
  ),
  guest_ranks AS (
    SELECT gr.player_id, gr.rank::numeric AS r
    FROM public.guest_rankings gr
    WHERE gr.scoring_format = p_scoring_format
      AND gr.league_type = p_league_type
      AND gr.is_superflex = p_is_superflex
  ),
  weighted_ranks AS (
    SELECT player_id, r, 100::numeric AS w FROM baseline_ranks
    UNION ALL
    SELECT player_id, r, 1::numeric AS w FROM user_ranks
    UNION ALL
    SELECT player_id, r, 1::numeric AS w FROM guest_ranks
  ),
  agg AS (
    SELECT
      wr.player_id,
      (SUM(wr.w * wr.r) / NULLIF(SUM(wr.w), 0))::numeric AS avg_rank,
      SUM(wr.w)::bigint AS sample_count
    FROM weighted_ranks wr
    GROUP BY wr.player_id
  )
  SELECT
    a.player_id,
    a.avg_rank,
    ROW_NUMBER() OVER (ORDER BY a.avg_rank ASC)::bigint AS rank_position,
    a.sample_count
  FROM agg a
  ORDER BY a.avg_rank ASC;
$$;
