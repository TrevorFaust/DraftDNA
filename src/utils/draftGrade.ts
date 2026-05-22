/**
 * Draft letter grade (A+ … F-).
 *
 * v3: harder curve (C is typical), fixes fake "steals" from missing ADP (999),
 * roster-quality pillar (backups, same-team WRs, elite tiers), richer taglines.
 */

import { analyzeRosterComposition } from '@/utils/draftGradeComposition';
import { analyzePositionalDraftValue } from '@/utils/draftGradePositionalValue';
import {
  analyzePriorSeasonRanks,
  priorSeasonEliteRosterScore,
  priorSeasonGradeAdjustment,
  type PriorSeasonDraftProfile,
} from '@/utils/draftGradePriorSeason';
import {
  analyzeEarlyDraftStructure,
  isFalseEarlySteal,
} from '@/utils/draftGradeEarlySlot';
import {
  analyzeRosterQuality,
  buildInsightTagline,
  type RosterQualityPick,
} from '@/utils/draftGradeRosterQuality';

export type LetterGrade =
  | 'A+'
  | 'A'
  | 'A-'
  | 'B+'
  | 'B'
  | 'B-'
  | 'C+'
  | 'C'
  | 'C-'
  | 'D+'
  | 'D'
  | 'D-'
  | 'F+'
  | 'F'
  | 'F-';

export interface DraftGradePick {
  pick_number: number;
  round_number: number;
  player?: {
    id?: string | null;
    name?: string | null;
    adp?: number | null;
    position?: string | null;
    bye_week?: number | null;
    team?: string | null;
  } | null;
  is_autodraft?: boolean;
}

export interface DraftGradeOptions {
  numTeams: number;
  numRounds?: number;
  isSuperflex?: boolean;
  chaosArchetype?: string | null;
  /** Full player pool for ADP-based team depth (WR1 vs WR2 on same NFL team). */
  playerPool?: { position?: string | null; team?: string | null; adp?: number | null }[];
  /** Prior-season positional finish rank by player id (e.g. 2025 RB9 → 9). */
  priorSeasonRankByPlayerId?: Record<string, number> | Map<string, number>;
  /** Detected archetype badge name for narrative (e.g. "The Ground & Pound"). */
  archetypeName?: string | null;
}

export interface DraftGradeBreakdown {
  avgValueSpots: number;
  stealCount: number;
  realStealCount: number;
  fakeValuePickCount: number;
  reachCount: number;
  severeReachCount: number;
  earlySpecialTeams: number;
  byeClusterPenalty: number;
  autodraftCount: number;
  consensusPickRate: number;
  rb2Round: number | null;
  wr2Round: number | null;
  synergyScore: number;
  synergyModifier: number;
  rosterQualityScore: number;
  eliteTierCount: number;
  backupSkillCount: number;
  valueScore: number;
  processScore: number;
}

export interface DraftGradeResult {
  grade: LetterGrade;
  numericScore: number;
  breakdown: DraftGradeBreakdown;
  tagline: string;
  summary: string;
}

/** Centered ~B (75): solid drafts land B-/B+, As rare, Cs/Ds for real mistakes. */
const GRADE_SCALE: { min: number; grade: LetterGrade }[] = [
  { min: 93, grade: 'A+' },
  { min: 88, grade: 'A' },
  { min: 85, grade: 'A-' },
  { min: 81, grade: 'B+' },
  { min: 75, grade: 'B' },
  { min: 71, grade: 'B-' },
  { min: 67, grade: 'C+' },
  { min: 62, grade: 'C' },
  { min: 58, grade: 'C-' },
  { min: 54, grade: 'D+' },
  { min: 49, grade: 'D' },
  { min: 44, grade: 'D-' },
  { min: 40, grade: 'F+' },
  { min: 35, grade: 'F' },
  { min: 0, grade: 'F-' },
];

interface ParsedPick {
  pick_number: number;
  round_number: number;
  pos: string;
  adp: number;
  rawAdp: number;
  nflTeam: string | null;
  bye_week: number | null;
  name: string | null;
  playerId: string | null;
  is_autodraft?: boolean;
}

function normalizePosition(position?: string | null): string {
  const p = (position || '').toUpperCase().trim();
  if (p === 'D/ST' || p === 'DST') return 'DEF';
  return p;
}

