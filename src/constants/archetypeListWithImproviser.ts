/**
 * Full archetype list including "The Improviser" (flexible/adaptive strategy).
 * Use FULL_ARCHETYPE_LIST for Badges page and detection; use getArchetypeByNameOrImproviser for tooltips.
 */

import type { NamedArchetype } from './archetypeMappings.generated';
import { ARCHETYPE_LIST, getArchetypeByName as getByName } from './archetypeMappings.generated';

export const THE_IMPROVISER: NamedArchetype = {
  name: 'The Improviser',
  strategies: {
    rb: 'bpa',
    wr: 'robust_wr',
    qb: 'mid_qb',
    te: 'stream_te',
    late: 'floor',
  },
};

export const FULL_ARCHETYPE_LIST: NamedArchetype[] = [...ARCHETYPE_LIST, THE_IMPROVISER];

export function getArchetypeByNameOrImproviser(name: string): NamedArchetype | undefined {
  const n = name.trim().toLowerCase();
  if (n === 'the improviser') return THE_IMPROVISER;
  return getByName(name);
}
