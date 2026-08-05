/**
 * Builder: human-like 12-team mocks aiming at letter grades.
 * Strategies mirror how a person would try for that grade — no grade-engine gaming
 * (no ADP rewrite, no threshold peeking).
 *
 * Usage:
 *   npx tsx scripts/grade-calibration/simulateMockDraftGrades.ts
 *   npx tsx scripts/grade-calibration/simulateMockDraftGrades.ts --trials=12 --seed=7 --attempt=1
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

/** Human mindset when trying for a letter — not score thresholds. */
type HumanIntent = 'excellent' | 'solid' | 'sloppy' | 'terrible';

type IntentConfig = {
  intent: HumanIntent;
  /** Target letter the human is trying to earn. */
  aimGrade: LetterGrade | 'F-';
  bpa: number;
  balance: number;
  earlyTe: number;
  earlySpecial: number;
  earlyQb: number;
  digDepth: number;
};

/**
 * One human strategy per aim. Extreme aims are clearer; mid grades are "dial it
 * down a notch" — exact hits will be rarer, which is honest.
 */
const INTENTS: IntentConfig[] = [
  // A+: hunt value + balanced starters
  { aimGrade: 'A+', intent: 'excellent', bpa: 1, balance: 1, earlyTe: 0.04, earlySpecial: 0, earlyQb: 0.08, digDepth: 0 },
  // A: same quality, slightly less aggressive on fallers
  { aimGrade: 'A', intent: 'excellent', bpa: 0.95, balance: 1, earlyTe: 0.06, earlySpecial: 0, earlyQb: 0.1, digDepth: 0 },
  // A-: clean BPA with a bit more early TE lean
  { aimGrade: 'A-', intent: 'excellent', bpa: 0.92, balance: 0.95, earlyTe: 0.12, earlySpecial: 0, earlyQb: 0.14, digDepth: 1 },
  // B+: solid human draft
  { aimGrade: 'B+', intent: 'solid', bpa: 0.9, balance: 0.95, earlyTe: 0.1, earlySpecial: 0, earlyQb: 0.12, digDepth: 0 },
  // B: chalk / slightly less disciplined
  { aimGrade: 'B', intent: 'solid', bpa: 0.85, balance: 0.9, earlyTe: 0.15, earlySpecial: 0, earlyQb: 0.18, digDepth: 1 },
  // B-: mostly fine with one soft mistake pattern
  { aimGrade: 'B-', intent: 'solid', bpa: 0.8, balance: 0.85, earlyTe: 0.25, earlySpecial: 0, earlyQb: 0.22, digDepth: 2 },
  // C+: early TE lean, still fill RB/WR
  { aimGrade: 'C+', intent: 'sloppy', bpa: 0.7, balance: 0.8, earlyTe: 0.55, earlySpecial: 0, earlyQb: 0.2, digDepth: 3 },
  // C: early TE + mild reaches
  { aimGrade: 'C', intent: 'sloppy', bpa: 0.65, balance: 0.75, earlyTe: 0.7, earlySpecial: 0, earlyQb: 0.25, digDepth: 4 },
  // C-: messier mid-bad
  { aimGrade: 'C-', intent: 'sloppy', bpa: 0.55, balance: 0.7, earlyTe: 0.75, earlySpecial: 0, earlyQb: 0.3, digDepth: 6 },
  // D+: a few blind-faith reaches, still build a roster
  { aimGrade: 'D+', intent: 'sloppy', bpa: 0.35, balance: 0.75, earlyTe: 0.15, earlySpecial: 0, earlyQb: 0.12, digDepth: 7 },
  // D: more pet-player reaches
  { aimGrade: 'D', intent: 'sloppy', bpa: 0.25, balance: 0.7, earlyTe: 0.2, earlySpecial: 0, earlyQb: 0.15, digDepth: 11 },
  // D-: heavy reaches + messy TE lean
  { aimGrade: 'D-', intent: 'sloppy', bpa: 0.15, balance: 0.6, earlyTe: 0.55, earlySpecial: 0, earlyQb: 0.35, digDepth: 15 },
  // F: one early K or DEF, still grab a couple skill pieces
  { aimGrade: 'F', intent: 'terrible', bpa: 0.25, balance: 0.35, earlyTe: 0.3, earlySpecial: 0.65, earlyQb: 0.3, digDepth: 8 },
  // F-: full meltdown
  { aimGrade: 'F-', intent: 'terrible', bpa: 0.05, balance: 0.05, earlyTe: 0.85, earlySpecial: 0.98, earlyQb: 0.7, digDepth: 24 },
];

