/**
 * Prior-season (2025) positional finish ranks for draft grade narratives.
 * RB/WR top-fives weigh most; RB/WR top-tens add depth; duplicate QB/TE/K/DEF top-fives are discounted.
 */

import { PLAYER_POOL_PRIOR_SEASON } from '@/constants/playerPoolSeason';
import { narrativeCount, seasonCountPhrase } from '@/utils/draftGradeNarrativeStyle';

const SKILL_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);

export interface PosRank1Finisher {
  name: string;
  pos: string;
  round: number;
}

export interface RbWrFinisher {
  name: string;
  pos: string;
  rank: number;
  draftRound: number;
}

export interface RankedDefFinisher {
  name: string;
  rank: number;
  draftRound: number;
}

/** Draft slot context so we do not state the obvious (e.g. WR1 at 1.01). */
export interface PriorSeasonNarrativeContext {
  firstPickNumber?: number | null;
  firstPickName?: string | null;
  numTeams?: number;
}

export interface PriorSeasonDraftProfile {
  season: number;
  /** All skill-position top-fives (legacy aggregate). */
  top5Count: number;
  top10Count: number;
  top5CoreCount: number;
  top5Names: string[];
  top10Names: string[];
  benchTop10Count: number;
  benchTop10Names: string[];
  benchUnprovenCount: number;
  skillPicksWithPriorRank: number;
  skillPicksTotal: number;
  top5KickerDefCount: number;
  top5KickerDefNames: string[];
  top5DefCount: number;
  top5DefNames: string[];
  top5KickerCount: number;
  top5KickerNames: string[];
  /** Finished #1 at their position last season (QB1, RB1, DEF1, etc.). */
  posRank1Finishers: PosRank1Finisher[];
  qbRank1Name: string | null;
  qbRank1Round: number | null;
  /** High-impact top-fives for grade boost and praise. */
  top5RbWrCount: number;
  top5RbWrNames: string[];
  /** RB/WR with prior-year finish rank 6–10 (premium depth, not elite). */
  top10RbWrOnlyCount: number;
  top10RbWrOnlyNames: string[];
  /** All RB/WR top-ten finishers (includes top-five). */
  top10RbWrCount: number;
  top10RbWrNames: string[];
  /** RB/WR with prior-year rank (for WR2 / RB6 style copy). */
  rbWrFinishers: RbWrFinisher[];
  rankedDefFinishers: RankedDefFinisher[];
  top5QbCount: number;
  top5QbNames: string[];
  firstQbTop5Round: number | null;
  secondQbTop5Round: number | null;
  /** Sole top-five QB taken round 7+ without a big reach. */
  firstQbTop5LateValue: boolean;
  /** Second top-five QB round 7+ (or both QBs late) — insurance/steal, not wasted capital. */
  secondQbTop5LateValue: boolean;
  bothQbTop5Early: boolean;
  bothQbTop5Late: boolean;
  secondQbTop5BigReach: boolean;
  top5TeCount: number;
  top5TeNames: string[];
  /** Round of the second top-five TE on the roster, if any. */
  secondTeTop5Round: number | null;
  /** Top-five TEs taken in rounds 1–12 while the roster was still forming. */
  teTop5EarlyCount: number;
  /** Second top-five TE was ~3+ rounds ahead of ADP. */
  secondTeTop5BigReach: boolean;
}

export interface PriorSeasonGradeAdjustment {
  bonus: number;
  penalty: number;
}

export interface PriorSeasonPickInput {
  name: string | null;
  pos: string;
  round_number: number;
  pick_number: number;
  playerId?: string | null;
  adp?: number;
}

const EARLY_ROSTER_MAX_ROUND = 12;
/** Second (or sole) top-five QB at this round or later = roster already built; treat as value. */
const LATE_TOP5_QB_ROUND = 7;

export function parseNumericPositionRank(positionRank: string): number | null {
  const m = /(\d+)\s*$/.exec(positionRank.trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n > 0 ? n : null;
}

export function buildPriorSeasonRankByPlayerId(
  stats: Map<string, { positionRank: string }>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, row] of stats) {
    const rank = parseNumericPositionRank(row.positionRank);
    if (rank != null) out[id] = rank;
  }
  return out;
}

function getRank(
  rankByPlayerId: Record<string, number> | Map<string, number>,
  playerId: string
): number | null {
  const rank =
    rankByPlayerId instanceof Map
      ? rankByPlayerId.get(playerId)
      : rankByPlayerId[playerId];
  return rank != null && rank > 0 ? rank : null;
}

