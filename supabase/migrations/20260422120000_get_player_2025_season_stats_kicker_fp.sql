-- Kickers: weekly_stats_2025.fantasy_points often omits kicking; add PAT + distance-based FG points.
-- Scoring (matches app `src/utils/kickerFantasyPoints.ts`): XPM 1 pt; FG 1–39 = 3, 40–49 = 4, 50–59 = 5, 60+ = 5.
-- `kicker_weekly_derived_json` exposes per-week counting stats for the Player Stats (K) grid; optional JSON keys.

DROP FUNCTION IF EXISTS get_player_2025_season_stats();
DROP FUNCTION IF EXISTS public.kicking_fp_add_on_from_weekly_json(jsonb);
DROP FUNCTION IF EXISTS public.kicker_weekly_derived_json(jsonb);

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
      COALESCE((NULLIF(btrim(COALESCE(j->>'fg_made', '')), ''))::double precision, (NULLIF(btrim(COALESCE(j->>'fgm', '')), ''))::double precision, 0) AS fg_made_total
  ),
  resolved AS (
    SELECT
      pat_made,
      pat_att,
      fg_att,
      COALESCE(fg0039_single, fg0039_parts, 0::double precision) AS n0039,
      COALESCE(fgm4049, 0) AS n4049,
      COALESCE(fgm5059, 0) AS n5059,
      COALESCE(fgm60, 0) AS n60,
      COALESCE(fg_made_total, 0) AS fg_made_total
    FROM nums
  ),
  kicked AS (
    SELECT
      r.*,
      CASE
        WHEN (r.n0039 + r.n4049 + r.n5059 + r.n60) = 0 AND r.fg_made_total > 0 THEN
          r.pat_made * 1.0 + r.fg_made_total * 3.0
        ELSE
          r.pat_made * 1.0
          + r.n0039 * 3.0
          + r.n4049 * 4.0
          + r.n5059 * 5.0
          + r.n60 * 5.0
      END AS kick_fp
    FROM resolved r
  )
  SELECT jsonb_build_object(
    'pat_made', pat_made,
    'pat_att', pat_att,
    'fg_att', fg_att,
    'fg_made', fg_made_total,
    'fg_0039', n0039,
    'fg_4049', n4049,
    'fg_5059', n5059,
    'fg_60', n60,
    'kick_fp', kick_fp
  )
  FROM kicked;
$kd$;

COMMENT ON FUNCTION public.kicker_weekly_derived_json(jsonb) IS
  'Per-week kicker counting stats + kick_fp from weekly_stats row as JSON (keys align with app kickerFantasyPoints).';

CREATE OR REPLACE FUNCTION public.kicking_fp_add_on_from_weekly_json(j jsonb)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $kfp$
  SELECT (public.kicker_weekly_derived_json(j)->>'kick_fp')::double precision;
$kfp$;

COMMENT ON FUNCTION public.kicking_fp_add_on_from_weekly_json(jsonb) IS
  'Kicker-only fantasy points from weekly_stats row as JSON (delegates to kicker_weekly_derived_json).';

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
  k_fg_60 bigint
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
      COALESCE(SUM(
        CASE
          WHEN UPPER(TRIM(COALESCE(w.position, ''))) = 'K' THEN
            COALESCE(w.fantasy_points, 0)::double precision
            + public.kicking_fp_add_on_from_weekly_json(to_jsonb(w))
          ELSE w.fantasy_points::double precision
        END
      ), 0)::double precision AS total_fp_standard,
      COALESCE(SUM(
        CASE
          WHEN UPPER(TRIM(COALESCE(w.position, ''))) = 'K' THEN
            COALESCE(w.fantasy_points_ppr, w.fantasy_points, 0)::double precision
            + public.kicking_fp_add_on_from_weekly_json(to_jsonb(w))
          ELSE w.fantasy_points_ppr::double precision
        END
      ), 0)::double precision AS total_fp_ppr,
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
      (array_agg(w.position ORDER BY w.week))[1] AS "position",
      COALESCE(SUM(
        CASE WHEN UPPER(TRIM(COALESCE(w.position, ''))) = 'K' THEN
          (public.kicker_weekly_derived_json(to_jsonb(w))->>'pat_made')::double precision
        ELSE 0 END
      ), 0)::bigint AS k_pat_made,
      COALESCE(SUM(
        CASE WHEN UPPER(TRIM(COALESCE(w.position, ''))) = 'K' THEN
          (public.kicker_weekly_derived_json(to_jsonb(w))->>'pat_att')::double precision
        ELSE 0 END
      ), 0)::bigint AS k_pat_att,
      COALESCE(SUM(
        CASE WHEN UPPER(TRIM(COALESCE(w.position, ''))) = 'K' THEN
          (public.kicker_weekly_derived_json(to_jsonb(w))->>'fg_made')::double precision
        ELSE 0 END
      ), 0)::bigint AS k_fg_made,
      COALESCE(SUM(
        CASE WHEN UPPER(TRIM(COALESCE(w.position, ''))) = 'K' THEN
          (public.kicker_weekly_derived_json(to_jsonb(w))->>'fg_att')::double precision
        ELSE 0 END
      ), 0)::bigint AS k_fg_att,
      COALESCE(SUM(
        CASE WHEN UPPER(TRIM(COALESCE(w.position, ''))) = 'K' THEN
          (public.kicker_weekly_derived_json(to_jsonb(w))->>'fg_0039')::double precision
        ELSE 0 END
      ), 0)::bigint AS k_fg_0039,
      COALESCE(SUM(
        CASE WHEN UPPER(TRIM(COALESCE(w.position, ''))) = 'K' THEN
          (public.kicker_weekly_derived_json(to_jsonb(w))->>'fg_4049')::double precision
        ELSE 0 END
      ), 0)::bigint AS k_fg_4049,
      COALESCE(SUM(
        CASE WHEN UPPER(TRIM(COALESCE(w.position, ''))) = 'K' THEN
          (public.kicker_weekly_derived_json(to_jsonb(w))->>'fg_5059')::double precision
        ELSE 0 END
      ), 0)::bigint AS k_fg_5059,
      COALESCE(SUM(
        CASE WHEN UPPER(TRIM(COALESCE(w.position, ''))) = 'K' THEN
          (public.kicker_weekly_derived_json(to_jsonb(w))->>'fg_60')::double precision
        ELSE 0 END
      ), 0)::bigint AS k_fg_60
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
      r.pos_rank AS position_rank,
      r.k_pat_made,
      r.k_pat_att,
      r.k_fg_made,
      r.k_fg_att,
      r.k_fg_0039,
      r.k_fg_4049,
      r.k_fg_5059,
      r.k_fg_60
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
         mapped.k_fg_0039, mapped.k_fg_4049, mapped.k_fg_5059, mapped.k_fg_60
  FROM mapped;
END;
$$;
