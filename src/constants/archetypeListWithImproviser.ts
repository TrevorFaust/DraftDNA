/**
 * Full archetype list including "The Improviser" (optional 361st archetype).
 * - ARCHETYPE_LIST = 360 from Master Archetypes CSV.
 * - The Improviser = code-only fallback: BPA-style with Robust WR, Mid QB, Stream TE, Floor.
 *   Used when detection lands on a flexible/adaptive profile that doesn't match a named archetype,
 *   or as a display fallback. Remove THE_IMPROVISER and use only ARCHETYPE_LIST if you want
 *   exactly 360 archetypes from the file with no extra entry.
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
  // No flavorText — optional; add a sentence here if you keep this archetype and want tooltip text.
};

export const FULL_ARCHETYPE_LIST: NamedArchetype[] = [...ARCHETYPE_LIST, THE_IMPROVISER];

export function getArchetypeByNameOrImproviser(name: string): NamedArchetype | undefined {
  const n = name.trim().toLowerCase();
  if (n === 'the improviser') return THE_IMPROVISER;
  return getByName(name);
}