function valueSpotsForPick(p: PriorSeasonPickInput): number {
  const adp = p.adp != null && p.adp > 0 ? p.adp : p.pick_number;
  return p.pick_number - adp;
}

/** ~3 rounds ahead of ADP (same scale as draft grade reaches). */
function isBigReach(valueSpots: number, numTeams: number): boolean {
  return valueSpots < -numTeams * 2.85;
}

export function analyzePriorSeasonRanks(
  picks: PriorSeasonPickInput[],
  rankByPlayerId: Record<string, number> | Map<string, number>,
  numTeams: number = 12
): PriorSeasonDraftProfile | null {
  let top5Count = 0;
  let top10Count = 0;
  let top5CoreCount = 0;
  const top5Names: string[] = [];
  const top10Names: string[] = [];
  const benchTop10Names: string[] = [];
  let benchTop10Count = 0;
  let benchUnprovenCount = 0;
  let skillPicksWithPriorRank = 0;
  let skillPicksTotal = 0;
  const top5KickerDefNames: string[] = [];
  const top5DefNames: string[] = [];
  const top5KickerNames: string[] = [];
  const posRank1Finishers: PosRank1Finisher[] = [];
  let top5KickerDefCount = 0;
  let qbRank1Name: string | null = null;
  let qbRank1Round: number | null = null;
  const top5RbWrNames: string[] = [];
  const top10RbWrNames: string[] = [];
  const top10RbWrOnlyNames: string[] = [];
  const rbWrFinishers: RbWrFinisher[] = [];
  const rankedDefFinishers: RankedDefFinisher[] = [];
  const top5QbNames: string[] = [];
  const qbTop5Rounds: number[] = [];
  const qbTop5ValueSpots: number[] = [];
  const top5TeNames: string[] = [];
  const teTop5Rounds: number[] = [];
  const teTop5ValueSpots: number[] = [];

  const sorted = [...picks].sort((a, b) => a.pick_number - b.pick_number);

  for (const p of sorted) {
    const id = p.playerId?.trim();
    const rank = id ? getRank(rankByPlayerId, id) : null;

    if (p.pos === 'K' || p.pos === 'DEF') {
      if (rank != null) {
        if (rank === 1 && p.name) {
          posRank1Finishers.push({
            name: p.name,
            pos: p.pos,
            round: p.round_number,
          });
        }
        if (rank <= 5) {
          top5KickerDefCount += 1;
          if (p.name) top5KickerDefNames.push(p.name);
          if (p.pos === 'DEF' && p.name) {
            top5DefNames.push(p.name);
            rankedDefFinishers.push({
              name: p.name,
              rank,
              draftRound: p.round_number,
            });
          }
          if (p.pos === 'K' && p.name) top5KickerNames.push(p.name);
        }
      }
      continue;
    }

    if (!SKILL_POSITIONS.has(p.pos)) continue;
    skillPicksTotal += 1;

    const isCore = p.round_number <= 5;
    const isBench = p.round_number >= 10;

    if (rank == null) {
      if (isBench) benchUnprovenCount += 1;
      continue;
    }

    skillPicksWithPriorRank += 1;

    if (rank === 1 && p.name) {
      posRank1Finishers.push({
        name: p.name,
        pos: p.pos,
        round: p.round_number,
      });
    }

    if (rank <= 5) {
      top5Count += 1;
      if (p.name) top5Names.push(p.name);
      if (isCore) top5CoreCount += 1;

      if (p.pos === 'RB' || p.pos === 'WR') {
        if (p.name) top5RbWrNames.push(p.name);
      } else if (p.pos === 'QB') {
        if (p.name) top5QbNames.push(p.name);
        qbTop5Rounds.push(p.round_number);
        qbTop5ValueSpots.push(valueSpotsForPick(p));
        if (rank === 1) {
          qbRank1Name = p.name;
          qbRank1Round = p.round_number;
        }
      } else if (p.pos === 'TE') {
        if (p.name) top5TeNames.push(p.name);
        teTop5Rounds.push(p.round_number);
        teTop5ValueSpots.push(valueSpotsForPick(p));
      }
    }
    if (rank <= 10) {
      top10Count += 1;
      if (p.name && top10Names.length < 6) top10Names.push(p.name);
      if (p.pos === 'RB' || p.pos === 'WR') {
        if (p.name) {
          top10RbWrNames.push(p.name);
          if (rank > 5) top10RbWrOnlyNames.push(p.name);
          rbWrFinishers.push({
            name: p.name,
            pos: p.pos,
            rank,
            draftRound: p.round_number,
          });
        }
      }
      if (isBench) {
        benchTop10Count += 1;
        if (p.name && benchTop10Names.length < 2) benchTop10Names.push(p.name);
      }
    } else if (isBench && rank > 24) {
      benchUnprovenCount += 1;
    }
  }

  if (skillPicksWithPriorRank < 2) return null;

  const secondTeTop5Round = teTop5Rounds.length >= 2 ? teTop5Rounds[1] : null;
  const secondTeTop5BigReach =
    teTop5ValueSpots.length >= 2 && isBigReach(teTop5ValueSpots[1], numTeams);
  const teTop5EarlyCount = teTop5Rounds.filter((r) => r <= EARLY_ROSTER_MAX_ROUND).length;

  const firstQbTop5Round = qbTop5Rounds[0] ?? null;
  const secondQbTop5Round = qbTop5Rounds.length >= 2 ? qbTop5Rounds[1] : null;
  const secondQbTop5BigReach =
    qbTop5ValueSpots.length >= 2 && isBigReach(qbTop5ValueSpots[1], numTeams);
  const firstQbTop5BigReach =
    qbTop5ValueSpots.length >= 1 && isBigReach(qbTop5ValueSpots[0], numTeams);
  const bothQbTop5Early =
    qbTop5Rounds.length >= 2 &&
    qbTop5Rounds.every((r) => r < LATE_TOP5_QB_ROUND);
  const bothQbTop5Late =
    qbTop5Rounds.length >= 2 &&
    qbTop5Rounds.every((r) => r >= LATE_TOP5_QB_ROUND);
  const secondQbTop5LateValue =
    secondQbTop5Round != null &&
    secondQbTop5Round >= LATE_TOP5_QB_ROUND &&
    !secondQbTop5BigReach;
  const firstQbTop5LateValue =
    top5QbNames.length === 1 &&
    firstQbTop5Round != null &&
    firstQbTop5Round >= LATE_TOP5_QB_ROUND &&
    !firstQbTop5BigReach;

  return {
    season: PLAYER_POOL_PRIOR_SEASON,
    top5Count,
    top10Count,
    top5CoreCount,
    top5Names,
    top10Names,
    benchTop10Count,
    benchTop10Names,
    benchUnprovenCount,
    skillPicksWithPriorRank,
    skillPicksTotal,
    top5KickerDefCount,
    top5KickerDefNames,
    top5DefCount: top5DefNames.length,
    top5DefNames,
    top5KickerCount: top5KickerNames.length,
    top5KickerNames,
    posRank1Finishers,
    qbRank1Name,
    qbRank1Round,
    top5RbWrCount: top5RbWrNames.length,
    top5RbWrNames,
    top10RbWrOnlyCount: top10RbWrOnlyNames.length,
    top10RbWrOnlyNames,
    top10RbWrCount: top10RbWrNames.length,
    top10RbWrNames,
    rbWrFinishers,
    rankedDefFinishers,
    top5QbCount: top5QbNames.length,
    top5QbNames,
    firstQbTop5Round,
    secondQbTop5Round,
    firstQbTop5LateValue,
    secondQbTop5LateValue,
    bothQbTop5Early,
    bothQbTop5Late,
    secondQbTop5BigReach,
    top5TeCount: top5TeNames.length,
    top5TeNames,
    secondTeTop5Round,
    teTop5EarlyCount,
    secondTeTop5BigReach,
  };
}

