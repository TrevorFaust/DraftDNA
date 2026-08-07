/** Shared snake-draft math for multiplayer drafts (mirrors SQL helpers). */

import {
  parseStarters,
  starterNeedsFromCounts,
  type PositionLimitsLike,
  type StarterCounts,
} from '@/utils/rosterSlots';

export function mpTeamForPick(
  pickNumber: number,
  numTeams: number,
  draftOrder: string = 'snake'
): number {
  if (numTeams < 1 || pickNumber < 1) return 1;
  const round = Math.ceil(pickNumber / numTeams);
  const pickInRound = ((pickNumber - 1) % numTeams) + 1;
  if (draftOrder === 'snake' && round % 2 === 0) {
    return numTeams - pickInRound + 1;
  }
  return pickInRound;
}

export function mpRoundForPick(pickNumber: number, numTeams: number): number {
  return Math.ceil(pickNumber / Math.max(numTeams, 1));
}

export function mpNormalizePos(pos: string | null | undefined): string {
  const p = (pos || '').toUpperCase();
  if (p === 'D/ST' || p === 'DST' || p === 'DEF') return 'DEF';
  return p;
}

function resolveStarters(
  startersOrLimits?: StarterCounts | PositionLimitsLike | null
): StarterCounts {
  if (!startersOrLimits) return parseStarters(null);
  if ('starters' in startersOrLimits || 'FLEX' in startersOrLimits || 'BENCH' in startersOrLimits) {
    return parseStarters(startersOrLimits as PositionLimitsLike);
  }
  return {
    QB: (startersOrLimits as StarterCounts).QB ?? 1,
    RB: (startersOrLimits as StarterCounts).RB ?? 2,
    WR: (startersOrLimits as StarterCounts).WR ?? 2,
    TE: (startersOrLimits as StarterCounts).TE ?? 1,
    DEF: (startersOrLimits as StarterCounts).DEF ?? 1,
    K: (startersOrLimits as StarterCounts).K ?? 1,
  };
}

/** Unfilled starter holes (multiplicity preserved — e.g. two RB slots). */
export function mpStarterNeeds(
  positionCounts: Record<string, number>,
  startersOrLimits?: StarterCounts | PositionLimitsLike | null
): string[] {
  return starterNeedsFromCounts(positionCounts, resolveStarters(startersOrLimits));
}

/**
 * Whether a team can still roster this position:
 * - honor position limits
 * - when remaining picks <= unfilled starter holes, only show those positions
 */
export function mpCanDraftPosition(opts: {
  position: string;
  positionCounts: Record<string, number>;
  rosterSize: number;
  numRounds: number;
  positionLimits: Record<string, number | undefined>;
}): boolean {
  const pos = mpNormalizePos(opts.position);
  if (opts.rosterSize >= opts.numRounds) return false;

  const limit = opts.positionLimits[pos];
  const count = opts.positionCounts[pos] ?? 0;
  if (typeof limit === 'number' && count >= limit) return false;

  const remaining = Math.max(0, opts.numRounds - opts.rosterSize);
  const needed = mpStarterNeeds(opts.positionCounts, opts.positionLimits as PositionLimitsLike);
  if (needed.length > 0 && remaining <= needed.length && !needed.includes(pos)) {
    return false;
  }

  return true;
}
