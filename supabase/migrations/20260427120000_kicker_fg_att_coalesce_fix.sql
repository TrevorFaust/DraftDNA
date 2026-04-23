-- Fix att COALESCE: computed band att_* was always >=0 so COALESCE(att, fga_*) never read fga_40_49 / fg_att_* from weekly_stats.
-- bands2 now yields NULL when a band has no activity; GREATEST(makes, COALESCE(fga, fg_att, computed_att)).
-- Safe if 20260426120000 already applied (replaces same function).

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
      (NULLIF(btrim(COALESCE(j->>'fg_made_0_19', j->>'fg_made_0-19', j->>'fgm_0_19', '')), ''))::double precision AS m019,
      (NULLIF(btrim(COALESCE(j->>'fg_made_20_29', j->>'fg_made_20-29', j->>'fgm_20_29', '')), ''))::double precision AS m2029,
      (NULLIF(btrim(COALESCE(j->>'fg_made_30_39', j->>'fg_made_30-39', j->>'fgm_30_39', j->>'fg_made_3039', '')), ''))::double precision AS m3039,
      (NULLIF(btrim(COALESCE(j->>'fg_missed_0_19', j->>'fg_missed_0-19', '')), ''))::double precision AS ms019,
      (NULLIF(btrim(COALESCE(j->>'fg_missed_20_29', j->>'fg_missed_20-29', '')), ''))::double precision AS ms2029,
      (NULLIF(btrim(COALESCE(j->>'fg_missed_30_39', j->>'fg_missed_30-39', '')), ''))::double precision AS ms3039,
      (NULLIF(btrim(COALESCE(j->>'fgm_40_49', j->>'fg_made_40_49', j->>'fg_made_40-49', '')), ''))::double precision AS m4049,
      (NULLIF(btrim(COALESCE(j->>'fg_missed_40_49', j->>'fg_missed_40-49', '')), ''))::double precision AS ms4049,
      (NULLIF(btrim(COALESCE(j->>'fgm_50_59', j->>'fg_made_50_59', j->>'fg_made_50-59', '')), ''))::double precision AS m5059,
      (NULLIF(btrim(COALESCE(j->>'fg_missed_50_59', j->>'fg_missed_50-59', '')), ''))::double precision AS ms5059,
      (NULLIF(btrim(COALESCE(
        j->>'fgm_60p',
        j->>'fgm_60',
        j->>'fg_made_60',
        j->>'fg_made_60_',
        j->>'fg_made_60p',
        j->>'fg_made_60_plus',
        j->>'fg_60_plus'
      )), ''))::double precision AS m60,
      (NULLIF(btrim(COALESCE(j->>'fg_missed_60', j->>'fg_missed_60_', j->>'fg_missed_60p', j->>'fg_missed_60_plus', '')), ''))::double precision AS ms60,
      (NULLIF(btrim(COALESCE(j->>'fg_blocked_0_19', j->>'fg_blocked_0-19', j->>'fg_block_0_19', '')), ''))::double precision AS blk019,
      (NULLIF(btrim(COALESCE(j->>'fg_blocked_20_29', j->>'fg_blocked_20-29', j->>'fg_block_20_29', '')), ''))::double precision AS blk2029,
      (NULLIF(btrim(COALESCE(j->>'fg_blocked_30_39', j->>'fg_blocked_30-39', j->>'fg_block_30_39', '')), ''))::double precision AS blk3039,
      (NULLIF(btrim(COALESCE(j->>'fg_blocked_40_49', j->>'fg_blocked_40-49', j->>'fg_block_40_49', '')), ''))::double precision AS blk4049,
      (NULLIF(btrim(COALESCE(j->>'fg_blocked_50_59', j->>'fg_blocked_50-59', j->>'fg_block_50_59', '')), ''))::double precision AS blk5059,
      (NULLIF(btrim(COALESCE(j->>'fg_blocked_60', j->>'fg_blocked_60_', j->>'fg_blocked_60p', j->>'fg_block_60', '')), ''))::double precision AS blk60,
      COALESCE((NULLIF(btrim(COALESCE(j->>'fg_made', '')), ''))::double precision, (NULLIF(btrim(COALESCE(j->>'fgm', '')), ''))::double precision, 0) AS fg_made_total,
      (NULLIF(btrim(COALESCE(j->>'fg_missed', j->>'fg_miss', '')), ''))::double precision AS fg_missed_agg,
      (NULLIF(btrim(COALESCE(j->>'fg_blocked', j->>'fg_blocks', '')), ''))::double precision AS fg_blocked_agg,
      (NULLIF(btrim(COALESCE(j->>'fga_0_19', '')), ''))::double precision AS fga_0_19_raw,
      (NULLIF(btrim(COALESCE(j->>'fga_20_29', '')), ''))::double precision AS fga_20_29_raw,
      (NULLIF(btrim(COALESCE(j->>'fga_30_39', '')), ''))::double precision AS fga_30_39_raw,
      COALESCE(
        (NULLIF(btrim(COALESCE(j->>'fg_att_0_39', '')), ''))::double precision,
        (NULLIF(btrim(COALESCE(j->>'fg_att_1_39', '')), ''))::double precision,
        (NULLIF(btrim(COALESCE(j->>'fga_0039', '')), ''))::double precision
      ) AS fga0039_single,
      (NULLIF(btrim(COALESCE(j->>'fga_40_49', j->>'fga_40-49', j->>'fga_4049', '')), ''))::double precision AS fga_40_49_raw,
      (NULLIF(btrim(COALESCE(j->>'fg_att_40_49', j->>'fg_att_40-49', '')), ''))::double precision AS fg_att_40_49_raw,
      (NULLIF(btrim(COALESCE(j->>'fga_50_59', j->>'fga_50-59', j->>'fga_5059', '')), ''))::double precision AS fga_50_59_raw,
      (NULLIF(btrim(COALESCE(j->>'fg_att_50_59', j->>'fg_att_50-59', '')), ''))::double precision AS fg_att_50_59_raw,
      (NULLIF(btrim(COALESCE(j->>'fga_60p', j->>'fga_60_p', '')), ''))::double precision AS fga_60p_raw,
      (NULLIF(btrim(COALESCE(j->>'fga_60', j->>'fga_60_', '')), ''))::double precision AS fga_60_raw,
      (NULLIF(btrim(COALESCE(j->>'fg_att_60', j->>'fg_att_60p', '')), ''))::double precision AS fg_att_60_raw
  ),
  bands AS (
    SELECT
      n.*,
      COALESCE(n.m019, 0::double precision)
        + COALESCE(n.m2029, 0::double precision)
        + COALESCE(n.m3039, 0::double precision) AS fg0039_parts,
      COALESCE(
        COALESCE(n.m019, 0::double precision) + COALESCE(n.ms019, 0::double precision)
        + COALESCE(n.m2029, 0::double precision) + COALESCE(n.ms2029, 0::double precision)
        + COALESCE(n.m3039, 0::double precision) + COALESCE(n.ms3039, 0::double precision)
        + COALESCE(n.m4049, 0::double precision) + COALESCE(n.ms4049, 0::double precision)
        + COALESCE(n.m5059, 0::double precision) + COALESCE(n.ms5059, 0::double precision)
        + COALESCE(n.m60, 0::double precision) + COALESCE(n.ms60, 0::double precision),
        0::double precision
      ) AS touch_all,
      (
        n.blk019 IS NOT NULL OR n.blk2029 IS NOT NULL OR n.blk3039 IS NOT NULL
        OR n.blk4049 IS NOT NULL OR n.blk5059 IS NOT NULL OR n.blk60 IS NOT NULL
      ) AS has_any_range_blk,
      CASE
        WHEN n.m019 IS NULL AND n.ms019 IS NULL AND n.blk019 IS NULL THEN NULL::double precision
        ELSE COALESCE(n.m019, 0::double precision) + COALESCE(n.ms019, 0::double precision) + COALESCE(n.blk019, 0::double precision)
      END AS base019,
      CASE
        WHEN n.m2029 IS NULL AND n.ms2029 IS NULL AND n.blk2029 IS NULL THEN NULL::double precision
        ELSE COALESCE(n.m2029, 0::double precision) + COALESCE(n.ms2029, 0::double precision) + COALESCE(n.blk2029, 0::double precision)
      END AS base2029,
      CASE
        WHEN n.m3039 IS NULL AND n.ms3039 IS NULL AND n.blk3039 IS NULL THEN NULL::double precision
        ELSE COALESCE(n.m3039, 0::double precision) + COALESCE(n.ms3039, 0::double precision) + COALESCE(n.blk3039, 0::double precision)
      END AS base3039,
      CASE
        WHEN n.m4049 IS NULL AND n.ms4049 IS NULL AND n.blk4049 IS NULL THEN NULL::double precision
        ELSE COALESCE(n.m4049, 0::double precision) + COALESCE(n.ms4049, 0::double precision) + COALESCE(n.blk4049, 0::double precision)
      END AS base4049,
      CASE
        WHEN n.m5059 IS NULL AND n.ms5059 IS NULL AND n.blk5059 IS NULL THEN NULL::double precision
        ELSE COALESCE(n.m5059, 0::double precision) + COALESCE(n.ms5059, 0::double precision) + COALESCE(n.blk5059, 0::double precision)
      END AS base5059,
      CASE
        WHEN n.m60 IS NULL AND n.ms60 IS NULL AND n.blk60 IS NULL THEN NULL::double precision
        ELSE COALESCE(n.m60, 0::double precision) + COALESCE(n.ms60, 0::double precision) + COALESCE(n.blk60, 0::double precision)
      END AS base60,
      (
        COALESCE(n.ms019, 0::double precision)
        + COALESCE(n.ms2029, 0::double precision)
        + COALESCE(n.ms3039, 0::double precision)
        + COALESCE(n.ms4049, 0::double precision)
        + COALESCE(n.ms5059, 0::double precision)
        + COALESCE(n.ms60, 0::double precision)
      ) AS fg_miss_sum_ranges,
      (
        n.ms019 IS NOT NULL OR n.ms2029 IS NOT NULL OR n.ms3039 IS NOT NULL
        OR n.ms4049 IS NOT NULL OR n.ms5059 IS NOT NULL OR n.ms60 IS NOT NULL
      ) AS has_any_range_miss
    FROM nums n
  ),
  alloc AS (
    SELECT
      b.*,
      CASE
        WHEN NOT b.has_any_range_blk AND COALESCE(b.fg_blocked_agg, 0::double precision) > 0::double precision
          AND b.touch_all > 0::double precision
          THEN COALESCE(b.fg_blocked_agg, 0::double precision)
            * (COALESCE(b.m019, 0::double precision) + COALESCE(b.ms019, 0::double precision)) / b.touch_all
        ELSE 0::double precision
      END AS blk_alloc_019,
      CASE
        WHEN NOT b.has_any_range_blk AND COALESCE(b.fg_blocked_agg, 0::double precision) > 0::double precision
          AND b.touch_all > 0::double precision
          THEN COALESCE(b.fg_blocked_agg, 0::double precision)
            * (COALESCE(b.m2029, 0::double precision) + COALESCE(b.ms2029, 0::double precision)) / b.touch_all
        ELSE 0::double precision
      END AS blk_alloc_2029,
      CASE
        WHEN NOT b.has_any_range_blk AND COALESCE(b.fg_blocked_agg, 0::double precision) > 0::double precision
          AND b.touch_all > 0::double precision
          THEN COALESCE(b.fg_blocked_agg, 0::double precision)
            * (COALESCE(b.m3039, 0::double precision) + COALESCE(b.ms3039, 0::double precision)) / b.touch_all
        ELSE 0::double precision
      END AS blk_alloc_3039,
      CASE
        WHEN NOT b.has_any_range_blk AND COALESCE(b.fg_blocked_agg, 0::double precision) > 0::double precision
          AND b.touch_all > 0::double precision
          THEN COALESCE(b.fg_blocked_agg, 0::double precision)
            * (COALESCE(b.m4049, 0::double precision) + COALESCE(b.ms4049, 0::double precision)) / b.touch_all
        ELSE 0::double precision
      END AS blk_alloc_4049,
      CASE
        WHEN NOT b.has_any_range_blk AND COALESCE(b.fg_blocked_agg, 0::double precision) > 0::double precision
          AND b.touch_all > 0::double precision
          THEN COALESCE(b.fg_blocked_agg, 0::double precision)
            * (COALESCE(b.m5059, 0::double precision) + COALESCE(b.ms5059, 0::double precision)) / b.touch_all
        ELSE 0::double precision
      END AS blk_alloc_5059,
      CASE
        WHEN NOT b.has_any_range_blk AND COALESCE(b.fg_blocked_agg, 0::double precision) > 0::double precision
          AND b.touch_all > 0::double precision
          THEN COALESCE(b.fg_blocked_agg, 0::double precision)
            * (COALESCE(b.m60, 0::double precision) + COALESCE(b.ms60, 0::double precision)) / b.touch_all
        ELSE 0::double precision
      END AS blk_alloc_60,
      CASE
        WHEN NOT b.has_any_range_blk AND COALESCE(b.fg_blocked_agg, 0::double precision) > 0::double precision
          AND b.touch_all = 0::double precision
          THEN COALESCE(b.fg_blocked_agg, 0::double precision)
        ELSE 0::double precision
      END AS blocked_all_short_fallback
    FROM bands b
  ),
  bands2 AS (
    SELECT
      a.*,
      CASE
        WHEN a.base019 IS NULL AND COALESCE(a.blk_alloc_019, 0::double precision) = 0::double precision THEN NULL::double precision
        ELSE COALESCE(a.base019, 0::double precision) + COALESCE(a.blk_alloc_019, 0::double precision)
      END AS att019,
      CASE
        WHEN a.base2029 IS NULL AND COALESCE(a.blk_alloc_2029, 0::double precision) = 0::double precision THEN NULL::double precision
        ELSE COALESCE(a.base2029, 0::double precision) + COALESCE(a.blk_alloc_2029, 0::double precision)
      END AS att2029,
      CASE
        WHEN a.base3039 IS NULL AND COALESCE(a.blk_alloc_3039, 0::double precision) = 0::double precision THEN NULL::double precision
        ELSE COALESCE(a.base3039, 0::double precision) + COALESCE(a.blk_alloc_3039, 0::double precision)
      END AS att3039,
      CASE
        WHEN a.base4049 IS NULL AND COALESCE(a.blk_alloc_4049, 0::double precision) = 0::double precision THEN NULL::double precision
        ELSE COALESCE(a.base4049, 0::double precision) + COALESCE(a.blk_alloc_4049, 0::double precision)
      END AS att4049,
      CASE
        WHEN a.base5059 IS NULL AND COALESCE(a.blk_alloc_5059, 0::double precision) = 0::double precision THEN NULL::double precision
        ELSE COALESCE(a.base5059, 0::double precision) + COALESCE(a.blk_alloc_5059, 0::double precision)
      END AS att5059,
      CASE
        WHEN a.base60 IS NULL AND COALESCE(a.blk_alloc_60, 0::double precision) = 0::double precision THEN NULL::double precision
        ELSE COALESCE(a.base60, 0::double precision) + COALESCE(a.blk_alloc_60, 0::double precision)
      END AS att60
    FROM alloc a
  ),
  resolved AS (
    SELECT
      b.*,
      COALESCE(b.fg0039_single, b.fg0039_parts, 0::double precision) AS n0039_raw,
      COALESCE(b.m4049, 0::double precision) AS n4049,
      COALESCE(b.m5059, 0::double precision) AS n5059,
      COALESCE(b.m60, 0::double precision) AS n60,
      CASE
        WHEN b.fga_0_19_raw IS NOT NULL OR b.fga_20_29_raw IS NOT NULL OR b.fga_30_39_raw IS NOT NULL THEN
          COALESCE(b.fga_0_19_raw, 0::double precision)
          + COALESCE(b.fga_20_29_raw, 0::double precision)
          + COALESCE(b.fga_30_39_raw, 0::double precision)
        WHEN b.base019 IS NOT NULL OR b.base2029 IS NOT NULL OR b.base3039 IS NOT NULL
          OR b.m019 IS NOT NULL OR b.m2029 IS NOT NULL OR b.m3039 IS NOT NULL
          OR b.ms019 IS NOT NULL OR b.ms2029 IS NOT NULL OR b.ms3039 IS NOT NULL
          THEN
          COALESCE(b.att019, 0::double precision)
          + COALESCE(b.att2029, 0::double precision)
          + COALESCE(b.att3039, 0::double precision)
          + COALESCE(b.blocked_all_short_fallback, 0::double precision)
        ELSE NULL::double precision
      END AS fga0039_parts_sum,
      CASE
        WHEN b.has_any_range_miss THEN b.fg_miss_sum_ranges
        ELSE COALESCE(b.fg_missed_agg, 0::double precision)
      END AS fg_miss_count_fp,
      COALESCE(b.fg_blocked_agg, 0::double precision) AS fg_block_count_fp
    FROM bands2 b
  ),
  bucketed AS (
    SELECT
      r.pat_made,
      r.pat_att,
      r.fg_att,
      r.fg_made_total,
      r.fga0039_single,
      r.fga0039_parts_sum,
      r.n0039_raw,
      r.n4049,
      r.n5059,
      r.n60,
      r.fg0039_single,
      r.ms019,
      r.ms2029,
      r.ms3039,
      r.fg_missed_agg,
      r.fg_blocked_agg,
      r.fg_miss_count_fp,
      r.fg_block_count_fp,
      r.fga_40_49_raw,
      r.fg_att_40_49_raw,
      r.fga_50_59_raw,
      r.fg_att_50_59_raw,
      r.fga_60p_raw,
      r.fga_60_raw,
      r.fg_att_60_raw,
      r.att019,
      r.att2029,
      r.att3039,
      r.att4049,
      r.att5059,
      r.att60,
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
        ELSE GREATEST(
          CASE WHEN b.use_fallback THEN 0::double precision ELSE b.n0039_raw END,
          COALESCE(
            b.fga0039_parts_sum,
            b.fga0039_single,
            CASE
              WHEN b.fg0039_single IS NOT NULL OR b.n0039_raw > 0 THEN
                (CASE WHEN b.use_fallback THEN b.fg_made_total ELSE b.n0039_raw END)
                + CASE
                    WHEN b.ms019 IS NOT NULL OR b.ms2029 IS NOT NULL OR b.ms3039 IS NOT NULL THEN
                      COALESCE(b.ms019, 0::double precision)
                      + COALESCE(b.ms2029, 0::double precision)
                      + COALESCE(b.ms3039, 0::double precision)
                    WHEN (CASE WHEN b.use_fallback THEN 0::double precision ELSE b.n4049 END)
                      + (CASE WHEN b.use_fallback THEN 0::double precision ELSE b.n5059 END)
                      + (CASE WHEN b.use_fallback THEN 0::double precision ELSE b.n60 END) = 0
                      THEN COALESCE(b.fg_missed_agg, 0::double precision)
                    ELSE 0::double precision
                  END
                + CASE
                    WHEN (CASE WHEN b.use_fallback THEN 0::double precision ELSE b.n4049 END)
                      + (CASE WHEN b.use_fallback THEN 0::double precision ELSE b.n5059 END)
                      + (CASE WHEN b.use_fallback THEN 0::double precision ELSE b.n60 END) = 0
                    THEN COALESCE(b.fg_blocked_agg, 0::double precision)
                    ELSE 0::double precision
                  END
              ELSE NULL::double precision
            END
          )
        )
      END AS fg_att_0039_out,
      CASE
        WHEN b.use_fallback THEN 0::double precision
        ELSE GREATEST(
          COALESCE(b.n4049, 0::double precision),
          COALESCE(b.fga_40_49_raw, b.fg_att_40_49_raw, b.att4049)
        )
      END AS fg_att_4049_out,
      CASE
        WHEN b.use_fallback THEN 0::double precision
        ELSE GREATEST(
          COALESCE(b.n5059, 0::double precision),
          COALESCE(b.fga_50_59_raw, b.fg_att_50_59_raw, b.att5059)
        )
      END AS fg_att_5059_out,
      CASE
        WHEN b.use_fallback THEN 0::double precision
        ELSE GREATEST(
          COALESCE(b.n60, 0::double precision),
          COALESCE(b.fga_60p_raw, b.fga_60_raw, b.fg_att_60_raw, b.att60)
        )
      END AS fg_att_60_out,
      (
        CASE
          WHEN b.use_fallback THEN b.pat_made * 1.0 + b.fg_made_total * 3.0
          ELSE
            b.pat_made * 1.0
            + (CASE WHEN b.use_fallback THEN b.fg_made_total ELSE b.n0039_raw END) * 3.0
            + (CASE WHEN b.use_fallback THEN 0::double precision ELSE b.n4049 END) * 4.0
            + (CASE WHEN b.use_fallback THEN 0::double precision ELSE b.n5059 END) * 5.0
            + (CASE WHEN b.use_fallback THEN 0::double precision ELSE b.n60 END) * 5.0
        END
        - 1.0 * (b.fg_miss_count_fp + b.fg_block_count_fp)
      ) AS kick_fp
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
  'Kicker weekly: fg_att_* from COALESCE(fga_*, fg_att_*, made+miss+blk per band); att >= makes; kick_fp −1 per miss and per block.';