/** Weighted signal for how much prior-year elite talent is on the roster. */
export function priorSeasonEliteRosterScore(
  profile: PriorSeasonDraftProfile | null | undefined
): number {
  if (!profile) return 0;
  let score = 0;
  score += profile.top5RbWrCount * 3;
  score += profile.top5QbCount * 3;
  score += profile.top10RbWrCount;
  if (profile.qbRank1Name) score += 4;
  if (profile.secondQbTop5LateValue) score += 3;
  score += profile.posRank1Finishers.length * 2;
  score += profile.top5DefCount;
  score += profile.top5TeCount;
  return score;
}

/** Grade boost/penalty from how prior-year elites are spread by position. */
export function priorSeasonGradeAdjustment(
  profile: PriorSeasonDraftProfile | null | undefined
): PriorSeasonGradeAdjustment {
  if (!profile) return { bonus: 0, penalty: 0 };

  let bonus = 0;
  let penalty = 0;

  if (profile.top5RbWrCount >= 3) bonus += 8;
  else if (profile.top5RbWrCount >= 2) bonus += 6;
  else if (profile.top5RbWrCount === 1) bonus += 3;

  if (profile.top10RbWrCount >= 5) bonus += 4;
  else if (profile.top10RbWrCount >= 4) bonus += 3;
  else if (profile.top10RbWrCount >= 3 && profile.top10RbWrOnlyCount >= 1) bonus += 2;
  else if (profile.top10RbWrOnlyCount >= 2) bonus += 2;
  else if (profile.top10RbWrOnlyCount >= 1 && profile.top5RbWrCount >= 1) bonus += 1;

  if (profile.top5QbCount === 1 && profile.top5RbWrCount + profile.top10RbWrCount >= 2) bonus += 1;

  if (profile.qbRank1Name) bonus += 4;

  const eliteScore = priorSeasonEliteRosterScore(profile);
  if (eliteScore >= 16) bonus += 8;
  else if (eliteScore >= 13) bonus += 6;
  else if (eliteScore >= 10) bonus += 4;

  if (profile.top5RbWrCount >= 1 && profile.top5QbCount >= 2 && profile.secondQbTop5LateValue) {
    bonus += 3;
  }

  if (profile.top5DefCount >= 1) bonus += 1;

  if (profile.teTop5EarlyCount >= 3) {
    penalty += 12;
  } else if (profile.top5TeCount === 2 && profile.secondTeTop5BigReach) {
    penalty += 5;
  } else if (profile.top5TeCount === 2 && !profile.secondTeTop5BigReach) {
    bonus += 1;
  } else if (profile.top5TeCount === 1 && profile.top5RbWrCount === 0) {
    bonus += 1;
  }

  if (profile.top5QbCount >= 2) {
    if (profile.bothQbTop5Late) bonus += 4;
    else if (profile.secondQbTop5LateValue) bonus += 3;
    else if (profile.bothQbTop5Early) penalty += 6;
    else penalty += 3;
  } else if (profile.firstQbTop5LateValue) {
    bonus += 2;
  }

  if (profile.top5KickerCount >= 2 || profile.top5DefCount >= 2) penalty += 5;

  return { bonus, penalty };
}

