/**
 * Post-draft archetype detection — Tab 1 Strategy Definitions.
 * Given a team's picks, detect RB/WR/QB/TE/Late strategies via priority order.
 */

import type { ArchetypeStrategies } from '@/constants/archetypeStrategies';
import { buildDraftConfig, type DraftConfig } from '@/constants/buildDraftConfig';
import { FULL_ARCHETYPE_LIST } from '@/constants/archetypeListWithImproviser';

export interface DraftPickWithPlayer {
  round_number: number;
  pick_number: number;
  position: string;
  rank: number;
  adp: number;
}

const DETECTION_PRIORITY = {
  rb: ['hero_rb', 'robust_rb', 'skill_pos_late', 'zero_rb', 'bpa'] as RbStrategyId[],
  wr: ['hero_wr', 'robust_wr', 'wr_mid', 'wr_late'] as WrStrategyId[],
  qb: ['early_qb', 'mid_qb', 'late_qb', 'punt_qb'] as QbStrategyId[],
  te: ['early_te', 'mid_te', 'stream_te'] as TeStrategyId[],
  late: ['handcuff', 'vbd', 'upside', 'floor'] as LateStrategyId[],
} as const;

function isRb(p: DraftPickWithPlayer): boolean {
  return p.position === 'RB' || p.position === 'rb';
}
function isWr(p: DraftPickWithPlayer): boolean {
  return p.position === 'WR' || p.position === 'wr';
}
function isQb(p: DraftPickWithPlayer): boolean {
  return p.position === 'QB' || p.position === 'qb';
}
function isTe(p: DraftPickWithPlayer): boolean {
  return p.position === 'TE' || p.position === 'te';
}

/** Detect RB strategy from picks (priority order). */
function detectRb(picks: DraftPickWithPlayer[], config: DraftConfig): RbStrategyId {
  const totalRounds = config.totalRounds;
  const w = (pct: number) => Math.ceil(pct * totalRounds);

  const sorted = [...picks].sort((a, b) => a.pick_number - b.pick_number);
  const first2Picks = sorted.slice(0, 2);
  const first27Pct = picks.filter((p) => p.round_number <= w(0.27));
  const first20Pct = picks.filter((p) => p.round_number <= w(0.2));
  const first40Pct = picks.filter((p) => p.round_number <= w(0.4));

  // Hero RB: exactly 1 RB in R1, top-6 ADP (rank ~1–12 for RB)
  const r1Picks = picks.filter((p) => p.round_number === 1);
  const r1Rbs = r1Picks.filter(isRb);
  if (r1Rbs.length === 1 && r1Rbs[0].rank <= 12) return 'hero_rb';

  // Robust RB: 2+ RBs in first 20%, 3+ by 40%
  const rbsIn20 = first20Pct.filter(isRb).length;
  const rbsIn40 = first40Pct.filter(isRb).length;
  if (rbsIn20 >= 2 && rbsIn40 >= 3) return 'robust_rb';

  // Skill Pos Late: 0 RB AND 0 WR in picks 1–2 (absolute)
  if (first2Picks.length >= 2) {
    const hasRb = first2Picks.some(isRb);
    const hasWr = first2Picks.some(isWr);
    if (!hasRb && !hasWr) return 'skill_pos_late';
  }

  // Zero RB: 0 RBs in first 27%
  const rbsIn27 = first27Pct.filter(isRb).length;
  if (rbsIn27 === 0) return 'zero_rb';

  return 'bpa';
}

/** Detect WR strategy. */
function detectWr(picks: DraftPickWithPlayer[], config: DraftConfig): WrStrategyId {
  const totalRounds = config.totalRounds;
  const w = (pct: number) => Math.ceil(pct * totalRounds);
  const sorted = [...picks].sort((a, b) => a.pick_number - b.pick_number);

  const first27Pct = picks.filter((p) => p.round_number <= w(0.27));
  const r1Picks = picks.filter((p) => p.round_number === 1);
  const r2Picks = picks.filter((p) => p.round_number === 2);
  const wrPicks = sorted.filter(isWr);

  // Hero WR: exactly 1 WR in R1, top-8 WR ADP (rank ~1–24)
  const r1Wrs = r1Picks.filter(isWr);
  if (r1Wrs.length === 1 && r1Wrs[0].rank <= 24) return 'hero_wr';

  // Robust WR: 2+ WRs in rounds 2–33% window; 3+ by 40%
  const windowEnd = w(0.33);
  const window40 = w(0.4);
  const wrIn2_33 = picks.filter((p) => isWr(p) && p.round_number >= 2 && p.round_number <= windowEnd).length;
  const wrBy40 = picks.filter((p) => isWr(p) && p.round_number <= window40).length;
  if (wrIn2_33 >= 2 && wrBy40 >= 3) return 'robust_wr';

  // WR Mid: 0 WR in R1-R2; first WR in 13–47% window
  const noWrR1R2 = !r1Picks.some(isWr) && !r2Picks.some(isWr);
  const firstWr = wrPicks[0];
  if (noWrR1R2 && firstWr) {
    const pct = firstWr.round_number / totalRounds;
    if (pct >= 0.13 && pct <= 0.47) return 'wr_mid';
  }

  // WR Late: 0 WR in first 27%
  const wrIn27 = first27Pct.filter(isWr).length;
  if (wrIn27 === 0) return 'wr_late';

  return 'robust_wr';
}

