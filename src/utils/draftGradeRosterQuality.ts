/**
 * Roster construction & NFL-team context heuristics for draft grading.
 * Tagline assembly: @see draftGradeNarrativeStyle.ts
 */

import {
  analyzeTeamDepthFromAdp,
  getDepthRole,
  isHealthySameTeamStack,
  isShallowSameTeamStack,
  type PlayerAdpOnTeam,
  type TeamDepthAnalysis,
} from '@/utils/teamDepthFromAdp';
import {
  archetypeImpliesTeFocus,
  archetypeIntegratedSentences,
} from '@/utils/draftGradeArchetypeNarrative';
import {
  rosterShapeNarrativeBeat,
  type RosterComposition,
} from '@/utils/draftGradeComposition';
import {
  priorSeasonEliteRosterScore,
  priorBeatMergedIntoCombined,
  priorSeasonNarrativeBeats,
  tryCombinedCaveatAndEliteBeat,
  type PriorSeasonDraftProfile,
  type PriorSeasonNarrativeContext,
} from '@/utils/draftGradePriorSeason';
import {
  balancedGradeVerdict,
  formatPlayerNames,
  gradeArticle,
  isHighlightPriorBeat,
  shouldFoldHighlightsIntoVerdict,
  verdictPositiveClause,
} from '@/utils/draftGradeReportVerdict';
import { placeKeeperNoteInSegments } from '@/utils/draftGradeKeepers';

export interface RosterQualityPick {
  pick_number: number;
  round_number: number;
  pos: string;
  adp: number;
  rawAdp: number;
  nflTeam: string | null;
  name?: string | null;
  is_keeper?: boolean;
}

function ordinalAtPosition(pick: RosterQualityPick, picks: RosterQualityPick[]): number {
  const same = picks
    .filter((p) => p.pos === pick.pos)
    .sort((a, b) => a.pick_number - b.pick_number);
  const idx = same.findIndex((p) => p.pick_number === pick.pick_number);
  return idx >= 0 ? idx + 1 : 1;
}

/** Late picks (R10+) rarely hurt grade unless they're early starters at the position. */
function countsAsBackupPenalty(
  pick: RosterQualityPick,
  picks: RosterQualityPick[],
  role: ReturnType<typeof getDepthRole>
): boolean {
  if (!role || !['depth', 'dart', 'competing'].includes(role)) return false;
  if (!['WR', 'RB'].includes(pick.pos)) return false;
  const ord = ordinalAtPosition(pick, picks);
  if (pick.round_number >= 10 && ord > 2) return false;
  if (pick.round_number >= 10 && ord <= 2) return false;
  if (ord <= 2) return false;
  return pick.round_number <= 9;
}

/** Round-1 worthy overall ADP (top RB/WR tier). */
function round1SkillAdpCap(numTeams: number): number {
  return Math.max(36, numTeams * 3);
}

/** True elite at position for bonus (not generic top-5 caps). */
function isRound1Anchor(p: RosterQualityPick, numTeams: number): boolean {
  if (p.round_number > 1) return false;
  if (p.pos === 'RB' || p.pos === 'WR') return p.adp <= round1SkillAdpCap(numTeams);
  return false;
}

/** Early-round stud RB/WR that still counts as an elite tier piece. */
function isEarlyEliteSkill(p: RosterQualityPick, numTeams: number): boolean {
  if (p.pos !== 'RB' && p.pos !== 'WR') return false;
  if (p.round_number === 1) return false; // counted by isRound1Anchor
  if (p.round_number > 3) return false;
  return p.adp <= numTeams * 2.5;
}

function isEliteQbTiming(p: RosterQualityPick, numTeams: number): boolean {
  if (p.pos !== 'QB') return false;
  const roundCap = Math.ceil(numTeams * 2.2);
  return p.round_number <= 3 && p.adp <= roundCap * numTeams * 0.9;
}

/** Non-superflex: QB taken ahead of market (reach), not a round-2 value QB. */
function isEarlyQbReach(
  p: RosterQualityPick,
  numTeams: number,
  isSuperflex?: boolean
): boolean {
  if (p.pos !== 'QB' || isSuperflex) return false;
  const valueSpots = p.pick_number - p.adp;
  if (p.round_number === 1 && p.adp > numTeams * 2.2) return true;
  if (p.round_number <= 2 && valueSpots < -numTeams * 0.85) return true;
  return false;
}

export interface RosterQualityResult {
  score: number;
  /** Elites on roster including keepers (narrative). */
  eliteTierCount: number;
  /** Elites from non-keeper draft picks only (scoring floors/boosts). */
  draftedEliteTierCount: number;
  backupSkillCount: number;
  sameTeamWrPenalty: number;
  consecutiveTeamWr: boolean;
  unstartablePickCount: number;
  fakeValuePickCount: number;
  notes: string[];
  anchorNames: string[];
  firstRbRound: number | null;
  qualityWrCount: number;
  teamSynergyNote: string | null;
}

