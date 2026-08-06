/**
 * Draft letter grade (A+ … F-).
 *
 * v5: value = pick − ADP (positive = faller/steal). Keepers are value-neutral
 * (no fake steals). Discount elites (R1–5 talent kept R6–10) reshape strategy
 * scoring and writeups. Curve centered ~B for solid drafts;
 * clean process + elites unlock As; tanks land D/F.
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
import { analyzeKeeperDraftContext } from '@/utils/draftGradeKeepers';
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
  /** League keeper auto-assigned this round — excluded from ADP value/steals/reaches. */
  is_keeper?: boolean;
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

/** Read a grade result saved on mock_drafts.grade_payload (or temp draft storage). */
export function parseStoredDraftGrade(payload: unknown): DraftGradeResult | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Partial<DraftGradeResult>;
  if (typeof p.grade !== 'string' || typeof p.numericScore !== 'number' || !p.breakdown) {
    return null;
  }
  return {
    grade: p.grade as LetterGrade,
    numericScore: p.numericScore,
    breakdown: p.breakdown,
    tagline: typeof p.tagline === 'string' ? p.tagline : '',
    summary: typeof p.summary === 'string' ? p.summary : '',
  };
}

/**
 * Letter-first grading: pick A/B/C/D/F from overall quality, then + / plain / -
 * as slightly better / on par / slightly worse within that letter.
 *
 * Good-faith human drafts mostly land A–C. D is heavy reaches / blind faith.
 * F is structural meltdown (early K/DEF spam, no skill core).
 */
