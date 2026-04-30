/**
 * Kicker fantasy scoring (ESPN-style default).
 * - XPM: 1 pt each (only makes count; misses/blocks are not in `pat_made`).
 * - FG: 3 pts (1–39 yd), 4 pts (40–49), 5 pts (50–59), 5 pts (60+).
 * - FG miss + blocked kick: −1 pt each (`fg_missed_*` / `fg_missed` and `fg_blocked`).
 *
 * Supports multiple `weekly_stats_2025` / API column naming conventions per bucket.
 */

/** Same shape as `FantasyPointsBreakdownItem` in fantasyPoints.ts (avoid circular import). */
export interface KickerFantasyBreakdownItem {
  label: string;
  statValue: number;
  points: number;
}

const PAT_MADE_KEYS = ['pat_made', 'xpm', 'extra_points_made', 'kicking_extra_points_made'] as const;

const FG_SHORT_SINGLE_KEYS = [
  'fg_made_0_39',
  'fg_made_1_39',
  'fg_made_0039',
  'fgm_0039',
  'fg_0039',
  'fg_made_under_40',
  'fg_1_39',
] as const;

const FG_0_19_KEYS = ['fgm_0_19', 'fg_made_0_19', 'fg_made_0-19', 'fg_made_0019'] as const;
const FG_20_29_KEYS = ['fgm_20_29', 'fg_made_20_29', 'fg_made_20-29', 'fg_made_2029'] as const;
const FG_30_39_KEYS = ['fgm_30_39', 'fg_made_30_39', 'fg_made_30-39', 'fg_made_3039'] as const;

const FG_40_49_KEYS = ['fgm_40_49', 'fg_made_40_49', 'fg_made_40-49', 'fg_made_4049', 'fg_40_49'] as const;
const FG_50_59_KEYS = ['fgm_50_59', 'fg_made_50_59', 'fg_made_50-59', 'fg_made_5059', 'fg_50_59'] as const;
const FG_60_PLUS_KEYS = ['fgm_60p', 'fgm_60', 'fg_made_60', 'fg_made_60p', 'fg_made_60_plus', 'fg_60_plus'] as const;

const FG_MADE_TOTAL_KEYS = ['fg_made', 'fgm', 'field_goals_made'] as const;

const PTS_PAT = 1;
const PTS_FG_0_39 = 3;
const PTS_FG_40_49 = 4;
const PTS_FG_50_59 = 5;
const PTS_FG_60_PLUS = 5;
/** Penalty per missed FG or blocked kick (matches DB `kicker_weekly_derived_json`). */
const PTS_FG_MISS_OR_BLOCK = 1;

const FG_MISSED_AGG_KEYS = ['fg_missed', 'fg_miss'] as const;
const FG_BLOCKED_KEYS = ['fg_blocked', 'fg_blocks'] as const;

const FG_MISSED_RANGE_KEY_GROUPS = [
  ['fg_missed_0_19', 'fg_missed_0-19'],
  ['fg_missed_20_29', 'fg_missed_20-29'],
  ['fg_missed_30_39', 'fg_missed_30-39'],
  ['fg_missed_40_49', 'fg_missed_40-49'],
  ['fg_missed_50_59', 'fg_missed_50-59'],
  ['fg_missed_60', 'fg_missed_60_', 'fg_missed_60p', 'fg_missed_60_plus'],
] as const;