function buildDepthContext(
  userPicks: RosterQualityPick[],
  playerPool?: PlayerAdpOnTeam[]
): TeamDepthAnalysis {
  const teams = new Set(
    userPicks.map((p) => p.nflTeam).filter((t): t is string => !!t)
  );
  const forAnalysis: PlayerAdpOnTeam[] = [];

  if (playerPool && playerPool.length > 0) {
    for (const p of playerPool) {
      if (p.nflTeam && teams.has(p.nflTeam) && ['WR', 'RB', 'TE'].includes(p.pos)) {
        forAnalysis.push(p);
      }
    }
  }
  for (const p of userPicks) {
    if (p.nflTeam && ['WR', 'RB', 'TE'].includes(p.pos)) {
      forAnalysis.push({ pos: p.pos, adp: p.adp, nflTeam: p.nflTeam });
    }
  }
  return analyzeTeamDepthFromAdp(forAnalysis);
}

export function analyzeRosterQuality(
  picks: RosterQualityPick[],
  numTeams: number,
  numRounds: number,
  playerPool?: PlayerAdpOnTeam[],
  isSuperflex?: boolean
): RosterQualityResult {
  const poolSize = numTeams * numRounds;
  const notes: string[] = [];
  let score = 72;
  let eliteTierCount = 0;
  let draftedEliteTierCount = 0;
  let backupSkillCount = 0;
  let sameTeamWrPenalty = 0;
  let consecutiveTeamWr = false;
  let unstartablePickCount = 0;
  let fakeValuePickCount = 0;
  let teamSynergyNote: string | null = null;

  const depthCtx = buildDepthContext(picks, playerPool);
  const anchorNames: string[] = [];
  let firstRbRound: number | null = null;
  let qualityWrCount = 0;

  const round1Picks = picks.filter((p) => p.round_number === 1);
  const hasRound1RbWr = round1Picks.some((p) => isRound1Anchor(p, numTeams));
  if (!hasRound1RbWr && round1Picks.some((p) => ['RB', 'WR'].includes(p.pos))) {
    score -= 4;
    notes.push('round 1 lacked a true RB/WR anchor');
  } else if (hasRound1RbWr) {
    score += 4;
  }

  for (const p of picks) {
    const invalidAdp = p.rawAdp <= 0 || p.rawAdp > poolSize + numTeams;
    // Missing ADP is a data gap, not "you drafted an unstartable" — only flag early picks.
    if (invalidAdp && ['QB', 'RB', 'WR', 'TE'].includes(p.pos) && p.round_number <= 8) {
      fakeValuePickCount += 1;
      unstartablePickCount += 1;
    }

    if (isRound1Anchor(p, numTeams)) {
      eliteTierCount += 1;
      if (!p.is_keeper) draftedEliteTierCount += 1;
      if (p.name) anchorNames.push(p.name);
    } else if (isEarlyEliteSkill(p, numTeams)) {
      eliteTierCount += 1;
      if (!p.is_keeper) draftedEliteTierCount += 1;
      if (p.name) anchorNames.push(p.name);
    } else if (
      p.is_keeper &&
      (p.pos === 'RB' || p.pos === 'WR') &&
      p.adp <= numTeams * 2.5
    ) {
      // Late-round keepers can be studs on the roster, but never draftedElite.
      eliteTierCount += 1;
      if (p.name) anchorNames.push(p.name);
    }
    if (isEliteQbTiming(p, numTeams)) {
      eliteTierCount += 1;
      if (!p.is_keeper) draftedEliteTierCount += 1;
      if (p.name && !anchorNames.includes(p.name)) anchorNames.push(p.name);
    }
    if (p.pos === 'RB' && firstRbRound == null) firstRbRound = p.round_number;
    if (p.pos === 'WR') {
      const wrRole = getDepthRole(depthCtx, p.nflTeam, 'WR', p.adp);
      if (
        wrRole === 'alpha' ||
        wrRole === 'starter' ||
        (p.round_number <= 9 && p.adp <= numTeams * 3.5)
      ) {
        qualityWrCount += 1;
      }
    }
    if (isEarlyQbReach(p, numTeams, isSuperflex)) {
      score -= 5;
      notes.push('QB reached ahead of where they usually go');
    }

    const role = getDepthRole(depthCtx, p.nflTeam, p.pos, p.adp);
    const isValuableRb2 =
      p.pos === 'RB' &&
      p.round_number >= 5 &&
      p.round_number <= 12 &&
      role != null &&
      ['alpha', 'starter', 'competing'].includes(role);
    if (countsAsBackupPenalty(p, picks, role) && !isValuableRb2) {
      backupSkillCount += 1;
      score -= 2;
    }

    if (p.pos === 'QB' && p.adp > numTeams * 10 && p.round_number <= 8) {
      backupSkillCount += 1;
      score -= 2;
    }

    // Late dart throws (R11+) with bad ADP are normal bench filler — don't treat as disasters.
    if (
      ['RB', 'WR', 'TE'].includes(p.pos) &&
      p.adp > poolSize * 0.92 &&
      p.round_number <= 10
    ) {
      unstartablePickCount += 1;
      score -= 2;
    }
  }

  const byTeamRb = new Map<string, RosterQualityPick[]>();
  for (const p of picks.filter((x) => x.pos === 'RB' && x.nflTeam)) {
    const list = byTeamRb.get(p.nflTeam!) ?? [];
    list.push(p);
    byTeamRb.set(p.nflTeam!, list);
  }

  for (const [, rbs] of byTeamRb) {
    if (rbs.length !== 2) continue;
    const sorted = [...rbs].sort((a, b) => a.adp - b.adp);
    const roles = sorted.map((p) => getDepthRole(depthCtx, p.nflTeam!, 'RB', p.adp));
    const starter = sorted[0].name;
    const backup = sorted[1].name;
    const isHandcuff =
      roles[0] === 'alpha' &&
      roles[1] != null &&
      ['depth', 'dart', 'competing'].includes(roles[1]);
    if (isHandcuff && starter && backup) {
      teamSynergyNote = `Pairing ${starter} with ${backup} as a handcuff is sensible insurance at running back.`;
      score += 1;
    }
  }

  const byTeamWr = new Map<string, RosterQualityPick[]>();
  for (const p of picks.filter((x) => x.pos === 'WR' && x.nflTeam)) {
    const list = byTeamWr.get(p.nflTeam!) ?? [];
    list.push(p);
    byTeamWr.set(p.nflTeam!, list);
  }

  const eliteWr2AdpCap = numTeams * 6;

  for (const [team, wrs] of byTeamWr) {
    const earlyUserWrs = wrs.filter((w) => w.round_number <= 10);
    if (earlyUserWrs.length < 2) continue;
    const sorted = [...earlyUserWrs].sort((a, b) => a.adp - b.adp);
    const roles = sorted.map((p) => getDepthRole(depthCtx, team, 'WR', p.adp));
    const hasAlpha = roles.includes('alpha');
    const competing = sorted.filter((p, i) => roles[i] === 'competing');
    // WR2 ("competing") is fine in 12/14-team leagues. WR3+ is the problem.
    const wr3PlusCount = roles.filter((r) => r === 'depth' || r === 'dart').length;

    const eliteCompetingEarly = competing.filter(
      (p) => p.round_number <= 6 && p.adp <= eliteWr2AdpCap
    );

    if (
      hasAlpha &&
      eliteCompetingEarly.length === 1 &&
      wr3PlusCount === 0 &&
      !teamSynergyNote
    ) {
      const wr2 = eliteCompetingEarly[0].name;
      if (wr2) {
        teamSynergyNote = `Stacking ${wr2} with your ${team} WR1 is a bit volatile, but the talent is strong enough that it can work when you pay a fair price.`;
      }
      // Slight note only — WR1+WR2 stacks are common, not a real penalty.
      continue;
    }

    if (wr3PlusCount >= 2 && !isHealthySameTeamStack(sorted, depthCtx)) {
      sameTeamWrPenalty += 6;
      score -= 6;
      const names = sorted
        .map((p) => p.name)
        .filter((n): n is string => !!n);
      if (names.length >= 2) {
        notes.push(
          `stacked ${formatPlayerNames(names, 2)} from ${team} early while clearer WR1s were still on the board`
        );
      } else {
        notes.push(
          `stacked multiple ${team} WRs early while better primary targets were still available`
        );
      }
    } else if (isHealthySameTeamStack(sorted, depthCtx)) {
      score += 1;
    }
  }

  for (let i = 1; i < picks.length; i++) {
    const a = picks[i - 1];
    const b = picks[i];
    if (a.round_number > 10 || b.round_number > 10) continue;
    if (isShallowSameTeamStack(a, b, depthCtx)) {
      consecutiveTeamWr = true;
      score -= 4;
      notes.push('back-to-back depth pieces from same offense');
      break;
    }
  }

  const rbsByPick = picks
    .filter((p) => p.pos === 'RB')
    .sort((a, b) => a.pick_number - b.pick_number);
  if (rbsByPick.length >= 2) {
    const rb2 = rbsByPick[1];
    const rb2Role = getDepthRole(depthCtx, rb2.nflTeam, 'RB', rb2.adp);
    if (
      rb2.round_number >= 4 &&
      rb2.round_number <= 12 &&
      ['alpha', 'starter', 'competing'].includes(rb2Role)
    ) {
      score += 4;
      notes.push('found a startable RB2 in the mid rounds');
    }
  } else if (rbsByPick.length === 1 && picks.length >= 10) {
    const only = rbsByPick[0];
    if (only.round_number <= 6) {
      score -= 3;
      notes.push('thin at RB — never locked in a second back');
    }
  }

  // Score bonus only for elites you drafted — keepers don't buy a roster-quality letter bump.
  if (draftedEliteTierCount >= 3) {
    score += 7;
    notes.push('elite anchors at multiple spots');
  } else if (draftedEliteTierCount >= 2) {
    score += 3;
  } else if (eliteTierCount >= 2 && draftedEliteTierCount === 0) {
    notes.push('elite talent came mostly from keepers, not the draft');
  }

  if (backupSkillCount >= 4) {
    score -= 5;
    notes.push('too many backup-role skill players');
  }

  if (unstartablePickCount >= 6) {
    score -= 6;
  } else if (unstartablePickCount >= 4) {
    score -= 3;
  }

  if (fakeValuePickCount >= 5) {
    score -= 5;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    eliteTierCount,
    draftedEliteTierCount,
    backupSkillCount,
    sameTeamWrPenalty,
    consecutiveTeamWr,
    unstartablePickCount,
    fakeValuePickCount,
    notes,
    anchorNames: [...new Set(anchorNames)],
    firstRbRound,
    qualityWrCount,
    teamSynergyNote,
  };
}

