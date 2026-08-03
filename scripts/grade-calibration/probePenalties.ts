import { readFileSync } from 'node:fs';
import { computeDraftGrade } from '../../src/utils/draftGrade';
import { analyzeEarlyDraftStructure } from '../../src/utils/draftGradeEarlySlot';
import { analyzePositionalDraftValue } from '../../src/utils/draftGradePositionalValue';
import type { RankedPlayer } from '../../src/types/database';

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
const teams = ['BUF', 'BAL', 'SF', 'DAL', 'PHI', 'KC', 'MIA', 'PIT', 'DEN', 'GB', 'MIN', 'DET'];
for (let i = 0; i < 12; i++) {
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

for (const delta of [20, 12, 0, -8, -16]) {
  const picks = base.map((p, i) => {
    const pick_number = pickNums[i];
    const pos = p.position;
    const adp =
      pos === 'K' || pos === 'DEF'
        ? pick_number
        : Math.max(1, Math.min(220, pick_number - delta));
    return {
      pick_number,
      round_number: i + 1,
      pos,
      adp,
      rawAdp: adp,
      name: p.name,
      nflTeam: p.team,
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
  const early = analyzeEarlyDraftStructure(
    picks,
    NUM_TEAMS,
    NUM_ROUNDS,
    pool.map((p) => ({ pos: p.position, adp: p.adp, nflTeam: p.team || '' }))
  );
  const posv = analyzePositionalDraftValue(picks);
  const g = computeDraftGrade(
    picks.map((p) => ({
      pick_number: p.pick_number,
      round_number: p.round_number,
      player: p.player,
    })),
    { numTeams: NUM_TEAMS, numRounds: NUM_ROUNDS, playerPool: pool }
  );
  console.log(
    JSON.stringify(
      {
        delta,
        grade: g?.grade,
        score: g?.numericScore,
        earlyPen: early.penalty,
        earlyCap: early.maxNumericScore,
        earlyWr2: early.earlyTeamWr2Count,
        earlyNote: early.narrativeNote,
        posPen: posv.penalty,
        posCap: posv.maxNumericScore,
        elite: g?.breakdown.eliteTierCount,
        steals: g?.breakdown.realStealCount,
        val: g?.breakdown.avgValueSpots,
        V: g?.breakdown.valueScore,
        P: g?.breakdown.processScore,
        S: g?.breakdown.synergyScore,
        R: g?.breakdown.rosterQualityScore,
      },
      null,
      0
    )
  );
}
