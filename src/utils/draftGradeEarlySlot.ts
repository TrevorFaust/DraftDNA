/**
 * Premium draft slot (1.01–1.03) and roster-structure penalties.
 */

import type { PlayerAdpOnTeam } from '@/utils/teamDepthFromAdp';
import {
  analyzeTeamDepthFromAdp,
  getDepthRole,
  isHealthySameTeamStack,
  type TeamDepthAnalysis,
} from '@/utils/teamDepthFromAdp';

export interface EarlySlotPick {
  pick_number: number;
  round_number: number;
  pos: string;
  adp: number;
  rawAdp: number;
  name: string | null;
  nflTeam: string | null;
}

export interface EarlyDraftStructureResult {
  penalty: number;
  maxNumericScore: number | null;
  narrativeNote: string | null;
  premiumSlotMiss: boolean;
  /** Non-elite WR2s taken early, or multiple WR2s in the back half. */
  earlyTeamWr2Count: number;
}

const TOP_TIER_ADP = 8;
const PREMIUM_PICK_MAX = 3;

function hasMarketAdp(p: EarlySlotPick, poolSize: number): boolean {
  return p.rawAdp > 0 && p.rawAdp <= poolSize + 12;
}

/** Positive = fell to you; negative = reached ahead of ADP. */
function valueSpots(p: EarlySlotPick): number {
  const adp = p.rawAdp > 0 ? p.rawAdp : p.pick_number;
  return p.pick_number - adp;
}

function isWrReach(p: EarlySlotPick, numTeams: number, poolSize: number): boolean {
  return hasMarketAdp(p, poolSize) && valueSpots(p) < -numTeams * 0.5;
}

function isWr1OnTeam(depthCtx: TeamDepthAnalysis, pick: EarlySlotPick): boolean {
  if (!pick.nflTeam) return false;
  const role = getDepthRole(depthCtx, pick.nflTeam, 'WR', pick.adp);
  return role === 'alpha' || role === 'starter';
}

function isShallowWrOnTeam(depthCtx: TeamDepthAnalysis, pick: EarlySlotPick): boolean {
  if (!pick.nflTeam) return false;
  const role = getDepthRole(depthCtx, pick.nflTeam, 'WR', pick.adp);
  // WR2 ("competing") is startable; only WR3+ is shallow for early-slot judgment.
  return role === 'depth' || role === 'dart';
}

function hasProblematicSameTeamEarlyWrs(
  earlyWrs: EarlySlotPick[],
  depthCtx: TeamDepthAnalysis
): boolean {
  const byTeam = new Map<string, EarlySlotPick[]>();
  for (const w of earlyWrs) {
    if (!w.nflTeam) continue;
    const list = byTeam.get(w.nflTeam) ?? [];
    list.push(w);
    byTeam.set(w.nflTeam, list);
  }
  for (const teamWrs of byTeam.values()) {
    if (teamWrs.length < 2) continue;
    if (isHealthySameTeamStack(teamWrs, depthCtx)) continue;
    const shallowOnTeam = teamWrs.filter((w) => isShallowWrOnTeam(depthCtx, w)).length;
    const hasAlpha = teamWrs.some((w) => {
      const role = getDepthRole(depthCtx, w.nflTeam, 'WR', w.adp);
      return role === 'alpha';
    });
    if (shallowOnTeam >= 2) return true;
    if (!hasAlpha && teamWrs.length >= 2) return true;
  }
  return false;
}

/** TE/QB anchor that can justify deferring RB (zero-RB builds). */
function hasPremiumTeOrQbAnchor(
  picks: EarlySlotPick[],
  numTeams: number,
  poolSize: number,
  goodLateQb: boolean
): boolean {
  const strongTe = picks.some(
    (p) =>
      p.pos === 'TE' &&
      p.round_number <= 8 &&
      hasMarketAdp(p, poolSize) &&
      p.rawAdp <= numTeams * 5
  );
  const earlyQb = picks.some((p) => p.pos === 'QB' && p.round_number <= 8);
  return strongTe || earlyQb || goodLateQb;
}

/** Zero-RB: no RB through round 6, but strong WR core plus TE/QB to carry the build. */
function isViableZeroRbWrStart(
  earlyWrs: EarlySlotPick[],
  picks: EarlySlotPick[],
  depthCtx: TeamDepthAnalysis,
  numTeams: number,
  poolSize: number,
  goodLateQb: boolean
): boolean {
  if (earlyWrs.length < 3) return false;
  const rbsInFirstSix = picks.filter((p) => p.pos === 'RB' && p.round_number <= 6).length;
  if (rbsInFirstSix > 0) return false;

  const wr1Count = earlyWrs.filter((w) => isWr1OnTeam(depthCtx, w)).length;
  const shallowCount = earlyWrs.filter((w) => isShallowWrOnTeam(depthCtx, w)).length;
  const wrReachCount = earlyWrs.filter((w) => isWrReach(w, numTeams, poolSize)).length;
  const sameTeamIssue = hasProblematicSameTeamEarlyWrs(earlyWrs, depthCtx);

  const strongWrCore =
    wr1Count >= 2 && shallowCount <= 1 && wrReachCount === 0 && !sameTeamIssue;

  return strongWrCore && hasPremiumTeOrQbAnchor(picks, numTeams, poolSize, goodLateQb);
}

