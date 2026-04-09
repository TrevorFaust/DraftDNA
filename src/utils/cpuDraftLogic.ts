/**
 * CPU draft pick selection based on draft archetype.
 * Uses ARCHETYPE_WEIGHTS for positional multipliers, value override, and drift.
 * Ground rules (position limits, defense fairness) are enforced in DraftRoom.
 */

import type { RankedPlayer } from '@/types/database';
import type { DraftArchetypeId } from '@/constants/draftArchetypes';
import {
  isDraftArchetypeId,
  ALL_ARCHETYPE_IDS,
  normalizeArchetypesForTeam,
  assignRandomArchetypeCombosForDraft as assignCombosFromArchetypes,
} from '@/constants/draftArchetypes';
import { ARCHETYPE_LIST } from '@/constants/archetypeMappings.generated';
import type { ArchetypeStrategies } from '@/constants/archetypeStrategies';
import { buildDraftConfig, getHardConstraints } from '@/constants/buildDraftConfig';
import { getCombinedWeights, getPhaseIndex } from '@/constants/archetypeWeights';

export interface CpuDraftContext {
  roundNumber: number;
  numRounds: number;
  numTeams: number;
  /** Players this CPU team has already drafted */
  teamDraftedPlayers: RankedPlayer[];
  positionLimits?: Record<string, number>;
  scoringFormat?: string;
  pickNumber?: number;
  draftOrder?: string;
  /** Flex slots (FLEX count) for getTotalRounds */
  flexSlots?: number;
  /** Bench size for getTotalRounds */
  benchSize?: number;
  /** Rookie-only mock: no DST/kicker round rules; pool is skill positions only */
  rookieFlexDraft?: boolean;
}

const DEFAULT_TOP_N = 5;

/** Resolve archetype name or legacy combo to strategies */
function resolveStrategies(archetypeIdOrIds: string | string[] | undefined): ArchetypeStrategies | null {
  if (!archetypeIdOrIds) return null;

  // Named archetype: "The Captain", "The Blueprint", etc.
  if (typeof archetypeIdOrIds === 'string' && !isDraftArchetypeId(archetypeIdOrIds)) {
    const named = ARCHETYPE_LIST.find((a) => a.name === archetypeIdOrIds);
    return named?.strategies ?? null;
  }

  // Legacy: single id or combo array — derive strategies from first matching ids
  const ids = Array.isArray(archetypeIdOrIds) ? archetypeIdOrIds : [archetypeIdOrIds];
  const valid = ids.filter((id): id is DraftArchetypeId => isDraftArchetypeId(id));
  if (valid.length === 0) return null;

  const rbIds = ['zero_rb', 'hero_rb', 'robust_rb', 'hybrid', 'skill_pos_late', 'bpa'];
  const wrIds = ['zero_wr', 'hero_wr', 'robust_wr']; // zero_wr -> wr_late
  const qbIds = ['early_qb', 'mid_qb', 'late_qb', 'punt_qb'];
  const teIds = ['early_te', 'late_te'];
  const lateIds = ['vbd', 'upside', 'floor', 'handcuff_heavy'];

  const rb = valid.find((id) => rbIds.includes(id)) ?? 'bpa';
  const wr = valid.find((id) => wrIds.includes(id)) ?? 'robust_wr';
  const qb = valid.find((id) => qbIds.includes(id)) ?? 'mid_qb';
  const te = valid.find((id) => teIds.includes(id)) ?? 'late_te';
  const late = valid.find((id) => lateIds.includes(id)) ?? 'floor';

  // Map zero_wr -> wr_late, late_te -> stream_te
  return {
    rb: rb as ArchetypeStrategies['rb'],
    wr: (wr === 'zero_wr' ? 'wr_late' : wr) as ArchetypeStrategies['wr'],
    qb: qb as ArchetypeStrategies['qb'],
    te: (te === 'late_te' ? 'stream_te' : te) as ArchetypeStrategies['te'],
    late: (late === 'handcuff_heavy' ? 'handcuff' : late) as ArchetypeStrategies['late'],
  };
}

/** Map position to weight key (DEF/D/ST -> DST) */
function getWeightPosition(p: RankedPlayer): string {
  const pos = (p.position || '').toUpperCase();
  if (pos === 'DEF' || pos === 'D/ST') return 'DST';
  if (pos === 'K') return 'K';
  return pos;
}

