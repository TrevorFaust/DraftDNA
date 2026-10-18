-- Season totals were recomputed on every page load. Two parts made each call
-- take several seconds and hold a pool connection for up to 60s, which timed
-- out the stats sync and anything else on this database (including ScoutDNA):
--   1. kicker_weekly_derived_json(to_jsonb(row)) ran for every weekly row
--   2. gsis→espn mapping DISTINCT-scanned all of depth_charts_2025 (~480k rows)
-- players_info + rosters_2025 already cover every 2025 and 2026 player the
-- old query returned. Depth charts are only a LIMIT 1 fallback for ids those
-- two tables do not know.

CREATE INDEX IF NOT EXISTS idx_players_info_gsis_id
  ON public.players_info (gsis_id);

CREATE INDEX IF NOT EXISTS idx_rosters_2025_gsis_id
  ON public.rosters_2025 (gsis_id);

CREATE INDEX IF NOT EXISTS idx_depth_charts_2025_gsis_id
  ON public.depth_charts_2025 (gsis_id)
  WHERE espn_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_player_season_stats(p_season integer)
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
  position_rank integer,
  k_pat_made bigint,
  k_pat_att bigint,
  k_fg_made bigint,
  k_fg_att bigint,
  k_fg_0039 bigint,
  k_fg_4049 bigint,
  k_fg_5059 bigint,
  k_fg_60 bigint,
  k_fg_att_0039 bigint,
  k_fg_att_4049 bigint,
  k_fg_att_5059 bigint,
  k_fg_att_60 bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '8s'
AS $$
DECLARE
  stats_table text;
