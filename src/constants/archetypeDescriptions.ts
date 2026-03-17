/**
 * Archetype descriptions for badges and tooltips.
 * Builds human-readable text from strategy IDs.
 */

import type { ArchetypeStrategies } from './archetypeStrategies';

const STRATEGY_LABELS: Record<string, string> = {
  // RB
  bpa: 'Best Player Available',
  zero_rb: 'Zero RB',
  robust_rb: 'Robust RB',
  skill_pos_late: 'Skill Pos Late',
  hybrid: 'Hybrid',
  hero_rb: 'Hero RB',
  // WR
  robust_wr: 'Robust WR',
  wr_late: 'WR Late',
  hero_wr: 'Hero WR',
  wr_mid: 'WR Mid',
  // QB
  early_qb: 'Early QB',
  mid_qb: 'Mid QB',
  late_qb: 'Late QB',
  punt_qb: 'Punt QB',
  // TE
  early_te: 'Early TE',
  mid_te: 'Mid TE',
  stream_te: 'Stream TE',
  // Late
  floor: 'Floor',
  upside: 'Upside',
  vbd: 'VBD',
  handcuff: 'Handcuff',
};

/** Build a short description of an archetype from its strategies. */
export function getArchetypeDescription(strategies: ArchetypeStrategies): string {
  const parts = [
    STRATEGY_LABELS[strategies.rb] || strategies.rb,
    STRATEGY_LABELS[strategies.wr] || strategies.wr,
    STRATEGY_LABELS[strategies.qb] || strategies.qb,
    STRATEGY_LABELS[strategies.te] || strategies.te,
    STRATEGY_LABELS[strategies.late] || strategies.late,
  ];
  return parts.join(' • ');
}

/** Build "why you earned it" text for tooltip (e.g. "You went with a Hero RB and Late QB strategy to earn this badge") */
export function getArchetypeEarnedReason(strategies: ArchetypeStrategies): string {
  const rb = STRATEGY_LABELS[strategies.rb] || strategies.rb;
  const wr = STRATEGY_LABELS[strategies.wr] || strategies.wr;
  const qb = STRATEGY_LABELS[strategies.qb] || strategies.qb;
  const te = STRATEGY_LABELS[strategies.te] || strategies.te;
  const late = STRATEGY_LABELS[strategies.late] || strategies.late;
  return `You went with a ${rb}, ${wr}, ${qb}, ${te}, and ${late} strategy to earn this badge.`;
}