const GRADE_SCALE: { min: number; grade: LetterGrade }[] = [
  // A family (80–100)
  { min: 93, grade: 'A+' },
  { min: 86, grade: 'A' },
  { min: 80, grade: 'A-' },
  // B family (66–79)
  { min: 75, grade: 'B+' },
  { min: 70, grade: 'B' },
  { min: 66, grade: 'B-' },
  // C family (52–65)
  { min: 61, grade: 'C+' },
  { min: 56, grade: 'C' },
  { min: 52, grade: 'C-' },
  // D family (36–51)
  { min: 46, grade: 'D+' },
  { min: 41, grade: 'D' },
  { min: 36, grade: 'D-' },
  // F family (0–35)
  { min: 27, grade: 'F+' },
  { min: 16, grade: 'F' },
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
  is_keeper: boolean;
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

/**
 * Enough skill core that K/DEF is a bench/streaming pick, not a reach past holes.
 * 2RB/2WR required. QB or TE can wait individually; missing both is a flag.
 */
function skillCoreReadyForSpecialTeams(prior: ParsedPick[]): boolean {
  let rb = 0;
  let wr = 0;
  let qb = 0;
  let te = 0;
  for (const p of prior) {
    if (p.pos === 'RB') rb += 1;
    else if (p.pos === 'WR') wr += 1;
    else if (p.pos === 'QB') qb += 1;
    else if (p.pos === 'TE') te += 1;
  }
  return rb >= 2 && wr >= 2 && (qb >= 1 || te >= 1);
}

/**
 * K/DEF is "early" only when it actually costs skill capital.
 * R1–7 always early; R8–9 only without a ready skill core; R10+ never.
 */
function isEarlySpecialTeamsPick(pick: ParsedPick, allPicks: ParsedPick[]): boolean {
  if (!isSpecialTeams(pick.pos)) return false;
  if (pick.round_number <= 7) return true;
  if (pick.round_number >= 10) return false;
  const prior = allPicks.filter((p) => p.pick_number < pick.pick_number);
  return !skillCoreReadyForSpecialTeams(prior);
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

function isReachHeavyBoard(opts: {
  reachCount: number;
  avgValueSpots: number;
  negativeValuePickCount: number;
  premiumSlotMiss: boolean;
  earlyTeamWr2Count: number;
}): boolean {
  // A few projection reaches (Love / Waddle-type bets) are normal — not board-breaking.
  return (
    opts.reachCount >= 6 ||
    opts.avgValueSpots < -10 ||
    opts.negativeValuePickCount >= 7 ||
    (opts.premiumSlotMiss && opts.reachCount >= 3) ||
    opts.earlyTeamWr2Count >= 4
  );
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
    hasEliteWrKeeper?: boolean;
    hasEliteRbKeeper?: boolean;
  }
): { score: number; modifier: number; rb2Round: number | null; wr2Round: number | null } {
  const { numTeams, numRounds, chaosArchetype, realStealCount, reachCount, avgValueSpots, consensusPickRate, rosterPenalty } =
    opts;
  const skillPicks = picks.filter((p) => isSkillPosition(p.pos));
  let score = 74;
  const chaos = isChaosDraft(chaosArchetype);

  // Drafted-only rounds for "when did you pick X"; keepers fill the hole for balance.
  const drafted = picks.filter((p) => !p.is_keeper);
  const rb1Drafted = firstPositionRound(drafted, 'RB');
  const rb2Drafted = nthPositionRound(drafted, 'RB', 2);
  const wr1Drafted = firstPositionRound(drafted, 'WR');
  const wr2Drafted = nthPositionRound(drafted, 'WR', 2);

  const rb1Round = opts.hasEliteRbKeeper ? 1 : rb1Drafted;
  const wr1Round = opts.hasEliteWrKeeper ? 1 : wr1Drafted;
  // Second starter: keeper counts as one, so first drafted at pos is effectively RB2/WR2.
  const rb2Round = opts.hasEliteRbKeeper
    ? rb1Drafted ?? rb2Drafted
    : rb2Drafted;
  const wr2Round = opts.hasEliteWrKeeper
    ? wr1Drafted ?? wr2Drafted
    : wr2Drafted;

  const rb2LateThreshold = Math.max(9, Math.ceil(numRounds * 0.52));
  const wr2LateThreshold = Math.max(10, Math.ceil(numRounds * 0.58));

  if (rb2Round != null && rb2Round > rb2LateThreshold) score -= 6;
  if (wr2Round != null && wr2Round > wr2LateThreshold) score -= 6;
  if (wr1Round != null && wr1Round > 8) score -= 4;
  if (rb1Round != null && rb1Round > 9) score -= 4;

  if (rb1Round != null && rb1Round <= 5 && wr1Round != null && wr1Round <= 6) score += 3;
  if (rb2Round != null && rb2Round <= 8 && wr2Round != null && wr2Round <= 9) score += 4;

  const zeroRb = rb1Round == null || rb1Round >= 6;
  const heroRb = rb1Round != null && rb1Round <= 2 && (rb2Round == null || rb2Round >= 6);
  const earlyDraftedWr = drafted.filter((p) => p.pos === 'WR' && p.round_number <= 5).length;
  const earlyDraftedRb = drafted.filter((p) => p.pos === 'RB' && p.round_number <= 5).length;
  const wrHeavyEarly = earlyDraftedWr >= 3;
  if (zeroRb && wrHeavyEarly) score += 3;
  if (heroRb && wr1Round != null && wr1Round <= 5) score += 2;

  // Known elite WR keeper → RB-heavy early is the plan, not a WR hole.
  if (opts.hasEliteWrKeeper && earlyDraftedRb >= 2 && earlyDraftedWr <= 1) score += 4;
  if (opts.hasEliteRbKeeper && earlyDraftedWr >= 2 && earlyDraftedRb <= 1) score += 4;

  // Pure chalk is fine — slight ding only when almost every skill pick is dead-on ADP
  // with no steals. (Ultra-consensus still hard-caps the final score later.)
  const queueOnly =
    skillPicks.length >= 6 &&
    consensusPickRate >= 0.82 &&
    realStealCount === 0 &&
    reachCount <= 1 &&
    Math.abs(avgValueSpots) < numTeams * 0.2;
  if (queueOnly) score -= 4;

  if (realStealCount >= 2 && (heroRb || zeroRb || wrHeavyEarly)) score += 2;
  if (chaos && realStealCount + reachCount >= 3) score += 1;

  // Same-team WR notes shouldn't erase an otherwise logical draft.
  score -= Math.min(8, rosterPenalty);

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
    const is_keeper = Boolean(pick.is_keeper);
    const { adp, rawAdp } = resolveAdp(pick.player?.adp, pick.pick_number, poolSize);
    return {
      pick_number: pick.pick_number,
      round_number: pick.round_number,
      pos: normalizePosition(pick.player?.position),
      // Keepers keep real ADP for roster/depth context, but value math skips them.
      adp,
      rawAdp,
      nflTeam: nflTeamTag(pick.player?.team),
      bye_week: pick.player?.bye_week ?? null,
      name: pick.player?.name?.trim() || null,
      playerId: pick.player?.id?.trim() || null,
      is_autodraft: pick.is_autodraft,
      is_keeper,
    };
  });

  const keeperCtx = analyzeKeeperDraftContext(parsed, numTeams);

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
        is_keeper: p.is_keeper,
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
  // Mild falls count — humans notice ~¾-round value, not only full-round steals.
  const stealThreshold = Math.max(6, Math.ceil(numTeams * 0.75));
  const reachThreshold = -numTeams;
  const severeReachThreshold = -numTeams * 2;
  const consensusBand = numTeams * 0.35;
  const chaos = isChaosDraft(options.chaosArchetype);
  const stealNames: string[] = [];
  const reachNames: string[] = [];

  const skillStealThreshold = stealThreshold;
  const skillReachThreshold = reachThreshold;
  let earlyKickerName: string | null = null;
  let earlyDefenseName: string | null = null;
  for (const pick of parsed) {
    if (pick.is_keeper) {
      // Keepers: roster context only. No ADP value, steals, reaches, or autodraft ding.
      if (typeof pick.bye_week === 'number' && pick.bye_week > 0) {
        byeCounts.set(pick.bye_week, (byeCounts.get(pick.bye_week) ?? 0) + 1);
      }
      continue;
    }

    // Positive = player fell (ADP earlier than pick). Negative = reached.
    const rawValue = pick.pick_number - pick.adp;
    const hasMarket = pick.rawAdp > 0 && pick.rawAdp <= poolSize + 12;
    const skill = isSkillPosition(pick.pos);
    const autodraftWeight = pick.is_autodraft ? 0.8 : 1;
    // Late bench darts barely move the grade — starters/mid rounds matter most.
    const roundWeight =
      pick.round_number >= 10 ? 0.12 : pick.round_number >= 8 ? 0.4 : 1;

    if (skill && hasMarket) {
      const w = autodraftWeight * roundWeight;
      weightedValueSum += rawValue * w;
      weightTotal += w;
    }

    if (!hasMarket && skill && pick.round_number <= 9) {
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

    // Steals still count late (nice finds), but reaches in R10+ are bench noise.
    if (skill && hasMarket && rawValue >= skillStealThreshold && !falseEarlySteal) {
      stealCount += 1;
      realStealCount += 1;
      if (pick.name) stealNames.push(pick.name);
    } else if (!hasMarket && skill && rawValue >= skillStealThreshold) {
      stealCount += 1;
    }

    if (skill && hasMarket && rawValue < 0 && pick.round_number <= 7) {
      negativeValuePickCount += 1;
    }

    // Reaches matter through the middle of the draft. R8+ bench darts barely count.
    if (
      skill &&
      hasMarket &&
      rawValue <= skillReachThreshold &&
      pick.round_number <= 7
    ) {
      reachCount += 1;
      if (pick.name) reachNames.push(pick.name);
    }
    if (
      skill &&
      hasMarket &&
      rawValue <= severeReachThreshold &&
      pick.round_number <= 7
    ) {
      severeReachCount += 1;
    }

    if (!chaos && isEarlySpecialTeamsPick(pick, parsed)) {
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

  const valueScore = Math.max(0, Math.min(100, 74 + roundsOfValue * 22));

  let processScore = 72;
  processScore -= earlySpecialTeams * 5;
  processScore -= Math.max(0, severeReachCount) * 4;
  processScore -= Math.max(0, reachCount - 1) * 2;
  processScore += Math.min(realStealCount, 4) * 2;
  processScore -= autodraftCount * 1;
  const maxByeStack = Math.max(0, ...byeCounts.values());
  const byeClusterPenalty = maxByeStack >= 5 ? 5 : maxByeStack >= 4 ? 3 : maxByeStack >= 3 ? 2 : 0;
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
    is_keeper: p.is_keeper,
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
    hasEliteWrKeeper: keeperCtx.hasEliteWrKeeper,
    hasEliteRbKeeper: keeperCtx.hasEliteRbKeeper,
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

  const draftedElite = rosterQuality.draftedEliteTierCount;
  // Pure chalk without elites costs a little — does not hard-block A-band.
  if (consensusPickRate >= 0.78 && realStealCount === 0 && draftedElite < 2) {
    numericScore -= 3;
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
    // Clean chalk boards (no reaches, real anchors) shouldn't lose a full letter
    // to WR-depth / late-QB heuristics alone.
    const chalkSoftened =
      reachCount === 0 &&
      realStealCount <= 1 &&
      draftedElite >= 2 &&
      avgValueSpots >= -2;
    const earlyPen = chalkSoftened
      ? Math.ceil(earlyStructure.penalty * 0.35)
      : earlyStructure.penalty;
    numericScore -= earlyPen;
  }
  if (earlyStructure.maxNumericScore != null) {
    const chalkSoftened =
      reachCount === 0 &&
      realStealCount <= 1 &&
      draftedElite >= 2 &&
      avgValueSpots >= -2;
    const cap = chalkSoftened
      ? Math.max(earlyStructure.maxNumericScore, 86)
      : earlyStructure.maxNumericScore;
    numericScore = Math.min(numericScore, cap);
  }
  const structureNote =
    earlyStructure.narrativeNote ??
    positionalValue.narrativeNote;

  if (
    !earlyStructure.premiumSlotMiss &&
    draftedElite >= 3 &&
    realStealCount >= 2 &&
    avgValueSpots >= 4
  ) {
    numericScore = Math.min(96, Math.max(numericScore + 6, 90));
  } else if (
    !earlyStructure.premiumSlotMiss &&
    draftedElite >= 3 &&
    realStealCount >= 1 &&
    numericScore < 86
  ) {
    numericScore = Math.min(92, numericScore + 5);
  } else if (
    !earlyStructure.premiumSlotMiss &&
    draftedElite >= 4 &&
    numericScore < 88
  ) {
    numericScore = Math.min(94, numericScore + 4);
  }

  const boardReachHeavy = isReachHeavyBoard({
    reachCount,
    avgValueSpots,
    negativeValuePickCount,
    premiumSlotMiss: earlyStructure.premiumSlotMiss,
    earlyTeamWr2Count: earlyStructure.earlyTeamWr2Count,
  });

  const cleanProcess =
    earlySpecialTeams === 0 &&
    !earlyStructure.premiumSlotMiss &&
    !boardReachHeavy &&
    reachCount <= 1;

  // Human-good boards enter a letter family; natural score keeps + / plain / - room.
  if (
    cleanProcess &&
    draftedElite >= 2 &&
    avgValueSpots >= 2 &&
    reachCount === 0 &&
    (realStealCount >= 1 || avgValueSpots >= 3)
  ) {
    // Strong A board — A+ only if value is already elite.
    numericScore = Math.max(numericScore, 90);
    if (realStealCount >= 2 && avgValueSpots >= 3) {
      numericScore = Math.max(numericScore, 93);
    }
  } else if (
    cleanProcess &&
    draftedElite >= 2 &&
    avgValueSpots >= 1 &&
    reachCount <= 1
  ) {
    numericScore = Math.max(numericScore, 86); // A
  } else if (
    cleanProcess &&
    draftedElite >= 2 &&
    avgValueSpots >= -0.5 &&
    reachCount <= 2
  ) {
    numericScore = Math.max(numericScore, 80); // A-
  } else if (
    cleanProcess &&
    draftedElite >= 2 &&
    avgValueSpots >= -1.5 &&
    reachCount <= 1 &&
    numericScore >= 66 &&
    numericScore < 80
  ) {
    numericScore = Math.max(numericScore, 75); // B+
  } else if (
    cleanProcess &&
    draftedElite >= 1 &&
    avgValueSpots >= -3 &&
    reachCount <= 2 &&
    earlySpecialTeams === 0 &&
    numericScore >= 56 &&
    numericScore < 70
  ) {
    // Solid chalk with one real anchor — B family, not C.
    numericScore = Math.max(numericScore, 68); // B- / B
  } else if (
    !earlyStructure.premiumSlotMiss &&
    !boardReachHeavy &&
    realStealCount >= 2 &&
    draftedElite >= 2 &&
    avgValueSpots >= 5 &&
    reachCount <= 1
  ) {
    numericScore = Math.max(numericScore, 90);
    if (avgValueSpots >= 6) numericScore = Math.max(numericScore, 93);
  }

  if (avgValueSpots < -4) {
    numericScore -= Math.min(10, Math.round(Math.abs(avgValueSpots) * 0.9));
  }
  if (negativeValuePickCount >= 6) {
    numericScore -= 6;
  } else if (negativeValuePickCount >= 4) {
    numericScore -= 3;
  }
  if (reachCount >= 6) {
    numericScore -= 8;
  } else if (reachCount >= 4) {
    numericScore -= 5;
  }
  // Reach-heavy boards lose points above; no hard ceiling so elite value can still recover.
  if (reachCount >= 4 && realStealCount <= 1) {
    numericScore -= 4;
  }
  if (severeReachCount >= 3 || (reachCount >= 5 && avgValueSpots < -6)) {
    numericScore -= 6;
  }

  const priorSeasonAdj = priorSeasonGradeAdjustment(priorSeasonProfile);
  const reachHeavy = boardReachHeavy;
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
      numericScore = Math.max(numericScore, 90);
    } else if (elitePrior >= 13 && reachCount <= 3) {
      numericScore = Math.max(numericScore, 86);
    } else if (elitePrior >= 10 && reachCount <= 2) {
      numericScore = Math.max(numericScore, 80);
    }
  }

  if (realStealCount >= 2 && reachCount <= realStealCount + 1 && numericScore < 80) {
    numericScore = Math.min(84, numericScore + 4);
  }

  // After late penalties, solid chalk stays in B family.
  if (
    earlySpecialTeams === 0 &&
    !earlyStructure.premiumSlotMiss &&
    !boardReachHeavy &&
    draftedElite >= 1 &&
    avgValueSpots >= -3 &&
    reachCount <= 3 &&
    numericScore >= 56 &&
    numericScore < 70
  ) {
    numericScore = Math.max(numericScore, 68);
  }

  // Trying-their-best: filled starters → A–C (early K/DEF alone is a cost, not an auto-F).
  // F when early K/DEF pairs with a thin/bad skill draft. D for extreme pet-player boards.
  const rbCount = parsed.filter((p) => p.pos === 'RB').length;
  const wrCount = parsed.filter((p) => p.pos === 'WR').length;
  const qbCount = parsed.filter((p) => p.pos === 'QB').length;
  const teCount = parsed.filter((p) => p.pos === 'TE').length;
  const skillEarly = parsed.filter(
    (p) => (p.pos === 'RB' || p.pos === 'WR') && p.round_number <= 6
  ).length;
  // Real lineup shape: 2RB/2WR/1QB is enough; flex TE is fine. Early K/DEF allowed.
  const filledStarters =
    rbCount >= 2 &&
    wrCount >= 2 &&
    qbCount >= 1 &&
    (teCount >= 1 || wrCount + rbCount >= 5);
  const notStructuralMeltdown =
    positionalValue.maxNumericScore == null || positionalValue.maxNumericScore >= 84;
  // Ordinary mocks with a few projection reaches stay in C. D needs a real pet-player board.
  const blindFaithReaches =
    severeReachCount >= 3 ||
    (reachCount >= 7 && avgValueSpots < -9) ||
    (reachCount >= 8 && avgValueSpots < -8);
  // Early K/DEF + weak skill core / rotten board → F. Early K/DEF + real starters → just a ding.
  const earlySpecialMeltdown =
    earlySpecialTeams >= 1 &&
    (skillEarly <= 1 ||
      rbCount < 2 ||
      wrCount < 2 ||
      qbCount < 1 ||
      (earlySpecialTeams >= 2 && skillEarly <= 2) ||
      (skillEarly <= 2 && reachCount >= 5 && avgValueSpots < -8));

  if (earlySpecialMeltdown) {
    // Spread F+/F/F- — one early K with zero early skill is F, not always F-.
    if (earlySpecialTeams >= 3 || (earlySpecialTeams >= 2 && skillEarly === 0)) {
      numericScore = 8; // F-
    } else if (skillEarly === 0) {
      numericScore = 20; // F
    } else if (skillEarly === 1 || earlySpecialTeams >= 2) {
      numericScore = 18; // F
    } else {
      numericScore = 30; // F+
    }
  } else if (filledStarters && notStructuralMeltdown && blindFaithReaches) {
    // D family spread: D+ / D / D- by how far past ADP — still a real roster.
    const reachSeverity =
      (reachCount >= 10 ? 2 : reachCount >= 8 ? 1 : 0) +
      (severeReachCount >= 5 ? 2 : severeReachCount >= 3 ? 1 : 0) +
      (avgValueSpots < -14 ? 2 : avgValueSpots < -10 ? 1 : 0);
    if (reachSeverity >= 3) numericScore = 36; // D-
    else if (reachSeverity >= 1) numericScore = 43; // D
    else numericScore = 48; // D+
  } else if (filledStarters && notStructuralMeltdown) {
    // One early K/DEF with a real roster: paid a price (process/positional), not a meltdown.
    // Soft ceiling — hard to be A-band when you burned early capital on ST.
    if (earlySpecialTeams >= 1 && skillEarly >= 3) {
      numericScore = Math.min(numericScore, 78); // B ceiling
    }
    // Solid starter core + only light early/mid reaches → at least B-.
    // Late bench darts already ignored in reachCount, so this won't punish dart throws.
    if (
      earlySpecialTeams === 0 &&
      positionalValue.penalty <= 8 &&
      draftedElite >= 2 &&
      reachCount <= 2 &&
      severeReachCount <= 1 &&
      avgValueSpots >= -4
    ) {
      numericScore = Math.max(numericScore, 72); // B-
    } else if (
      positionalValue.penalty <= 10 &&
      reachCount <= 4 &&
      severeReachCount <= 2 &&
      avgValueSpots >= -6
    ) {
      numericScore = Math.max(numericScore, earlySpecialTeams >= 1 ? 56 : 61); // C / C+
    } else if (
      positionalValue.penalty <= 14 &&
      reachCount <= 6 &&
      avgValueSpots >= -10
    ) {
      numericScore = Math.max(numericScore, 56); // C
    } else {
      numericScore = Math.max(numericScore, 52); // C-
    }
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
      keeperRosterNote: keeperCtx.rosterNote,
      keeperStrategyNote: keeperCtx.strategyNote,
      hasEliteWrKeeper: keeperCtx.hasEliteWrKeeper,
      hasEliteRbKeeper: keeperCtx.hasEliteRbKeeper,
      keeperPrimaryDiscount: keeperCtx.primaryDiscount,
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
    is_keeper?: boolean;
    player?: DraftGradePick['player'];
  }[]
): DraftGradePick[] {
  return picks.map((pick) => ({
    pick_number: pick.pick_number,
    round_number: pick.round_number,
    is_autodraft: pick.is_autodraft,
    is_keeper: pick.is_keeper,
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