BEGIN
  IF p_season IS NULL OR p_season NOT IN (2025, 2026) THEN
    RAISE EXCEPTION 'get_player_season_stats supports 2025 or 2026, got %', p_season;
  END IF;

  stats_table := CASE p_season
    WHEN 2026 THEN 'weekly_stats_2026'
    ELSE 'weekly_stats_2025'
  END;

  RETURN QUERY EXECUTE format($q$
  WITH
  ws AS MATERIALIZED (
    SELECT
      w.player_id,
      w.position,
      w.week,
      w.fantasy_points,
      w.fantasy_points_ppr,
      w.receptions,
      w.passing_yards,
      w.rushing_yards,
      w.receiving_yards,
      w.passing_tds,
      w.rushing_tds,
      w.receiving_tds,
      w.passing_interceptions,
      w.targets,
      CASE
        WHEN upper(trim(coalesce(w.position, ''))) = 'K'
          THEN public.kicker_weekly_derived_json(to_jsonb(w))
        ELSE '{}'::jsonb
      END AS kj
    FROM %I w
    WHERE w.season = %s
      AND w.week BETWEEN 1 AND 18
      AND (w.season_type IS NULL OR w.season_type = 'REG')
  ),
  season_totals AS (
    SELECT
      ws.player_id AS stats_player_id,
      COALESCE(SUM(
        CASE
          WHEN UPPER(TRIM(COALESCE(ws.position, ''))) = 'K' THEN
            COALESCE(ws.fantasy_points, 0)::double precision
            + (ws.kj->>'kick_fp')::double precision
          ELSE ws.fantasy_points::double precision
        END
      ), 0)::double precision AS total_fp_standard,
      COALESCE(SUM(
        CASE
          WHEN UPPER(TRIM(COALESCE(ws.position, ''))) = 'K' THEN
            COALESCE(ws.fantasy_points_ppr, ws.fantasy_points, 0)::double precision
            + (ws.kj->>'kick_fp')::double precision
          ELSE COALESCE(ws.fantasy_points_ppr, ws.fantasy_points)::double precision
        END
      ), 0)::double precision AS total_fp_ppr,
      COALESCE(SUM(ws.receptions), 0)::bigint AS total_receptions,
      COALESCE(SUM(ws.passing_yards), 0)::bigint AS total_pass_yards,
      COALESCE(SUM(ws.rushing_yards), 0)::bigint AS total_rush_yards,
      COALESCE(SUM(ws.receiving_yards), 0)::bigint AS total_rec_yards,
      COALESCE(SUM(ws.passing_tds), 0)::bigint AS total_pass_tds,
      COALESCE(SUM(ws.rushing_tds), 0)::bigint AS total_rush_tds,
      COALESCE(SUM(ws.receiving_tds), 0)::bigint AS total_rec_tds,
      COALESCE(SUM(ws.passing_interceptions), 0)::bigint AS total_interceptions,
      COALESCE(SUM(ws.targets), 0)::bigint AS total_targets,
      COUNT(*)::bigint AS games_played,
      (array_agg(ws.position ORDER BY ws.week))[1] AS "position",
      COALESCE(SUM(
        CASE WHEN UPPER(TRIM(COALESCE(ws.position, ''))) = 'K' THEN
          (ws.kj->>'pat_made')::double precision
        ELSE 0 END
      ), 0)::bigint AS k_pat_made,
      COALESCE(SUM(
        CASE WHEN UPPER(TRIM(COALESCE(ws.position, ''))) = 'K' THEN
          (ws.kj->>'pat_att')::double precision
        ELSE 0 END
      ), 0)::bigint AS k_pat_att,
      COALESCE(SUM(
        CASE WHEN UPPER(TRIM(COALESCE(ws.position, ''))) = 'K' THEN
          (ws.kj->>'fg_made')::double precision
        ELSE 0 END
      ), 0)::bigint AS k_fg_made,
      COALESCE(SUM(
        CASE WHEN UPPER(TRIM(COALESCE(ws.position, ''))) = 'K' THEN
          (ws.kj->>'fg_att')::double precision
        ELSE 0 END
      ), 0)::bigint AS k_fg_att,
      COALESCE(SUM(
        CASE WHEN UPPER(TRIM(COALESCE(ws.position, ''))) = 'K' THEN
          (ws.kj->>'fg_0039')::double precision
        ELSE 0 END
      ), 0)::bigint AS k_fg_0039,
      COALESCE(SUM(
        CASE WHEN UPPER(TRIM(COALESCE(ws.position, ''))) = 'K' THEN
          (ws.kj->>'fg_4049')::double precision
        ELSE 0 END
      ), 0)::bigint AS k_fg_4049,
      COALESCE(SUM(
        CASE WHEN UPPER(TRIM(COALESCE(ws.position, ''))) = 'K' THEN
          (ws.kj->>'fg_5059')::double precision
        ELSE 0 END
      ), 0)::bigint AS k_fg_5059,
      COALESCE(SUM(
        CASE WHEN UPPER(TRIM(COALESCE(ws.position, ''))) = 'K' THEN
          (ws.kj->>'fg_60')::double precision
        ELSE 0 END
      ), 0)::bigint AS k_fg_60,
      COALESCE(ROUND(SUM(
        CASE WHEN UPPER(TRIM(COALESCE(ws.position, ''))) = 'K' THEN
          COALESCE(NULLIF(btrim(COALESCE(ws.kj->>'fg_att_0039', '')), '')::double precision, 0::double precision)
        ELSE 0::double precision
        END
      )), 0)::bigint AS k_fg_att_0039,
      COALESCE(ROUND(SUM(
        CASE WHEN UPPER(TRIM(COALESCE(ws.position, ''))) = 'K' THEN
          COALESCE(NULLIF(btrim(COALESCE(ws.kj->>'fg_att_4049', '')), '')::double precision, 0::double precision)
        ELSE 0::double precision
        END
      )), 0)::bigint AS k_fg_att_4049,
      COALESCE(ROUND(SUM(
        CASE WHEN UPPER(TRIM(COALESCE(ws.position, ''))) = 'K' THEN
          COALESCE(NULLIF(btrim(COALESCE(ws.kj->>'fg_att_5059', '')), '')::double precision, 0::double precision)
        ELSE 0::double precision
        END
      )), 0)::bigint AS k_fg_att_5059,
      COALESCE(ROUND(SUM(
        CASE WHEN UPPER(TRIM(COALESCE(ws.position, ''))) = 'K' THEN
          COALESCE(NULLIF(btrim(COALESCE(ws.kj->>'fg_att_60', '')), '')::double precision, 0::double precision)
        ELSE 0::double precision
        END
      )), 0)::bigint AS k_fg_att_60
    FROM ws
    GROUP BY ws.player_id
  ),
  stats_ids AS (
    SELECT DISTINCT season_totals.stats_player_id AS gsis_id
    FROM season_totals
  ),
  gsis_to_espn_full AS (
    SELECT pi.gsis_id, pi.espn_id
    FROM stats_ids s
    JOIN players_info pi ON pi.gsis_id = s.gsis_id AND pi.espn_id IS NOT NULL
    UNION
    SELECT r.gsis_id, r.espn_id
    FROM stats_ids s
    JOIN rosters_2025 r ON r.gsis_id = s.gsis_id AND r.espn_id IS NOT NULL
    UNION
    SELECT m.gsis_id, dc.espn_id
    FROM (
      SELECT s.gsis_id
      FROM stats_ids s
      WHERE NOT EXISTS (
        SELECT 1 FROM players_info pi
        WHERE pi.gsis_id = s.gsis_id AND pi.espn_id IS NOT NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM rosters_2025 r
        WHERE r.gsis_id = s.gsis_id AND r.espn_id IS NOT NULL
      )
    ) m
    JOIN LATERAL (
      SELECT d.espn_id
      FROM depth_charts_2025 d
      WHERE d.gsis_id = m.gsis_id AND d.espn_id IS NOT NULL
      LIMIT 1
    ) dc ON true
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
      r.pos_rank AS position_rank,
      r.k_pat_made,
      r.k_pat_att,
      r.k_fg_made,
      r.k_fg_att,
      r.k_fg_0039,
      r.k_fg_4049,
      r.k_fg_5059,
      r.k_fg_60,
      r.k_fg_att_0039,
      r.k_fg_att_4049,
      r.k_fg_att_5059,
      r.k_fg_att_60
    FROM ranked r
    JOIN gsis_to_espn_full g ON g.gsis_id = r.stats_player_id
    JOIN players p ON p.espn_id = g.espn_id AND p.season IN (2025, 2026)
  )
  SELECT DISTINCT ON (mapped.player_id)
         mapped.player_id, mapped.total_fp_standard, mapped.total_fp_ppr, mapped.total_receptions,
         mapped.total_pass_yards, mapped.total_rush_yards, mapped.total_rec_yards,
         mapped.total_pass_tds, mapped.total_rush_tds, mapped.total_rec_tds,
         mapped.total_interceptions, mapped.total_targets, mapped.games_played,
         mapped."position", mapped.position_rank,
         mapped.k_pat_made, mapped.k_pat_att, mapped.k_fg_made, mapped.k_fg_att,
         mapped.k_fg_0039, mapped.k_fg_4049, mapped.k_fg_5059, mapped.k_fg_60,
         mapped.k_fg_att_0039, mapped.k_fg_att_4049, mapped.k_fg_att_5059, mapped.k_fg_att_60
  FROM mapped
  ORDER BY mapped.player_id, mapped.games_played DESC;

$q$, stats_table, p_season);
END;
$$;

COMMENT ON FUNCTION public.get_player_season_stats(integer) IS
  'Regular-season fantasy totals for 2025 or 2026. Maps gsis ids through players_info and rosters_2025, with a depth-chart fallback only for unknown ids.';

GRANT EXECUTE ON FUNCTION public.get_player_season_stats(integer) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_player_2025_season_stats()
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
  position_rank integer,
  k_pat_made bigint,
  k_pat_att bigint,
  k_fg_made bigint,
  k_fg_att bigint,
  k_fg_0039 bigint,
  k_fg_4049 bigint,
  k_fg_5059 bigint,
  k_fg_60 bigint,
  k_fg_att_0039 bigint,
  k_fg_att_4049 bigint,
  k_fg_att_5059 bigint,
  k_fg_att_60 bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '8s'
AS $$
  SELECT * FROM public.get_player_season_stats(2025);
$$;

GRANT EXECUTE ON FUNCTION public.get_player_2025_season_stats() TO anon, authenticated, service_role;
