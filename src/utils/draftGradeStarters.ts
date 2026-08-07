/**
 * Starter-lineup helpers for draft grading — keep floors/meltdowns aligned with league settings.
 */

import {
  DEFAULT_STARTERS,
  type StarterCounts,
  type StarterPosition,
} from '@/utils/rosterSlots';

export type PosCountMap = Record<string, number>;

export function countPositions(
  picks: { pos: string }[]
): PosCountMap {
  const counts: PosCountMap = {};
  for (const p of picks) {
    const pos = p.pos === 'D/ST' || p.pos === 'DST' ? 'DEF' : p.pos;
    counts[pos] = (counts[pos] ?? 0) + 1;
  }
  return counts;
}

export function resolveGradeStarters(
  starters?: StarterCounts | null
): StarterCounts {
  return starters ?? DEFAULT_STARTERS;
}

/** Dedicated starters filled (DEF/K not required — matches classic trying-their-best). */
export function hasFilledSkillStarters(
  counts: PosCountMap,
  starters: StarterCounts
): boolean {
  if ((counts.QB ?? 0) < starters.QB) return false;
  if ((counts.RB ?? 0) < starters.RB) return false;
  if ((counts.WR ?? 0) < starters.WR) return false;
  if ((counts.TE ?? 0) < starters.TE) return false;
  return true;
}

/**
 * Skill core ready for K/DEF: required RB/WR filled when those exist;
 * if the league starts QB or TE, one of those (or the required count) should be in.
 */
export function skillCoreReadyForSpecialTeams(
  counts: PosCountMap,
  starters: StarterCounts
): boolean {
  const skillNeed =
    starters.QB + starters.RB + starters.WR + starters.TE;
  if (skillNeed === 0) return true;

  if ((counts.RB ?? 0) < starters.RB) return false;
  if ((counts.WR ?? 0) < starters.WR) return false;

  if (starters.QB + starters.TE === 0) {
    // RB/WR-only skill league
    return true;
  }

  if (starters.QB > 0 && starters.TE > 0) {
    // Classic-ish: can wait on one of QB/TE if the other (or either) is started
    return (
      (counts.QB ?? 0) >= starters.QB ||
      (counts.TE ?? 0) >= starters.TE ||
      ((counts.QB ?? 0) >= 1 && (counts.TE ?? 0) >= 1)
    );
  }

  if (starters.QB > 0) return (counts.QB ?? 0) >= starters.QB;
  return (counts.TE ?? 0) >= starters.TE;
}

/** Early-round skill picks at positions the league actually starts. */
export function countRelevantEarlySkill(
  picks: { pos: string; round_number: number }[],
  starters: StarterCounts,
  maxRound = 6
): number {
  const skillNeed =
    starters.QB + starters.RB + starters.WR + starters.TE;
  return picks.filter((p) => {
    if (p.round_number > maxRound) return false;
    if (skillNeed === 0) {
      return p.pos === 'QB' || p.pos === 'RB' || p.pos === 'WR' || p.pos === 'TE';
    }
    if (p.pos === 'RB') return starters.RB > 0;
    if (p.pos === 'WR') return starters.WR > 0;
    if (p.pos === 'QB') return starters.QB > 0;
    if (p.pos === 'TE') return starters.TE > 0;
    return false;
  }).length;
}

export function missingRequiredSkill(
  counts: PosCountMap,
  starters: StarterCounts
): boolean {
  return !hasFilledSkillStarters(counts, starters);
}

/** Skill + DEF/K starter holes (for meltdown checks in ST-only / ST-heavy leagues). */
export function missingRequiredStarters(
  counts: PosCountMap,
  starters: StarterCounts
): boolean {
  if (missingRequiredSkill(counts, starters)) return true;
  if ((counts.DEF ?? 0) < starters.DEF) return true;
  if ((counts.K ?? 0) < starters.K) return true;
  return false;
}

/**
 * "Trying their best" floor gate. Classic skill leagues ignore DEF/K holes;
 * ST-only / no-skill leagues require those starters filled.
 */
export function hasFilledGradeFloorStarters(
  counts: PosCountMap,
  starters: StarterCounts
): boolean {
  if (!hasFilledSkillStarters(counts, starters)) return false;
  const skillNeed =
    starters.QB + starters.RB + starters.WR + starters.TE;
  if (skillNeed > 0) return true;
  if ((counts.DEF ?? 0) < starters.DEF) return false;
  if ((counts.K ?? 0) < starters.K) return false;
  return true;
}

/** Positions that contribute to "skill capital" for this lineup. */
export function primarySkillPositions(starters: StarterCounts): StarterPosition[] {
  const out: StarterPosition[] = [];
  if (starters.RB > 0) out.push('RB');
  if (starters.WR > 0) out.push('WR');
  if (starters.QB > 0) out.push('QB');
  if (starters.TE > 0) out.push('TE');
  if (out.length === 0) {
    // Pure IDP / ST novelty — treat any skill as primary for structure checks.
    return ['RB', 'WR', 'QB', 'TE'];
  }
  return out;
}