/** Keys commonly copied from `weekly_stats_2025` into the client row for display + scoring. */
export const KICKER_WEEKLY_PASSTHROUGH_KEYS = [
  'pat_att',
  'pat_made',
  'xpa',
  'xpm',
  'fgm_0_19',
  'fgm_20_29',
  'fgm_30_39',
  'fgm_40_49',
  'fgm_50_59',
  'fgm_60p',
  'fg_made_0_19',
  'fg_made_0-19',
  'fg_made_20_29',
  'fg_made_20-29',
  'fg_made_30_39',
  'fg_made_30-39',
  'fg_missed_0_19',
  'fg_missed_0-19',
  'fg_missed_20_29',
  'fg_missed_20-29',
  'fg_missed_30_39',
  'fg_missed_30-39',
  'fg_missed_40_49',
  'fg_missed_40-49',
  'fg_missed_50_59',
  'fg_missed_50-59',
  'fg_missed_60',
  'fg_missed_60p',
  'fg_blocked_0_19',
  'fg_blocked_0-19',
  'fg_blocked_20_29',
  'fg_blocked_20-29',
  'fg_blocked_30_39',
  'fg_blocked_30-39',
  'fg_blocked_40_49',
  'fg_blocked_40-49',
  'fg_blocked_50_59',
  'fg_blocked_50-59',
  'fg_blocked_60',
  'fg_blocked_60p',
  'fg_made_0_39',
  'fg_made_1_39',
  'fg_made_40_49',
  'fg_made_50_59',
  'fg_made_60',
  'fg_made',
  'fg_att',
  'fg_missed',
  'fg_miss',
  'fg_blocked',
  'fg_blocks',
  /** Distance strings for weekly player popup tooltips */
  'fg_made_list',
  'fg_missed_list',
] as const;

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function firstDefinedFinite(row: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(row, k)) continue;
    const n = toFiniteNumber(row[k]);
    if (n != null) return n;
  }
  return null;
}

function sumPartBuckets(row: Record<string, unknown>, keyGroups: readonly (readonly string[])[]): number {
  let sum = 0;
  for (const group of keyGroups) {
    const v = firstDefinedFinite(row, group as unknown as string[]);
    if (v != null) sum += Math.max(0, v);
  }
  return sum;
}

/** Made FGs in the 0–39 / 1–39 yard bucket. */
export function pickFgMade0To39(row: Record<string, unknown>): number {
  const single = firstDefinedFinite(row, [...FG_SHORT_SINGLE_KEYS]);
  if (single != null) return Math.max(0, single);
  return Math.max(
    0,
    sumPartBuckets(row, [FG_0_19_KEYS, FG_20_29_KEYS, FG_30_39_KEYS])
  );
}

export function pickFgMade40To49(row: Record<string, unknown>): number {
  const v = firstDefinedFinite(row, [...FG_40_49_KEYS]);
  return v != null ? Math.max(0, v) : 0;
}

export function pickFgMade50To59(row: Record<string, unknown>): number {
  const v = firstDefinedFinite(row, [...FG_50_59_KEYS]);
  return v != null ? Math.max(0, v) : 0;
}

export function pickFgMade60Plus(row: Record<string, unknown>): number {
  const v = firstDefinedFinite(row, [...FG_60_PLUS_KEYS]);
  return v != null ? Math.max(0, v) : 0;
}

export function pickPatMade(row: Record<string, unknown>): number {
  const v = firstDefinedFinite(row, [...PAT_MADE_KEYS]);
  return v != null ? Math.max(0, v) : 0;
}

function pickFgMadeTotal(row: Record<string, unknown>): number {
  const v = firstDefinedFinite(row, [...FG_MADE_TOTAL_KEYS]);
  return v != null ? Math.max(0, v) : 0;
}

/** Misses for scoring: sum distance-specific `fg_missed_*` when any is present; else aggregate `fg_missed`. */
function fgMissedCountForPenalty(row: Record<string, unknown>): number {
  const hasAnyRange = FG_MISSED_RANGE_KEY_GROUPS.some(
    (g) => firstDefinedFinite(row, g as unknown as string[]) != null
  );
  if (hasAnyRange) {
    let sum = 0;
    for (const g of FG_MISSED_RANGE_KEY_GROUPS) {
      sum += Math.max(0, firstDefinedFinite(row, g as unknown as string[]) ?? 0);
    }
    return sum;
  }
  const agg = firstDefinedFinite(row, [...FG_MISSED_AGG_KEYS]);
  return agg != null ? Math.max(0, agg) : 0;
}

function fgBlockedCount(row: Record<string, unknown>): number {
  const v = firstDefinedFinite(row, [...FG_BLOCKED_KEYS]);
  return v != null ? Math.max(0, v) : 0;
}