/**
 * Select one player from the available list for a CPU pick.
 * Uses archetype weights, value override, and hard constraints.
 */
export function selectCpuPick(
  available: RankedPlayer[],
  archetypeIdOrIds: DraftArchetypeId | string | string[] | undefined,
  context: CpuDraftContext
): RankedPlayer | undefined {
  if (available.length === 0) return undefined;

  const flexSlots = context.flexSlots ?? 1;
  const benchSize = context.benchSize ?? 6;
  const config = buildDraftConfig(flexSlots, benchSize, context.numTeams);
  const constraints = getHardConstraints(config);

  const strategies = resolveStrategies(archetypeIdOrIds);
  const phase = getPhaseIndex(context.roundNumber, config);
  const weights = strategies
    ? getCombinedWeights(strategies, config, context.roundNumber)
    : null;

  // Hard: DST not before dstEarliestRound; K only in final round (skipped for rookie flex mocks)
  const filtered = context.rookieFlexDraft
    ? available
    : available.filter((p) => {
        const pos = (p.position || '').toUpperCase();
        if (pos === 'DEF' || pos === 'D/ST') return context.roundNumber >= constraints.dstEarliestRound;
        if (pos === 'K') return context.roundNumber >= constraints.kickerOnlyRound;
        return true;
      });
  const pool = filtered.length > 0 ? filtered : available;

  // No weights (e.g. invalid archetype) -> BPA fallback
  if (!weights) return selectBpaStyle(pool, DEFAULT_TOP_N);

  // Score each player: base value * positional multiplier
  const scored = pool.map((p) => {
    const posKey = getWeightPosition(p);
    const mult = weights[posKey]?.[phase] ?? 1.0;
    const baseValue = 1000 - p.rank;
    const adjustedScore = baseValue * mult;
    return { player: p, baseValue, adjustedScore };
  });

  const byAdjusted = [...scored].sort((a, b) => b.adjustedScore - a.adjustedScore);
  const byBase = [...scored].sort((a, b) => b.baseValue - a.baseValue);
  const archetypePick = byAdjusted[0];
  const bpaPick = byBase[0];
  if (!archetypePick || !bpaPick) return pool[0];

  // Value override: if BPA is enough rounds better (by rank), take BPA
  const roundsBetter = (archetypePick.player.rank - bpaPick.player.rank) / context.numTeams;
  if (roundsBetter >= config.valueOverrideThreshold && bpaPick.player.id !== archetypePick.player.id) {
    return bpaPick.player;
  }

  return archetypePick.player;
}

function selectBpaStyle(available: RankedPlayer[], topN: number): RankedPlayer {
  const sorted = [...available].sort((a, b) => a.rank - b.rank);
  const top = sorted.slice(0, Math.min(topN, sorted.length));
  const idx = Math.floor(Math.random() * top.length);
  return top[idx];
}

/**
 * Assign random NAMED archetypes (e.g. "The Captain") to each CPU team.
 * Each bot drafts with a full 5-strategy profile.
 */
export function assignRandomNamedArchetypesForDraft(
  numTeams: number,
  userPickPosition: number
): Record<number, string> {
  const map: Record<number, string> = {};
  for (let teamNum = 1; teamNum <= numTeams; teamNum++) {
    if (teamNum === userPickPosition) continue;
    const idx = Math.floor(Math.random() * ARCHETYPE_LIST.length);
    map[teamNum] = ARCHETYPE_LIST[idx].name;
  }
  return map;
}

/**
 * Legacy: Build a map of team_number -> archetype combo (2–3 ids).
 * Prefer assignRandomNamedArchetypesForDraft for full weighted logic.
 */
export const assignRandomArchetypeCombosForDraft = assignCombosFromArchetypes;

export function assignRandomArchetypesForDraft(
  numTeams: number,
  userPickPosition: number
): Record<number, DraftArchetypeId> {
  const map: Record<number, DraftArchetypeId> = {};
  for (let teamNum = 1; teamNum <= numTeams; teamNum++) {
    if (teamNum === userPickPosition) continue;
    const idx = Math.floor(Math.random() * ALL_ARCHETYPE_IDS.length);
    map[teamNum] = ALL_ARCHETYPE_IDS[idx];
  }
  return map;
}
