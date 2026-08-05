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

const rbs = pool.filter((p) => p.position === 'RB');
const wrs = pool.filter((p) => p.position === 'WR');
const tes = pool.filter((p) => p.position === 'TE');
const qbs = pool.filter((p) => p.position === 'QB');
const defs = pool.filter((p) => p.position === 'DEF');
const ks = pool.filter((p) => p.position === 'K');
const NUM_TEAMS = 12;
const slot = 5;
const pickNums = Array.from({ length: 15 }, (_, r) => {
  const round = r + 1;
  return round % 2 === 1
    ? (round - 1) * NUM_TEAMS + slot
    : round * NUM_TEAMS - slot + 1;
});

function run(label: string, seq: RankedPlayer[], chalkAdp = true) {
  const picks = seq.map((p, i) => {
    const pick_number = pickNums[i];
    const pos = p.position;
    // Near-queue: ADP ≈ pick (what "drafting off the board" looks like).
    const adp =
      chalkAdp && pos !== 'K' && pos !== 'DEF'
        ? pick_number + (i % 3) - 1
        : p.adp;
    return {
      pick_number,
      round_number: i + 1,
      player: {
        id: p.id,
        name: p.name,
        adp: Math.max(1, adp),
        position: p.position,
        team: p.team,
        bye_week: p.bye_week,
      },
    };
  });
  const g = computeDraftGrade(picks, {
    numTeams: 12,
    numRounds: 15,
    playerPool: pool,
  });
  console.log(
    `${label.padEnd(32)} => ${String(g?.grade).padEnd(2)} score=${g?.numericScore} val=${g?.breakdown.avgValueSpots} reaches=${g?.breakdown.reachCount}`
  );
}

run(
  'punt TE + WR/RB depth',
  [
    rbs[1],
    wrs[1],
    rbs[3],
    wrs[3],
    wrs[5],
    rbs[5],
    wrs[7],
    rbs[7],
    qbs[2],
    wrs[10],
    rbs[10],
    wrs[14],
    defs[0],
    ks[0],
    tes[8],
  ]
);

run(
  'queue BPA RB/WR heavy',
  [
    rbs[0],
    wrs[0],
    rbs[2],
    wrs[2],
    wrs[4],
    rbs[4],
    wrs[6],
    rbs[6],
    qbs[1],
    wrs[9],
    rbs[9],
    tes[3],
    defs[1],
    ks[1],
    wrs[15],
  ]
);
