/**
 * Archetype list for detection, badges, and UI (360 from Master CSV).
 * Re-exports ARCHETYPE_LIST as FULL_ARCHETYPE_LIST for legacy imports.
 */

import type { NamedArchetype } from './archetypeMappings.generated';
import { ARCHETYPE_LIST, getArchetypeByName as getByName } from './archetypeMappings.generated';

export { ARCHETYPE_LIST };

/** Same reference as ARCHETYPE_LIST — 360 archetypes. */
export const FULL_ARCHETYPE_LIST: NamedArchetype[] = ARCHETYPE_LIST;

export function getArchetypeByNameOrImproviser(name: string): NamedArchetype | undefined {
  return getByName(name);
}
