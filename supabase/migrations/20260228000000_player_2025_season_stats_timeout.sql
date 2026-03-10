-- Increase statement timeout for get_player_2025_season_stats to avoid 500/cancel on large datasets.
-- Note: SET LOCAL is not used so the function works with Supabase pooler and anon role.
-- To allow longer runs, increase statement_timeout in Supabase Dashboard (Database settings) if needed.
-- SECURITY DEFINER so anon/guest can call it and read stats tables that may be RLS-restricted.

CREATE OR REPLACE FUNCTION get_player_2025_season_stats()
RETURNS TABLE (
  player_id uuid,
  total_fp_standard double precision,
  total_fp_ppr double precision,
  total_receptions bigint,
  total_pass_yards bigint,
  total_rush_yards bigint,
  total_rec_yards bigint,
  total_pass_tds bigint,
  total_rush_tds bigint,
  total_rec_tds bigint,
  total_interceptions bigint,
  total_targets bigint,
  games_played bigint,
  "position" text,
  position_rank integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH
  season_totals AS (
    SELECT
      w.player_id AS stats_player_id,
      COALESCE(SUM(w.fantasy_points), 0)::double precision AS total_fp_standard,
      COALESCE(SUM(w.fantasy_points_ppr), 0)::double precision AS total_fp_ppr,
      COALESCE(SUM(w.receptions), 0)::bigint AS total_receptions,
      COALESCE(SUM(w.passing_yards), 0)::bigint AS total_pass_yards,
      COALESCE(SUM(w.rushing_yards), 0)::bigint AS total_rush_yards,
      COALESCE(SUM(w.receiving_yards), 0)::bigint AS total_rec_yards,
      COALESCE(SUM(w.passing_tds), 0)::bigint AS total_pass_tds,
      COALESCE(SUM(w.rushing_tds), 0)::bigint AS total_rush_tds,
      COALESCE(SUM(w.receiving_tds), 0)::bigint AS total_rec_tds,
      COALESCE(SUM(w.passing_interceptions), 0)::bigint AS total_interceptions,
      COALESCE(SUM(w.targets), 0)::bigint AS total_targets,
      COUNT(*)::bigint AS games_played,
      (array_agg(w.position ORDER BY w.week))[1] AS "position"
    FROM weekly_stats_2025 w
    WHERE w.season = 2025
      AND w.week <= 18
    GROUP BY w.player_id
  ),
  gsis_to_espn AS (
    SELECT DISTINCT dc.gsis_id, dc.espn_id
    FROM depth_charts_2025 dc
    WHERE dc.gsis_id IS NOT NULL AND dc.espn_id IS NOT NULL
    UNION
    SELECT DISTINCT r.gsis_id, r.espn_id
    FROM rosters_2025 r
    WHERE r.gsis_id IS NOT NULL AND r.espn_id IS NOT NULL
  ),
  gsis_to_espn_full AS (
    SELECT gsis_id, espn_id FROM gsis_to_espn
    UNION
    SELECT pi.gsis_id, pi.espn_id
    FROM players_info pi
    WHERE pi.gsis_id IS NOT NULL AND pi.espn_id IS NOT NULL
  ),
  ranked AS (
    SELECT
      st.*,
      ROW_NUMBER() OVER (PARTITION BY st."position" ORDER BY st.total_fp_ppr DESC NULLS LAST)::integer AS pos_rank
    FROM season_totals st
  ),
  mapped AS (
    SELECT
      p.id AS player_id,
      r.total_fp_standard,
      r.total_fp_ppr,
      r.total_receptions,
      r.total_pass_yards,
      r.total_rush_yards,
      r.total_rec_yards,
      r.total_pass_tds,
      r.total_rush_tds,
      r.total_rec_tds,
      r.total_interceptions,
      r.total_targets,
      r.games_played,
      r."position",
      r.pos_rank AS position_rank
    FROM ranked r
    JOIN gsis_to_espn_full g ON g.gsis_id = r.stats_player_id
    JOIN players p ON p.espn_id = g.espn_id AND p.season = 2025
  )
  SELECT mapped.player_id, mapped.total_fp_standard, mapped.total_fp_ppr, mapped.total_receptions,
         mapped.total_pass_yards, mapped.total_rush_yards, mapped.total_rec_yards,
         mapped.total_pass_tds, mapped.total_rush_tds, mapped.total_rec_tds,
         mapped.total_interceptions, mapped.total_targets, mapped.games_played,
         mapped."position", mapped.position_rank
  FROM mapped;
END;
$$;
