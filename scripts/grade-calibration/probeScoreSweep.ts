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
for (let i = 0; i < 12; i++) {
  const teams = ['BUF', 'BAL', 'SF', 'DAL', 'PHI', 'KC', 'MIA', 'PIT', 'DEN', 'GB', 'MIN', 'DET'];
  pool.push({
    id: `def-${i}`,
    name: `${teams[i]} DEF`,
    position: 'DEF',
    team: teams[i],
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

const base = [
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

console.log(
  'base defined?',
  base.every(Boolean),
  'counts',
  { rbs: rbs.length, wrs: wrs.length, tes: tes.length, qbs: qbs.length, defs: defs.length, ks: ks.length }
);

for (const delta of [20, 14, 10, 6, 0, -6, -12, -20, -30, -40]) {
  const picks = base.map((p, i) => {
    const pick_number = pickNums[i];
    const pos = p.position;
    const adp = pos === 'K' || pos === 'DEF' ? pick_number : Math.max(1, Math.min(220, pick_number - delta));
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
    `delta ${String(delta).padStart(3)} => ${String(g?.grade).padEnd(2)} score=${g?.numericScore} val=${g?.breakdown.avgValueSpots} steals=${g?.breakdown.realStealCount} reaches=${g?.breakdown.reachCount} elite=${g?.breakdown.eliteTierCount} V=${g?.breakdown.valueScore} P=${g?.breakdown.processScore} S=${g?.breakdown.synergyScore} R=${g?.breakdown.rosterQualityScore}`
  );
}

const hard = [
  tes[0],
  ks[0],
  defs[0],
  qbs[0],
  tes[1],
  qbs[1],
  wrs[20],
  rbs[20],
  wrs[30],
  rbs[30],
  wrs[40],
  rbs[40],
  tes[4],
  ks[2],
  defs[2],
];
for (const delta of [0, -12, -24, -36]) {
  const picks = hard.map((p, i) => {
    const pick_number = pickNums[i];
    const pos = p.position;
    const adp = pos === 'K' || pos === 'DEF' ? pick_number : Math.max(1, Math.min(220, pick_number - delta));
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
    `HARD delta ${String(delta).padStart(3)} => ${String(g?.grade).padEnd(2)} score=${g?.numericScore} val=${g?.breakdown.avgValueSpots} steals=${g?.breakdown.realStealCount} reaches=${g?.breakdown.reachCount}`
  );
}