/** Late QB is only penalized with an early WR run when the WRs or roster holes justify it. */
function lateQbWithEarlyWrPenalty(
  picks: EarlySlotPick[],
  firstQb: EarlySlotPick,
  numTeams: number,
  poolSize: number,
  depthCtx: TeamDepthAnalysis,
  goodLateQb: boolean
): { penalty: number; maxCap: number | null; note: string | null } {
  const earlyWrs = picks.filter((p) => p.pos === 'WR' && p.round_number <= 6);
  if (earlyWrs.length < 3) {
    return { penalty: 0, maxCap: null, note: null };
  }

  const wr1Count = earlyWrs.filter((w) => isWr1OnTeam(depthCtx, w)).length;
  const shallowCount = earlyWrs.filter((w) => isShallowWrOnTeam(depthCtx, w)).length;
  const wrReachCount = earlyWrs.filter((w) => isWrReach(w, numTeams, poolSize)).length;
  const sameTeamIssue = hasProblematicSameTeamEarlyWrs(earlyWrs, depthCtx);

  const threeStrongWr1 =
    wr1Count >= 3 && shallowCount === 0 && wrReachCount === 0 && !sameTeamIssue;

  if (
    threeStrongWr1 ||
    isViableZeroRbWrStart(earlyWrs, picks, depthCtx, numTeams, poolSize, goodLateQb)
  ) {
    return { penalty: 0, maxCap: null, note: null };
  }

  const reasons: string[] = [];
  if (shallowCount >= 2) {
    reasons.push('several early wideouts were WR3-or-lower on their teams');
  } else if (shallowCount >= 1) {
    reasons.push('at least one early wideout was a WR3-or-lower option on his team');
  }
  if (sameTeamIssue) {
    reasons.push('you doubled up on the same passing game early');
  }
  if (wrReachCount >= 2) {
    reasons.push('those wideout picks came well ahead of ADP');
  } else if (wrReachCount >= 1 && shallowCount >= 1) {
    reasons.push('you reached on depth-chart wideouts');
  }

  if (reasons.length === 0) {
    if (wr1Count < 3 && !goodLateQb) {
      reasons.push('the early wideout run was not three clear WR1s on their teams');
    } else {
      return { penalty: 0, maxCap: null, note: null };
    }
  }

  const severity =
    (shallowCount >= 2 ? 2 : shallowCount >= 1 ? 1 : 0) +
    (sameTeamIssue ? 2 : 0) +
    (wrReachCount >= 2 ? 2 : wrReachCount >= 1 ? 1 : 0) +
    (!goodLateQb ? 1 : 0);

  const penalty = severity >= 5 ? 6 : severity >= 3 ? 4 : 2;
  // No hard strategy ceiling — late QB + messy WR run costs points only.
  const maxCap = null;

  const reasonText =
    reasons.length === 1
      ? reasons[0]
      : `${reasons.slice(0, -1).join(', ')} and ${reasons[reasons.length - 1]}`;

  const qbRound = firstQb.round_number;
  const qbName = firstQb.name ?? 'your quarterback';
  const note = goodLateQb
    ? `You found ${qbName} late at value, but ${reasonText} before quarterback in round ${qbRound}.`
    : `You waited on quarterback until round ${qbRound} after loading up on wideouts because ${reasonText}.`;

  return { penalty, maxCap, note };
}

/** Took player well before their ADP with a top-three pick (passed on elite tier). */
export function isPremiumSlotReach(
  pick: EarlySlotPick,
  numTeams: number,
  poolSize: number
): boolean {
  if (pick.pick_number > PREMIUM_PICK_MAX) return false;
  if (!hasMarketAdp(pick, poolSize)) return false;
  if (!['RB', 'WR', 'QB', 'TE'].includes(pick.pos)) return false;
  // How many spots ahead of ADP (reach size).
  const tierGap = pick.rawAdp - pick.pick_number;
  return tierGap >= Math.max(5, Math.floor(numTeams * 0.45));
}

/** A top-slot "steal" is fake when the pick was actually a premium reach. */
export function isFalseEarlySteal(
  pick: EarlySlotPick,
  numTeams: number,
  poolSize: number
): boolean {
  if (!hasMarketAdp(pick, poolSize)) return false;
  if (pick.pick_number > numTeams) return false;
  if (isPremiumSlotReach(pick, numTeams, poolSize)) return true;
  if (pick.pick_number <= PREMIUM_PICK_MAX && pick.rawAdp > TOP_TIER_ADP) {
    return pick.rawAdp - pick.pick_number >= 4;
  }
  return false;
}

