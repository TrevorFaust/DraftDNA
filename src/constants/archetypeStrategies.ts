/**
 * Five-dimension strategy IDs for named archetypes (e.g. "The Captain").
 * Used for bot weighting and post-draft classification. CSV display names
 * map to these IDs via STRATEGY_DISPLAY_TO_ID.
 */

// ─── RB strategies (1 of 6) ─────────────────────────────────────────────────
export const RB_STRATEGY_IDS = [
  'bpa',
  'zero_rb',
  'robust_rb',
  'skill_pos_late',
  'hybrid',
  'hero_rb',
] as const;
export type RbStrategyId = (typeof RB_STRATEGY_IDS)[number];

// ─── WR strategies (1 of 4) ─────────────────────────────────────────────────
export const WR_STRATEGY_IDS = [
  'robust_wr',
  'wr_late',
  'hero_wr',
  'wr_mid',
] as const;
export type WrStrategyId = (typeof WR_STRATEGY_IDS)[number];

// ─── QB strategies (1 of 4) ─────────────────────────────────────────────────
export const QB_STRATEGY_IDS = [
  'early_qb',
  'mid_qb',
  'late_qb',
  'punt_qb',
] as const;
export type QbStrategyId = (typeof QB_STRATEGY_IDS)[number];

// ─── TE strategies (1 of 3) ─────────────────────────────────────────────────
export const TE_STRATEGY_IDS = [
  'early_te',
  'mid_te',
  'stream_te',
] as const;
export type TeStrategyId = (typeof TE_STRATEGY_IDS)[number];

// ─── Late round philosophy (1 of 4) ─────────────────────────────────────────
export const LATE_STRATEGY_IDS = [
  'floor',
  'upside',
  'vbd',
  'handcuff',
] as const;
export type LateStrategyId = (typeof LATE_STRATEGY_IDS)[number];

export interface ArchetypeStrategies {
  rb: RbStrategyId;
  wr: WrStrategyId;
  qb: QbStrategyId;
  te: TeStrategyId;
  late: LateStrategyId;
}

/** Map CSV display name → strategy ID (case-insensitive, trimmed). */
export const STRATEGY_DISPLAY_TO_ID: Record<string, { rb?: RbStrategyId; wr?: WrStrategyId; qb?: QbStrategyId; te?: TeStrategyId; late?: LateStrategyId }> = {
  // RB
  'bpa': { rb: 'bpa' },
  'zero rb': { rb: 'zero_rb' },
  'robust rb': { rb: 'robust_rb' },
  'skill pos late': { rb: 'skill_pos_late' },
  'hybrid': { rb: 'hybrid' },
  'hero rb': { rb: 'hero_rb' },
  // WR
  'robust wr': { wr: 'robust_wr' },
  'wr late': { wr: 'wr_late' },
  'hero wr': { wr: 'hero_wr' },
  'wr mid': { wr: 'wr_mid' },
  // QB
  'early qb': { qb: 'early_qb' },
  'mid qb': { qb: 'mid_qb' },
  'late qb': { qb: 'late_qb' },
  'punt qb': { qb: 'punt_qb' },
  // TE
  'early te': { te: 'early_te' },
  'mid te': { te: 'mid_te' },
  'stream te': { te: 'stream_te' },
  // Late
  'floor': { late: 'floor' },
  'upside': { late: 'upside' },
  'vbd': { late: 'vbd' },
  'handcuff': { late: 'handcuff' },
};

function normalizeKey(s: string): string {
  return s.trim().toLowerCase();
}

/** Resolve CSV strategy cell to the 5-dimension IDs. */
export function resolveStrategiesFromRow(
  rbDisplay: string,
  wrDisplay: string,
  qbDisplay: string,
  teDisplay: string,
  lateDisplay: string
): ArchetypeStrategies | null {
  const rb = STRATEGY_DISPLAY_TO_ID[normalizeKey(rbDisplay)]?.rb;
  const wr = STRATEGY_DISPLAY_TO_ID[normalizeKey(wrDisplay)]?.wr;
  const qb = STRATEGY_DISPLAY_TO_ID[normalizeKey(qbDisplay)]?.qb;
  const te = STRATEGY_DISPLAY_TO_ID[normalizeKey(teDisplay)]?.te;
  const late = STRATEGY_DISPLAY_TO_ID[normalizeKey(lateDisplay)]?.late;
  if (rb && wr && qb && te && late) {
    return { rb, wr, qb, te, late };
  }
  return null;
}