function parseArgs() {
  const trials = Number(process.argv.find((a) => a.startsWith('--trials='))?.split('=')[1] ?? 10);
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

type SloppyFlavor = 'early_te' | 'reachy' | 'late_rb2' | 'double_te';

/** Draft like a person with a quality mindset — no grade thresholds. */
function selectHumanPick(
  available: RankedPlayer[],
  team: RankedPlayer[],
  pickNumber: number,
  round: number,
  cfg: IntentConfig,
  rng: () => number,
  sloppyFlavor: SloppyFlavor = 'early_te',
  /** Known keepers still on the roster (future rounds) — draft around them. */
  pendingKeepers: RankedPlayer[] = []
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

    score += (90 - idx) * cfg.bpa;

    const valueSpots = pickNumber - p.adp;
    if (cfg.intent === 'excellent' || cfg.intent === 'solid') {
      if (valueSpots >= 6) score += valueSpots * 2.5 * cfg.bpa;
    } else if (cfg.intent === 'sloppy') {
      if (sloppyFlavor === 'reachy') {
        score += Math.max(0, p.adp - pickNumber) * 0.8;
        if (idx >= 3 && idx <= 3 + cfg.digDepth) score += 12;
      } else {
        score += (90 - idx) * 0.35;
        if (valueSpots < -6) score += 8;
      }
    } else {
      score += Math.max(0, p.adp - pickNumber) * (1 - cfg.bpa) * 1.2;
      if (idx < cfg.digDepth) score -= (cfg.digDepth - idx) * 2;
      else score += Math.min(40, idx);
    }

    const pendingWrKeeper = pendingKeepers.some((k) => posKey(k) === 'WR' && k.adp <= NUM_TEAMS * 5);
    const pendingRbKeeper = pendingKeepers.some((k) => posKey(k) === 'RB' && k.adp <= NUM_TEAMS * 5);

    if (round <= 6) {
      // Plan around discounted elite keepers (e.g. Puka in R10 → lean RB early).
      if (pendingWrKeeper) {
        if (pos === 'RB' && rb < 3) score += 45;
        if (pos === 'WR' && wr >= 1 && round <= 4) score -= 25;
      }
      if (pendingRbKeeper) {
        if (pos === 'WR' && wr < 3) score += 45;
        if (pos === 'RB' && rb >= 1 && round <= 4) score -= 25;
      }
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
          score -= 55;
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
        score += 80;
      }
    } else {
      if (pos === 'K' && k === 0) score += 35;
      if (pos === 'DEF' && def === 0) score += 35;
      if (pos === 'QB' && qb === 0) score += 25;
      if (pos === 'TE' && te === 0) score += 25;
    }

    if (cfg.intent === 'terrible' && round <= 5) {
      if (cfg.aimGrade === 'F') {
        // Early K/DEF plus a thin skill core — F needs the bad rest, not auto from the K alone.
        if ((pos === 'K' || pos === 'DEF') && k + def === 0) score += 150;
        if (pos === 'TE' || pos === 'QB') score += 60;
        if (pos === 'RB' || pos === 'WR') score -= 40;
      } else {
        if (pos === 'K' || pos === 'DEF' || pos === 'TE' || pos === 'QB') score += 80 + rng() * 40;
        if (pos === 'RB' || pos === 'WR') score -= 70 + rng() * 30;
      }
    }

    // F-: keep burning early capital on K/DEF and avoiding skill.
    if (cfg.aimGrade === 'F-' && round <= 7) {
      if (pos === 'K' || pos === 'DEF') score += 160;
      if (pos === 'RB' || pos === 'WR') score -= 55;
    }
    // D- : early TE+QB without necessarily taking K yet
    if (cfg.aimGrade === 'D-' && round <= 5) {
      if (pos === 'TE' || pos === 'QB') score += 70;
      if (pos === 'K' || pos === 'DEF') score += 25;
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

  // F / F-: force early K/DEF from the full board (specials sit outside top-ADP window).
  if (
    (cfg.aimGrade === 'F' || cfg.aimGrade === 'F-') &&
    round <= (cfg.aimGrade === 'F-' ? 6 : 4) &&
    k === 0 &&
    def === 0
  ) {
    const kdPool = byAdp.filter((p) => {
      const pos = posKey(p);
      return pos === 'K' || pos === 'DEF';
    });
    if (kdPool.length && rng() < (cfg.aimGrade === 'F-' ? 0.95 : 0.9)) {
      return kdPool[Math.floor(rng() * Math.min(4, kdPool.length))];
    }
  }

  if (cfg.earlySpecial >= 0.7 && round <= 6) {
    const preferKd = cfg.aimGrade === 'F' || cfg.aimGrade === 'F-';
    if (preferKd && k === 0 && def === 0) {
      const kdPool = byAdp.filter((p) => {
        const pos = posKey(p);
        return pos === 'K' || pos === 'DEF';
      });
      if (kdPool.length && rng() < cfg.earlySpecial) {
        return kdPool[Math.floor(rng() * Math.min(3, kdPool.length))];
      }
    }
    const special = scored.find((s) => s.pos === 'K' || s.pos === 'DEF' || s.pos === 'TE');
    if (special && rng() < cfg.earlySpecial) return special.p;
  }

  const topN =
    cfg.intent === 'excellent' ? 2 : cfg.intent === 'solid' ? 3 : cfg.intent === 'sloppy' ? 3 : 5;
  const top = scored.slice(0, Math.min(topN, scored.length));
  return top[Math.floor(rng() * top.length)]?.p ?? byAdp[0];
}

type RosterPick = {
  round: number;
  pick: number;
  name: string;
  pos: string;
  team: string | null;
  adp: number;
  is_keeper: boolean;
};

type TrialResult = {
  aimGrade: LetterGrade | 'F-';
  intent: HumanIntent;
  slot: number;
  grade: LetterGrade;
  score: number;
  avgValue: number;
  steals: number;
  reaches: number;
  elite: number;
  withKeepers?: boolean;
  tagline?: string;
  roster: RosterPick[];
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

  const dBand = cfg.aimGrade === 'D+' || cfg.aimGrade === 'D' || cfg.aimGrade === 'D-';
  const fBand = cfg.aimGrade === 'F' || cfg.aimGrade === 'F-';
  const liveCfg: IntentConfig = {
    ...cfg,
    digDepth: fBand
      ? cfg.aimGrade === 'F-'
        ? Math.floor(16 + rng() * 12)
        : Math.floor(6 + rng() * 6)
      : dBand
        ? cfg.digDepth + Math.floor(rng() * 2)
        : cfg.intent === 'sloppy'
          ? Math.floor(3 + rng() * 6)
          : cfg.digDepth,
    earlySpecial: fBand
      ? Math.max(cfg.earlySpecial, cfg.aimGrade === 'F-' ? 0.95 : 0.8)
      : cfg.earlySpecial,
  };
  const sloppyFlavors: SloppyFlavor[] = ['early_te', 'reachy', 'late_rb2', 'double_te'];
  // D-band = blind-faith reaches; C-band keeps mixed human mistakes.
  const sloppyFlavor: SloppyFlavor =
    cfg.aimGrade === 'D+' || cfg.aimGrade === 'D' || cfg.aimGrade === 'D-'
      ? 'reachy'
      : cfg.intent === 'sloppy'
        ? sloppyFlavors[Math.floor(rng() * sloppyFlavors.length)]
        : 'early_te';

  const keeperByRound = new Map<number, RankedPlayer>();
  if (keeperPlan) {
    for (let i = 0; i < keeperPlan.playerIds.length; i++) {
      const pl = pool.find((p) => p.id === keeperPlan.playerIds[i]);
      if (pl) keeperByRound.set(keeperPlan.rounds[i], pl);
    }
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
      const pendingKeepers = [...keeperByRound.entries()]
        .filter(([r]) => r > round)
        .map(([, p]) => p);
      chosen = selectHumanPick(
        board,
        drafted,
        pickNumber,
        round,
        liveCfg,
        rng,
        sloppyFlavor,
        pendingKeepers
      );
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
    aimGrade: cfg.aimGrade,
    intent: cfg.intent,
    slot: userSlot,
    grade: gradeResult?.grade ?? 'F-',
    score: gradeResult?.numericScore ?? 0,
    avgValue: gradeResult?.breakdown.avgValueSpots ?? 0,
    steals: gradeResult?.breakdown.realStealCount ?? 0,
    reaches: gradeResult?.breakdown.reachCount ?? 0,
    elite: gradeResult?.breakdown.eliteTierCount ?? 0,
    withKeepers: Boolean(keeperPlan),
    tagline: gradeResult?.tagline ?? '',
    roster: userPickRows.map((r) => ({
      round: r.round_number,
      pick: r.pick_number,
      name: r.player.name,
      pos: posKey(r.player),
      team: r.player.team,
      adp: r.player.adp,
      is_keeper: r.is_keeper,
    })),
  };
}

function runKeeperAbuseTests(pool: RankedPlayer[], seed: number) {
  const elites = pool.filter((p) => ['RB', 'WR'].includes(p.position)).slice(0, 3);
  const terrible = INTENTS.find((i) => i.aimGrade === 'F-')!;
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
    pass: bOrBetter / results.length <= 0.15 && aOrBetter === 0,
  };
}