interface TaglineContext {
  realStealCount: number;
  reachCount: number;
  severeReachCount: number;
  negativeValuePickCount?: number;
  eliteTierCount: number;
  backupSkillCount: number;
  unstartablePickCount: number;
  fakeValuePickCount: number;
  sameTeamWrPenalty: number;
  consecutiveTeamWr: boolean;
  rb2Round: number | null;
  wr2Round: number | null;
  rosterNotes: string[];
  consensusPickRate: number;
  avgValueSpots: number;
  stealNames: string[];
  reachNames: string[];
  earlyKickerName: string | null;
  earlyDefenseName: string | null;
  anchorNames: string[];
  firstRbRound: number | null;
  qualityWrCount: number;
  priorSeasonProfile?: PriorSeasonDraftProfile | null;
  archetypeName?: string | null;
  rosterComposition?: RosterComposition | null;
  positionalValueNote?: string | null;
  firstPickName?: string | null;
  firstPickPos?: string | null;
  firstPickNumber?: number | null;
  numTeams?: number;
  firstWrRound?: number | null;
  firstQbRound?: number | null;
  firstTeRound?: number | null;
  premiumSlotMiss?: boolean;
  earlyTeamWr2Count?: number;
  teamSynergyNote?: string | null;
  keeperRosterNote?: string | null;
  keeperStrategyNote?: string | null;
  hasEliteWrKeeper?: boolean;
  hasEliteRbKeeper?: boolean;
  keeperPrimaryDiscount?: {
    name: string;
    pos: string;
    round: number;
    marketRound: number;
    discountPhrase: string;
  } | null;
}

