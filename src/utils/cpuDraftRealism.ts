/**
 * Expert-style gates for CPU picks — rare early QB, TE only in realistic windows, RB run dampening, etc.
 */

import type { RankedPlayer } from '@/types/database';

export interface CpuRealismContext {
  roundNumber: number;
  pickNumber: number;
  numTeams: number;
  teTakenInTop12: number;
  qbTakenInRound1: number;
  rbsTakenRounds12: number;
  /** RBs taken league-wide with pick_number <= 12 */
  rbsInTop12: number;
  recentRbPickStreak: number;
  rbInRecentWindow: number;
  teamRbCount?: number;
  draftSeed: number;
}

function seededChance(seed: number, pickNumber: number, salt: string): number {
  let h = seed ^ pickNumber;
  for (let i = 0; i < salt.length; i++) {
    h = ((h << 5) - h + salt.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 10000) / 10000;
}

function posOf(p: RankedPlayer | { position?: string | null }): string {
  return (p.position || '').toUpperCase();
}

function targetMaxRbsInTop12(numTeams: number): number {
  return Math.max(4, Math.ceil(numTeams * 0.42));
}

export function applyCpuExpertFilters(
  available: RankedPlayer[],
  ctx: CpuRealismContext
): RankedPlayer[] {
  if (available.length === 0) return available;

  const {
    roundNumber,
    pickNumber,
    numTeams,
    teTakenInTop12,
    qbTakenInRound1,
    rbsTakenRounds12,
    rbsInTop12,
    recentRbPickStreak,
    rbInRecentWindow,
    draftSeed,
  } = ctx;
  const round1 = roundNumber <= 1;
  const round2 = roundNumber <= 2;
  const earlyRounds = roundNumber <= 2;
  const midRounds = roundNumber >= 3 && roundNumber <= 8;
  const inTeWindow = pickNumber >= 6 && pickNumber <= 12;
  const earlyOverall = pickNumber <= numTeams * 2;
  const top12Window = pickNumber <= 12;

  const rbSaturation = rbsTakenRounds12 / Math.max(1, numTeams * 2);
  const top12RbCap = targetMaxRbsInTop12(numTeams);
  const top12RbHeavy = rbsInTop12 >= top12RbCap;
  const heavyRbRun =
    recentRbPickStreak >= 2 ||
    rbInRecentWindow >= 4 ||
    (recentRbPickStreak >= 2 && rbInRecentWindow >= 3);
  const extremeRbRun =
    recentRbPickStreak >= 3 ||
    rbInRecentWindow >= 5 ||
    rbsInTop12 >= top12RbCap + 1;

  return available.filter((p) => {
    const pos = posOf(p);

    if (round1 && (pos === 'K' || pos === 'DEF' || pos === 'D/ST')) return false;

    if (pos === 'QB') {
      if (round1) {
        const allowRound1Qb = seededChance(draftSeed, pickNumber, 'qb-r1') < 0.001;
        if (!allowRound1Qb) return false;
      } else if (earlyOverall && round2) {
        return seededChance(draftSeed, pickNumber, 'qb-r2-early') < 0.015;
      }
      if (round1 && qbTakenInRound1 >= 1 && p.rank > 18) return false;
      if (round2 && p.rank > numTeams * 2.5) {
        return seededChance(draftSeed, pickNumber, 'qb-r2-late') < 0.2;
      }
    }

    if (pos === 'TE') {
      if (pickNumber <= 5) return false;
      if (inTeWindow) {
        if (teTakenInTop12 >= 1) return false;
        const eliteTe = p.rank <= Math.max(14, Math.ceil(numTeams * 1.1));
        if (!eliteTe) return false;
        return seededChance(draftSeed, pickNumber, 'te-6-12') < 0.05;
      }
      if (round2 && p.rank > numTeams * 2) {
        return seededChance(draftSeed, pickNumber, 'te-r2') < 0.2;
      }
    }

    if (pos === 'RB') {
      const eliteRb = p.rank <= Math.ceil(numTeams * 1.35);
      const teamStarvedRb = (ctx.teamRbCount ?? 2) <= 1;

      if (top12Window && top12RbHeavy && !eliteRb && !teamStarvedRb) {
        return false;
      }

      if (earlyRounds && !eliteRb && !teamStarvedRb) {
        if (extremeRbRun) return false;
        if (heavyRbRun && p.rank > numTeams * 1.6) return false;
        if (rbSaturation >= 0.55 && p.rank > numTeams * 2) return false;
      }

      if (midRounds && !teamStarvedRb && rbSaturation >= 0.62 && p.rank > numTeams * 2.5) {
        if (heavyRbRun) return false;
        return seededChance(draftSeed, pickNumber, 'rb-mid-skip') < 0.25;
      }
    }

    return true;
  });
}

export function applyMarketScarcityToScores(
  scored: { player: RankedPlayer; adjustedScore: number }[],
  ctx: CpuRealismContext
): { player: RankedPlayer; adjustedScore: number }[] {
  if (scored.length === 0) return scored;

  const {
    numTeams,
    rbsTakenRounds12,
    rbsInTop12,
    recentRbPickStreak,
    rbInRecentWindow,
    roundNumber,
    teamRbCount = 0,
  } = ctx;
  const rbSaturation = rbsTakenRounds12 / Math.max(1, numTeams * 2);
  const top12RbHeavy = rbsInTop12 >= targetMaxRbsInTop12(numTeams);
  const heavyRun = recentRbPickStreak >= 2 || rbInRecentWindow >= 4;
  const extremeRun = recentRbPickStreak >= 3 || rbInRecentWindow >= 5 || top12RbHeavy;
  const teamNeedsRb = teamRbCount <= 1;
  const leagueRbFlooded = top12RbHeavy || rbSaturation >= 0.58;

  let adjusted = scored;

  if (roundNumber <= 8) {
    adjusted = adjusted.map((row) => {
      const pos = posOf(row.player);
      let mult = 1;

      if (pos === 'RB') {
        if (teamNeedsRb && !leagueRbFlooded) {
          if (teamRbCount === 0 && row.player.rank <= numTeams * 6) mult *= 1.1;
          else if (teamRbCount === 1 && roundNumber >= 5 && row.player.rank <= numTeams * 7) {
            mult *= 1.12;
          }
        } else if (teamNeedsRb && leagueRbFlooded && row.player.rank <= numTeams * 5) {
          mult *= 1.05;
        } else if (extremeRun && row.player.rank > numTeams * 1.4) mult *= 0.35;
        else if (heavyRun && row.player.rank > numTeams * 1.8) mult *= 0.48;
        else if (rbSaturation >= 0.5 && row.player.rank > numTeams * 2) mult *= 0.58;
      }
      if (pos === 'WR') {
        if (extremeRun) mult *= 1.32;
        else if (heavyRun) mult *= 1.22;
        else if (leagueRbFlooded) mult *= 1.15;
        else if (rbSaturation >= 0.48) mult *= 1.1;
      }

      return { ...row, adjustedScore: row.adjustedScore * mult };
    });
  }

  if (roundNumber >= 3 && roundNumber <= 12 && teamNeedsRb && !leagueRbFlooded) {
    adjusted = applyTeamRosterNeedToScores(adjusted, teamRbCount, roundNumber, numTeams);
  }

  return adjusted;
}

export function applyTeamRosterNeedToScores(
  scored: { player: RankedPlayer; adjustedScore: number }[],
  teamRbCount: number,
  roundNumber: number,
  numTeams: number
): { player: RankedPlayer; adjustedScore: number }[] {
  if (teamRbCount >= 2) return scored;

  return scored.map((row) => {
    const pos = posOf(row.player);
    let mult = 1;
    const starterTier = row.player.rank <= numTeams * 7;
    const flexRbTier = row.player.rank <= numTeams * 10;

    if (pos === 'RB') {
      if (teamRbCount === 0 && roundNumber >= 4 && starterTier) mult = 1.18;
      else if (teamRbCount === 0 && roundNumber >= 4 && flexRbTier) mult = 1.1;
      else if (teamRbCount === 1 && roundNumber >= 5 && starterTier) mult = 1.15;
      else if (teamRbCount === 1 && roundNumber >= 6 && flexRbTier) mult = 1.08;
    }

    return { ...row, adjustedScore: row.adjustedScore * mult };
  });
}

export function countLeagueTop12Te(
  picks: { pick_number: number; player?: { position?: string | null } | null }[]
): number {
  return picks.filter((p) => {
    if (p.pick_number > 12) return false;
    return posOf(p.player ?? {}) === 'TE';
  }).length;
}

export function countLeagueTop10Te(
  picks: { pick_number: number; player?: { position?: string | null } | null }[]
): number {
  return countLeagueTop12Te(picks);
}

export function countRound1Qb(
  picks: { round_number: number; player?: { position?: string | null } | null }[],
  _numTeams: number
): number {
  return picks.filter((p) => {
    if (p.round_number !== 1) return false;
    return posOf(p.player ?? {}) === 'QB';
  }).length;
}

export function countRbsInRounds12(
  picks: { round_number: number; player?: { position?: string | null } | null }[]
): number {
  return picks.filter((p) => {
    if (p.round_number > 2) return false;
    return posOf(p.player ?? {}) === 'RB';
  }).length;
}

export function countRbsInPickWindow(
  picks: { pick_number: number; player?: { position?: string | null } | null }[],
  maxPickNumber: number
): number {
  return picks.filter((p) => {
    if (p.pick_number > maxPickNumber) return false;
    return posOf(p.player ?? {}) === 'RB';
  }).length;
}

export function countRecentPositionStreak(
  picks: { pick_number: number; player?: { position?: string | null } | null }[],
  position: string,
  lookback = 8
): number {
  const sorted = [...picks].sort((a, b) => b.pick_number - a.pick_number);
  const target = position.toUpperCase();
  let streak = 0;
  for (let i = 0; i < Math.min(lookback, sorted.length); i++) {
    if (posOf(sorted[i].player ?? {}) !== target) break;
    streak += 1;
  }
  return streak;
}

export function countPositionInRecentWindow(
  picks: { pick_number: number; player?: { position?: string | null } | null }[],
  position: string,
  windowSize = 8
): number {
  const sorted = [...picks].sort((a, b) => b.pick_number - a.pick_number);
  const target = position.toUpperCase();
  let count = 0;
  for (let i = 0; i < Math.min(windowSize, sorted.length); i++) {
    if (posOf(sorted[i].player ?? {}) === target) count += 1;
  }
  return count;
}

export function draftIdToSeed(draftId: string | undefined): number {
  if (!draftId) return 42;
  let h = 0;
  for (let i = 0; i < draftId.length; i++) {
    h = ((h << 5) - h + draftId.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}