/**
 * Realistic discount keepers (R1–5 talent, kept R6–10) + human good drafts.
 * Writeups must say "kept", never "found … in round N" for the keeper.
 */
function runKeeperStrategyTests(pool: RankedPlayer[], seed: number) {
  const wrs = pool.filter((p) => p.position === 'WR');
  const rbs = pool.filter((p) => p.position === 'RB');
  const pukaLike = wrs.find((p) => p.adp <= 12) ?? wrs[0];
  const olaveLike = wrs.find((p) => p.adp >= 24 && p.adp <= 48) ?? wrs[8];
  const chaseBrownLike = rbs.find((p) => p.adp >= 30 && p.adp <= 55) ?? rbs[10];
  const achaneLike = rbs.find((p) => p.adp >= 14 && p.adp <= 36) ?? rbs[5];
  const hypoWr = wrs.find((p) => p.adp >= 13 && p.adp <= 24 && p.id !== pukaLike.id) ?? wrs[3];
  const hypoRb = rbs.find((p) => p.adp >= 8 && p.adp <= 20 && p.id !== achaneLike.id) ?? rbs[2];

  const excellent = INTENTS.find((i) => i.aimGrade === 'A+')!;
  const solid = INTENTS.find((i) => i.aimGrade === 'B')!;

  type Scenario = {
    id: string;
    player: RankedPlayer;
    round: number;
    cfg: IntentConfig;
  };
  const scenarios: Scenario[] = [
    { id: 'puka_r10', player: pukaLike, round: 10, cfg: excellent },
    { id: 'olave_r7', player: olaveLike, round: 7, cfg: solid },
    { id: 'chase_brown_r6', player: chaseBrownLike, round: 6, cfg: solid },
    { id: 'achane_r9', player: achaneLike, round: 9, cfg: excellent },
    { id: 'hypo_wr_r8', player: hypoWr, round: 8, cfg: solid },
    { id: 'hypo_rb_r10', player: hypoRb, round: 10, cfg: excellent },
  ];

  const rows: {
    id: string;
    keeper: string;
    round: number;
    grade: string;
    score: number;
    tagline: string;
    mentionsKept: boolean;
    falseFind: boolean;
  }[] = [];

  let n = 0;
  for (const sc of scenarios) {
    for (let t = 0; t < 8; t++) {
      n += 1;
      const slot = (t % 12) + 1;
      const r = runDraft(pool, slot, sc.cfg, seed + 9000 + n * 17, {
        playerIds: [sc.player.id],
        rounds: [sc.round],
      });
      const tag = r.tagline ?? '';
      const name = sc.player.name;
      const mentionsKept =
        /kept|keeper/i.test(tag) &&
        (tag.includes(name) || tag.toLowerCase().includes('keeper'));
      // "found NAME … in round N" or "landing him in round N" for the keeper is wrong.
      const falseFind = new RegExp(
        `(found|landing|got)\\s[^.]{0,40}${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^.]{0,40}round\\s*${sc.round}`,
        'i'
      ).test(tag) || new RegExp(
        `${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^.]{0,60}in round ${sc.round}[^.]{0,40}(value|found|steal)`,
        'i'
      ).test(tag);

      rows.push({
        id: sc.id,
        keeper: name,
        round: sc.round,
        grade: r.grade,
        score: r.score,
        tagline: tag,
        mentionsKept,
        falseFind,
      });
    }
  }

  const bOrBetter = rows.filter((r) =>
    ['A+', 'A', 'A-', 'B+', 'B', 'B-'].includes(r.grade)
  ).length;
  const falseFinds = rows.filter((r) => r.falseFind).length;
  const keptMentions = rows.filter((r) => r.mentionsKept).length;

  return {
    trials: rows.length,
    bOrBetter,
    bOrBetterRate: rows.length ? bOrBetter / rows.length : 0,
    keptMentions,
    keptMentionRate: rows.length ? keptMentions / rows.length : 0,
    falseFinds,
    samples: rows.slice(0, 8).map((r) => ({
      id: r.id,
      keeper: r.keeper,
      grade: r.grade,
      tagline: r.tagline.slice(0, 220),
      mentionsKept: r.mentionsKept,
      falseFind: r.falseFind,
    })),
    /** Good drafts with discount keepers stay A–C; writeups name keepers, not fake finds. */
    pass:
      bOrBetter / rows.length >= 0.7 &&
      falseFinds === 0 &&
      keptMentions / rows.length >= 0.5,
  };
}

