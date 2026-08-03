/**
 * Dense ADP/structure sweep to see which letter bands are hittable.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RankedPlayer } from '../../src/types/database';
import { computeDraftGrade, type LetterGrade } from '../../src/utils/draftGrade';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'output');
const text = readFileSync('rankings/generated/ppr_season_1qb.csv', 'utf8');
const lines = text.trim().split(/\r?\n/);
const h = lines[0].split(',');
const ir = h.indexOf('rank');
const iid = h.indexOf('player_id');
const iname = h.indexOf('name');
const ipos = h.indexOf('position');
const iteam = h.indexOf('team_db');
const pool: RankedPlayer[] = [];
for (let i = 1; i < lines.length; i++) {
  const c = lines[i].split(',');
  const rank = Number(c[ir]);
  if (!rank) continue;
  const position = (c[ipos] || '').trim().toUpperCase();
  if (!['QB', 'RB', 'WR', 'TE', 'K'].includes(position)) continue;
  pool.push({
    id: c[iid],
    name: c[iname],
    position,
    team: c[iteam] || null,
    adp: rank,
    bye_week: ((pool.length * 3) % 14) + 1,
    jersey_number: null,
    season: 2026,
    created_at: '',
    rank,
  });
}
pool.sort((a, b) => a.adp - b.adp);
pool.forEach((p, i) => {
  p.rank = i + 1;
  p.adp = i + 1;
});
const nfl = ['BUF', 'BAL', 'SF', 'DAL', 'PHI', 'KC', 'MIA', 'PIT', 'DEN', 'GB', 'MIN', 'DET'];
for (let i = 0; i < 12; i++) {
  pool.push({
    id: `def-${i}`,
    name: `${nfl[i]} DEF`,
    position: 'DEF',
    team: nfl[i],
    adp: 250 + i,
    bye_week: i + 1,
    jersey_number: null,
    season: 2026,
    created_at: '',
    rank: 250 + i,
  });
}

const NUM_TEAMS = 12;
const NUM_ROUNDS = 15;
const TARGETS: LetterGrade[] = [
  'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F',
];

const rbs = pool.filter((p) => p.position === 'RB');
const wrs = pool.filter((p) => p.position === 'WR');
const tes = pool.filter((p) => p.position === 'TE');
const qbs = pool.filter((p) => p.position === 'QB');
const defs = pool.filter((p) => p.position === 'DEF');
const ks = pool.filter((p) => p.position === 'K');

type Template = { name: string; players: RankedPlayer[] };
const templates: Template[] = [
  {
    name: 'balanced',
    players: [
      rbs[0], wrs[0], rbs[1], wrs[1], wrs[2], rbs[2], tes[0], qbs[0],
      wrs[3], rbs[3], wrs[4], rbs[4], defs[0], ks[0], wrs[5],
    ],
  },
  {
    name: 'heroRb',
    players: [
      rbs[0], rbs[1], wrs[0], wrs[1], wrs[2], tes[0], qbs[0], wrs[3],
      rbs[5], wrs[5], rbs[8], defs[0], ks[0], wrs[8], rbs[10],
    ],
  },
  {
    name: 'zeroRb',
    players: [
      wrs[0], wrs[1], wrs[2], tes[0], qbs[0], wrs[3], rbs[4], wrs[5],
      rbs[6], defs[0], ks[0], wrs[8], rbs[10], wrs[10], rbs[12],
    ],
  },
  {
    name: 'earlyTe',
    players: [
      tes[0], rbs[1], wrs[1], rbs[3], wrs[3], wrs[5], qbs[1], rbs[6],
      wrs[8], rbs[8], defs[0], ks[0], wrs[12], rbs[12], tes[2],
    ],
  },
  {
    name: 'earlyK',
    players: [
      rbs[1], wrs[1], ks[0], wrs[3], rbs[3], wrs[5], tes[1], qbs[1],
      rbs[6], wrs[8], rbs[8], defs[0], wrs[12], rbs[12], wrs[14],
    ],
  },
  {
    name: 'twoTe',
    players: [
      tes[0], tes[1], wrs[2], rbs[3], wrs[4], qbs[0], wrs[6], rbs[8],
      defs[0], ks[0], wrs[12], rbs[12], wrs[16], rbs[16], qbs[3],
    ],
  },
  {
    name: 'softTank',
    players: [
      tes[0], qbs[0], wrs[4], tes[1], wrs[6], rbs[8], wrs[10], rbs[12],
      defs[0], ks[0], wrs[16], rbs[16], wrs[20], rbs[20], qbs[4],
    ],
  },
  {
    name: 'hardTank',
    players: [
      tes[0], ks[0], defs[0], qbs[0], tes[1], qbs[1], wrs[20], rbs[20],
      wrs[30], rbs[30], wrs[40], rbs[40], tes[4], ks[2], defs[2],
    ],
  },
  {
    name: 'utility3',
    players: [
      tes[0], qbs[0], ks[0], wrs[2], rbs[2], wrs[4], rbs[4], wrs[6],
      rbs[6], defs[0], wrs[10], rbs[10], tes[2], qbs[2], wrs[14],
    ],
  },
];

const hits: Record<string, { count: number; examples: string[] }> = {};
for (const g of TARGETS) hits[g] = { count: 0, examples: [] };
hits['F+'] = { count: 0, examples: [] };
hits['F-'] = { count: 0, examples: [] };

let total = 0;
for (const slot of [1, 3, 6, 8, 10, 12]) {
  for (const tmpl of templates) {
    if (tmpl.players.some((p) => !p)) continue;
    for (let delta = -36; delta <= 22; delta += 1) {
      const picks = tmpl.players.map((p, i) => {
        const round = i + 1;
        const pick_number =
          round % 2 === 1
            ? (round - 1) * NUM_TEAMS + slot
            : round * NUM_TEAMS - slot + 1;
        const pos = p.position;
        const adp =
          pos === 'K' || pos === 'DEF'
            ? pick_number
            : Math.max(1, Math.min(220, pick_number - delta));
        return {
          pick_number,
          round_number: round,
          player: {
            id: p.id,
            name: p.name,
            adp,
            position: p.position,
            team: p.team,
            bye_week: p.bye_week,
          },
        };
      });
      const g = computeDraftGrade(picks, {
        numTeams: NUM_TEAMS,
        numRounds: NUM_ROUNDS,
        playerPool: pool,
      });
      if (!g) continue;
      total += 1;
      const bucket = hits[g.grade] ?? (hits[g.grade] = { count: 0, examples: [] });
      bucket.count += 1;
      if (bucket.examples.length < 3) {
        bucket.examples.push(`${tmpl.name}|slot${slot}|d${delta}|score${g.numericScore}`);
      }
    }
  }
}

console.log(`Total graded combos: ${total}`);
for (const g of [...TARGETS, 'F+', 'F-']) {
  const row = hits[g] ?? { count: 0, examples: [] };
  const mark = TARGETS.includes(g as LetterGrade) ? (row.count >= 3 ? 'OK ' : 'LOW') : '   ';
  console.log(
    `${mark} ${g.padEnd(2)} hits=${row.count} e.g. ${row.examples.join(' ; ') || '(none)'}`
  );
}

const missing = TARGETS.filter((g) => (hits[g]?.count ?? 0) < 3);
mkdirSync(OUT, { recursive: true });
writeFileSync(
  join(OUT, 'dense-band-sweep.json'),
  JSON.stringify({ total, hits, missing }, null, 2)
);
console.log(missing.length ? `MISSING(<3): ${missing.join(', ')}` : 'ALL TARGET BANDS HIT ≥3');
