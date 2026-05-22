/**
 * Archetype + strategy woven into draft grade (natural multi-sentence lead).
 * @see draftGradeNarrativeStyle.ts for voice and flow conventions.
 */

import { STRATEGY_LABELS } from '@/constants/archetypeDescriptions';
import { getArchetypeByNameOrImproviser } from '@/constants/archetypeListWithImproviser';
import type { ArchetypeStrategies } from '@/constants/archetypeStrategies';

export interface ArchetypeNarrativeContext {
  archetypeName: string | null | undefined;
  anchorNames: string[];
  firstPickName: string | null;
  firstPickPos: string | null;
  firstRbRound: number | null;
  firstWrRound: number | null;
  firstQbRound: number | null;
  firstTeRound: number | null;
}

function displayArchetypeName(name: string): string {
  const trimmed = name.trim();
  return trimmed.startsWith('The ') ? trimmed : `The ${trimmed}`;
}

function strategyLabel(key: string): string {
  return STRATEGY_LABELS[key] ?? key;
}

export function archetypeImpliesTeFocus(archetypeName: string | null | undefined): boolean {
  const lower = (archetypeName ?? '').toLowerCase();
  if (!lower) return false;
  if (lower.includes('te hoard') || lower.includes('tight end hoard')) return true;
  const meta = getArchetypeByNameOrImproviser(archetypeName!.trim());
  return meta?.strategies?.te === 'early_te';
}

function openerSentence(ctx: ArchetypeNarrativeContext, strategies: ArchetypeStrategies): string {
  const openerPlayer =
    ctx.firstPickName ??
    (ctx.anchorNames.length > 0 ? ctx.anchorNames[0] : null);

  if (openerPlayer) {
    if (ctx.firstPickPos === 'RB' && strategies.rb === 'hero_rb') {
      return `You drafted ${openerPlayer} first and stayed on a ${strategyLabel('hero_rb')} plan.`;
    }
    if (ctx.firstPickPos === 'WR' && strategies.wr === 'hero_wr') {
      return `You drafted ${openerPlayer} first and stayed on a ${strategyLabel('hero_wr')} plan.`;
    }
    if (ctx.firstPickPos === 'QB' && strategies.qb === 'early_qb') {
      return `You drafted ${openerPlayer} first and committed to ${strategyLabel('early_qb')}.`;
    }
    if (ctx.firstPickPos === 'TE' && (strategies.te === 'early_te' || strategies.te === 'mid_te')) {
      return `You took ${openerPlayer} with your first pick and led with tight end while the best backs and receivers were still on the board.`;
    }
    if (
      ctx.firstPickPos === 'RB' &&
      ctx.firstRbRound === 1 &&
      strategies.rb === 'zero_rb'
    ) {
      return `You opened with ${openerPlayer} at running back, then the rest of the draft leaned much more receiver-heavy than a true Zero RB build.`;
    }
    return `You drafted ${openerPlayer} first and ran a ${strategyLabel(strategies.rb)} plan at running back.`;
  }
  return `You ran a ${strategyLabel(strategies.rb)} plan.`;
}

/** Second sentence: early QB/TE (draft order), then badge. */
function followUpSentence(
  ctx: ArchetypeNarrativeContext,
  strategies: ArchetypeStrategies,
  badge: string
): string | null {
  const teRound =
    strategies.te === 'early_te' || strategies.te === 'mid_te' ? ctx.firstTeRound : null;
  const qbRound =
    strategies.qb === 'early_qb' || strategies.qb === 'mid_qb' ? ctx.firstQbRound : null;

  const slots: { round: number; label: string }[] = [];
  if (qbRound != null && qbRound <= 10) {
    slots.push({ round: qbRound, label: `your quarterback in round ${qbRound}` });
  }
  const teAlreadyFirstPick =
    ctx.firstPickPos === 'TE' && teRound != null && teRound <= 1;
  if (teRound != null && teRound <= 8 && !teAlreadyFirstPick) {
    slots.push({ round: teRound, label: `your tight end in round ${teRound}` });
  }
  slots.sort((a, b) => a.round - b.round);

  if (slots.length === 2) {
    return `Then you locked in ${slots[0].label} and ${slots[1].label}, matching ${badge}.`;
  }
  if (slots.length === 1) {
    return `Then you locked in ${slots[0].label}, matching ${badge}.`;
  }
  if (teAlreadyFirstPick && ctx.firstPickPos === 'TE') {
    return `That fits ${badge}.`;
  }
  if (strategies.qb === 'punt_qb') {
    return `You waited on quarterback until the end of the draft, matching ${badge}.`;
  }
  if (strategies.rb === 'zero_rb' && ctx.firstRbRound != null && ctx.firstRbRound >= 5) {
    return `Your first running back did not arrive until round ${ctx.firstRbRound}, matching ${badge}.`;
  }

  const wrPath = wrPathPhrase(strategies);
  if (wrPath && strategies.wr !== 'bpa') {
    return `From there you ${wrPath}, matching ${badge}.`;
  }

  return `That path matches ${badge}.`;
}

function wrPathPhrase(strategies: ArchetypeStrategies): string | null {
  switch (strategies.wr) {
    case 'robust_wr':
      return 'built out Robust WR depth through the middle rounds';
    case 'hero_wr':
      return 'centered the pass game on a Hero WR';
    case 'wr_late':
      return 'waited on wideout until the back half of the draft';
    case 'wr_mid':
      return 'filled out wideout in the middle rounds';
    default:
      return null;
  }
}

/** Opening beat: plan first, then how early picks fit the badge. */
export function archetypeIntegratedSentences(ctx: ArchetypeNarrativeContext): string[] {
  const name = ctx.archetypeName?.trim();
  if (!name || name === 'Unknown') return [];

  const meta = getArchetypeByNameOrImproviser(name);
  if (!meta?.strategies) return [];

  const badge = displayArchetypeName(name);
  const opener = openerSentence(ctx, meta.strategies);
  const followUp = followUpSentence(ctx, meta.strategies, badge);

  if (ctx.firstPickPos === 'TE' && ctx.firstTeRound === 1 && followUp === `That fits ${badge}.`) {
    return [opener.replace(/\.$/, '') + `, matching ${badge}.`];
  }

  if (followUp) return [opener, followUp];
  return [opener.replace(/\.$/, '') + `, matching ${badge}.`];
}

export function archetypeIntegratedLead(ctx: ArchetypeNarrativeContext): string | null {
  const parts = archetypeIntegratedSentences(ctx);
  if (parts.length === 0) return null;
  return parts.join(' ');
}

export function archetypeNarrativeBeat(ctx: ArchetypeNarrativeContext): string | null {
  return archetypeIntegratedLead(ctx);
}