function isSkillPosition(pos: string): boolean {
  return pos === 'QB' || pos === 'RB' || pos === 'WR' || pos === 'TE';
}

function isSpecialTeams(pos: string): boolean {
  return pos === 'K' || pos === 'DEF';
}

function nflTeamTag(team?: string | null): string | null {
  const raw = (team || '').trim();
  if (!raw || raw.toUpperCase() === 'FA') return null;
  return raw;
}

/** ADP missing or out of pool → neutral (no fake +800 "steals"). */
function resolveAdp(raw: number | null | undefined, pickNumber: number, poolSize: number): {
  adp: number;
  rawAdp: number;
  hasMarketAdp: boolean;
} {
  const rawAdp = Number(raw);
  if (!Number.isFinite(rawAdp) || rawAdp <= 0 || rawAdp > poolSize + 12) {
    return { adp: pickNumber, rawAdp: rawAdp > 0 ? rawAdp : 0, hasMarketAdp: false };
  }
  return { adp: rawAdp, rawAdp, hasMarketAdp: true };
}

function scoreToLetter(score: number): LetterGrade {
  const clamped = Math.max(0, Math.min(100, score));
  for (const row of GRADE_SCALE) {
    if (clamped >= row.min) return row.grade;
  }
  return 'F-';
}

function nthPositionRound(picks: ParsedPick[], pos: string, n: number): number | null {
  let count = 0;
  for (const p of picks) {
    if (p.pos !== pos) continue;
    count += 1;
    if (count === n) return p.round_number;
  }
  return null;
}

function firstPositionRound(picks: ParsedPick[], pos: string): number | null {
  return nthPositionRound(picks, pos, 1);
}

function isChaosDraft(chaosArchetype?: string | null): boolean {
  return Boolean(chaosArchetype?.trim());
}

function computeSynergyScore(
  picks: ParsedPick[],
  opts: {
    numTeams: number;
    numRounds: number;
    chaosArchetype?: string | null;
    realStealCount: number;
    reachCount: number;
    avgValueSpots: number;
    consensusPickRate: number;
    rosterPenalty: number;
  }
): { score: number; modifier: number; rb2Round: number | null; wr2Round: number | null } {
  const { numTeams, numRounds, chaosArchetype, realStealCount, reachCount, avgValueSpots, consensusPickRate, rosterPenalty } =
    opts;
  const skillPicks = picks.filter((p) => isSkillPosition(p.pos));
  let score = 70;
  const chaos = isChaosDraft(chaosArchetype);

  const rb1Round = firstPositionRound(picks, 'RB');
  const rb2Round = nthPositionRound(picks, 'RB', 2);
  const wr1Round = firstPositionRound(picks, 'WR');
  const wr2Round = nthPositionRound(picks, 'WR', 2);

  const rb2LateThreshold = Math.max(9, Math.ceil(numRounds * 0.52));
  const wr2LateThreshold = Math.max(10, Math.ceil(numRounds * 0.58));

  if (rb2Round != null && rb2Round > rb2LateThreshold) score -= 11;
  if (wr2Round != null && wr2Round > wr2LateThreshold) score -= 11;
  if (wr1Round != null && wr1Round > 8) score -= 5;
  if (rb1Round != null && rb1Round > 9) score -= 5;

  if (rb1Round != null && rb1Round <= 5 && wr1Round != null && wr1Round <= 6) score += 3;
  if (rb2Round != null && rb2Round <= 8 && wr2Round != null && wr2Round <= 9) score += 4;

  const zeroRb = rb1Round == null || rb1Round >= 6;
  const heroRb = rb1Round != null && rb1Round <= 2 && (rb2Round == null || rb2Round >= 6);
  const wrHeavyEarly = picks.filter((p) => p.pos === 'WR' && p.round_number <= 5).length >= 3;
  if (zeroRb && wrHeavyEarly) score += 3;
  if (heroRb && wr1Round != null && wr1Round <= 5) score += 2;

  const queueOnly =
    skillPicks.length >= 6 &&
    consensusPickRate >= 0.68 &&
    realStealCount <= 1 &&
    reachCount <= 2 &&
    Math.abs(avgValueSpots) < numTeams * 0.3;
  if (queueOnly) score -= 14;

  if (realStealCount >= 2 && (heroRb || zeroRb || wrHeavyEarly)) score += 2;
  if (chaos && realStealCount + reachCount >= 3) score += 1;

  score -= Math.min(15, rosterPenalty);

  score = Math.max(0, Math.min(100, score));
  const modifier = Math.round((score - 70) / 3);
  return { score, modifier, rb2Round, wr2Round };
}

