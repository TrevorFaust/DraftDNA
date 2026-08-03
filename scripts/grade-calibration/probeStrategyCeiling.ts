/**
 * Prove strategy choices don't hard-block A+ when the rest of the draft is elite.
 */
import { readFileSync } from 'node:fs';
import type { RankedPlayer } from '../../src/types/database';
import { computeDraftGrade } from '../../src/utils/draftGrade';

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
const slot = 6;
const pickNums = Array.from({ length: NUM_ROUNDS }, (_, r) => {
  const round = r + 1;
  return round % 2 === 1
    ? (round - 1) * NUM_TEAMS + slot
    : round * NUM_TEAMS - slot + 1;
});

const rbs = pool.filter((p) => p.position === 'RB');
const wrs = pool.filter((p) => p.position === 'WR');
const tes = pool.filter((p) => p.position === 'TE');
const qbs = pool.filter((p) => p.position === 'QB');
const defs = pool.filter((p) => p.position === 'DEF');
const ks = pool.filter((p) => p.position === 'K');

function grade(label: string, seq: RankedPlayer[], valueDelta: number) {
  const picks = seq.map((p, i) => {
    const pick_number = pickNums[i];
    const pos = p.position;
    const adp =
      pos === 'K' || pos === 'DEF'
        ? pick_number
        : Math.max(1, Math.min(220, pick_number - valueDelta));
    return {
      pick_number,
      round_number: i + 1,
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
  console.log(
    `${label.padEnd(28)} => ${String(g?.grade).padEnd(2)} score=${g?.numericScore} val=${g?.breakdown.avgValueSpots} steals=${g?.breakdown.realStealCount} elite=${g?.breakdown.eliteTierCount}`
  );
}

const eliteRecover = [
  tes[0], // early TE
  rbs[0],
  wrs[0],
  rbs[1],
  wrs[1],
  wrs[2],
  qbs[0],
  rbs[2],
  wrs[3],
  rbs[3],
  wrs[4],
  defs[0],
  ks[0],
  wrs[5],
  rbs[4],
];

const earlyQbRecover = [
  qbs[0],
  rbs[0],
  wrs[0],
  rbs[1],
  wrs[1],
  wrs[2],
  tes[0],
  rbs[2],
  wrs[3],
  rbs[3],
  wrs[4],
  defs[0],
  ks[0],
  wrs[5],
  rbs[4],
];

const balanced = [
  rbs[0],
  wrs[0],
  rbs[1],
  wrs[1],
  wrs[2],
  rbs[2],
  tes[0],
  qbs[0],
  wrs[3],
  rbs[3],
  wrs[4],
  rbs[4],
  defs[0],
  ks[0],
  wrs[5],
];

const hardTank = [
  tes[0],
  ks[0],
  defs[0],
  qbs[0],
  tes[1],
  qbs[1],
  wrs[40],
  rbs[40],
  wrs[50],
  rbs[50],
  wrs[60],
  rbs[60],
  tes[4],
  ks[2],
  defs[2],
];

console.log('--- elite value after early TE/QB (should allow A-band) ---');
grade('early TE + elite recovery', eliteRecover, 14);
grade('early QB + elite recovery', earlyQbRecover, 14);
grade('balanced elite', balanced, 14);

console.log('\n--- same shapes, chalk value ---');
grade('early TE chalk', eliteRecover, 0);
grade('early QB chalk', earlyQbRecover, 0);
grade('balanced chalk', balanced, 0);

console.log('\n--- floor: hard tank should still reach F/F- ---');
grade('hard tank chalk', hardTank, 0);
grade('hard tank reaches', hardTank, -20);