export function analyzeEarlyDraftStructure(
  picks: EarlySlotPick[],
  numTeams: number,
  numRounds: number,
  playerPool?: PlayerAdpOnTeam[]
): EarlyDraftStructureResult {
  const poolSize = numTeams * numRounds;
  const sorted = [...picks].sort((a, b) => a.pick_number - b.pick_number);
  let penalty = 0;
  let maxNumericScore: number | null = null;
  let narrativeNote: string | null = null;
  let premiumSlotMiss = false;
  let earlyTeamWr2Count = 0;

  const first = sorted[0];
  if (first && isPremiumSlotReach(first, numTeams, poolSize)) {
    premiumSlotMiss = true;
    const gap = Math.round(first.rawAdp - first.pick_number);
    penalty += 10 + Math.min(6, gap);
    // Soft ceiling only — an elite recovery can still clear A-band.
    maxNumericScore = 92;
    const who = first.name ?? 'your first pick';
    narrativeNote =
      first.pick_number === 1
        ? `At 1.01 you took ${who} while several top-five-to-six studs were still on the board.`
        : `With pick ${first.pick_number} you took ${who} well ahead of ADP and passed on the true first-round tier.`;
  }

  const teams = new Set(
    picks.map((p) => p.nflTeam).filter((t): t is string => Boolean(t))
  );
  const forDepth: PlayerAdpOnTeam[] = [];
  if (playerPool) {
    for (const p of playerPool) {
      if (p.nflTeam && teams.has(p.nflTeam) && ['WR', 'RB', 'TE'].includes(p.pos)) {
        forDepth.push(p);
      }
    }
  }
  for (const p of picks) {
    if (p.nflTeam && ['WR', 'RB', 'TE'].includes(p.pos)) {
      forDepth.push({ pos: p.pos, adp: p.adp, nflTeam: p.nflTeam });
    }
  }
  const depthCtx = analyzeTeamDepthFromAdp(forDepth);

  // NFL WR2 ("competing") is a normal fantasy starter in 12/14-team leagues.
  // Only early WR3+ (depth/dart) ahead of the WR2 market is a real problem.
  let earlyWr3Count = 0;
  let wr3DepthPenalty = 0;

  for (const p of picks) {
    if (p.pos !== 'WR' || !p.nflTeam) continue;
    const role = getDepthRole(depthCtx, p.nflTeam, 'WR', p.adp);
    if (role !== 'depth' && role !== 'dart') continue;

    if (p.round_number <= 6) {
      earlyWr3Count += 1;
      earlyTeamWr2Count += 1; // retained field name for callers; means early shallow WR count
      wr3DepthPenalty += p.round_number <= 4 ? 2 : 1;
    }
  }

  penalty += Math.min(6, wr3DepthPenalty);

  if (earlyWr3Count >= 2) {
    penalty += 1;
    const note =
      'You took NFL WR3-or-lower options early while clearer WR2s were still on the board.';
    narrativeNote = narrativeNote ? `${narrativeNote} ${note}` : note;
  }

  const firstQb = sorted.find((p) => p.pos === 'QB');
  if (firstQb && firstQb.round_number >= 7) {
    const qbValue = valueSpots(firstQb);
    const goodLateQb = hasMarketAdp(firstQb, poolSize) && qbValue >= numTeams * 0.75;
    const midRoundLeaks = picks.filter(
      (p) =>
        p.round_number >= 4 &&
        p.round_number <= 7 &&
        p.pos !== 'QB' &&
        hasMarketAdp(p, poolSize) &&
        valueSpots(p) < -numTeams * 0.5
    ).length;

    const wrLate = lateQbWithEarlyWrPenalty(
      picks,
      firstQb,
      numTeams,
      poolSize,
      depthCtx,
      goodLateQb
    );
    if (wrLate.penalty > 0) {
      penalty += wrLate.penalty;
      if (wrLate.maxCap != null) {
        maxNumericScore =
          maxNumericScore != null ? Math.min(maxNumericScore, wrLate.maxCap) : wrLate.maxCap;
      }
      narrativeNote = narrativeNote ? `${narrativeNote} ${wrLate.note}` : wrLate.note;
    } else if (goodLateQb && midRoundLeaks >= 2) {
      penalty += 3;
      const qbNote = `You found ${firstQb.name ?? 'your quarterback'} late at value, but the middle rounds still included reaches while better QBs were on the board.`;
      narrativeNote = narrativeNote ? `${narrativeNote} ${qbNote}` : qbNote;
    }
  }

  return {
    penalty,
    maxNumericScore,
    narrativeNote,
    premiumSlotMiss,
    earlyTeamWr2Count,
  };
}