function polishTagline(text: string): string {
  return text
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

type NarrativeTone = 'celebrate' | 'steady' | 'caution';

function narrativeTone(grade: string): NarrativeTone {
  if (grade.startsWith('A')) return 'celebrate';
  if (grade.startsWith('B')) return 'steady';
  return 'caution';
}

function joinNarrative(sentences: string[]): string {
  return polishTagline(sentences.filter(Boolean).join(' '));
}

function anchorLabel(ctx: TaglineContext): string {
  if (ctx.anchorNames.length >= 2) {
    return formatPlayerNames(ctx.anchorNames.slice(0, 2));
  }
  if (ctx.anchorNames.length === 1) return ctx.anchorNames[0];
  return '';
}

function capitalizeLead(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function joinFactors(factors: string[]): string {
  if (factors.length === 0) return '';
  if (factors.length === 1) return factors[0];
  if (factors.length === 2) return `${factors[0]} and ${factors[1]}`;
  return `${factors[0]}, ${factors[1]}, and the rest`;
}

function anchorOpener(ctx: TaglineContext, tone: NarrativeTone): string | null {
  const label = anchorLabel(ctx);
  if (label) {
    if (ctx.anchorNames.length >= 2) {
      if (tone === 'celebrate') {
        return `You built your core around ${label}, and the rest of the draft played off that strength.`;
      }
      if (tone === 'steady') {
        return `You built your core around ${label}, then shaped the rest of the roster around them.`;
      }
      return `You built your core around ${label}, then had to patch the holes that plan left behind.`;
    }
    if (tone === 'celebrate') {
      return `You built your core around ${label} and ran the draft from that anchor forward.`;
    }
    return `You built your core around ${label} and filled in the roster from there.`;
  }
  if (ctx.eliteTierCount >= 2) {
    return 'You built your core around multiple early studs at RB, WR, or QB.';
  }
  return null;
}

function teamSynergyBeat(ctx: TaglineContext): string | null {
  if (ctx.teamSynergyNote?.trim()) {
    return ctx.teamSynergyNote.trim().charAt(0).toUpperCase() + ctx.teamSynergyNote.trim().slice(1);
  }

  const note = ctx.rosterNotes.find((n) => n.startsWith('stacked '));
  if (!note) return null;
  const match = note.match(/^stacked (.+) from ([A-Z]{2,4}) early while/i);
  if (match) {
    return `You paid up for ${match[1]} from ${match[2]} while clearer WR1s were still available, which is a tough same-team bet at that price.`;
  }
  return 'You stacked multiple receivers from the same offense early while better primary targets were still on the board.';
}

function balanceThread(ctx: TaglineContext): string | null {
  // Elite keepers already fill that position — don't ding the complementary early run.
  if (ctx.keeperStrategyNote?.trim()) {
    return ctx.keeperStrategyNote.trim();
  }
  if (
    ctx.firstRbRound != null &&
    ctx.firstRbRound >= 6 &&
    ctx.qualityWrCount >= 3 &&
    !ctx.hasEliteRbKeeper
  ) {
    return `From there you loaded up at wideout and waited until round ${ctx.firstRbRound} for your first RB, leaning on ${ctx.qualityWrCount} strong receivers to cover the gap.`;
  }
  if (ctx.firstRbRound != null && ctx.firstRbRound >= 6 && !ctx.hasEliteRbKeeper) {
    return `The build got thin when your first RB did not arrive until round ${ctx.firstRbRound}, so you need that backfield to hit.`;
  }
  if (ctx.rb2Round != null && ctx.rb2Round >= 10 && !ctx.hasEliteRbKeeper) {
    return 'Running back depth stayed thin until late, so your early core has to carry the load.';
  }
  if (
    ctx.wr2Round != null &&
    ctx.wr2Round >= 11 &&
    ctx.qualityWrCount < 3 &&
    !ctx.hasEliteWrKeeper
  ) {
    return 'Receiver depth tapers off after your top options, so expect some uneven weeks there.';
  }
  const rbNote = ctx.rosterNotes.find((n) => n.includes('RB2') || n.includes('thin at RB'));
  if (rbNote?.includes('found a startable RB2')) {
    return 'You found a startable RB2 in the middle rounds, which steadied the backfield.';
  }
  if (rbNote?.includes('thin at RB')) {
    return 'You never added a second RB you can trust weekly, and that keeps the backfield fragile.';
  }
  if (ctx.backupSkillCount >= 3) {
    return 'A few mid-round picks look more like bench pieces than weekly starters.';
  }
  if (ctx.consecutiveTeamWr) {
    return 'Back-to-back picks from the same offense without a clear starter role added risk you did not need.';
  }
  return null;
}

/** Middle beat when balanceThread has nothing specific to say. */
function middleBeat(ctx: TaglineContext): string | null {
  const structure = structureNoteFromCtx(ctx);
  if (structure) {
    return structure.charAt(0).toUpperCase() + structure.slice(1);
  }

  const balance = balanceThread(ctx);
  if (balance) return balance;

  const shape = rosterShapeNarrativeBeat(ctx.rosterComposition, {
    skipTeShape: archetypeImpliesTeFocus(ctx.archetypeName),
  });
  if (shape) return shape;

  const comp = ctx.rosterComposition;
  if (
    comp &&
    ctx.qualityWrCount >= 4 &&
    comp.wrCount > comp.rbCount &&
    comp.wrCount >= 6
  ) {
    return `You filled out the WR room with ${comp.wrCount} wideouts around that core.`;
  }
  if (ctx.consensusPickRate >= 0.72) {
    return 'The middle rounds mostly tracked the consensus board without many reaches.';
  }
  return null;
}

function valueBeat(ctx: TaglineContext): string | null {
  // Only early/mid reaches drag the story — late bench darts are mostly noise.
  const reachHeavy =
    ctx.reachCount >= 5 ||
    (ctx.negativeValuePickCount ?? 0) >= 6 ||
    ctx.avgValueSpots < -8;

  if (reachHeavy) {
    const who =
      ctx.reachNames.length > 0
        ? formatPlayerNames(ctx.reachNames.slice(0, 2))
        : 'several early and middle-round picks';
    return ctx.reachNames.length > 0
      ? `Reaches on ${who} in the early and middle rounds cost you value while stronger options were still there.`
      : `You reached past ADP a few times in the early and middle rounds and left stronger players on the board.`;
  }

  if (ctx.reachCount >= 3 || ctx.severeReachCount >= 2) {
    const who =
      ctx.reachNames.length > 0
        ? formatPlayerNames(ctx.reachNames.slice(0, 2))
        : 'a few middle-round picks';
    return `Reaches on ${who} cost a little value before the roster was finished.`;
  }
  if (ctx.reachCount === 2 && ctx.reachNames.length > 0) {
    return `Reaches on ${formatPlayerNames(ctx.reachNames.slice(0, 2))} were small leaks more than draft-breakers.`;
  }
  if (ctx.reachCount === 1 && ctx.reachNames.length > 0) {
    return `${ctx.reachNames[0]} was a bit of a reach, but the rest of the draft stayed closer to the board.`;
  }
  const stealNames = ctx.stealNames.filter(
    (name) =>
      !(
        ctx.premiumSlotMiss &&
        ctx.firstPickName &&
        name.trim().toLowerCase() === ctx.firstPickName.trim().toLowerCase()
      )
  );

  if (ctx.realStealCount >= 2 && stealNames.length > 0) {
    return `You also got ${formatPlayerNames(stealNames.slice(0, 2))} later than they usually go.`;
  }
  if (stealNames.length === 1) {
    return `Getting ${stealNames[0]} where you did was a win without paying full draft capital.`;
  }
  return null;
}

function verdictCtxFromTagline(ctx: TaglineContext) {
  return {
    priorSeasonProfile: ctx.priorSeasonProfile,
    stealNames: ctx.stealNames,
    premiumSlotMiss: ctx.premiumSlotMiss,
    firstPickName: ctx.firstPickName,
  };
}

function negativeGradeFactors(ctx: TaglineContext): string[] {
  const factors: string[] = [];
  if (ctx.premiumSlotMiss) {
    factors.push('passing on the true top tier with your first pick');
  }
  if ((ctx.earlyTeamWr2Count ?? 0) >= 2) {
    factors.push(
      'drafting NFL WR3s too early while clearer WR2s were still available'
    );
  }
  if (ctx.reachCount >= 2) {
    factors.push(
      ctx.reachNames.length > 0
        ? `reaches on ${formatPlayerNames(ctx.reachNames.slice(0, 2))}`
        : 'multiple reaches'
    );
  }
  if (ctx.backupSkillCount >= 4) factors.push('too many backup-level picks');
  if (ctx.sameTeamWrPenalty > 0) {
    factors.push(
      'paying up for multiple receivers from the same offense while clearer WR1s were still available'
    );
  }
  if (
    ctx.firstRbRound != null &&
    ctx.firstRbRound >= 7 &&
    ctx.qualityWrCount < 3 &&
    !ctx.hasEliteRbKeeper
  ) {
    factors.push(`waiting until round ${ctx.firstRbRound} for your first RB`);
  }
  const comp = ctx.rosterComposition;
  if (
    comp &&
    ctx.qualityWrCount >= 5 &&
    comp.wrCount >= comp.rbCount + 2 &&
    ctx.firstRbRound != null &&
    ctx.firstRbRound >= 5 &&
    !ctx.hasEliteRbKeeper
  ) {
    factors.push('loading up on WRs while RB lagged');
  }
  if (ctx.unstartablePickCount >= 5) factors.push('picks that rarely crack your lineup');
  if (ctx.earlyKickerName) factors.push(`taking ${ctx.earlyKickerName} too early`);
  if (ctx.earlyDefenseName) factors.push(`taking ${ctx.earlyDefenseName} too early`);
  return factors;
}

function gradeVerdict(grade: string, ctx: TaglineContext): string {
  const value = valueBeat(ctx);
  let negatives = negativeGradeFactors(ctx);
  if (value && ctx.reachCount >= 2) {
    negatives = negatives.filter((f) => !f.toLowerCase().includes('reach'));
  }

  const elitePrior =
    ctx.priorSeasonProfile != null &&
    priorSeasonEliteRosterScore(ctx.priorSeasonProfile) >= 13;

  const isWeak = grade.startsWith('C') || grade.startsWith('D') || grade.startsWith('F');
  const isStrong = grade.startsWith('A');

  const positives = verdictPositiveClause(verdictCtxFromTagline(ctx));

  if (isWeak && negatives.length > 0) {
    if (elitePrior && ctx.reachCount <= 2 && !shouldFoldHighlightsIntoVerdict(grade, positives, negatives)) {
      const joined = joinFactors(negatives);
      return `A couple of leaks — ${joined} — but the ${ctx.priorSeasonProfile!.season} star power still makes this ${gradeArticle(grade)} ${grade} draft.`;
    }
    if (shouldFoldHighlightsIntoVerdict(grade, positives, negatives)) {
      return balancedGradeVerdict(grade, positives, negatives);
    }
    return balancedGradeVerdict(grade, null, negatives);
  }

  if (isWeak && elitePrior) {
    return `The ${ctx.priorSeasonProfile!.season} talent on this roster lifts an otherwise uneven draft to a ${grade}.`;
  }

  if (isWeak) {
    return `Overall, this lands as ${gradeArticle(grade)} ${grade} draft.`;
  }

  if (isStrong) {
    return `That combination adds up to ${gradeArticle(grade)} ${grade} draft.`;
  }

  if (grade.startsWith('B') || grade.startsWith('A')) {
    const ps = ctx.priorSeasonProfile;
    if (ps && priorSeasonEliteRosterScore(ps) >= 14 && ctx.reachCount <= 2) {
      return `Put together, the ${ps.season} star power and how you built around it lead to a strong ${grade} draft.`;
    }
  }

  if (grade.startsWith('B')) {
    const ps = ctx.priorSeasonProfile;
    const thinPrior =
      !ps ||
      priorSeasonEliteRosterScore(ps) < 8 ||
      (ps.top10RbWrCount <= 1 && ps.top5RbWrCount === 0);
    if (
      ctx.premiumSlotMiss ||
      (thinPrior && (ctx.reachCount >= 2 || ctx.avgValueSpots < -3))
    ) {
      return `One or two bright spots do not outweigh the reaches and missed value — this settles at a ${grade} draft.`;
    }
    if (
      ps &&
      (ps.top5RbWrCount >= 2 || ps.top10RbWrCount >= 4) &&
      negatives.length === 0
    ) {
      if (grade === 'B+' || grade === 'A-' || grade.startsWith('A')) {
        return `Put together, that ${ps.season} RB and WR production leads to a strong ${grade} draft.`;
      }
      return `Put together, that ${ps.season} RB and WR production leads to a solid ${grade} draft.`;
    }
    if (ps && ps.teTop5EarlyCount >= 3) {
      return `Put together, this lands at a ${grade} after spending too many early picks on tight end.`;
    }
    if (negatives.length > 0) {
      if (shouldFoldHighlightsIntoVerdict(grade, positives, negatives)) {
        return balancedGradeVerdict(grade, positives, negatives);
      }
      return `The strong core and the ${joinFactors(negatives)} balance out to a ${grade} draft.`;
    }
    if (ctx.firstPickPos === 'TE' && ctx.firstTeRound === 1) {
      return `Starting at tight end and chasing the rest of the board leaves this at a ${grade} draft.`;
    }
    return `Put together, that combination leads to a solid ${grade} draft.`;
  }

  if (
    (grade.startsWith('C') || grade.startsWith('D') || grade.startsWith('F')) &&
    ctx.firstPickPos === 'TE' &&
    ctx.firstTeRound === 1
  ) {
    return `Leading with tight end and reaching past ADP on several picks makes this a ${grade} draft.`;
  }

  return `Overall, this settles at a ${grade} draft.`;
}

const TOPIC_KEYWORDS: Record<string, string[]> = {
  te: ['tight end', 'te ', ' te', 'premium-te', 'premium te'],
  rb: ['running back', 'backfield', ' rb'],
  wr: ['wideout', 'wide receiver', ' wr'],
  archetype: ['badge', 'archetype', 'earned the'],
  prior: ['top-five', 'top-ten', 'top five', 'top ten', '2025', '2024'],
  value: ['reach', 'slid', 'draft capital', 'later than', 'value on', 'getting '],
};

function sentenceTopics(text: string): Set<string> {
  const lower = text.toLowerCase();
  const topics = new Set<string>();
  for (const [topic, keys] of Object.entries(TOPIC_KEYWORDS)) {
    if (keys.some((k) => lower.includes(k))) topics.add(topic);
  }
  return topics;
}

function segmentOverlaps(existing: string[], next: string): boolean {
  const probe = next.slice(0, 28).toLowerCase();
  if (existing.some((s) => s.toLowerCase().includes(probe) || probe.includes(s.slice(0, 20).toLowerCase()))) {
    return true;
  }
  const nextTopics = sentenceTopics(next);
  if (nextTopics.size === 0) return false;
  for (const seg of existing) {
    const shared = [...sentenceTopics(seg)].filter((t) => nextTopics.has(t));
    if (shared.includes('te') && nextTopics.has('te')) return true;
    if (shared.includes('archetype') && nextTopics.has('archetype')) return true;
  }
  return false;
}

function archetypeLeadFromCtx(ctx: TaglineContext): string[] {
  return archetypeIntegratedSentences({
    archetypeName: ctx.archetypeName,
    anchorNames: ctx.anchorNames,
    firstPickName: ctx.firstPickName ?? null,
    firstPickPos: ctx.firstPickPos ?? null,
    firstRbRound: ctx.firstRbRound,
    firstWrRound: ctx.firstWrRound ?? null,
    firstQbRound: ctx.firstQbRound ?? null,
    firstTeRound: ctx.firstTeRound ?? null,
  });
}

function structureNoteFromCtx(ctx: TaglineContext): string | null {
  if (ctx.positionalValueNote?.trim()) return ctx.positionalValueNote.trim();
  return null;
}

function buildNarrative(grade: string, ctx: TaglineContext, body: (string | null)[]): string {
  let segments = body.filter((p): p is string => Boolean(p));
  // Weave keeper talk into WR/RB/core beats, or slot mid-writeup — not always first.
  segments = placeKeeperNoteInSegments(segments, {
    rosterNote: ctx.keeperRosterNote ?? null,
    strategyNote: ctx.keeperStrategyNote ?? null,
    primaryDiscount: ctx.keeperPrimaryDiscount ?? null,
  });
  const isWeakGrade =
    grade.startsWith('C') || grade.startsWith('D') || grade.startsWith('F');
  const foldHighlights = shouldFoldHighlightsIntoVerdict(
    grade,
    verdictPositiveClause(verdictCtxFromTagline(ctx)),
    negativeGradeFactors(ctx)
  );

  const priorCtx: PriorSeasonNarrativeContext = {
    firstPickNumber: ctx.firstPickNumber ?? null,
    firstPickName: ctx.firstPickName ?? null,
    numTeams: ctx.numTeams ?? 12,
  };

  const profile = ctx.priorSeasonProfile;
  if (profile) {
    const benchIdx = segments.findIndex((s) =>
      s.toLowerCase().includes('bench pieces')
    );
    if (benchIdx >= 0) {
      const combined = tryCombinedCaveatAndEliteBeat(profile, segments[benchIdx]);
      if (combined) {
        segments.splice(benchIdx, 1, combined);
      }
    }
  }

  let priorBeats = priorSeasonNarrativeBeats(profile, priorCtx);
  if (profile && segments.some((s) => s.toLowerCase().startsWith('while a few mid-round'))) {
    priorBeats = priorBeats.filter((b) => !priorBeatMergedIntoCombined(b, profile));
  }
  if (foldHighlights && profile) {
    priorBeats = priorBeats.filter((b) => !isHighlightPriorBeat(b, profile));
  }

  for (const prior of priorBeats) {
    if (!segmentOverlaps(segments, prior)) {
      segments.push(prior);
    }
  }

  const value = valueBeat(ctx);
  const valueIsStealHighlight =
    value != null &&
    (value.includes('later than they usually go') ||
      value.includes('without paying full draft capital'));
  if (value && !foldHighlights && !(isWeakGrade && valueIsStealHighlight) && !segmentOverlaps(segments, value)) {
    segments.push(value);
  }

  const synergy = teamSynergyBeat(ctx);
  if (synergy && !segmentOverlaps(segments, synergy)) {
    segments.push(synergy);
  }

  segments.push(gradeVerdict(grade, ctx));
  return joinNarrative(segments);
}

/** One flowing paragraph: core, roster thread, value beat, grade verdict. */
function composeDraftNarrative(grade: string, ctx: TaglineContext): string {
  const tone = narrativeTone(grade);

  if (ctx.earlyKickerName) {
    return buildNarrative(grade, ctx, [
      `Taking ${ctx.earlyKickerName} that early for a kicker left skill spots open you never fully closed.`,
      balanceThread(ctx) ?? middleBeat(ctx),
    ]);
  }
  if (ctx.earlyDefenseName) {
    return buildNarrative(grade, ctx, [
      `You grabbed ${ctx.earlyDefenseName} early and spent the rest of the draft catching up at RB, WR, and TE.`,
      balanceThread(ctx) ?? middleBeat(ctx),
    ]);
  }

  const synergyBeat = teamSynergyBeat(ctx);
  if (synergyBeat && ctx.reachCount >= 3) {
    return buildNarrative(grade, ctx, [synergyBeat]);
  }

  const archetypeSents = archetypeLeadFromCtx(ctx);

  if (archetypeSents.length > 0 && synergyBeat) {
    return buildNarrative(grade, ctx, [...archetypeSents, synergyBeat, balanceThread(ctx)]);
  }

  if (archetypeSents.length > 0) {
    return buildNarrative(grade, ctx, [...archetypeSents, middleBeat(ctx)]);
  }

  const opener = anchorOpener(ctx, tone);

  if (opener && synergyBeat) {
    return buildNarrative(grade, ctx, [opener, synergyBeat, balanceThread(ctx)]);
  }

  if (opener) {
    return buildNarrative(grade, ctx, [opener, middleBeat(ctx)]);
  }

  if (synergyBeat) {
    return buildNarrative(grade, ctx, [synergyBeat, balanceThread(ctx)]);
  }

  const balance = balanceThread(ctx);
  if (balance) {
    return buildNarrative(grade, ctx, [
      tone === 'celebrate'
        ? 'The roster has a clear shape even without a single named anchor at the top.'
        : 'The roster took shape in the middle rounds more than at the top.',
      balance,
    ]);
  }

  if (ctx.reachCount >= 3 || ctx.severeReachCount >= 2) {
    const who =
      ctx.reachNames.length > 0
        ? formatPlayerNames(ctx.reachNames.slice(0, 2))
        : 'several players';
    return buildNarrative(grade, ctx, [
      `You reached on ${who} and a few others before the board could give you value.`,
    ]);
  }

  return buildNarrative(grade, ctx, [middleBeat(ctx)]);
}

export function buildInsightTagline(grade: string, ctx: TaglineContext): string {
  return composeDraftNarrative(grade, ctx);
}
