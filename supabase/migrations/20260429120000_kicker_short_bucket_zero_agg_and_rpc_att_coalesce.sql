-- Fix per-range FG attempts showing as empty (m/–):
-- 1) kicker_weekly_derived_json: do not treat fg_made_0_39 = 0 as authoritative when fg_made / per-band makes carry the real short FGs.
-- 2) get_player_2025_season_stats: sum k_fg_att_* with COALESCE so all-NULL weeks do not yield NULL season totals.

CREATE OR REPLACE FUNCTION public.kicker_weekly_derived_json(j jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $kd$
  WITH x AS (
    SELECT
      COALESCE((NULLIF(btrim(COALESCE(j->>'pat_made', '')), ''))::double precision, (NULLIF(btrim(COALESCE(j->>'xpm', '')), ''))::double precision, 0) AS pat_made,
      COALESCE((NULLIF(btrim(COALESCE(j->>'pat_att', '')), ''))::double precision, (NULLIF(btrim(COALESCE(j->>'xpa', '')), ''))::double precision, 0) AS pat_att,
      COALESCE((NULLIF(btrim(COALESCE(j->>'fg_made', '')), ''))::double precision, (NULLIF(btrim(COALESCE(j->>'fgm', '')), ''))::double precision, 0) AS fg_made_total,
      COALESCE((NULLIF(btrim(COALESCE(j->>'fg_made_0_39', '')), ''))::double precision, (NULLIF(btrim(COALESCE(j->>'fg_made_1_39', '')), ''))::double precision) AS fg_made_0_39_agg,
      COALESCE((NULLIF(btrim(COALESCE(j->>'fg_made_0_19', '')), ''))::double precision, 0) AS m019,
      COALESCE((NULLIF(btrim(COALESCE(j->>'fg_made_20_29', '')), ''))::double precision, 0) AS m2029,
      COALESCE((NULLIF(btrim(COALESCE(j->>'fg_made_30_39', '')), ''))::double precision, 0) AS m3039,
      COALESCE((NULLIF(btrim(COALESCE(j->>'fg_made_40_49', '')), ''))::double precision, 0) AS m4049,
      COALESCE((NULLIF(btrim(COALESCE(j->>'fg_made_50_59', '')), ''))::double precision, 0) AS m5059,
      COALESCE(
        (NULLIF(btrim(COALESCE(j->>'fg_made_60', '')), ''))::double precision,
        (NULLIF(btrim(COALESCE(j->>'fg_made_60_', '')), ''))::double precision,
        (NULLIF(btrim(COALESCE(j->>'fg_made_60p', '')), ''))::double precision,
        (NULLIF(btrim(COALESCE(j->>'fg_made_60_plus', '')), ''))::double precision,
        0
      ) AS m60,
      COALESCE((NULLIF(btrim(COALESCE(j->>'fg_missed_0_19', j->>'fg_missed_0-19', '')), ''))::double precision, 0) AS ms019,
      COALESCE((NULLIF(btrim(COALESCE(j->>'fg_missed_20_29', j->>'fg_missed_20-29', '')), ''))::double precision, 0) AS ms2029,
      COALESCE((NULLIF(btrim(COALESCE(j->>'fg_missed_30_39', j->>'fg_missed_30-39', '')), ''))::double precision, 0) AS ms3039,
      COALESCE((NULLIF(btrim(COALESCE(j->>'fg_missed_40_49', j->>'fg_missed_40-49', '')), ''))::double precision, 0) AS ms4049,
      COALESCE((NULLIF(btrim(COALESCE(j->>'fg_missed_50_59', j->>'fg_missed_50-59', '')), ''))::double precision, 0) AS ms5059,
      COALESCE(
        (NULLIF(btrim(COALESCE(j->>'fg_missed_60', '')), ''))::double precision,
        (NULLIF(btrim(COALESCE(j->>'fg_missed_60_', '')), ''))::double precision,
        (NULLIF(btrim(COALESCE(j->>'fg_missed_60p', '')), ''))::double precision,
        (NULLIF(btrim(COALESCE(j->>'fg_missed_60_plus', '')), ''))::double precision,
        0
      ) AS ms60,
      COALESCE(
        (NULLIF(btrim(COALESCE(j->>'fg_blocked', '')), ''))::double precision,
        (NULLIF(btrim(COALESCE(j->>'fg_blocks', '')), ''))::double precision,
        0
      ) AS fg_blocked_agg
  ),
  y AS (
    SELECT
      x.*,
      (x.m019 + x.m2029 + x.m3039) AS m_short_sum,
      (x.ms019 + x.ms2029 + x.ms3039) AS ms_short_sum,
      CASE
        WHEN (x.m019 + x.m2029 + x.m3039) > 0 THEN x.m019 + x.m2029 + x.m3039
        WHEN x.fg_made_0_39_agg IS NOT NULL AND x.fg_made_0_39_agg > 0 THEN x.fg_made_0_39_agg
        WHEN (x.m019 + x.m2029 + x.m3039) = 0 AND x.fg_made_total > 0 THEN x.fg_made_total
        WHEN x.fg_made_0_39_agg IS NOT NULL THEN x.fg_made_0_39_agg
        ELSE x.m019 + x.m2029 + x.m3039
      END AS n0039_makes,
      CASE
        WHEN (x.m019 + x.m2029 + x.m3039) > 0 THEN x.m019 + x.ms019 + x.m2029 + x.ms2029 + x.m3039 + x.ms3039
        WHEN x.fg_made_0_39_agg IS NOT NULL AND x.fg_made_0_39_agg > 0 THEN x.fg_made_0_39_agg + x.ms019 + x.ms2029 + x.ms3039
        WHEN (x.m019 + x.m2029 + x.m3039) = 0 AND x.fg_made_total > 0 THEN x.fg_made_total + x.ms019 + x.ms2029 + x.ms3039
        WHEN x.fg_made_0_39_agg IS NOT NULL THEN x.fg_made_0_39_agg + x.ms019 + x.ms2029 + x.ms3039
        ELSE x.m019 + x.ms019 + x.m2029 + x.ms2029 + x.m3039 + x.ms3039
      END AS att0039,
      (x.m4049 + x.ms4049) AS att4049,
      (x.m5059 + x.ms5059) AS att5059,
      (x.m60 + x.ms60) AS att60,
      (x.ms019 + x.ms2029 + x.ms3039 + x.ms4049 + x.ms5059 + x.ms60 + x.fg_blocked_agg) AS miss_and_block_penalty_units,
      (
        GREATEST(
          x.fg_made_total,
          x.m019 + x.m2029 + x.m3039 + x.m4049 + x.m5059 + x.m60
        )
        + x.ms019 + x.ms2029 + x.ms3039 + x.ms4049 + x.ms5059 + x.ms60
      ) AS fg_att_derived_total
    FROM x
  ),
  z AS (
    SELECT
      y.*,
      CASE
        WHEN (y.m_short_sum + y.m4049 + y.m5059 + y.m60) > 0
          OR (y.fg_made_0_39_agg IS NOT NULL AND y.fg_made_0_39_agg > 0) THEN
          y.pat_made
          + y.n0039_makes * 3.0
          + y.m4049 * 4.0
          + y.m5059 * 5.0
          + y.m60 * 5.0
        WHEN y.fg_made_total > 0 THEN
          y.pat_made + y.fg_made_total * 3.0
        ELSE
          y.pat_made
      END - 1.0 * y.miss_and_block_penalty_units AS kick_fp
    FROM y
  )
  SELECT jsonb_build_object(
    'pat_made', z.pat_made,
    'pat_att', z.pat_att,
    'fg_att', z.fg_att_derived_total,
    'fg_made', z.fg_made_total,
    'fg_0039', z.n0039_makes,
    'fg_4049', z.m4049,
    'fg_5059', z.m5059,
    'fg_60', z.m60,
    'fg_att_0039', z.att0039,
    'fg_att_4049', z.att4049,
    'fg_att_5059', z.att5059,
    'fg_att_60', z.att60,
    'kick_fp', z.kick_fp
  )
  FROM z;
$kd$;

COMMENT ON FUNCTION public.kicker_weekly_derived_json(jsonb) IS
  'Kicker weekly: fg_att = GREATEST(fg_made,sum band makes)+sum misses; fg_att_* = made+miss; short bucket prefers granular / positive fg_made_0_39 / fg_made fallback; kick_fp −1 per (misses+blocked).';

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
AS $$
BEGIN
  RETURN QUERY
  WITH
  ws AS (
    SELECT
      w.*,
      public.kicker_weekly_derived_json(to_jsonb(w)) AS kj
    FROM weekly_stats_2025 w
    WHERE w.season = 2025
      AND w.week <= 18
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
    JOIN players p ON p.espn_id = g.espn_id AND p.season = 2025
  )
  SELECT mapped.player_id, mapped.total_fp_standard, mapped.total_fp_ppr, mapped.total_receptions,
         mapped.total_pass_yards, mapped.total_rush_yards, mapped.total_rec_yards,
         mapped.total_pass_tds, mapped.total_rush_tds, mapped.total_rec_tds,
         mapped.total_interceptions, mapped.total_targets, mapped.games_played,
         mapped."position", mapped.position_rank,
         mapped.k_pat_made, mapped.k_pat_att, mapped.k_fg_made, mapped.k_fg_att,
         mapped.k_fg_0039, mapped.k_fg_4049, mapped.k_fg_5059, mapped.k_fg_60,
         mapped.k_fg_att_0039, mapped.k_fg_att_4049, mapped.k_fg_att_5059, mapped.k_fg_att_60
  FROM mapped;
END;
$$;