function gradesNear(aim: string, got: string): boolean {
  const scale = [
    'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F+', 'F', 'F-',
  ];
  const ai = scale.indexOf(aim);
  const gi = scale.indexOf(got);
  if (ai < 0 || gi < 0) return aim === got;
  return Math.abs(ai - gi) <= 1;
}

function main() {
  const { trials, slots, seed, attempt } = parseArgs();
  const pool = buildSimPool(loadPlayers());
  console.log(
    `Builder attempt ${attempt} | ${pool.length} players | ${NUM_TEAMS}x${NUM_ROUNDS} | trials/aim=${trials}`
  );

  const byAim: Record<string, TrialResult[]> = {};
  const byIntent: Record<string, TrialResult[]> = {};
  const allResults: TrialResult[] = [];

  for (const cfg of INTENTS) {
    const results: TrialResult[] = [];
    let n = 0;
    for (let i = 0; i < trials; i++) {
      for (const slot of slots) {
        n += 1;
        const r = runDraft(
          pool,
          slot,
          cfg,
          seed + n * 7919 + cfg.aimGrade.length * 17 + INTENTS.indexOf(cfg) * 101
        );
        results.push(r);
        allResults.push(r);
        (byIntent[cfg.intent] ??= []).push(r);
      }
    }
    byAim[cfg.aimGrade] = results;
    const hits = results.filter((r) => r.grade === cfg.aimGrade).length;
    const near = results.filter((r) => gradesNear(cfg.aimGrade, r.grade)).length;
    const grades: Record<string, number> = {};
    let scoreSum = 0;
    for (const r of results) {
      grades[r.grade] = (grades[r.grade] ?? 0) + 1;
      scoreSum += r.score;
    }
    console.log(
      `[aim ${cfg.aimGrade.padEnd(2)}] n=${results.length} hit=${((hits / results.length) * 100).toFixed(1)}% ` +
        `near±1=${((near / results.length) * 100).toFixed(1)}% avg=${(scoreSum / results.length).toFixed(1)} ` +
        `got=${JSON.stringify(grades)}`
    );
  }

  const excellent = byIntent.excellent ?? [];
  const solid = byIntent.solid ?? [];
  const goodAim = [...excellent, ...solid];
  const terrible = byIntent.terrible ?? [];

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

  const coverage: Record<string, number> = {};
  for (const r of allResults) coverage[r.grade] = (coverage[r.grade] ?? 0) + 1;
  const missingGrades = USER_GRADES.filter((g) => (coverage[g] ?? 0) < 3);

  const aimHitRates: Record<
    string,
    { n: number; exactHits: number; exactRate: number; nearHits: number; nearRate: number; grades: Record<string, number> }
  > = {};
  for (const [aim, rows] of Object.entries(byAim)) {
    const exactHits = rows.filter((r) => r.grade === aim).length;
    const nearHits = rows.filter((r) => gradesNear(aim, r.grade)).length;
    const grades: Record<string, number> = {};
    for (const r of rows) grades[r.grade] = (grades[r.grade] ?? 0) + 1;
    aimHitRates[aim] = {
      n: rows.length,
      exactHits,
      exactRate: rows.length ? exactHits / rows.length : 0,
      nearHits,
      nearRate: rows.length ? nearHits / rows.length : 0,
      grades,
    };
  }

  // Sample rosters for review: all A+ hits and all F- hits (cap for file size).
  const aPlusRosters = (byAim['A+'] ?? [])
    .filter((r) => r.grade === 'A+')
    .slice(0, 12)
    .map((r) => ({
      slot: r.slot,
      score: r.score,
      grade: r.grade,
      aimGrade: r.aimGrade,
      roster: r.roster,
    }));
  const fMinusRosters = (byAim['F-'] ?? [])
    .filter((r) => r.grade === 'F-')
    .slice(0, 12)
    .map((r) => ({
      slot: r.slot,
      score: r.score,
      grade: r.grade,
      aimGrade: r.aimGrade,
      roster: r.roster,
    }));

  // If no exact A+ hits, still show best A+ aims for review
  const aPlusAimSamples =
    aPlusRosters.length > 0
      ? aPlusRosters
      : (byAim['A+'] ?? [])
          .slice()
          .sort((a, b) => b.score - a.score)
          .slice(0, 6)
          .map((r) => ({
            slot: r.slot,
            score: r.score,
            grade: r.grade,
            aimGrade: r.aimGrade,
            roster: r.roster,
            note: 'best A+ aims (no exact A+ hit in sample)',
          }));

  const fMinusAimSamples =
    fMinusRosters.length > 0
      ? fMinusRosters
      : (byAim['F-'] ?? [])
          .slice()
          .sort((a, b) => a.score - b.score)
          .slice(0, 6)
          .map((r) => ({
            slot: r.slot,
            score: r.score,
            grade: r.grade,
            aimGrade: r.aimGrade,
            roster: r.roster,
            note: 'worst F- aims (no exact F- hit in sample)',
          }));

  const keeperTest = runKeeperAbuseTests(pool, seed);
  console.log(
    `\nKeeper abuse (terrible + 3 late elite keepers): ${JSON.stringify(keeperTest.grades)} ` +
      `pass=${keeperTest.pass}`
  );

  const keeperStrategyTest = runKeeperStrategyTests(pool, seed);
  console.log(
    `\nKeeper strategy (discount elites R6–10 + good drafts): B+=${(keeperStrategyTest.bOrBetterRate * 100).toFixed(0)}% ` +
      `keptMentions=${(keeperStrategyTest.keptMentionRate * 100).toFixed(0)}% falseFinds=${keeperStrategyTest.falseFinds} ` +
      `pass=${keeperStrategyTest.pass}`
  );
  for (const s of keeperStrategyTest.samples.slice(0, 4)) {
    console.log(`  [${s.id}] ${s.keeper} → ${s.grade} kept=${s.mentionsKept} fakeFind=${s.falseFind}`);
    console.log(`    ${s.tagline}`);
  }

  console.log('\n=== Aim hit rates (exact) ===');
  for (const aim of [...USER_GRADES, 'F-'] as const) {
    const h = aimHitRates[aim];
    if (!h) continue;
    console.log(
      `  ${aim.padEnd(2)} → ${(h.exactRate * 100).toFixed(1)}% exact | ${(h.nearRate * 100).toFixed(1)}% ±1 grade`
    );
  }

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
    byAim: Object.fromEntries(
      Object.entries(byAim).map(([k, rows]) => [
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
    aimHitRates,
    sampleRosters: {
      aPlusHits: aPlusAimSamples,
      fMinusHits: fMinusAimSamples,
    },
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
      aPlusAimExactRate: aimHitRates['A+']?.exactRate ?? 0,
      fMinusAimExactRate: aimHitRates['F-']?.exactRate ?? 0,
      fBandAimExactRate:
        ((aimHitRates['F']?.exactHits ?? 0) + (aimHitRates['F-']?.exactHits ?? 0)) /
        Math.max(1, (aimHitRates['F']?.n ?? 0) + (aimHitRates['F-']?.n ?? 0)),
    },
    keeperTest,
    keeperStrategyTest,
    builderNotes: [
      'Aims use human drafting mindsets for that letter — not grade-engine thresholds.',
      'No ADP rewriting to hit bands.',
      'WR2 on an NFL team is treated as startable; early WR3+ is the depth problem.',
      'Discount keepers (R1–5 talent kept R6–10) reshape early RB/WR strategy and writeups.',
    ],
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, `builder-run-${attempt}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  // Human-readable roster dump
  const rosterMd: string[] = [
    `# Sample rosters — attempt ${attempt}`,
    '',
    '## A+ (exact hits, or best aims if none)',
    '',
  ];
  for (const s of aPlusAimSamples) {
    rosterMd.push(`### Slot ${s.slot} — graded ${s.grade} (score ${s.score.toFixed(1)}, aimed ${s.aimGrade})`);
    for (const p of s.roster) {
      rosterMd.push(
        `- R${p.round} (P${p.pick}): ${p.name} ${p.pos}${p.team ? ` ${p.team}` : ''} ADP ${p.adp}${p.is_keeper ? ' [K]' : ''}`
      );
    }
    rosterMd.push('');
  }
  rosterMd.push('## F− (exact hits, or worst aims if none)', '');
  for (const s of fMinusAimSamples) {
    rosterMd.push(`### Slot ${s.slot} — graded ${s.grade} (score ${s.score.toFixed(1)}, aimed ${s.aimGrade})`);
    for (const p of s.roster) {
      rosterMd.push(
        `- R${p.round} (P${p.pick}): ${p.name} ${p.pos}${p.team ? ` ${p.team}` : ''} ADP ${p.adp}${p.is_keeper ? ' [K]' : ''}`
      );
    }
    rosterMd.push('');
  }
  const rosterPath = join(OUT_DIR, `rosters-attempt-${attempt}.md`);
  writeFileSync(rosterPath, rosterMd.join('\n'));

  console.log(`\nWrote ${outPath}`);
  console.log(`Wrote ${rosterPath}`);
  console.log(
    `goodAim D/F rate=${(goodDfRate * 100).toFixed(1)}% | goodAim B-or-better=${(goodBPlusOrBetter * 100).toFixed(1)}%`
  );
  console.log(
    `excellent A+=${excellentAPlus}/${excellent.length} B+=${excellentBPlus} A-band=${(excellentAMinusPlus * 100).toFixed(1)}%`
  );
  console.log(`missing grades (<3 overall): ${missingGrades.join(', ') || '(none)'}`);
}

main();
