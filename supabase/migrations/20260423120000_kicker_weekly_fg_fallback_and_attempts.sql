-- Align kicker JSON buckets with scoring when only fg_made / fg_att exist (no distance split).
-- Expose per-bucket attempt counts when present (fg_att_* / fga_*); season RPC sums k_fg_att_*.

DROP FUNCTION IF EXISTS get_player_2025_season_stats();

CREATE OR REPLACE FUNCTION public.kicker_weekly_derived_json(j jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $kd$
  WITH nums AS (
    SELECT
      COALESCE((NULLIF(btrim(COALESCE(j->>'pat_made', '')), ''))::double precision, (NULLIF(btrim(COALESCE(j->>'xpm', '')), ''))::double precision, 0) AS pat_made,
      COALESCE((NULLIF(btrim(COALESCE(j->>'pat_att', '')), ''))::double precision, (NULLIF(btrim(COALESCE(j->>'xpa', '')), ''))::double precision, 0) AS pat_att,
      COALESCE((NULLIF(btrim(COALESCE(j->>'fg_att', '')), ''))::double precision, 0) AS fg_att,
      COALESCE(
        (NULLIF(btrim(COALESCE(j->>'fg_made_0_39', '')), ''))::double precision,
        (NULLIF(btrim(COALESCE(j->>'fg_made_1_39', '')), ''))::double precision,
        (NULLIF(btrim(COALESCE(j->>'fg_made_0039', '')), ''))::double precision,
        (NULLIF(btrim(COALESCE(j->>'fgm_0039', '')), ''))::double precision,
        (NULLIF(btrim(COALESCE(j->>'fg_0039', '')), ''))::double precision
      ) AS fg0039_single,
      COALESCE((NULLIF(btrim(COALESCE(j->>'fgm_0_19', '')), ''))::double precision, 0)
        + COALESCE((NULLIF(btrim(COALESCE(j->>'fgm_20_29', '')), ''))::double precision, 0)
        + COALESCE((NULLIF(btrim(COALESCE(j->>'fgm_30_39', '')), ''))::double precision, 0) AS fg0039_parts,
      COALESCE((NULLIF(btrim(COALESCE(j->>'fgm_40_49', '')), ''))::double precision, (NULLIF(btrim(COALESCE(j->>'fg_made_40_49', '')), ''))::double precision, 0) AS fgm4049,
      COALESCE((NULLIF(btrim(COALESCE(j->>'fgm_50_59', '')), ''))::double precision, (NULLIF(btrim(COALESCE(j->>'fg_made_50_59', '')), ''))::double precision, 0) AS fgm5059,
      COALESCE((NULLIF(btrim(COALESCE(j->>'fgm_60p', '')), ''))::double precision, (NULLIF(btrim(COALESCE(j->>'fgm_60', '')), ''))::double precision, (NULLIF(btrim(COALESCE(j->>'fg_made_60', '')), ''))::double precision, (NULLIF(btrim(COALESCE(j->>'fg_made_60p', '')), ''))::double precision, 0) AS fgm60,
      COALESCE((NULLIF(btrim(COALESCE(j->>'fg_made', '')), ''))::double precision, (NULLIF(btrim(COALESCE(j->>'fgm', '')), ''))::double precision, 0) AS fg_made_total,
      (NULLIF(btrim(COALESCE(j->>'fga_0_19', '')), ''))::double precision AS fga_0_19_raw,
      (NULLIF(btrim(COALESCE(j->>'fga_20_29', '')), ''))::double precision AS fga_20_29_raw,
      (NULLIF(btrim(COALESCE(j->>'fga_30_39', '')), ''))::double precision AS fga_30_39_raw,
      COALESCE(
        (NULLIF(btrim(COALESCE(j->>'fg_att_0_39', '')), ''))::double precision,
        (NULLIF(btrim(COALESCE(j->>'fg_att_1_39', '')), ''))::double precision,
        (NULLIF(btrim(COALESCE(j->>'fga_0039', '')), ''))::double precision
      ) AS fga0039_single,
      (NULLIF(btrim(COALESCE(j->>'fga_40_49', '')), ''))::double precision AS fga_40_49_raw,
      (NULLIF(btrim(COALESCE(j->>'fg_att_40_49', '')), ''))::double precision AS fg_att_40_49_raw,
      (NULLIF(btrim(COALESCE(j->>'fga_50_59', '')), ''))::double precision AS fga_50_59_raw,
      (NULLIF(btrim(COALESCE(j->>'fg_att_50_59', '')), ''))::double precision AS fg_att_50_59_raw,
      (NULLIF(btrim(COALESCE(j->>'fga_60p', '')), ''))::double precision AS fga_60p_raw,
      (NULLIF(btrim(COALESCE(j->>'fga_60', '')), ''))::double precision AS fga_60_raw,
      (NULLIF(btrim(COALESCE(j->>'fg_att_60', '')), ''))::double precision AS fg_att_60_raw
  ),
  resolved AS (
    SELECT
      n.*,
      COALESCE(n.fg0039_single, n.fg0039_parts, 0::double precision) AS n0039_raw,
      COALESCE(n.fgm4049, 0::double precision) AS n4049,
      COALESCE(n.fgm5059, 0::double precision) AS n5059,
      COALESCE(n.fgm60, 0::double precision) AS n60,
      CASE
        WHEN n.fga_0_19_raw IS NULL AND n.fga_20_29_raw IS NULL AND n.fga_30_39_raw IS NULL THEN NULL::double precision
        ELSE COALESCE(n.fga_0_19_raw, 0::double precision) + COALESCE(n.fga_20_29_raw, 0::double precision) + COALESCE(n.fga_30_39_raw, 0::double precision)
      END AS fga0039_parts_sum,
      COALESCE(n.fga_40_49_raw, n.fg_att_40_49_raw) AS fga4049_single,
      COALESCE(n.fga_50_59_raw, n.fg_att_50_59_raw) AS fga5059_single,
      COALESCE(n.fga_60p_raw, n.fga_60_raw, n.fg_att_60_raw) AS fga60_single
    FROM nums n
  ),
  bucketed AS (
    SELECT
      r.pat_made,
      r.pat_att,
      r.fg_att,
      r.fg_made_total,
      r.fga0039_single,
      r.fga0039_parts_sum,
      r.fga4049_single,
      r.fga5059_single,
      r.fga60_single,
      r.n0039_raw,
      r.n4049,
      r.n5059,
      r.n60,
      (r.n0039_raw + r.n4049 + r.n5059 + r.n60) = 0 AND r.fg_made_total > 0 AS use_fallback
    FROM resolved r
  ),
  outv AS (
    SELECT
      b.pat_made,
      b.pat_att,
      b.fg_att,
      b.fg_made_total,
      CASE WHEN b.use_fallback THEN b.fg_made_total ELSE b.n0039_raw END AS n0039_out,
      CASE WHEN b.use_fallback THEN 0::double precision ELSE b.n4049 END AS n4049_out,
      CASE WHEN b.use_fallback THEN 0::double precision ELSE b.n5059 END AS n5059_out,
      CASE WHEN b.use_fallback THEN 0::double precision ELSE b.n60 END AS n60_out,
      CASE
        WHEN b.use_fallback THEN b.fg_att
        ELSE COALESCE(b.fga0039_single, b.fga0039_parts_sum)
      END AS fg_att_0039_out,
      CASE
        WHEN b.use_fallback THEN 0::double precision
        WHEN b.fga4049_single IS NOT NULL THEN b.fga4049_single
        WHEN (CASE WHEN b.use_fallback THEN 0::double precision ELSE b.n4049 END) > 0 THEN NULL::double precision
        ELSE 0::double precision
      END AS fg_att_4049_out,
      CASE
        WHEN b.use_fallback THEN 0::double precision
        WHEN b.fga5059_single IS NOT NULL THEN b.fga5059_single
        WHEN (CASE WHEN b.use_fallback THEN 0::double precision ELSE b.n5059 END) > 0 THEN NULL::double precision
        ELSE 0::double precision
      END AS fg_att_5059_out,
      CASE
        WHEN b.use_fallback THEN 0::double precision
        WHEN b.fga60_single IS NOT NULL THEN b.fga60_single
        WHEN (CASE WHEN b.use_fallback THEN 0::double precision ELSE b.n60 END) > 0 THEN NULL::double precision
        ELSE 0::double precision
      END AS fg_att_60_out,
      CASE
        WHEN b.use_fallback THEN b.pat_made * 1.0 + b.fg_made_total * 3.0
        ELSE
          b.pat_made * 1.0
          + (CASE WHEN b.use_fallback THEN b.fg_made_total ELSE b.n0039_raw END) * 3.0
          + (CASE WHEN b.use_fallback THEN 0::double precision ELSE b.n4049 END) * 4.0
          + (CASE WHEN b.use_fallback THEN 0::double precision ELSE b.n5059 END) * 5.0
          + (CASE WHEN b.use_fallback THEN 0::double precision ELSE b.n60 END) * 5.0
      END AS kick_fp
    FROM bucketed b
  )
  SELECT jsonb_build_object(
    'pat_made', o.pat_made,
    'pat_att', o.pat_att,
    'fg_att', o.fg_att,
    'fg_made', o.fg_made_total,
    'fg_0039', o.n0039_out,
    'fg_4049', o.n4049_out,
    'fg_5059', o.n5059_out,
    'fg_60', o.n60_out,
    'fg_att_0039', o.fg_att_0039_out,
    'fg_att_4049', o.fg_att_4049_out,
    'fg_att_5059', o.fg_att_5059_out,
    'fg_att_60', o.fg_att_60_out,
    'kick_fp', o.kick_fp
  )
  FROM outv o;
$kd$;

COMMENT ON FUNCTION public.kicker_weekly_derived_json(jsonb) IS
  'Per-week kicker counting stats + kick_fp; fg_0039 matches scoring fallback when only fg_made exists; optional fg_att_* per bucket.';

CREATE OR REPLACE FUNCTION public.kicking_fp_add_on_from_weekly_json(j jsonb)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $kfp$
  SELECT (public.kicker_weekly_derived_json(j)->>'kick_fp')::double precision;
$kfp$;

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
      ROUND(SUM(
        CASE WHEN UPPER(TRIM(COALESCE(ws.position, ''))) = 'K' THEN
          NULLIF(btrim(COALESCE(ws.kj->>'fg_att_0039', '')), '')::double precision
        END
      ))::bigint AS k_fg_att_0039,
      ROUND(SUM(
        CASE WHEN UPPER(TRIM(COALESCE(ws.position, ''))) = 'K' THEN
          NULLIF(btrim(COALESCE(ws.kj->>'fg_att_4049', '')), '')::double precision
        END
      ))::bigint AS k_fg_att_4049,
      ROUND(SUM(
        CASE WHEN UPPER(TRIM(COALESCE(ws.position, ''))) = 'K' THEN
          NULLIF(btrim(COALESCE(ws.kj->>'fg_att_5059', '')), '')::double precision
        END
      ))::bigint AS k_fg_att_5059,
      ROUND(SUM(
        CASE WHEN UPPER(TRIM(COALESCE(ws.position, ''))) = 'K' THEN
          NULLIF(btrim(COALESCE(ws.kj->>'fg_att_60', '')), '')::double precision
        END
      ))::bigint AS k_fg_att_60
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
