/**
 * ARCHETYPE_WEIGHTS — Tab 6 Bot Behavior Weights.
 * Weights multiply base value. 1.0 = neutral, >1 = favored, <1 = suppressed.
 * Phase: early = first 27%, mid = 27–60%, late = 60%+.
 */

import type { ArchetypeStrategies } from './archetypeStrategies';
import type { DraftConfig } from './buildDraftConfig';

type PhaseWeights = [number, number, number]; // [early, mid, late]

/** Weights by strategy id. RB strategies include WR weights from Tab 6. */
const WEIGHTS: Record<string, Partial<Record<'RB' | 'WR' | 'QB' | 'TE' | 'DST' | 'K', PhaseWeights>>> = {
  // RB strategies (include WR from Tab 6)
  zero_rb: { RB: [0.3, 0.8, 1.1], WR: [1.4, 1.1, 0.9], QB: [0.9, 1.0, 1.0], TE: [1.1, 1.0, 1.0], DST: [0, 0, 1.0], K: [0, 0, 0.8] },
  hero_rb: { RB: [1.8, 0.7, 0.9], WR: [0.9, 1.2, 1.0], QB: [0.8, 1.0, 1.0], TE: [0.9, 0.9, 1.0], DST: [0, 0, 1.0], K: [0, 0, 0.8] },
  robust_rb: { RB: [1.5, 1.2, 0.9], WR: [0.6, 0.9, 1.1], QB: [0.5, 1.0, 1.1], TE: [0.6, 0.9, 1.0], DST: [0, 0, 1.0], K: [0, 0, 0.8] },
  bpa: { RB: [1.0, 1.0, 1.0], WR: [1.0, 1.0, 1.0], QB: [1.0, 1.0, 1.0], TE: [1.0, 1.0, 1.0], DST: [0, 0, 1.0], K: [0, 0, 0.8] },
  skill_pos_late: { RB: [0.2, 1.1, 1.0], WR: [0.2, 1.1, 1.0], QB: [1.6, 0.9, 0.8], TE: [1.4, 0.9, 0.9], DST: [0, 0, 1.0], K: [0, 0, 0.8] },
  hybrid: { RB: [1.1, 1.1, 0.9], WR: [1.1, 1.1, 0.9], QB: [0.8, 1.0, 1.0], TE: [0.8, 1.0, 1.0], DST: [0, 0, 1.0], K: [0, 0, 0.8] },
  // QB strategies (override QB only)
  early_qb: { QB: [2.0, 0.4, 0.3] },
  mid_qb: { QB: [0.3, 1.5, 0.5] },
  late_qb: { QB: [0.1, 0.4, 1.8] },
  punt_qb: { QB: [0, 0.1, 1.2] },
  // TE strategies
  early_te: { TE: [2.0, 0.3, 0.2] },
  mid_te: { TE: [0.3, 1.6, 0.4] },
  stream_te: { TE: [0.1, 0.3, 1.5] },
  // WR strategies (override WR when combined with RB)
  robust_wr: { WR: [1.4, 1.1, 0.9] },
  wr_late: { WR: [0.6, 0.9, 1.1] },
  hero_wr: { WR: [1.8, 0.7, 0.9] },
  wr_mid: { WR: [0.3, 1.5, 0.8] },
  // Late philosophy
  upside: { RB: [1.0, 1.0, 1.1], WR: [1.0, 1.0, 1.1], QB: [1.0, 1.0, 1.0], TE: [1.0, 1.0, 1.0], DST: [0, 0, 1.0], K: [0, 0, 0.8] },
  floor: { RB: [1.0, 1.0, 0.9], WR: [1.0, 1.0, 0.9], QB: [1.0, 1.0, 1.0], TE: [1.0, 1.0, 1.0], DST: [0, 0, 1.0], K: [0, 0, 0.8] },
  handcuff: { RB: [1.0, 1.0, 1.3], WR: [1.0, 1.0, 0.9], QB: [1.0, 1.0, 1.0], TE: [1.0, 1.0, 0.9], DST: [0, 0, 1.0], K: [0, 0, 0.8] },
  vbd: { RB: [1.0, 1.0, 1.0], WR: [1.0, 1.0, 1.0], QB: [1.0, 1.0, 1.0], TE: [1.0, 1.0, 1.0], DST: [0, 0, 1.0], K: [0, 0, 0.8] },
};

const POSITIONS = ['RB', 'WR', 'QB', 'TE', 'DST', 'K'] as const;
const DEF_ALIASES = ['DEF', 'D/ST'];

/** Get phase index 0=early, 1=mid, 2=late from round number */
export function getPhaseIndex(roundNumber: number, config: DraftConfig): 0 | 1 | 2 {
  if (roundNumber <= config.phases.earlyEnd) return 0;
  if (roundNumber <= config.phases.midEnd) return 1;
  return 2;
}

/** Drift: late-phase weights relax toward 1.0 after driftStartRound. Tab 6. */
function getDriftFactor(phase: number, roundNumber: number, config: DraftConfig): number {
  if (phase < 2) return 1.0;
  return roundNumber >= config.driftStartRound ? 0.85 : 1.0;
}

export type CombinedWeights = Record<string, [number, number, number]>;

/** Combine weights for all 5 strategies (rb, wr, qb, te, late). Multiply per-position, apply drift in late. */
export function getCombinedWeights(
  strategies: ArchetypeStrategies,
  config: DraftConfig,
  roundNumber: number
): CombinedWeights {
  const ids = [strategies.rb, strategies.wr, strategies.qb, strategies.te, strategies.late];
  const result: CombinedWeights = {};

  for (const pos of POSITIONS) {
    const phases: PhaseWeights = [1, 1, 1];
    for (let ph = 0; ph < 3; ph++) {
      let combined = 1.0;
      for (const id of ids) {
        const w = WEIGHTS[id];
        if (!w) continue;
        const pw = w[pos as keyof typeof w];
        if (pw) combined *= pw[ph];
        else if ((w as Record<string, PhaseWeights>)._rest) combined *= (w as Record<string, number>)._rest;
      }
      const drift = getDriftFactor(ph, roundNumber, config);
      phases[ph] = combined * drift;
    }
    result[pos] = phases;
  }
  return result;
}