export function posRankTag(pos: string, rank: number): string {
  const label =
    pos === 'DEF' || pos === 'D/ST' || pos === 'DST' ? 'D/ST' : pos;
  return `${label}${rank}`;
}

function positionLabel(pos: string): string {
  switch (pos) {
    case 'QB':
      return 'quarterback';
    case 'RB':
      return 'running back';
    case 'WR':
      return 'wide receiver';
    case 'TE':
      return 'tight end';
    case 'DEF':
      return 'defense';
    case 'K':
      return 'kicker';
    default:
      return 'player';
  }
}

function formatNameList(names: string[], listAllUpTo = 8): string {
  const u = [...new Set(names.filter(Boolean))].slice(0, listAllUpTo);
  if (u.length === 0) return '';
  if (u.length === 1) return u[0];
  if (u.length === 2) return `${u[0]} and ${u[1]}`;
  return `${u.slice(0, -1).join(', ')}, and ${u[u.length - 1]}`;
}

function qbTop5StackSentence(profile: PriorSeasonDraftProfile, y: number): string | null {
  if (profile.top5QbCount < 2) return null;
  const who = formatNameList(profile.top5QbNames, 2);
  const second = profile.top5QbNames[1];
  const r2 = profile.secondQbTop5Round;

  if (profile.bothQbTop5Late) {
    return who
      ? `You rostered two ${y} top-five quarterbacks (${who}) in the second half of the draft — real value at a position most rooms overpay for early.`
      : `You rostered two top-five quarterbacks late, which is strong value at a position most rooms overpay for early.`;
  }

  if (profile.secondQbTop5LateValue && r2 != null) {
    const lateName = second ?? 'your second quarterback';
    const starter = profile.qbRank1Name ?? profile.top5QbNames[0];
    const r1 = profile.qbRank1Round ?? profile.firstQbTop5Round;
    if (profile.qbRank1Name && r1 != null) {
      return `You locked in ${starter} in round ${r1} — the ${y} QB1 — then grabbed ${lateName} in round ${r2}, another top-five quarterback that late is insurance and a steal once your skill positions were set.`;
    }
    if (starter && r1 != null) {
      return `You locked in ${starter} in round ${r1}, then grabbed ${lateName} in round ${r2} — a ${y} top-five quarterback that late is insurance and a steal once your skill positions were set.`;
    }
    return who
      ? `You locked in your starter early, then grabbed ${lateName} in round ${r2} — a ${y} top-five quarterback that late is insurance and a steal once your skill positions were set.`
      : `You added a second top-five quarterback in round ${r2}, which is strong insurance and real value once your skill positions were set.`;
  }

  if (profile.bothQbTop5Early) {
    return who
      ? `You have two ${y} top-five quarterbacks (${who}) in the early rounds, and the second one is usually wasted capital that could have gone to RB or WR.`
      : `You have two top-five quarterbacks in the early rounds, and the second one is usually wasted capital that could have gone to RB or WR.`;
  }

  return who
    ? `You have two ${y} top-five quarterbacks (${who}); the second came before your roster was fully built, so it is harder to justify than a late-round value add.`
    : `You have two top-five quarterbacks before the roster was fully built, which is harder to justify than a late-round value add.`;
}