/** Detect QB strategy from first QB pick round. */
function detectQb(picks: DraftPickWithPlayer[], config: DraftConfig): QbStrategyId {
  const totalRounds = config.totalRounds;
  const qbPicks = [...picks].filter(isQb).sort((a, b) => a.pick_number - b.pick_number);
  const firstQb = qbPicks[0];
  if (!firstQb) return 'mid_qb';

  const pct = firstQb.round_number / totalRounds;
  if (pct < 3 / 15) return 'early_qb';
  if (pct < 8 / 15) return 'mid_qb';
  if (pct < 12 / 15) return 'late_qb';
  return 'punt_qb';
}

/** Detect TE strategy from first TE pick round. */
function detectTe(picks: DraftPickWithPlayer[], config: DraftConfig): TeStrategyId {
  const totalRounds = config.totalRounds;
  const tePicks = [...picks].filter(isTe).sort((a, b) => a.pick_number - b.pick_number);
  const firstTe = tePicks[0];
  if (!firstTe) return 'stream_te';

  const pct = firstTe.round_number / totalRounds;
  if (pct < 3 / 15) return 'early_te';
  if (pct < 8 / 15) return 'mid_te';
  return 'stream_te';
}

/** Detect late-round philosophy. Lacks player tags (handcuff, highVariance, highFloor) — default floor. */
function detectLate(_picks: DraftPickWithPlayer[], _config: DraftConfig): LateStrategyId {
  // Tab 1 requires player-type tags (handcuff, highVariance, highFloor) and VBD scores.
  // Without those, default to floor.
  return 'floor';
}

/** Detect full strategy profile from a team's picks. */
export function detectStrategiesFromPicks(
  teamPicks: DraftPickWithPlayer[],
  config: DraftConfig
): ArchetypeStrategies {
  return {
    rb: detectRb(teamPicks, config),
    wr: detectWr(teamPicks, config),
    qb: detectQb(teamPicks, config),
    te: detectTe(teamPicks, config),
    late: detectLate(teamPicks, config),
  };
}

/** Deterministic hash from team picks for tie-breaking (so different drafts get different badges when tied). */
function hashPicksForTieBreak(picks: DraftPickWithPlayer[]): number {
  let h = 0;
  for (const p of picks) {
    h = ((h << 5) - h) + p.pick_number;
    h = ((h << 5) - h) + (p.rank ?? 0);
    h = h & 0x7fffffff;
  }
  return h;
}

/** Find archetypes with the most matching strategy dimensions; tie-break by draft hash for variety. Returns index into FULL_ARCHETYPE_LIST. */
function getClosestArchetypeIndexByStrategies(
  strategies: ArchetypeStrategies,
  tieBreakHash: number
): number {
  const scored = FULL_ARCHETYPE_LIST.map((a, idx) => {
    const s = a.strategies;
    let score = 0;
    if (s.rb === strategies.rb) score += 1;
    if (s.wr === strategies.wr) score += 1;
    if (s.qb === strategies.qb) score += 1;
    if (s.te === strategies.te) score += 1;
    if (s.late === strategies.late) score += 1;
    return { index: idx, score };
  });
  const bestScore = Math.max(...scored.map((x) => x.score));
  const ties = scored.filter((x) => x.score === bestScore);
  const idx = Math.abs(tieBreakHash) % ties.length;
  return ties[idx].index;
}

/** Detect strategies and resolve to archetype list index. Uses closest match + tie-break. */
export function detectArchetypeIndex(teamPicks: DraftPickWithPlayer[], config: DraftConfig): number {
  const strategies = detectStrategiesFromPicks(teamPicks, config);
  const tieBreakHash = hashPicksForTieBreak(teamPicks);
  return getClosestArchetypeIndexByStrategies(strategies, tieBreakHash);
}

/** Detect strategies and resolve to archetype name (for display). */
export function detectArchetypeName(teamPicks: DraftPickWithPlayer[], config: DraftConfig): string {
  return FULL_ARCHETYPE_LIST[detectArchetypeIndex(teamPicks, config)].name;
}

/** Draft pick with player for detection (from History/DraftRoom). */
export interface PickWithPlayer {
  round_number: number;
  pick_number: number;
  player_id: string;
  team_number: number;
  player?: { position?: string; rank?: number; adp?: number } | null;
}

/**
 * Get detected archetype name for a team from draft picks.
 * Use when viewing history or draft completion.
 */
export function getArchetypeForTeam(
  picks: PickWithPlayer[],
  teamNumber: number,
  options: {
    flexSlots?: number;
    benchSize?: number;
    numTeams?: number;
  } = {}
): string {
  const idx = getArchetypeIndexForTeam(picks, teamNumber, options);
  return FULL_ARCHETYPE_LIST[idx].name;
}

/**
 * Get detected archetype index (into FULL_ARCHETYPE_LIST) for a team. Use for Badges grid.
 */
export function getArchetypeIndexForTeam(
  picks: PickWithPlayer[],
  teamNumber: number,
  options: {
    flexSlots?: number;
    benchSize?: number;
    numTeams?: number;
  } = {}
): number {
  const flexSlots = options.flexSlots ?? 1;
  const benchSize = options.benchSize ?? 6;
  const numTeams = options.numTeams ?? 12;
  const config = buildDraftConfig(flexSlots, benchSize, numTeams);

  const teamPicks = picks
    .filter((p) => p.team_number === teamNumber && p.player)
    .map((p) => ({
      round_number: p.round_number,
      pick_number: p.pick_number,
      position: p.player?.position ?? '',
      rank: p.player?.rank ?? p.player?.adp ?? 999,
      adp: p.player?.adp ?? p.player?.rank ?? 999,
    }))
    .sort((a, b) => a.pick_number - b.pick_number);

  return detectArchetypeIndex(teamPicks, config);
}
