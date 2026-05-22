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
import {
  LATE_STRATEGY_IDS,
  QB_STRATEGY_IDS,
  RB_STRATEGY_IDS,
  TE_STRATEGY_IDS,
  WR_STRATEGY_IDS,
} from '@/constants/archetypeStrategies';
import type { NamedArchetype } from '@/constants/archetypeMappings.generated';
import { buildDraftConfig, getHardConstraints } from '@/constants/buildDraftConfig';
import { getCombinedWeights, getPhaseIndex } from '@/constants/archetypeWeights';
import {
  applyCpuExpertFilters,
  applyMarketScarcityToScores,
  type CpuRealismContext,
} from '@/utils/cpuDraftRealism';

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
  /** Expert realism gates (early QB/TE frequency, etc.) */
  realism?: CpuRealismContext;
}

const DEFAULT_TOP_N = 5;
/** How much archetype weights can bend pick choice (rest follows ADP). */
const ARCHETYPE_NUDGE_STRENGTH = 0.22;
/** Max ranks ahead of BPA / slot CPUs may reach for archetype (≈1 round in 12-team). */
function maxReachRanks(numTeams: number): number {
  return Math.ceil(numTeams * 1.05);
}

function getEffectiveAdp(p: RankedPlayer): number {
  const adp = Number(p.adp);
  if (Number.isFinite(adp) && adp > 0) return adp;
  return Number(p.rank) || 999;
}

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
  let pool = filtered.length > 0 ? filtered : available;

  if (context.realism && !context.rookieFlexDraft) {
    const realistic = applyCpuExpertFilters(pool, context.realism);
    if (realistic.length > 0) pool = realistic;
  }

  const pickSlot = context.pickNumber ?? 1;
  const numTeams = context.numTeams;
  const reachCap = maxReachRanks(numTeams);

  // ADP window: prefer players near this pick slot (rank/adp), not 6+ rounds early
  const byAdpProximity = [...pool].sort(
    (a, b) => Math.abs(getEffectiveAdp(a) - pickSlot) - Math.abs(getEffectiveAdp(b) - pickSlot)
  );
  const adpWindow = Math.ceil(numTeams * 1.35);
  const nearSlot = byAdpProximity.filter((p) => Math.abs(getEffectiveAdp(p) - pickSlot) <= adpWindow);
  if (nearSlot.length > 0) pool = nearSlot;

  if (!weights) return selectBpaStyle(pool, DEFAULT_TOP_N);

  const bpaByRank = [...pool].sort((a, b) => a.rank - b.rank)[0];

  const scored = pool.map((p) => {
    const posKey = getWeightPosition(p);
    const mult = weights[posKey]?.[phase] ?? 1.0;
    const archetypeNudge = 1 + (mult - 1) * ARCHETYPE_NUDGE_STRENGTH;
    const adpDelta = Math.abs(getEffectiveAdp(p) - pickSlot);
    const adpScore = Math.max(0, 800 - adpDelta * 6);
    const adjustedScore = adpScore * archetypeNudge;
    return { player: p, adpScore, adjustedScore, adpDelta };
  });

  let adjustedPool =
    context.realism && !context.rookieFlexDraft
      ? applyMarketScarcityToScores(scored, context.realism)
      : scored;

  adjustedPool = adjustedPool.map((row) => {
    const reachVsBpa = row.player.rank - (bpaByRank?.rank ?? row.player.rank);
    if (reachVsBpa > reachCap) {
      return { ...row, adjustedScore: row.adjustedScore * 0.15 };
    }
    const reachVsSlot = getEffectiveAdp(row.player) - pickSlot;
    if (reachVsSlot < -reachCap) {
      return { ...row, adjustedScore: row.adjustedScore * 0.2 };
    }
    return row;
  });

  const byAdjusted = [...adjustedPool].sort((a, b) => {
    if (b.adjustedScore !== a.adjustedScore) return b.adjustedScore - a.adjustedScore;
    return a.adpDelta - b.adpDelta;
  });

  const best = byAdjusted[0]?.player;
  if (!best) return pool[0];

  if (bpaByRank && best.id !== bpaByRank.id) {
    const reachRanks = best.rank - bpaByRank.rank;
    if (reachRanks > reachCap) return bpaByRank;
    const reachAdp = getEffectiveAdp(best) - pickSlot;
    if (reachAdp < -reachCap && bpaByRank) return bpaByRank;
  }

  return best;
}