function singleLateTop5QbSentence(profile: PriorSeasonDraftProfile, y: number): string | null {
  if (!profile.firstQbTop5LateValue || profile.top5QbCount !== 1) return null;
  const who = profile.top5QbNames[0];
  const r = profile.firstQbTop5Round;
  if (!who || r == null) return null;
  return `You landed ${who} in round ${r}, a ${y} top-five quarterback that late is excellent value even if he is your only elite at the position.`;
}

function describeRbWrFinisher(f: RbWrFinisher, y: number): string {
  return `${f.name} as the ${y} ${posRankTag(f.pos, f.rank)}`;
}

function rbWrProductionFromRanks(profile: PriorSeasonDraftProfile, y: number): string | null {
  const finishers = [...profile.rbWrFinishers].sort((a, b) => a.draftRound - b.draftRound);
  if (finishers.length === 0) return null;

  const core = finishers.filter((f) => f.draftRound < LATE_TOP5_QB_ROUND);
  const late = finishers.filter((f) => f.draftRound >= LATE_TOP5_QB_ROUND);

  if (core.length === 1 && late.length === 0) {
    const f = core[0];
    return `You have ${describeRbWrFinisher(f, y)}.`;
  }

  if (core.length === 2 && late.length === 0) {
    return `You have ${describeRbWrFinisher(core[0], y)} and ${describeRbWrFinisher(core[1], y)}.`;
  }

  if (core.length >= 1) {
    const coreParts = core.map((f) => describeRbWrFinisher(f, y));
    let line =
      coreParts.length === 1
        ? `You have ${coreParts[0]}.`
        : `You have ${coreParts.slice(0, -1).join(', ')} and ${coreParts[coreParts.length - 1]}.`;
    if (late.length > 0) {
      const lateDesc = late
        .map((f) => `${f.name} (${posRankTag(f.pos, f.rank)} in round ${f.draftRound})`)
        .join(' and ');
      line += ` You also added ${lateDesc} later.`;
    }
    return line;
  }

  if (late.length > 0) {
    const lateDesc = late
      .map((f) => `${f.name} (${posRankTag(f.pos, f.rank)} in round ${f.draftRound})`)
      .join(' and ');
    return `You found ${lateDesc} in the back half of the draft.`;
  }

  return null;
}

