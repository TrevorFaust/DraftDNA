/**
 * Penalize drafts that burn early capital on TE/QB/K/DEF instead of RB/WR starters.
 */

export interface PositionalDraftValueResult {
  penalty: number;
  /** Cap final numeric score (e.g. 55 ≈ D range) when structure is broken. */
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

  if (firstPick?.pos === 'TE' && firstPick.round_number === 1) {
    penalty += 20;
    maxNumericScore = 64;
    narrativeNote =
      'Taking tight end with the first pick meant passing on elite running backs and wideouts who rarely last that long.';
  } else if (teEarly >= 1 && firstPick?.pos === 'TE' && firstPick.round_number <= 2) {
    penalty += 12;
    maxNumericScore = maxNumericScore ?? 70;
    narrativeNote =
      'You prioritized tight end in the first two rounds and left stronger RB and WR value on the board.';
  }

  if (teEarly >= 3) {
    penalty += 28;
    maxNumericScore = 52;
    narrativeNote =
      'Burning several early picks on tight end left almost no room for a real RB and WR core.';
  } else if (teEarly >= 2 && rbWrEarly <= 2) {
    penalty += 14;
    maxNumericScore = maxNumericScore ?? 62;
  }

  if (kEarly > 0) {
    penalty += 10 * kEarly;
    if (rbWrEarly < 3) maxNumericScore = Math.min(maxNumericScore ?? 100, 58);
  }
  if (defEarly > 0) {
    penalty += 10 * defEarly;
    if (rbWrEarly < 3) maxNumericScore = Math.min(maxNumericScore ?? 100, 58);
  }

  if (utilityEarly >= 4 && rbWrEarly <= 2) {
    penalty += 22;
    maxNumericScore = Math.min(maxNumericScore ?? 100, 48);
    narrativeNote =
      'Too many early picks went to TE, QB, kicker, or defense while RB and WR got left behind.';
  }

  if (rbWrEarly === 0 && picks.some((p) => p.round_number <= 6)) {
    penalty += 18;
    maxNumericScore = Math.min(maxNumericScore ?? 100, 50);
    if (!narrativeNote) {
      narrativeNote = 'You did not add a running back or wide receiver in the first six rounds.';
    }
  }

  return { penalty, maxNumericScore, narrativeNote };
}
