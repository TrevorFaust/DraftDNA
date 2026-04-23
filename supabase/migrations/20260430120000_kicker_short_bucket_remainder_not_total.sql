-- Fix FG 1–39 inflated counts: when short-band fg_made_* are all zero but fg_made_total > 0,
-- do not assign the full fg_made_total to 1–39 if fg_made_40_49 / 50_59 / 60 already sum to part of it.
-- Short makes = remainder GREATEST(0, fg_made_total - long bands); blocks stay in kick_fp penalty only.

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
      (x.m4049 + x.m5059 + x.m60) AS m_long_sum,
      CASE
        WHEN (x.m019 + x.m2029 + x.m3039) > 0 THEN x.m019 + x.m2029 + x.m3039
        WHEN x.fg_made_0_39_agg IS NOT NULL AND x.fg_made_0_39_agg > 0 THEN x.fg_made_0_39_agg
        WHEN x.fg_made_total > 0 THEN
          CASE
            WHEN (x.m4049 + x.m5059 + x.m60) > 0 THEN
              GREATEST(0::double precision, x.fg_made_total - (x.m4049 + x.m5059 + x.m60))
            ELSE x.fg_made_total
          END
        WHEN x.fg_made_0_39_agg IS NOT NULL THEN x.fg_made_0_39_agg
        ELSE x.m019 + x.m2029 + x.m3039
      END AS n0039_makes,
      CASE
        WHEN (x.m019 + x.m2029 + x.m3039) > 0 THEN x.m019 + x.ms019 + x.m2029 + x.ms2029 + x.m3039 + x.ms3039
        WHEN x.fg_made_0_39_agg IS NOT NULL AND x.fg_made_0_39_agg > 0 THEN x.fg_made_0_39_agg + x.ms019 + x.ms2029 + x.ms3039
        WHEN x.fg_made_total > 0 THEN
          (
            CASE
              WHEN (x.m4049 + x.m5059 + x.m60) > 0 THEN
                GREATEST(0::double precision, x.fg_made_total - (x.m4049 + x.m5059 + x.m60))
              ELSE x.fg_made_total
            END
          ) + x.ms019 + x.ms2029 + x.ms3039
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
  'Kicker weekly: 1–39 makes = granular short, else positive fg_made_0_39, else remainder of fg_made_total after 40+/50+/60 bands, else fg_made_0_39 or 0; att_* = made+miss per bucket; fg_blocked only in −1 kick_fp penalty.';