function buildSummary(b: DraftGradeBreakdown, tagline: string): string {
  return `${tagline} Value ${b.avgValueSpots >= 0 ? '+' : ''}${b.avgValueSpots.toFixed(1)} ADP spots/pick (${b.valueScore}). Roster ${b.rosterQualityScore}. Synergy ${b.synergyScore}. Steals ${b.realStealCount}, reaches ${b.reachCount}, elite tiers ${b.eliteTierCount}.`;
}

export function computeDraftGrade(
  picks: DraftGradePick[],
  options: DraftGradeOptions
): DraftGradeResult | null {
  const numTeams = Math.max(options.numTeams, 2);
  const numRounds = options.numRounds ?? 16;
  const poolSize = numTeams * numRounds;
  const withPlayer = picks
    .filter((p) => p.player)
    .sort((a, b) => a.pick_number - b.pick_number);

  if (withPlayer.length === 0) return null;

  const parsed: ParsedPick[] = withPlayer.map((pick) => {
    const { adp, rawAdp } = resolveAdp(pick.player?.adp, pick.pick_number, poolSize);
    return {
      pick_number: pick.pick_number,
      round_number: pick.round_number,
      pos: normalizePosition(pick.player?.position),
      adp,
      rawAdp,
      nflTeam: nflTeamTag(pick.player?.team),
      bye_week: pick.player?.bye_week ?? null,
      name: pick.player?.name?.trim() || null,
      playerId: pick.player?.id?.trim() || null,
      is_autodraft: pick.is_autodraft,
    };
  });

  let priorSeasonProfile: PriorSeasonDraftProfile | null = null;
  if (options.priorSeasonRankByPlayerId) {
    priorSeasonProfile = analyzePriorSeasonRanks(
      parsed.map((p) => ({
        name: p.name,
        pos: p.pos,
        round_number: p.round_number,
        pick_number: p.pick_number,
        playerId: p.playerId,
        adp: p.adp,
      })),
      options.priorSeasonRankByPlayerId,
      numTeams
    );
  }

  let weightedValueSum = 0;
  let weightTotal = 0;
  let stealCount = 0;
  let realStealCount = 0;
  let fakeValuePickCount = 0;
  let reachCount = 0;
  let severeReachCount = 0;
  let negativeValuePickCount = 0;
  let earlySpecialTeams = 0;
  let autodraftCount = 0;
  let consensusSkillPicks = 0;
  let skillPickCount = 0;
  const byeCounts = new Map<number, number>();

  const specialTeamsEarliestRound = Math.max(10, Math.ceil(numTeams * 1.25));
  const stealThreshold = numTeams;
  const reachThreshold = -numTeams;
  const severeReachThreshold = -numTeams * 2;
  const consensusBand = numTeams * 0.35;
  const chaos = isChaosDraft(options.chaosArchetype);
  const stealNames: string[] = [];
  const reachNames: string[] = [];

  const skillStealThreshold = stealThreshold;
  const skillReachThreshold = reachThreshold;
  const earlyKDefRound = Math.max(8, Math.ceil(numTeams * 0.85));
  let earlyKickerName: string | null = null;
  let earlyDefenseName: string | null = null;

  for (const pick of parsed) {
    const rawValue = pick.adp - pick.pick_number;
    const hasMarket = pick.rawAdp > 0 && pick.rawAdp <= poolSize + 12;
    const skill = isSkillPosition(pick.pos);
    const autodraftWeight = pick.is_autodraft ? 0.8 : 1;

    if (skill && hasMarket) {
      weightedValueSum += rawValue * autodraftWeight;
      weightTotal += autodraftWeight;
    }

    if (!hasMarket && skill) {
      fakeValuePickCount += 1;
    }

    const falseEarlySteal = isFalseEarlySteal(
      {
        pick_number: pick.pick_number,
        round_number: pick.round_number,
        pos: pick.pos,
        adp: pick.adp,
        rawAdp: pick.rawAdp,
        name: pick.name,
        nflTeam: pick.nflTeam,
      },
      numTeams,
      poolSize
    );

    if (skill && hasMarket && rawValue >= skillStealThreshold && !falseEarlySteal) {
      stealCount += 1;
      realStealCount += 1;
      if (pick.name) stealNames.push(pick.name);
    } else if (!hasMarket && skill && rawValue >= skillStealThreshold) {
      stealCount += 1;
    }

    if (skill && hasMarket && rawValue < 0) negativeValuePickCount += 1;

    if (skill && hasMarket && rawValue <= skillReachThreshold) {
      reachCount += 1;
      if (pick.name) reachNames.push(pick.name);
    }
    if (skill && hasMarket && rawValue <= severeReachThreshold) severeReachCount += 1;

    if (isSpecialTeams(pick.pos) && pick.round_number < earlyKDefRound && !chaos) {
      earlySpecialTeams += 1;
      if (pick.pos === 'K' && pick.name) earlyKickerName = pick.name;
      if (pick.pos === 'DEF' && pick.name) earlyDefenseName = pick.name;
    }
    if (pick.is_autodraft) autodraftCount += 1;

    if (isSkillPosition(pick.pos)) {
      skillPickCount += 1;
      if (hasMarket && Math.abs(rawValue) <= consensusBand) consensusSkillPicks += 1;
    }

    if (typeof pick.bye_week === 'number' && pick.bye_week > 0) {
      byeCounts.set(pick.bye_week, (byeCounts.get(pick.bye_week) ?? 0) + 1);
    }
  }

  const avgValueSpots = weightTotal > 0 ? weightedValueSum / weightTotal : 0;
  const roundsOfValue = avgValueSpots / numTeams;
  const consensusPickRate = skillPickCount > 0 ? consensusSkillPicks / skillPickCount : 0;

  const valueScore = Math.max(0, Math.min(100, 68 + roundsOfValue * 20));

  let processScore = 68;
  processScore -= earlySpecialTeams * 5;
  processScore -= Math.max(0, severeReachCount) * 4;
  processScore -= Math.max(0, reachCount - 1) * 2;
  processScore += Math.min(realStealCount, 4) * 2;
  processScore -= autodraftCount * 1;
  const maxByeStack = Math.max(0, ...byeCounts.values());
  const byeClusterPenalty = maxByeStack >= 4 ? 6 : maxByeStack >= 3 ? 3 : 0;
  processScore -= byeClusterPenalty;
  processScore = Math.max(0, Math.min(100, processScore));

  const rosterPicks: RosterQualityPick[] = parsed.map((p) => ({
    pick_number: p.pick_number,
    round_number: p.round_number,
    pos: p.pos,
    adp: p.adp,
    rawAdp: p.rawAdp,
    nflTeam: p.nflTeam,
    name: p.name,
  }));
  const poolForDepth =
    options.playerPool?.map((p) => ({
      pos: normalizePosition(p.position),
      adp: Number(p.adp) || 999,
      nflTeam: nflTeamTag(p.team) ?? '',
    })).filter((p) => p.nflTeam) ?? [];

  const rosterQuality = analyzeRosterQuality(
    rosterPicks,
    numTeams,
    numRounds,
    poolForDepth,
    options.isSuperflex
  );

  const synergy = computeSynergyScore(parsed, {
    numTeams,
    numRounds,
    chaosArchetype: options.chaosArchetype,
    realStealCount,
    reachCount,
    avgValueSpots,
    consensusPickRate,
    rosterPenalty: rosterQuality.sameTeamWrPenalty + (rosterQuality.consecutiveTeamWr ? 4 : 0),
  });

  let numericScore = Math.round(
    valueScore * 0.28 +
      processScore * 0.22 +
      synergy.score * 0.28 +
      rosterQuality.score * 0.22
  );

  if (fakeValuePickCount >= 4 && realStealCount >= 3) {
    numericScore -= 5;
  }
  if (rosterQuality.unstartablePickCount >= 6) {
    numericScore -= 4;
  }
  if (rosterQuality.backupSkillCount >= 4) {
    numericScore -= 3;
  }

  if (consensusPickRate >= 0.78 && realStealCount === 0 && rosterQuality.eliteTierCount < 2) {
    numericScore = Math.min(numericScore, 82);
  }

  const positionalValue = analyzePositionalDraftValue(parsed);
  if (positionalValue.penalty > 0) {
    numericScore -= positionalValue.penalty;
  }
  if (positionalValue.maxNumericScore != null) {
    numericScore = Math.min(numericScore, positionalValue.maxNumericScore);
  }

  const earlyStructure = analyzeEarlyDraftStructure(
    parsed.map((p) => ({
      pick_number: p.pick_number,
      round_number: p.round_number,
      pos: p.pos,
      adp: p.adp,
      rawAdp: p.rawAdp,
      name: p.name,
      nflTeam: p.nflTeam,
    })),
    numTeams,
    numRounds,
    poolForDepth
  );
  if (earlyStructure.penalty > 0) {
    numericScore -= earlyStructure.penalty;
  }
  if (earlyStructure.maxNumericScore != null) {
    numericScore = Math.min(numericScore, earlyStructure.maxNumericScore);
  }
  const structureNote =
    earlyStructure.narrativeNote ??
    positionalValue.narrativeNote;

  if (
    !earlyStructure.premiumSlotMiss &&
    rosterQuality.eliteTierCount >= 3 &&
    realStealCount >= 1 &&
    numericScore < 86
  ) {
    numericScore = Math.min(92, numericScore + 5);
  } else if (
    !earlyStructure.premiumSlotMiss &&
    rosterQuality.eliteTierCount >= 4 &&
    numericScore < 88
  ) {
    numericScore = Math.min(94, numericScore + 4);
  }

  if (avgValueSpots < -4) {
    numericScore -= Math.min(14, Math.round(Math.abs(avgValueSpots) * 1.2));
  }
  if (negativeValuePickCount >= 6) {
    numericScore -= 8;
  } else if (negativeValuePickCount >= 4) {
    numericScore -= 4;
  }
  if (reachCount >= 6) {
    numericScore -= 10;
  } else if (reachCount >= 4) {
    numericScore -= 6;
  }
  if (reachCount >= 4 && realStealCount <= 1) {
    numericScore = Math.min(numericScore, 72);
  }
  if (severeReachCount >= 3 || (reachCount >= 5 && avgValueSpots < -6)) {
    numericScore = Math.min(numericScore, 65);
  }

  const priorSeasonAdj = priorSeasonGradeAdjustment(priorSeasonProfile);
  const reachHeavy =
    reachCount >= 4 ||
    avgValueSpots < -6 ||
    negativeValuePickCount >= 5 ||
    earlyStructure.premiumSlotMiss ||
    earlyStructure.earlyTeamWr2Count >= 2;
  if (positionalValue.penalty < 10 && !reachHeavy) {
    numericScore += priorSeasonAdj.bonus;
    numericScore -= priorSeasonAdj.penalty;
  } else if (positionalValue.penalty < 10) {
    numericScore += Math.min(priorSeasonAdj.bonus, 3);
    numericScore -= priorSeasonAdj.penalty;
  }

  if (priorSeasonProfile && !reachHeavy) {
    const elitePrior = priorSeasonEliteRosterScore(priorSeasonProfile);
    if (elitePrior >= 16 && reachCount <= 2) {
      numericScore = Math.min(95, Math.max(numericScore, 90));
    } else if (elitePrior >= 13 && reachCount <= 3) {
      numericScore = Math.min(93, Math.max(numericScore, 86));
    } else if (elitePrior >= 10 && reachCount <= 2) {
      numericScore = Math.min(90, Math.max(numericScore, 82));
    }
  }

  if (realStealCount >= 2 && reachCount <= realStealCount + 1 && numericScore < 80) {
    numericScore = Math.min(84, numericScore + 4);
  }

  numericScore = Math.max(0, Math.min(100, numericScore));
  const grade = scoreToLetter(numericScore);
  const rosterComposition = analyzeRosterComposition(parsed);

  const firstPick = parsed[0];
  const firstRoundFor = (pos: string) =>
    parsed.find((p) => p.pos === pos)?.round_number ?? null;

  const breakdown: DraftGradeBreakdown = {
    avgValueSpots: Math.round(avgValueSpots * 10) / 10,
    stealCount,
    realStealCount,
    fakeValuePickCount: Math.max(fakeValuePickCount, rosterQuality.fakeValuePickCount),
    reachCount,
    severeReachCount,
    earlySpecialTeams,
    byeClusterPenalty,
    autodraftCount,
    consensusPickRate: Math.round(consensusPickRate * 100) / 100,
    rb2Round: synergy.rb2Round,
    wr2Round: synergy.wr2Round,
    synergyScore: Math.round(synergy.score),
    synergyModifier: synergy.modifier,
    rosterQualityScore: Math.round(rosterQuality.score),
    eliteTierCount: rosterQuality.eliteTierCount,
    backupSkillCount: rosterQuality.backupSkillCount,
    valueScore: Math.round(valueScore),
    processScore: Math.round(processScore),
  };

  const tagline = buildInsightTagline(grade, {
    realStealCount,
    reachCount,
    severeReachCount,
    negativeValuePickCount,
    eliteTierCount: rosterQuality.eliteTierCount,
    backupSkillCount: rosterQuality.backupSkillCount,
    unstartablePickCount: rosterQuality.unstartablePickCount,
    fakeValuePickCount: breakdown.fakeValuePickCount,
    sameTeamWrPenalty: rosterQuality.sameTeamWrPenalty,
    consecutiveTeamWr: rosterQuality.consecutiveTeamWr,
    rb2Round: synergy.rb2Round,
    wr2Round: synergy.wr2Round,
    rosterNotes: rosterQuality.notes,
    consensusPickRate,
    avgValueSpots: breakdown.avgValueSpots,
      stealNames,
      reachNames,
      earlyKickerName,
      earlyDefenseName,
      anchorNames: rosterQuality.anchorNames,
      firstRbRound: rosterQuality.firstRbRound,
      qualityWrCount: rosterQuality.qualityWrCount,
      priorSeasonProfile,
      archetypeName: options.archetypeName ?? null,
      rosterComposition,
      firstPickName: firstPick?.name ?? null,
      firstPickPos: firstPick?.pos ?? null,
      firstPickNumber: firstPick?.pick_number ?? null,
      numTeams,
      firstWrRound: firstRoundFor('WR'),
      firstQbRound: firstRoundFor('QB'),
      firstTeRound: firstRoundFor('TE'),
      positionalValueNote: structureNote,
      premiumSlotMiss: earlyStructure.premiumSlotMiss,
      earlyTeamWr2Count: earlyStructure.earlyTeamWr2Count,
      teamSynergyNote: rosterQuality.teamSynergyNote,
    });

  return {
    grade,
    numericScore,
    breakdown,
    tagline,
    summary: buildSummary(breakdown, tagline),
  };
}

