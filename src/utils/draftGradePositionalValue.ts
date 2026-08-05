/**
 * Penalize drafts that burn early capital on TE/QB/K/DEF instead of RB/WR starters.
 *
 * Recoverable strategy choices (early TE/QB) apply point penalties only — no hard
 * ceiling. Catastrophic structure (early K/DEF with no skill core) can still soft-cap
 * but leaves room for an elite recovery to grade well.
 */

export interface PositionalDraftValueResult {
  penalty: number;
  /** Soft ceiling; null means no cap. Prefer penalties over caps when possible. */
  maxNumericScore: number | null;
  narrativeNote: string | null;
}

export function analyzePositionalDraftValue(
  picks: { pos: string; round_number: number; pick_number?: number }[]
): PositionalDraftValueResult {
  const sorted =
    picks.length > 0 && picks[0].pick_number != null
      ? [...picks].sort((a, b) => (a.pick_number ?? 0) - (b.pick_number ?? 0))
      : picks;
  const firstPick = sorted[0];

  const inRounds = (maxRound: number) =>
    picks.filter((p) => p.round_number <= maxRound);

  const r1_5 = inRounds(5);
  const r1_8 = inRounds(8);

  const teEarly = r1_5.filter((p) => p.pos === 'TE').length;
  const qbEarly = r1_5.filter((p) => p.pos === 'QB').length;
  const rbWrEarly = r1_5.filter((p) => p.pos === 'RB' || p.pos === 'WR').length;
  const kEarly = r1_8.filter((p) => p.pos === 'K').length;
  const defEarly = r1_8.filter((p) => p.pos === 'DEF').length;
  const utilityEarly = teEarly + qbEarly + kEarly + defEarly;

  let penalty = 0;
  let maxNumericScore: number | null = null;
  let narrativeNote: string | null = null;

  // Early TE/QB: cost points, but a great recovery can still reach A-band.
  if (firstPick?.pos === 'TE' && firstPick.round_number === 1) {
    penalty += 10;
    narrativeNote =
      'Taking tight end with the first pick meant passing on elite running backs and wideouts who rarely last that long.';
  } else if (teEarly >= 1 && firstPick?.pos === 'TE' && firstPick.round_number <= 2) {
    penalty += 7;
    narrativeNote =
      'You prioritized tight end in the first two rounds and left stronger RB and WR value on the board.';
  }

  if (teEarly >= 3) {
    penalty += 14;
    narrativeNote =
      'Burning several early picks on tight end left almost no room for a real RB and WR core.';
  } else if (teEarly >= 2 && rbWrEarly <= 2) {
    penalty += 8;
  } else if (teEarly >= 2 && rbWrEarly >= 3) {
    penalty += 4;
  }

  // Early QB is a real cost in 1QB, not a hard strategy ban.
  if (qbEarly >= 2 && rbWrEarly <= 2) {
    penalty += 6;
  } else if (qbEarly >= 1 && firstPick?.pos === 'QB' && firstPick.round_number === 1) {
    penalty += 5;
    if (!narrativeNote) {
      narrativeNote =
        'Taking quarterback first overall in a 1QB league spent premium capital you usually save for RB or WR.';
    }
  }

  // Early K/DEF costs capital; only soft-cap hard when RB/WR also lagged.
  if (kEarly > 0) {
    penalty += kEarly === 1 && rbWrEarly >= 3 ? 5 : 8 * kEarly;
    if (rbWrEarly < 3) maxNumericScore = Math.min(maxNumericScore ?? 100, 86);
  }
  if (defEarly > 0) {
    penalty += defEarly === 1 && rbWrEarly >= 3 ? 5 : 8 * defEarly;
    if (rbWrEarly < 3) maxNumericScore = Math.min(maxNumericScore ?? 100, 86);
  }

  // Full utility meltdown: soft cap leaves A- possible only with an exceptional recovery.
  if (utilityEarly >= 4 && rbWrEarly <= 2) {
    penalty += 12;
    maxNumericScore = Math.min(maxNumericScore ?? 100, 84);
    narrativeNote =
      'Too many early picks went to TE, QB, kicker, or defense while RB and WR got left behind.';
  } else if (utilityEarly >= 3 && rbWrEarly <= 2) {
    penalty += 8;
    maxNumericScore = Math.min(maxNumericScore ?? 100, 90);
  }

  if (rbWrEarly === 0 && picks.some((p) => p.round_number <= 6)) {
    penalty += 10;
    maxNumericScore = Math.min(maxNumericScore ?? 100, 86);
    if (!narrativeNote) {
      narrativeNote = 'You did not add a running back or wide receiver in the first six rounds.';
    }
  }

  return { penalty, maxNumericScore, narrativeNote };
}