/** Fantasy points from kicking only (PAT + distance FGs − misses/blocks). */
export function computeKickerFantasyPointsFromRow(row: Record<string, unknown>): number {
  const pat = pickPatMade(row);
  const n0039 = pickFgMade0To39(row);
  const n4049 = pickFgMade40To49(row);
  const n5059 = pickFgMade50To59(row);
  const n60 = pickFgMade60Plus(row);
  const fromBuckets =
    pat * PTS_PAT +
    n0039 * PTS_FG_0_39 +
    n4049 * PTS_FG_40_49 +
    n5059 * PTS_FG_50_59 +
    n60 * PTS_FG_60_PLUS;

  const bucketSum = n0039 + n4049 + n5059 + n60;
  const fgMade = pickFgMadeTotal(row);
  const missBlockPenalty =
    PTS_FG_MISS_OR_BLOCK * (fgMissedCountForPenalty(row) + fgBlockedCount(row));

  if (bucketSum === 0 && fgMade > 0) {
    return pat * PTS_PAT + fgMade * PTS_FG_0_39 - missBlockPenalty;
  }
  return fromBuckets - missBlockPenalty;
}

export function getKickerFantasyBreakdownItems(row: Record<string, unknown>): KickerFantasyBreakdownItem[] {
  const items: KickerFantasyBreakdownItem[] = [];
  const pat = pickPatMade(row);
  if (pat) items.push({ label: 'XPM', statValue: pat, points: pat * PTS_PAT });
  const n0039 = pickFgMade0To39(row);
  if (n0039) items.push({ label: 'FG 1–39 yd', statValue: n0039, points: n0039 * PTS_FG_0_39 });
  const n4049 = pickFgMade40To49(row);
  if (n4049) items.push({ label: 'FG 40–49 yd', statValue: n4049, points: n4049 * PTS_FG_40_49 });
  const n5059 = pickFgMade50To59(row);
  if (n5059) items.push({ label: 'FG 50–59 yd', statValue: n5059, points: n5059 * PTS_FG_50_59 });
  const n60 = pickFgMade60Plus(row);
  if (n60) items.push({ label: 'FG 60+ yd', statValue: n60, points: n60 * PTS_FG_60_PLUS });
  const bucketSum = n0039 + n4049 + n5059 + n60;
  const fgMade = pickFgMadeTotal(row);
  if (bucketSum === 0 && fgMade > 0) {
    items.push({ label: 'FG (no distance split)', statValue: fgMade, points: fgMade * PTS_FG_0_39 });
  }
  const missN = fgMissedCountForPenalty(row);
  const blkN = fgBlockedCount(row);
  if (missN) items.push({ label: 'FG missed', statValue: missN, points: -missN * PTS_FG_MISS_OR_BLOCK });
  if (blkN) items.push({ label: 'FG blocked', statValue: blkN, points: -blkN * PTS_FG_MISS_OR_BLOCK });
  return items;
}

export function aggregateKickerCountingStatsFromWeeklyRows(
  rows: Iterable<Record<string, unknown>>,
  isBye: (row: Record<string, unknown>) => boolean
): {
  pat_made: number;
  fg_0_39: number;
  fg_40_49: number;
  fg_50_59: number;
  fg_60: number;
  fg_made_fallback: number;
} {
  let pat_made = 0;
  let fg_0_39 = 0;
  let fg_40_49 = 0;
  let fg_50_59 = 0;
  let fg_60 = 0;
  let fg_made_fallback = 0;
  for (const r of rows) {
    if (isBye(r)) continue;
    pat_made += pickPatMade(r);
    const a = pickFgMade0To39(r);
    const b = pickFgMade40To49(r);
    const c = pickFgMade50To59(r);
    const d = pickFgMade60Plus(r);
    fg_0_39 += a;
    fg_40_49 += b;
    fg_50_59 += c;
    fg_60 += d;
    if (a + b + c + d === 0) fg_made_fallback += pickFgMadeTotal(r);
  }
  return { pat_made, fg_0_39, fg_40_49, fg_50_59, fg_60, fg_made_fallback };
}

export function syntheticKickerRowFromAggregates(t: ReturnType<typeof aggregateKickerCountingStatsFromWeeklyRows>): Record<string, unknown> {
  const row: Record<string, unknown> = { pat_made: t.pat_made };
  if (t.fg_0_39) row.fg_made_0_39 = t.fg_0_39;
  if (t.fg_40_49) row.fg_made_40_49 = t.fg_40_49;
  if (t.fg_50_59) row.fg_made_50_59 = t.fg_50_59;
  if (t.fg_60) row.fg_made_60 = t.fg_60;
  if (t.fg_0_39 + t.fg_40_49 + t.fg_50_59 + t.fg_60 === 0 && t.fg_made_fallback > 0) {
    row.fg_made = t.fg_made_fallback;
  }
  return row;
}