/** RB/WR prior-year production — positional ranks (WR2) for core; top-five/ten for bulk/late value. */
function rbWrProductionSentence(profile: PriorSeasonDraftProfile, y: number): string | null {
  const fromRanks = rbWrProductionFromRanks(profile, y);
  if (fromRanks && profile.rbWrFinishers.length <= 4) {
    return fromRanks;
  }

  const top5 = profile.top5RbWrCount;
  const top10 = profile.top10RbWrCount;
  const top10Only = profile.top10RbWrOnlyCount;

  if (top5 >= 3) {
    const who = formatNameList(profile.top5RbWrNames, top5);
    const topFiveLabel = seasonCountPhrase(top5, y, 'top-five finishers');
    let line = who
      ? `Your RB and WR rooms include ${topFiveLabel}: ${who}.`
      : `Your RB and WR rooms include ${topFiveLabel}.`;
    if (top10Only >= 1) {
      const also = formatNameList(profile.top10RbWrOnlyNames, top10Only);
      line += also
        ? ` You also rostered ${narrativeCount(top10Only)} more top-ten RB/WR piece${top10Only === 1 ? '' : 's'} in ${also}.`
        : ` You also rostered ${narrativeCount(top10Only)} more top-ten RB/WR pieces.`;
    }
    return line;
  }

  if (top5 >= 2) {
    const who = formatNameList(profile.top5RbWrNames, top5);
    const topFiveLabel = seasonCountPhrase(top5, y, 'top-five finishers at RB or WR');
    let line = who
      ? `You landed ${topFiveLabel} in ${who}.`
      : `You landed ${topFiveLabel}.`;
    if (top10Only >= 2) {
      const also = formatNameList(profile.top10RbWrOnlyNames, Math.min(top10Only, 3));
      line += also ? ` ${also} also finished top ten at RB or WR.` : '';
    }
    return line;
  }

  if (top5 === 1 && top10 >= 3) {
    const elite = profile.top5RbWrNames[0];
    const rest = formatNameList(
      profile.top10RbWrOnlyNames.length > 0 ? profile.top10RbWrOnlyNames : profile.top10RbWrNames.slice(1),
      top10 - 1
    );
    const more = top10 - 1;
    return rest
      ? `${elite} was a ${y} top-five RB/WR, and you added ${narrativeCount(more)} more top-ten finishers at the position in ${rest}.`
      : `${elite} was a ${y} top-five RB/WR surrounded by other top-ten wideout and backfield talent.`;
  }

  if (top10 >= 4) {
    const who = formatNameList(profile.top10RbWrNames, top10);
    const label = seasonCountPhrase(top10, y, 'top-ten finishers');
    return who
      ? `Your RB and WR group has ${label}: ${who}.`
      : `Your RB and WR group has ${label}.`;
  }

  if (top10 >= 2 && top10 <= 3) {
    const who = formatNameList(profile.top10RbWrNames, top10);
    const label = seasonCountPhrase(top10, y, 'top-ten finishers');
    return who
      ? `You have ${label} in ${who}.`
      : `You have ${label} on this roster.`;
  }

  if (top5 === 1) {
    return `You have one ${y} top-five finisher at RB or WR on the roster.`;
  }

  if (top10Only === 1) {
    const who = profile.top10RbWrOnlyNames[0];
    return who
      ? `${who} finished top ten at RB or WR last year, giving you solid volume at a premium spot.`
      : null;
  }

  return null;
}

function kickerDefTopFiveBeat(profile: PriorSeasonDraftProfile, y: number): string | null {
  if (profile.top5DefCount === 0 && profile.top5KickerCount === 0) return null;

  if (profile.top5DefCount > 0) {
    const def = profile.rankedDefFinishers[0];
    if (def) {
      return `You also rostered ${def.name}, the ${y} ${posRankTag('D/ST', def.rank)} — a nice snag even though defenses matter less week to week than skill positions.`;
    }
    const who = formatNameList(profile.top5DefNames, profile.top5DefCount);
    return who
      ? `You also rostered ${who}, a ${y} top-five defense that rounds out the roster.`
      : `You also rostered a ${y} top-five defense that rounds out the roster.`;
  }

  const who = formatNameList(profile.top5KickerNames, profile.top5KickerCount);
  return who
    ? `You also have ${who}, a ${y} top-five kicker.`
    : null;
}

function isObviousFirstRoundElite(
  f: PosRank1Finisher,
  narrativeCtx?: PriorSeasonNarrativeContext
): boolean {
  if (f.round > 2) return false;
  const numTeams = narrativeCtx?.numTeams ?? 12;
  const slot = narrativeCtx?.firstPickNumber;
  if (slot == null) return f.round === 1;

  if (slot === 1 && f.round === 1) return true;
  if (slot <= numTeams && f.round === 1) return true;
  if (
    narrativeCtx?.firstPickName &&
    f.name.trim().toLowerCase() === narrativeCtx.firstPickName.trim().toLowerCase() &&
    f.round <= 2
  ) {
    return true;
  }
  return false;
}

function posRank1SkillBeats(
  profile: PriorSeasonDraftProfile,
  y: number,
  narrativeCtx?: PriorSeasonNarrativeContext
): string[] {
  const beats: string[] = [];
  for (const f of profile.posRank1Finishers) {
    if (f.pos === 'QB' && profile.top5QbCount >= 1) continue;
    if (f.pos === 'DEF' && profile.top5DefCount >= 1) continue;
    if (f.pos === 'RB' || f.pos === 'WR') {
      if (profile.rbWrFinishers.some((r) => r.name === f.name)) continue;
    }
    if (isObviousFirstRoundElite(f, narrativeCtx)) continue;

    const label = positionLabel(f.pos);
    beats.push(
      `${f.name} finished first among ${label}s in ${y}, and landing him in round ${f.round} was strong value.`
    );
  }
  return beats;
}

