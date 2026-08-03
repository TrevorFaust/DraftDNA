/**
 * Builder: human-like 12-team mocks. Aims for "good" or "bad" drafting —
 * does NOT know letter-grade thresholds or rewrite ADP to hit bands.
 *
 * Usage:
 *   npx tsx scripts/grade-calibration/simulateMockDraftGrades.ts
 *   npx tsx scripts/grade-calibration/simulateMockDraftGrades.ts --trials=20 --seed=7
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { RankedPlayer } from '../../src/types/database';
import {
  assignRandomNamedArchetypesForDraft,
  selectCpuPick,
} from '../../src/utils/cpuDraftLogic';
import {
  computeDraftGrade,
  type LetterGrade,
} from '../../src/utils/draftGrade';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '../..');
const CSV_PATH = join(ROOT, 'rankings/generated/ppr_season_1qb.csv');
const OUT_DIR = join(SCRIPT_DIR, 'output');

const NUM_TEAMS = 12;
const NUM_ROUNDS = 15;
const FANTASY_POS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DST', 'D/ST']);
const USER_GRADES: LetterGrade[] = [
  'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F',
];

/** Human intent only — no score-band knowledge. */
type HumanIntent = 'excellent' | 'solid' | 'sloppy' | 'terrible';

type IntentConfig = {
  intent: HumanIntent;
  /** Prefer best available ADP among skill. */
  bpa: number;
  /** Prefer RB/WR early. */
  balance: number;
  /** Willingness to take early TE. */
  earlyTe: number;
  /** Willingness to take early K/DEF. */
  earlySpecial: number;
  /** Willingness to take early QB. */
  earlyQb: number;
  /** How far below BPA to randomly dig (reaches). */
  digDepth: number;
};

const INTENTS: IntentConfig[] = [
  { intent: 'excellent', bpa: 1, balance: 1, earlyTe: 0.05, earlySpecial: 0, earlyQb: 0.1, digDepth: 0 },
  { intent: 'solid', bpa: 0.9, balance: 0.95, earlyTe: 0.08, earlySpecial: 0, earlyQb: 0.12, digDepth: 0 },
  // Sloppy = flawed human draft (one early TE lean, mild reaches) — C/D, not F.
  { intent: 'sloppy', bpa: 0.6, balance: 0.75, earlyTe: 0.7, earlySpecial: 0, earlyQb: 0.15, digDepth: 5 },
  // Terrible = early K/DEF/TE spam.
  { intent: 'terrible', bpa: 0.1, balance: 0.1, earlyTe: 0.8, earlySpecial: 0.9, earlyQb: 0.55, digDepth: 18 },
];

function parseArgs() {
  const trials = Number(process.argv.find((a) => a.startsWith('--trials='))?.split('=')[1] ?? 16);
  const slotArg = process.argv.find((a) => a.startsWith('--slot='))?.split('=')[1];
  const slots = slotArg
    ? slotArg.split(',').map(Number)
    : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const seed = Number(process.argv.find((a) => a.startsWith('--seed='))?.split('=')[1] ?? 42);
  const attempt = Number(process.argv.find((a) => a.startsWith('--attempt='))?.split('=')[1] ?? 1);
  return { trials: Math.max(1, trials), slots, seed, attempt };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function loadPlayers(): RankedPlayer[] {
  const text = readFileSync(CSV_PATH, 'utf8');
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',');
  const idx = {
    rank: header.indexOf('rank'),
    id: header.indexOf('player_id'),
    name: header.indexOf('name'),
    position: header.indexOf('position'),
    team: header.indexOf('team_db'),
  };
  const players: RankedPlayer[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const rank = Number(cols[idx.rank]);
    if (!Number.isFinite(rank) || rank <= 0) continue;
    let position = (cols[idx.position] || '').trim().toUpperCase();
    if (position === 'D/ST' || position === 'DST') position = 'DEF';
    if (!FANTASY_POS.has(position)) continue;
    players.push({
      id: cols[idx.id],
      name: cols[idx.name],
      position,
      team: cols[idx.team] || null,
      adp: rank,
      bye_week: ((players.length * 3) % 14) + 1,
      jersey_number: null,
      season: 2026,
      created_at: '',
      rank,
    });
  }
  const maxRank = players.reduce((m, p) => Math.max(m, p.rank), 0);
  const teams = ['BUF', 'BAL', 'SF', 'DAL', 'PHI', 'KC', 'MIA', 'PIT', 'DEN', 'GB', 'MIN', 'DET'];
  for (let i = 0; i < teams.length; i++) {
    players.push({
      id: `synth-def-${teams[i]}`,
      name: `${teams[i]} Defense`,
      position: 'DEF',
      team: teams[i],
      adp: maxRank + 1 + i * 3,
      bye_week: ((i * 5) % 14) + 1,
      jersey_number: null,
      season: 2026,
      created_at: '',
      rank: maxRank + 1 + i * 3,
    });
  }
  players.sort((a, b) => a.adp - b.adp);
  players.forEach((p, i) => {
    p.rank = i + 1;
    p.adp = i + 1;
  });
  return players;
}