export function toDraftGradePicks(
  picks: {
    pick_number: number;
    round_number: number;
    is_autodraft?: boolean;
    player?: DraftGradePick['player'];
  }[]
): DraftGradePick[] {
  return picks.map((pick) => ({
    pick_number: pick.pick_number,
    round_number: pick.round_number,
    is_autodraft: pick.is_autodraft,
    player: pick.player,
  }));
}

export function getDraftGradeStyles(grade: LetterGrade): {
  text: string;
  border: string;
  bg: string;
} {
  if (grade.startsWith('A')) {
    return {
      text: 'text-emerald-400',
      border: 'border-emerald-500/40',
      bg: 'bg-emerald-500/10',
    };
  }
  if (grade.startsWith('B')) {
    return {
      text: 'text-sky-400',
      border: 'border-sky-500/40',
      bg: 'bg-sky-500/10',
    };
  }
  if (grade.startsWith('C')) {
    return {
      text: 'text-amber-400',
      border: 'border-amber-500/40',
      bg: 'bg-amber-500/10',
    };
  }
  if (grade.startsWith('D')) {
    return {
      text: 'text-orange-400',
      border: 'border-orange-500/40',
      bg: 'bg-orange-500/10',
    };
  }
  return {
    text: 'text-red-400',
    border: 'border-red-500/40',
    bg: 'bg-red-500/10',
  };
}