function teHeavyNarrativeBeat(profile: PriorSeasonDraftProfile, y: number): string | null {
  if (profile.teTop5EarlyCount >= 3) {
    const teWho = formatNameList(profile.top5TeNames, profile.top5TeCount);
    return teWho
      ? `You used the first ${EARLY_ROSTER_MAX_ROUND} rounds to stack ${narrativeCount(profile.top5TeCount)} top-five tight ends (${teWho}) while RB and WR were still thin, which is too much capital at a one-starter spot.`
      : `You stacked multiple top-five tight ends in the early rounds while RB and WR were still thin.`;
  }

  if (profile.top5TeCount === 2) {
    const teWho = formatNameList(profile.top5TeNames, 2);
    if (profile.secondTeTop5BigReach) {
      return teWho
        ? `You have two ${y} top-five tight ends (${teWho}), but reaching for the second cost value; one should start and the other is still useful depth.`
        : `You have two top-five tight ends, but reaching for the second cost value.`;
    }
    if (profile.secondTeTop5Round != null && profile.secondTeTop5Round > EARLY_ROSTER_MAX_ROUND) {
      return teWho
        ? `You landed two ${y} top-five tight ends (${teWho}), with the second coming late at value as a strong rotational piece.`
        : `You landed two top-five tight ends, with the second coming late at value.`;
    }
    if (profile.top5RbWrCount >= 1 || profile.top10RbWrCount >= 2) {
      const rbWr = rbWrProductionSentence(profile, y);
      return teWho
        ? `${rbWr ?? 'You have strong RB/WR production.'} You also have two top-five tight ends (${teWho}); one TE starts most weeks and the other is elite depth even if you rarely play both.`
        : `${rbWr ?? 'You have strong RB/WR production.'} You also have two top-five tight ends; one TE starts most weeks and the other is strong depth.`;
    }
    return teWho
      ? `You have two ${y} top-five tight ends (${teWho}); one should start and the other is a strong rotational option even if you do not play both weekly.`
      : `You have two top-five tight ends; one should start and the other is strong depth.`;
  }

  return null;
}

function priorSeasonFallbackBeat(profile: PriorSeasonDraftProfile, y: number): string | null {
  if (profile.top5RbWrCount === 1 && profile.top5QbCount === 1) {
    return `You have a ${y} top-five finisher at RB or WR plus a top-five quarterback, a solid one-per-premium-slot start.`;
  }

  if (profile.top5QbCount === 1 && profile.top5TeCount === 1) {
    return `You have ${y} top-five finishers at quarterback and tight end, but the weekly lift is smaller than the same stack at RB and WR.`;
  }

  if (profile.top5TeCount === 1 && profile.top5RbWrCount === 0) {
    return `Your clearest ${y} elite is at tight end, which helps the position but does less for overall roster strength than a top RB or WR.`;
  }

  if (profile.top5Count >= 1 && profile.top5Count <= 2) {
    const label =
      profile.top5Count === 1
        ? `one ${y} top-five finisher`
        : seasonCountPhrase(2, y, 'top-five finishers');
    return `You have ${label} at their position on this roster.`;
  }

  if (profile.skillPicksWithPriorRank >= 5 && profile.top10RbWrCount === 0 && profile.top5RbWrCount === 0) {
    return `You never secured a ${y} top-ten finisher at QB, RB, WR, or TE. Bold strategy, but unlikely to hold up week to week.`;
  }

  if (profile.benchTop10Count >= 3) {
    const who = formatNameList(profile.benchTop10Names, profile.benchTop10Count);
    const label = seasonCountPhrase(profile.benchTop10Count, y, 'top-ten finishers');
    return who
      ? `Your bench still carries ${label}, including ${who}.`
      : `Your bench still carries ${label} for matchup flexibility.`;
  }

  if (profile.benchUnprovenCount >= 4 && profile.top10Count <= 2) {
    return `Most of your bench never cracked the ${y} top 25 at their position, so the depth is thin if injuries hit.`;
  }

  return null;
}

