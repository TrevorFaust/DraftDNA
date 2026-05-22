/**
 * Drafted roster shape (position counts) for grade narratives.
 * @see draftGradeNarrativeStyle.ts for voice and flow conventions.
 */

import { narrativeCount } from '@/utils/draftGradeNarrativeStyle';
export interface RosterComposition {
  rbCount: number;
  wrCount: number;
  teCount: number;
  qbCount: number;
}

export interface RosterShapeOptions {
  /** Skip TE count lines when the archetype badge already covers that story. */
  skipTeShape?: boolean;
}

export function analyzeRosterComposition(
  picks: { pos: string }[]
): RosterComposition {
  let rbCount = 0;
  let wrCount = 0;
  let teCount = 0;
  let qbCount = 0;
  for (const p of picks) {
    if (p.pos === 'RB') rbCount += 1;
    else if (p.pos === 'WR') wrCount += 1;
    else if (p.pos === 'TE') teCount += 1;
    else if (p.pos === 'QB') qbCount += 1;
  }
  return { rbCount, wrCount, teCount, qbCount };
}

/** Factual roster shape — no archetype/strategy repetition. */
export function rosterShapeNarrativeBeat(
  composition: RosterComposition | null | undefined,
  options?: RosterShapeOptions
): string | null {
  if (!composition) return null;
  const { rbCount, wrCount, teCount } = composition;
  const skipTe = options?.skipTeShape === true;

  if (rbCount >= 5 && rbCount > wrCount) {
    return `You finished with ${rbCount} running backs, a backfield-heavy roster compared with ${wrCount} wideouts.`;
  }
  if (rbCount >= 5 && wrCount <= 5) {
    return `You used ${rbCount} picks on running backs and ${wrCount} on wideouts.`;
  }
  if (!skipTe && teCount >= 3) {
    return `You rostered ${narrativeCount(teCount)} tight ends, which is unconventional, but the values you got make sense.`;
  }
  if (wrCount >= 7 && wrCount >= rbCount + 2) {
    return `You have ${wrCount} wideouts, typical for chasing late-round receiver value.`;
  }
  return null;
}