function selectBpaStyle(available: RankedPlayer[], topN: number): RankedPlayer {
  const sorted = [...available].sort((a, b) => a.rank - b.rank);
  const top = sorted.slice(0, Math.min(topN, sorted.length));
  const idx = Math.floor(Math.random() * top.length);
  return top[idx];
}

function shuffleIds<T extends string>(ids: readonly T[]): T[] {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function archetypesForRb(rb: ArchetypeStrategies['rb']): NamedArchetype[] {
  return ARCHETYPE_LIST.filter((a) => a.strategies.rb === rb);
}

/**
 * Assign NAMED archetypes to each CPU at draft start. Each bot keeps that 5-dimension
 * profile (RB/WR/QB/TE/Late) for the whole draft via positional weights.
 * Spread ensures the room mixes hero RB, zero RB, robust RB, hybrid, etc.
 */
export function assignRandomNamedArchetypesForDraft(
  numTeams: number,
  userPickPosition: number
): Record<number, string> {
  const cpuTeams: number[] = [];
  for (let t = 1; t <= numTeams; t++) {
    if (t !== userPickPosition) cpuTeams.push(t);
  }

  const rbOrder = shuffleIds(RB_STRATEGY_IDS);
  const wrOrder = shuffleIds(WR_STRATEGY_IDS);
  const qbOrder = shuffleIds(QB_STRATEGY_IDS);
  const teOrder = shuffleIds(TE_STRATEGY_IDS);
  const lateOrder = shuffleIds(LATE_STRATEGY_IDS);

  const usedNames = new Set<string>();
  const map: Record<number, string> = {};

  cpuTeams.forEach((teamNum, i) => {
    const targetRb = rbOrder[i % rbOrder.length];
    const targetWr = wrOrder[i % wrOrder.length];
    const targetQb = qbOrder[i % qbOrder.length];
    const targetTe = teOrder[i % teOrder.length];
    const targetLate = lateOrder[i % lateOrder.length];

    let pool = archetypesForRb(targetRb).filter((a) => !usedNames.has(a.name));
    if (pool.length === 0) pool = archetypesForRb(targetRb);
    if (pool.length === 0) pool = [...ARCHETYPE_LIST];

    const scorePool = (list: NamedArchetype[]) =>
      [...list].sort((a, b) => {
        let sa = 0;
        let sb = 0;
        if (a.strategies.wr === targetWr) sa += 2;
        if (b.strategies.wr === targetWr) sb += 2;
        if (a.strategies.qb === targetQb) sa += 1;
        if (b.strategies.qb === targetQb) sb += 1;
        if (a.strategies.te === targetTe) sa += 1;
        if (b.strategies.te === targetTe) sb += 1;
        if (a.strategies.late === targetLate) sa += 1;
        if (b.strategies.late === targetLate) sb += 1;
        return sb - sa;
      });

    const ranked = scorePool(pool);
    const topTier = ranked.filter(
      (a) =>
        a.strategies.wr === targetWr ||
        a.strategies.qb === targetQb ||
        a.strategies.rb === targetRb
    );
    const pickFrom = topTier.length > 0 ? topTier : ranked;
    const chosen = pickFrom[Math.floor(Math.random() * Math.min(5, pickFrom.length))] ?? ranked[0];

    map[teamNum] = chosen.name;
    usedNames.add(chosen.name);
  });

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