function formatRbWrTalentClause(profile: PriorSeasonDraftProfile, y: number): string | null {
  const core = profile.rbWrFinishers
    .filter((f) => f.draftRound < LATE_TOP5_QB_ROUND)
    .sort((a, b) => a.draftRound - b.draftRound);
  if (core.length === 0) return null;

  const rbs = core.filter((f) => f.pos === 'RB');
  const wrs = core.filter((f) => f.pos === 'WR');

  if (rbs.length >= 2) {
    const [a, b] = rbs;
    return `you still landed strong backs in ${a.name} and ${b.name}, who finished as the ${y} ${posRankTag('RB', a.rank)} and ${posRankTag('RB', b.rank)}`;
  }
  if (rbs.length === 1 && wrs.length >= 1) {
    const rb = rbs[0];
    const wr = wrs[0];
    return `you still have ${rb.name} (${posRankTag('RB', rb.rank)}) and ${wr.name} (${posRankTag('WR', wr.rank)}) from ${y}`;
  }
  if (rbs.length === 1) {
    const rb = rbs[0];
    return `you still have ${rb.name}, who finished as the ${y} ${posRankTag('RB', rb.rank)}`;
  }
  if (wrs.length >= 2) {
    const [a, b] = wrs;
    return `you still landed strong receivers in ${a.name} and ${b.name}, who finished as the ${y} ${posRankTag('WR', a.rank)} and ${posRankTag('WR', b.rank)}`;
  }
  if (wrs.length === 1) {
    const wr = wrs[0];
    return `you still have ${wr.name}, who finished as the ${y} ${posRankTag('WR', wr.rank)}`;
  }
  return null;
}

/** Merge mid-round caveat with RB/WR + QB1 prior-year talent (one flowing sentence). */
export function tryCombinedCaveatAndEliteBeat(
  profile: PriorSeasonDraftProfile,
  caveat: string
): string | null {
  if (!caveat.toLowerCase().includes('bench pieces')) return null;
  if (profile.top5QbCount >= 2) return null;

  const y = profile.season;
  const talent = formatRbWrTalentClause(profile, y);
  if (!talent) return null;

  const qbName = profile.qbRank1Name ?? profile.top5QbNames[0] ?? null;
  const caveatTrim = caveat.trim().replace(/\.$/, '');
  const caveatWhile =
    caveatTrim.charAt(0).toLowerCase() + caveatTrim.slice(1);

  let clause = talent;
  if (qbName && profile.qbRank1Name) {
    clause += ` — similarly, you have the ${y} QB1 in ${qbName}`;
  }

  return `While ${caveatWhile}, ${clause}.`;
}

export function priorBeatMergedIntoCombined(
  beat: string,
  profile: PriorSeasonDraftProfile
): boolean {
  const lower = beat.toLowerCase();
  if (lower.includes('bench pieces')) return true;
  for (const f of profile.rbWrFinishers) {
    if (beat.includes(f.name) && (lower.startsWith('you have') || lower.includes('you still'))) {
      return true;
    }
  }
  if (profile.qbRank1Name && beat.includes(profile.qbRank1Name) && beat.includes('QB1')) {
    return true;
  }
  return false;
}

/** Prior-year finish beats — RB/WR, QB, #1 finishers, DEF/K; multiple sentences. */
export function priorSeasonNarrativeBeats(
  profile: PriorSeasonDraftProfile | null | undefined,
  narrativeCtx?: PriorSeasonNarrativeContext
): string[] {
  if (!profile) return [];
  const y = profile.season;

  const teHeavy = teHeavyNarrativeBeat(profile, y);
  if (teHeavy) return [teHeavy];

  const beats: string[] = [];

  const rbWr = rbWrProductionSentence(profile, y);
  if (rbWr) beats.push(rbWr);

  if (profile.top5QbCount >= 2) {
    const qb = qbTop5StackSentence(profile, y);
    if (qb) beats.push(qb);
  } else {
    const lateQb = singleLateTop5QbSentence(profile, y);
    if (lateQb) beats.push(lateQb);
    else if (profile.top5QbCount === 1 && profile.top5QbNames[0]) {
      const qbName = profile.top5QbNames[0];
      if (profile.qbRank1Name) {
        beats.push(
          `${qbName} was the ${y} QB1, and you have him as your top quarterback on this roster.`
        );
      }
    }
  }

  beats.push(...posRank1SkillBeats(profile, y, narrativeCtx));

  const defK = kickerDefTopFiveBeat(profile, y);
  if (defK) beats.push(defK);

  if (beats.length > 0) return beats;

  const fallback = priorSeasonFallbackBeat(profile, y);
  return fallback ? [fallback] : [];
}

/** @deprecated Prefer priorSeasonNarrativeBeats for multi-sentence flow. */
export function priorSeasonNarrativeBeat(
  profile: PriorSeasonDraftProfile | null | undefined,
  narrativeCtx?: PriorSeasonNarrativeContext
): string | null {
  const beats = priorSeasonNarrativeBeats(profile, narrativeCtx);
  if (beats.length === 0) return null;
  return beats.join(' ');
}
