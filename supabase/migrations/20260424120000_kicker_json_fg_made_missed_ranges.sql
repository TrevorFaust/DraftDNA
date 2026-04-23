-- Sum fg_made_0_19 + 20_29 + 30_39 (and hyphenated JSON keys from to_jsonb) for short FG makes.
-- Short FG attempts: prefer explicit fga_0_19 / 20_29 / 30_39; else per-band made + fg_missed_*.
-- Other distances: optional fg_missed_* with fga_* / fg_att_* for attempt totals.

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
      (NULLIF(btrim(COALESCE(j->>'fgm_60p', j->>'fgm_60', j->>'fg_made_60', j->>'fg_made_60p', j->>'fg_made_60_plus', j->>'fg_60_plus', '')), ''))::double precision AS m60,
      (NULLIF(btrim(COALESCE(j->>'fg_missed_60', j->>'fg_missed_60p', j->>'fg_missed_60_plus', '')), ''))::double precision AS ms60,
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
  bands AS (
    SELECT
      n.*,
      COALESCE(n.m019, 0::double precision)
        + COALESCE(n.m2029, 0::double precision)
        + COALESCE(n.m3039, 0::double precision) AS fg0039_parts,
      CASE
        WHEN n.m019 IS NULL AND n.ms019 IS NULL THEN NULL::double precision
        ELSE COALESCE(n.m019, 0::double precision) + COALESCE(n.ms019, 0::double precision)
      END AS att019,
      CASE
        WHEN n.m2029 IS NULL AND n.ms2029 IS NULL THEN NULL::double precision
        ELSE COALESCE(n.m2029, 0::double precision) + COALESCE(n.ms2029, 0::double precision)
      END AS att2029,
      CASE
        WHEN n.m3039 IS NULL AND n.ms3039 IS NULL THEN NULL::double precision
        ELSE COALESCE(n.m3039, 0::double precision) + COALESCE(n.ms3039, 0::double precision)
      END AS att3039,
      CASE
        WHEN n.m4049 IS NULL AND n.ms4049 IS NULL THEN NULL::double precision
        ELSE COALESCE(n.m4049, 0::double precision) + COALESCE(n.ms4049, 0::double precision)
      END AS att4049,
      CASE
        WHEN n.m5059 IS NULL AND n.ms5059 IS NULL THEN NULL::double precision
        ELSE COALESCE(n.m5059, 0::double precision) + COALESCE(n.ms5059, 0::double precision)
      END AS att5059,
      CASE
        WHEN n.m60 IS NULL AND n.ms60 IS NULL THEN NULL::double precision
        ELSE COALESCE(n.m60, 0::double precision) + COALESCE(n.ms60, 0::double precision)
      END AS att60
    FROM nums n
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
        WHEN b.att019 IS NOT NULL OR b.att2029 IS NOT NULL OR b.att3039 IS NOT NULL THEN
          COALESCE(b.att019, 0::double precision)
          + COALESCE(b.att2029, 0::double precision)
          + COALESCE(b.att3039, 0::double precision)
        ELSE NULL::double precision
      END AS fga0039_parts_sum,
      COALESCE(b.fga_40_49_raw, b.fg_att_40_49_raw, b.att4049) AS fga4049_single,
      COALESCE(b.fga_50_59_raw, b.fg_att_50_59_raw, b.att5059) AS fga5059_single,
      COALESCE(b.fga_60p_raw, b.fga_60_raw, b.fg_att_60_raw, b.att60) AS fga60_single
    FROM bands b
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
  'Per-week kicker stats + kick_fp; short FG from fg_made_0_19/20_29/30_39 + misses; attempts from fga_* or made+missed.';