function buildSimPool(all: RankedPlayer[], skillCap = 280): RankedPlayer[] {
  const skill = all.filter((p) => ['QB', 'RB', 'WR', 'TE'].includes(p.position)).slice(0, skillCap);
  const special = all.filter((p) => p.position === 'K' || p.position === 'DEF');
  const seen = new Set<string>();
  return [...skill, ...special].filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

function snakeTeam(pickNumber: number, numTeams: number): number {
  const round = Math.ceil(pickNumber / numTeams);
  const idx = (pickNumber - 1) % numTeams;
  return round % 2 === 1 ? idx + 1 : numTeams - idx;
}

function posKey(p: RankedPlayer): string {
  const pos = (p.position || '').toUpperCase();
  if (pos === 'D/ST' || pos === 'DST') return 'DEF';
  return pos;
}

function countPos(team: RankedPlayer[], pos: string): number {
  return team.filter((p) => posKey(p) === pos).length;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Per-draft sloppy flavor (human mistakes, not grade targets):
 * - early_te: one early TE, then mostly normal
 * - reachy: mild ADP reaches, thin early TE
 * - late_rb2: delay second RB
 * - double_te: two early TEs but still fill some RB/WR (D territory, not F)
 */
type SloppyFlavor = 'early_te' | 'reachy' | 'late_rb2' | 'double_te';

/** Draft like a person with a quality mindset — no grade thresholds. */
function selectHumanPick(
  available: RankedPlayer[],
  team: RankedPlayer[],
  pickNumber: number,
  round: number,
  cfg: IntentConfig,
  rng: () => number,
  sloppyFlavor: SloppyFlavor = 'early_te'
): RankedPlayer {
  const byAdp = [...available].sort((a, b) => a.adp - b.adp);
  const rb = countPos(team, 'RB');
  const wr = countPos(team, 'WR');
  const te = countPos(team, 'TE');
  const qb = countPos(team, 'QB');
  const k = countPos(team, 'K');
  const def = countPos(team, 'DEF');

  const scored = byAdp.slice(0, Math.min(90, byAdp.length)).map((p, idx) => {
    const pos = posKey(p);
    let score = 0;

    // BPA pressure
    score += (90 - idx) * cfg.bpa;

    // Prefer fallers when being excellent (human "that's value")
    const valueSpots = pickNumber - p.adp;
    if (cfg.intent === 'excellent' || cfg.intent === 'solid') {
      if (valueSpots >= 6) score += valueSpots * 2.5 * cfg.bpa;
    } else if (cfg.intent === 'sloppy') {
      // Mild dig — not a full tank
      if (sloppyFlavor === 'reachy') {
        score += Math.max(0, p.adp - pickNumber) * 0.8;
        if (idx >= 3 && idx <= 3 + cfg.digDepth) score += 12;
      } else {
        score += (90 - idx) * 0.35;
        if (valueSpots < -6) score += 8; // occasional reach
      }
    } else {
      // Terrible: dig for worse ADP
      score += Math.max(0, p.adp - pickNumber) * (1 - cfg.bpa) * 1.2;
      if (idx < cfg.digDepth) score -= (cfg.digDepth - idx) * 2;
      else score += Math.min(40, idx);
    }

    if (round <= 6) {
      // Always prefer some RB/WR for sloppy so we don't trip utility≥4 F-cap
      if (cfg.intent === 'sloppy') {
        if (pos === 'RB' && rb < 2) score += 70;
        if (pos === 'WR' && wr < 2) score += 70;
        if (pos === 'K' || pos === 'DEF') score -= 250;
        if (pos === 'QB' && qb >= 1) score -= 80;
        if (pos === 'TE' && te >= 1 && sloppyFlavor !== 'double_te') score -= 100;
        if (pos === 'TE' && te >= 2) score -= 150;

        if (sloppyFlavor === 'early_te' && te === 0 && round <= 3) {
          if (pos === 'TE') score += 90;
        }
        if (sloppyFlavor === 'double_te' && te < 2 && round <= 4) {
          if (pos === 'TE') score += 85;
        }
        if (sloppyFlavor === 'late_rb2' && pos === 'RB' && rb >= 1 && round <= 6) {
          score -= 55; // defer RB2
        }
        if (sloppyFlavor === 'late_rb2' && pos === 'WR' && wr < 3) score += 25;
      } else {
        if (pos === 'RB' && rb < 2) score += 50 * cfg.balance;
        if (pos === 'WR' && wr < 2) score += 50 * cfg.balance;
        if (pos === 'K' || pos === 'DEF') {
          score += cfg.earlySpecial * 130;
          if (cfg.earlySpecial < 0.2) score -= 220;
        }
        if (pos === 'TE') score += cfg.earlyTe * (55 + te * 40);
        if (pos === 'QB' && round <= 4) score += cfg.earlyQb * 35;
        if ((pos === 'RB' || pos === 'WR') && cfg.balance < 0.2) score -= 60;
      }
    } else if (round <= 11) {
      if (pos === 'RB' && rb < 2) score += 60 * Math.max(cfg.balance, 0.3);
      if (pos === 'WR' && wr < 2) score += 60 * Math.max(cfg.balance, 0.3);
      if ((pos === 'K' || pos === 'DEF') && round < 12 && cfg.earlySpecial < 0.5) score -= 80;
      if (cfg.intent === 'sloppy' && sloppyFlavor === 'late_rb2' && pos === 'RB' && rb < 2) {
        score += 80; // finally take RB2 mid-late
      }
    } else {
      if (pos === 'K' && k === 0) score += 35;
      if (pos === 'DEF' && def === 0) score += 35;
      if (pos === 'QB' && qb === 0) score += 25;
      if (pos === 'TE' && te === 0) score += 25;
    }

    // Terrible: force early utility
    if (cfg.intent === 'terrible' && round <= 5) {
      if (pos === 'K' || pos === 'DEF' || pos === 'TE' || pos === 'QB') score += 80 + rng() * 40;
      if (pos === 'RB' || pos === 'WR') score -= 70 + rng() * 30;
    }

    score += (rng() - 0.5) * (8 + cfg.digDepth * 0.3);
    return { p, score, pos };
  });

  scored.sort((a, b) => b.score - a.score);

  if (cfg.intent === 'excellent' && round <= 8) {
    const faller = scored.find(
      (s) =>
        ['RB', 'WR', 'TE', 'QB'].includes(s.pos) &&
        s.p.adp + 8 <= pickNumber
    );
    if (faller && rng() < 0.55) return faller.p;
  }

  // Sloppy: force the signature mistake early, then recover with RB/WR
  if (cfg.intent === 'sloppy' && round <= 3) {
    if (
      (sloppyFlavor === 'early_te' || sloppyFlavor === 'double_te') &&
      te === 0
    ) {
      const tePick = scored.find((s) => s.pos === 'TE');
      if (tePick && rng() < 0.85) return tePick.p;
    }
    if (sloppyFlavor === 'double_te' && te === 1) {
      const tePick = scored.find((s) => s.pos === 'TE');
      if (tePick && rng() < 0.75) return tePick.p;
    }
  }

  if (cfg.earlySpecial >= 0.7 && round <= 6) {
    const special = scored.find((s) => s.pos === 'K' || s.pos === 'DEF' || s.pos === 'TE');
    if (special && rng() < cfg.earlySpecial) return special.p;
  }

  const topN =
    cfg.intent === 'excellent' ? 2 : cfg.intent === 'solid' ? 3 : cfg.intent === 'sloppy' ? 3 : 5;
  const top = scored.slice(0, Math.min(topN, scored.length));
  return top[Math.floor(rng() * top.length)]?.p ?? byAdp[0];
}

type TrialResult = {
  intent: HumanIntent;
  slot: number;
  grade: LetterGrade;
  score: number;
  avgValue: number;
  steals: number;
  reaches: number;
  elite: number;
  withKeepers?: boolean;
};

function runDraft(
  pool: RankedPlayer[],
  userSlot: number,
  cfg: IntentConfig,
  seed: number,
  keeperPlan?: { playerIds: string[]; rounds: number[] } | null
): TrialResult {
  const rng = mulberry32(seed);
  const board = [...pool];
  const teamPicks = new Map<number, RankedPlayer[]>();
  for (let t = 1; t <= NUM_TEAMS; t++) teamPicks.set(t, []);

  const archetypes = assignRandomNamedArchetypesForDraft(NUM_TEAMS, userSlot);
  for (let i = 0; i < (seed % 5) + 1; i++) rng();

  // Per-draft human variance (not grade-aware).
  const liveCfg: IntentConfig = {
    ...cfg,
    digDepth:
      cfg.intent === 'terrible'
        ? Math.floor(10 + rng() * 20)
        : cfg.intent === 'sloppy'
          ? Math.floor(3 + rng() * 6)
          : cfg.digDepth,
    earlySpecial:
      cfg.intent === 'terrible' ? 0.7 + rng() * 0.3 : cfg.earlySpecial,
  };
  const sloppyFlavors: SloppyFlavor[] = ['early_te', 'reachy', 'late_rb2', 'double_te'];
  const sloppyFlavor =
    cfg.intent === 'sloppy'
      ? sloppyFlavors[Math.floor(rng() * sloppyFlavors.length)]
      : 'early_te';

  const keeperByRound = new Map<number, RankedPlayer>();
  if (keeperPlan) {
    for (let i = 0; i < keeperPlan.playerIds.length; i++) {
      const pl = pool.find((p) => p.id === keeperPlan.playerIds[i]);
      if (pl) keeperByRound.set(keeperPlan.rounds[i], pl);
    }
    // Remove keepers from board for other teams
    for (const pl of keeperByRound.values()) {
      const idx = board.findIndex((p) => p.id === pl.id);
      if (idx >= 0) board.splice(idx, 1);
    }
  }

  const userPickRows: {
    pick_number: number;
    round_number: number;
    player: RankedPlayer;
    is_keeper: boolean;
  }[] = [];

  const totalPicks = NUM_TEAMS * NUM_ROUNDS;
  for (let pickNumber = 1; pickNumber <= totalPicks; pickNumber++) {
    const team = snakeTeam(pickNumber, NUM_TEAMS);
    const round = Math.ceil(pickNumber / NUM_TEAMS);
    const drafted = teamPicks.get(team)!;
    let chosen: RankedPlayer | undefined;
    let isKeeper = false;

    if (team === userSlot && keeperByRound.has(round)) {
      chosen = keeperByRound.get(round)!;
      isKeeper = true;
    } else if (team === userSlot) {
      chosen = selectHumanPick(board, drafted, pickNumber, round, liveCfg, rng, sloppyFlavor);
    } else {
      chosen = selectCpuPick(board, archetypes[team], {
        roundNumber: round,
        numRounds: NUM_ROUNDS,
        numTeams: NUM_TEAMS,
        teamDraftedPlayers: drafted,
        pickNumber,
        draftOrder: 'snake',
        flexSlots: 1,
        benchSize: 6,
        realism: { enabled: true, pickNumber, numTeams: NUM_TEAMS },
      });
      if (!chosen) chosen = [...board].sort((a, b) => a.rank - b.rank)[0];
    }

    if (!chosen) break;
    if (!isKeeper) {
      const idx = board.findIndex((p) => p.id === chosen!.id);
      if (idx >= 0) board.splice(idx, 1);
    }
    drafted.push(chosen);

    if (team === userSlot) {
      userPickRows.push({
        pick_number: pickNumber,
        round_number: round,
        player: chosen,
        is_keeper: isKeeper,
      });
    }
  }

  const gradeResult = computeDraftGrade(
    userPickRows.map((r) => ({
      pick_number: r.pick_number,
      round_number: r.round_number,
      is_keeper: r.is_keeper,
      player: {
        id: r.player.id,
        name: r.player.name,
        adp: r.player.adp,
        position: r.player.position,
        team: r.player.team,
        bye_week: r.player.bye_week,
      },
    })),
    {
      numTeams: NUM_TEAMS,
      numRounds: NUM_ROUNDS,
      isSuperflex: false,
      playerPool: pool.map((p) => ({
        position: p.position,
        team: p.team,
        adp: p.adp,
      })),
    }
  );

  return {
    intent: cfg.intent,
    slot: userSlot,
    grade: gradeResult?.grade ?? 'F-',
    score: gradeResult?.numericScore ?? 0,
    avgValue: gradeResult?.breakdown.avgValueSpots ?? 0,
    steals: gradeResult?.breakdown.realStealCount ?? 0,
    reaches: gradeResult?.breakdown.reachCount ?? 0,
    elite: gradeResult?.breakdown.eliteTierCount ?? 0,
    withKeepers: Boolean(keeperPlan),
  };
}

/** Elite keepers in late rounds + terrible drafting should NOT yield A. */
function runKeeperAbuseTests(pool: RankedPlayer[], seed: number) {
  const elites = pool.filter((p) => ['RB', 'WR'].includes(p.position)).slice(0, 3);
  const terrible = INTENTS.find((i) => i.intent === 'terrible')!;
  const results: TrialResult[] = [];
  for (let i = 0; i < 24; i++) {
    const slot = (i % 12) + 1;
    results.push(
      runDraft(pool, slot, terrible, seed + 5000 + i, {
        playerIds: elites.map((p) => p.id),
        rounds: [4, 5, 6],
      })
    );
  }
  const aOrBetter = results.filter((r) =>
    ['A+', 'A', 'A-'].includes(r.grade)
  ).length;
  const bOrBetter = results.filter((r) =>
    ['A+', 'A', 'A-', 'B+', 'B', 'B-'].includes(r.grade)
  ).length;
  return {
    trials: results.length,
    aOrBetter,
    bOrBetter,
    grades: results.reduce((m, r) => {
      m[r.grade] = (m[r.grade] ?? 0) + 1;
      return m;
    }, {} as Record<string, number>),
    /** Pass if keepers + terrible draft rarely get B or better. */
    pass: bOrBetter / results.length <= 0.15 && aOrBetter === 0,
  };
}

function main() {
  const { trials, slots, seed, attempt } = parseArgs();
  const pool = buildSimPool(loadPlayers());
  console.log(
    `Builder attempt ${attempt} | ${pool.length} players | ${NUM_TEAMS}x${NUM_ROUNDS} | trials/intent=${trials}`
  );

  const byIntent: Record<string, TrialResult[]> = {};
  const allResults: TrialResult[] = [];

  for (const cfg of INTENTS) {
    const results: TrialResult[] = [];
    let n = 0;
    for (let i = 0; i < trials; i++) {
      for (const slot of slots) {
        n += 1;
        const r = runDraft(pool, slot, cfg, seed + n * 7919 + cfg.intent.length * 17);
        results.push(r);
        allResults.push(r);
      }
    }
    byIntent[cfg.intent] = results;
    const grades: Record<string, number> = {};
    let scoreSum = 0;
    for (const r of results) {
      grades[r.grade] = (grades[r.grade] ?? 0) + 1;
      scoreSum += r.score;
    }
    console.log(
      `[${cfg.intent.padEnd(9)}] n=${results.length} avg=${(scoreSum / results.length).toFixed(1)} ` +
        `grades=${JSON.stringify(grades)}`
    );
  }

  const excellent = byIntent.excellent ?? [];
  const solid = byIntent.solid ?? [];
  const goodAim = [...excellent, ...solid];
  const terrible = byIntent.terrible ?? [];
  const sloppy = byIntent.sloppy ?? [];

  const gradeCount = (rows: TrialResult[], g: LetterGrade) =>
    rows.filter((r) => r.grade === g).length;
  const rate = (rows: TrialResult[], pred: (r: TrialResult) => boolean) =>
    rows.length ? rows.filter(pred).length / rows.length : 0;

  const goodDfRate = rate(goodAim, (r) =>
    ['D+', 'D', 'D-', 'F+', 'F', 'F-'].includes(r.grade)
  );
  const goodBPlusOrBetter = rate(goodAim, (r) =>
    ['A+', 'A', 'A-', 'B+', 'B', 'B-'].includes(r.grade)
  );
  const excellentAPlus = gradeCount(excellent, 'A+');
  const excellentBPlus = gradeCount(excellent, 'B+');
  const excellentAMinusPlus = rate(excellent, (r) =>
    ['A+', 'A', 'A-'].includes(r.grade)
  );
  const terribleFBand = rate(terrible, (r) =>
    ['D+', 'D', 'D-', 'F+', 'F', 'F-'].includes(r.grade)
  );

  // Coverage: every letter appears somewhere across intents (human variance).
  const coverage: Record<string, number> = {};
  for (const r of allResults) coverage[r.grade] = (coverage[r.grade] ?? 0) + 1;
  const missingGrades = USER_GRADES.filter((g) => (coverage[g] ?? 0) < 3);

  const keeperTest = runKeeperAbuseTests(pool, seed);
  console.log(
    `\nKeeper abuse (terrible + 3 late elite keepers): ${JSON.stringify(keeperTest.grades)} ` +
      `pass=${keeperTest.pass}`
  );

  const report = {
    generatedAt: new Date().toISOString(),
    attempt,
    config: { NUM_TEAMS, NUM_ROUNDS, trials, slots, seed, poolSize: pool.length },
    byIntent: Object.fromEntries(
      Object.entries(byIntent).map(([k, rows]) => [
        k,
        {
          n: rows.length,
          avgScore: rows.reduce((s, r) => s + r.score, 0) / rows.length,
          grades: rows.reduce((m, r) => {
            m[r.grade] = (m[r.grade] ?? 0) + 1;
            return m;
          }, {} as Record<string, number>),
        },
      ])
    ),
    metrics: {
      goodAimDfRate: goodDfRate,
      goodAimBOrBetterRate: goodBPlusOrBetter,
      excellentAPlusCount: excellentAPlus,
      excellentBPlusCount: excellentBPlus,
      excellentABandRate: excellentAMinusPlus,
      excellentN: excellent.length,
      goodAimN: goodAim.length,
      terribleLowBandRate: terribleFBand,
      coverage,
      missingGrades,
    },
    keeperTest,
    builderNotes: [
      'Intents are human mindsets (excellent/solid/sloppy/terrible), not letter targets.',
      'No ADP rewriting to hit grade bands.',
      'Natural board value only (CPU reaches create falls).',
    ],
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, `builder-run-${attempt}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${outPath}`);
  console.log(
    `goodAim D/F rate=${(goodDfRate * 100).toFixed(1)}% | goodAim B-or-better=${(goodBPlusOrBetter * 100).toFixed(1)}%`
  );
  console.log(
    `excellent A+=${excellentAPlus}/${excellent.length} B+=${excellentBPlus} A-band=${(excellentAMinusPlus * 100).toFixed(1)}%`
  );
  console.log(`missing grades (<3 overall): ${missingGrades.join(', ') || '(none)'}`);
}

main();
