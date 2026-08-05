/** Shared snake-draft math for multiplayer drafts (mirrors SQL helpers). */

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

/** Unfilled starter holes (multiplicity preserved — e.g. two RB slots). */
export function mpStarterNeeds(positionCounts: Record<string, number>): string[] {
  const c = positionCounts;
  const qb = c.QB ?? 0;
  const rb = c.RB ?? 0;
  const wr = c.WR ?? 0;
  const te = c.TE ?? 0;
  const def = c.DEF ?? 0;
  const k = c.K ?? 0;
  const needed: string[] = [];
  if (qb < 1) needed.push('QB');
  if (rb < 2) {
    needed.push('RB');
    if (rb < 1) needed.push('RB');
  }
  if (wr < 2) {
    needed.push('WR');
    if (wr < 1) needed.push('WR');
  }
  if (te < 1) needed.push('TE');
  if (def < 1) needed.push('DEF');
  if (k < 1) needed.push('K');
  return needed;
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
  const needed = mpStarterNeeds(opts.positionCounts);
  if (needed.length > 0 && remaining <= needed.length && !needed.includes(pos)) {
    return false;
  }

  return true;
}
