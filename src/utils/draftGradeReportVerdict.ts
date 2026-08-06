/**
 * Balanced grade closers — good picks first, then what hurt, then the letter.
 * @see draftGradeNarrativeStyle.ts
 */

import { priorPosRankLabel } from '@/utils/draftGradePriorSeason';
import type { PriorSeasonDraftProfile } from '@/utils/draftGradePriorSeason';

export interface VerdictHighlightContext {
  priorSeasonProfile?: PriorSeasonDraftProfile | null;
  stealNames: string[];
  premiumSlotMiss?: boolean;
  firstPickName?: string | null;
}

export function gradeArticle(grade: string): string {
  return /^[AEIOU]/i.test(grade) ? 'an' : 'a';
}

export function formatPlayerNames(names: string[], max = 2): string {
  const unique = [...new Set(names.filter(Boolean))];
  if (unique.length === 0) return '';
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique[0]}, ${unique[1]}, and ${unique.length - 2} more`;
}

function filteredStealNames(ctx: VerdictHighlightContext): string[] {
  return ctx.stealNames.filter(
    (name) =>
      !(
        ctx.premiumSlotMiss &&
        ctx.firstPickName &&
        name.trim().toLowerCase() === ctx.firstPickName.trim().toLowerCase()
      )
  );
}

/** Wins to mention before the grade (steals, prior-year ranks, etc.). */
export function verdictPositiveClause(ctx: VerdictHighlightContext): string | null {
  const parts: string[] = [];
  const ps = ctx.priorSeasonProfile;
  const y = ps?.season ?? 2025;

  if (ps && ps.rbWrFinishers.length > 0) {
    const finishers = ps.rbWrFinishers.slice(0, 2);
    if (finishers.length === 1) {
      const f = finishers[0];
      parts.push(
        `you did get ${f.name}, who was the ${priorPosRankLabel(f.pos, f.rank, y)}`
      );
    } else {
      const a = finishers[0];
      const b = finishers[1];
      parts.push(
        `you landed ${a.name} (${priorPosRankLabel(a.pos, a.rank, y)}) and ${b.name} (${priorPosRankLabel(b.pos, b.rank, y)})`
      );
    }
  }

  const steals = filteredStealNames(ctx);
  if (steals.length >= 2) {
    parts.push(
      `you also got ${formatPlayerNames(steals.slice(0, 2))} later than they usually go`
    );
  } else if (steals.length === 1) {
    parts.push(`you got ${steals[0]} later than they usually go`);
  }

  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]}, and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

export function joinFactors(factors: string[]): string {
  if (factors.length === 0) return '';
  if (factors.length === 1) return factors[0];
  if (factors.length === 2) return `${factors[0]} and ${factors[1]}`;
  return `${factors.slice(0, -1).join(', ')}, and ${factors[factors.length - 1]}`;
}

export function capitalizeLead(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "[good]…, but [bad] add up to a B- draft." */
export function balancedGradeVerdict(
  grade: string,
  positives: string | null,
  negatives: string[]
): string {
  const joined = joinFactors(negatives);
  const verb = negatives.length > 1 ? 'add up' : 'adds up';
  if (positives) {
    return `While ${positives}, but ${joined} ${verb} to ${gradeArticle(grade)} ${grade} draft.`;
  }
  return `${capitalizeLead(joined)} ${verb} to ${gradeArticle(grade)} ${grade} draft.`;
}

export function isHighlightPriorBeat(
  beat: string,
  profile: PriorSeasonDraftProfile | null | undefined
): boolean {
  if (!profile) return false;
  const lower = beat.toLowerCase();
  if (!lower.startsWith('you have ') && !lower.includes('you did get')) return false;
  return profile.rbWrFinishers.some((f) => beat.includes(f.name));
}

export function shouldFoldHighlightsIntoVerdict(
  grade: string,
  positives: string | null,
  negatives: string[]
): boolean {
  if (!positives || negatives.length === 0) return false;
  if (grade.startsWith('C') || grade.startsWith('D') || grade.startsWith('F')) return true;
  if (grade.startsWith('B') && negatives.length > 0) return true;
  return false;
}
