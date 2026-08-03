/**
 * Probe synthetic pick lists to find score ceilings/floors without a full mock.
 */
import { readFileSync } from 'node:fs';
import type { RankedPlayer } from '../../src/types/database';
import { computeDraftGrade, type LetterGrade } from '../../src/utils/draftGrade';

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
  pool.push({
    id: c[iid],
    name: c[iname],
    position: c[ipos],
    team: c[iteam] || null,
    adp: rank,
    bye_week: ((rank * 7) % 14) + 1,
    jersey_number: null,
    season: 2026,
    created_at: '',
    rank,
  });
}
pool.sort((a, b) => a.rank - b.rank);

const NUM_TEAMS = 12;
const NUM_ROUNDS = 15;

function gradePicks(
  picks: { pick_number: number; round_number: number; player: RankedPlayer }[],
  label: string
) {
  const g = computeDraftGrade(
    picks.map((r) => ({
      pick_number: r.pick_number,
      round_number: r.round_number,
      player: {
        id: r.player.id,
        name: r.player.name,
        adp: r.player.adp,
        position: r.player.position,
        team: r.player.team,
        bye_week: r.player.bye_week,
      },
    })),
    { numTeams: NUM_TEAMS, numRounds: NUM_ROUNDS, playerPool: pool }
  );
  console.log(
    `${label.padEnd(28)} => ${String(g?.grade).padEnd(2)} score=${g?.numericScore} ` +
      `val=${g?.breakdown.avgValueSpots} steals=${g?.breakdown.realStealCount} reaches=${g?.breakdown.reachCount} ` +
      `elite=${g?.breakdown.eliteTierCount} V=${g?.breakdown.valueScore} P=${g?.breakdown.processScore} ` +
      `S=${g?.breakdown.synergyScore} R=${g?.breakdown.rosterQualityScore}`
  );
  return g;
}

function byPos(pos: string) {
  return pool.filter((p) => p.position === pos);
}

/** Build snake picks for slot with a fixed player sequence. */
function pack(slot: number, players: RankedPlayer[]) {
  const picks: { pick_number: number; round_number: number; player: RankedPlayer }[] = [];
  let i = 0;
  for (let round = 1; round <= NUM_ROUNDS; round++) {
    const pick_number =
      round % 2 === 1
        ? (round - 1) * NUM_TEAMS + slot
        : round * NUM_TEAMS - slot + 1;
    picks.push({ pick_number, round_number: round, player: players[i++] });
  }
  return picks;
}

const slot = 6;
const pickNums = Array.from({ length: NUM_ROUNDS }, (_, r) => {
  const round = r + 1;
  return round % 2 === 1
    ? (round - 1) * NUM_TEAMS + slot
    : round * NUM_TEAMS - slot + 1;
});

// 1) Perfect consensus: take player whose ADP ~= pick each round (RB/WR heavy early)
{
  const used = new Set<string>();
  const chosen: RankedPlayer[] = [];
  for (let r = 0; r < NUM_ROUNDS; r++) {
    const pn = pickNums[r];
    const round = r + 1;
    const candidates = pool.filter((p) => !used.has(p.id));
    let pick: RankedPlayer | undefined;
    if (round <= 6) {
      pick = candidates
        .filter((p) => p.position === 'RB' || p.position === 'WR')
        .sort((a, b) => Math.abs(a.adp - pn) - Math.abs(b.adp - pn))[0];
    } else if (round <= 10) {
      pick = candidates
        .filter((p) => ['RB', 'WR', 'TE', 'QB'].includes(p.position))
        .sort((a, b) => Math.abs(a.adp - pn) - Math.abs(b.adp - pn))[0];
    } else {
      pick = candidates.sort((a, b) => Math.abs(a.adp - pn) - Math.abs(b.adp - pn))[0];
    }
    if (pick) {
      used.add(pick.id);
      chosen.push(pick);
    }
  }
  gradePicks(pack(slot, chosen), 'consensus RB/WR');
}

// 2) Steal machine: take ADP much better than pick (fallers)
{
  const used = new Set<string>();
  const chosen: RankedPlayer[] = [];
  for (let r = 0; r < NUM_ROUNDS; r++) {
    const pn = pickNums[r];
    const round = r + 1;
    const candidates = pool
      .filter((p) => !used.has(p.id) && p.adp + 8 < pn)
      .filter((p) => {
        if (round <= 8) return ['RB', 'WR', 'TE', 'QB'].includes(p.position);
        return true;
      })
      .sort((a, b) => a.adp - b.adp);
    // Prefer biggest steal among top remaining that "fell"
    const pick =
      candidates.sort((a, b) => b.adp - pn - (a.adp - pn) || a.adp - b.adp)[0] ||
      pool.filter((p) => !used.has(p.id)).sort((a, b) => a.adp - b.adp)[0];
    used.add(pick.id);
    chosen.push(pick);
  }
  gradePicks(pack(slot, chosen), 'steal-hunt (artificial)');
}

// 3) Elite anchors by ADP order with structure
{
  const rbs = byPos('RB');
  const wrs = byPos('WR');
  const tes = byPos('TE');
  const qbs = byPos('QB');
  const defs = byPos('DEF');
  const ks = byPos('K');
  const seq = [
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
  // Fake ADP to create steals: set adp = pick - 14 for skill
  const withSteals = seq.map((p, i) => {
    const pn = pickNums[i];
    const pos = p.position;
    const adp =
      pos === 'K' || pos === 'DEF'
        ? pn
        : Math.max(1, pn - 14);
    return { ...p, adp };
  });
  gradePicks(pack(slot, withSteals), 'structured + fake steals');
}

// 4) Mild reaches
{
  const rbs = byPos('RB');
  const wrs = byPos('WR');
  const tes = byPos('TE');
  const qbs = byPos('QB');
  const defs = byPos('DEF');
  const ks = byPos('K');
  const seq = [
    rbs[5],
    wrs[5],
    rbs[8],
    wrs[8],
    tes[2],
    qbs[2],
    wrs[12],
    rbs[12],
    wrs[15],
    rbs[15],
    tes[5],
    qbs[5],
    defs[2],
    ks[2],
    wrs[20],
  ];
  gradePicks(pack(slot, seq), 'mild reaches structured');
}

// 5) Early TE then recover
{
  const rbs = byPos('RB');
  const wrs = byPos('WR');
  const tes = byPos('TE');
  const qbs = byPos('QB');
  const defs = byPos('DEF');
  const ks = byPos('K');
  const seq = [
    tes[0],
    rbs[2],
    wrs[2],
    rbs[4],
    wrs[4],
    wrs[6],
    qbs[1],
    rbs[8],
    wrs[10],
    rbs[10],
    defs[0],
    ks[0],
    wrs[14],
    rbs[14],
    tes[3],
  ];
  gradePicks(pack(slot, seq), 'early TE then recover');
}

// 6) Early K once
{
  const rbs = byPos('RB');
  const wrs = byPos('WR');
  const tes = byPos('TE');
  const qbs = byPos('QB');
  const defs = byPos('DEF');
  const ks = byPos('K');
  const seq = [
    rbs[3],
    wrs[3],
    ks[0],
    wrs[5],
    rbs[5],
    wrs[7],
    tes[1],
    qbs[1],
    rbs[9],
    wrs[11],
    rbs[11],
    defs[0],
    wrs[16],
    rbs[16],
    wrs[18],
  ];
  gradePicks(pack(slot, seq), 'early K round 3');
}

// 7) Soft tank: 2 early TE, late RB2
{
  const rbs = byPos('RB');
  const wrs = byPos('WR');
  const tes = byPos('TE');
  const qbs = byPos('QB');
  const defs = byPos('DEF');
  const ks = byPos('K');
  const seq = [
    tes[0],
    tes[1],
    qbs[0],
    wrs[4],
    wrs[6],
    wrs[8],
    rbs[10],
    rbs[14],
    defs[0],
    ks[0],
    wrs[20],
    rbs[20],
    wrs[25],
    rbs[25],
    qbs[4],
  ];
  gradePicks(pack(slot, seq), 'soft tank 2TE early');
}

// 8) Hard tank utility early
{
  const rbs = byPos('RB');
  const wrs = byPos('WR');
  const tes = byPos('TE');
  const qbs = byPos('QB');
  const defs = byPos('DEF');
  const ks = byPos('K');
  const seq = [
    tes[0],
    ks[0],
    defs[0],
    qbs[0],
    tes[1],
    qbs[1],
    wrs[30],
    rbs[30],
    wrs[40],
    rbs[40],
    wrs[50],
    rbs[50],
    tes[5],
    ks[2],
    defs[2],
  ];
  gradePicks(pack(slot, seq), 'hard tank utility');
}

// Sweep artificial avg value via ADP rewrite
console.log('\n--- ADP rewrite sweep (structured roster) ---');
const baseSeq = (() => {
  const rbs = byPos('RB');
  const wrs = byPos('WR');
  const tes = byPos('TE');
  const qbs = byPos('QB');
  const defs = byPos('DEF');
  const ks = byPos('K');
  return [
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
})();

for (const delta of [20, 12, 6, 0, -6, -12, -18, -24, -36]) {
  const rewritten = baseSeq.map((p, i) => {
    const pn = pickNums[i];
    const pos = p.position;
    if (pos === 'K' || pos === 'DEF') return { ...p, adp: pn };
    return { ...p, adp: Math.max(1, Math.min(190, pn - delta)) };
  });
  gradePicks(pack(slot, rewritten), `ADP delta ${delta >= 0 ? '+' : ''}${delta}`);
}

console.log('\n--- random structured noise histogram (200) ---');
const hist: Record<string, number> = {};
const scores: number[] = [];
for (let n = 0; n < 200; n++) {
  const rbs = [...byPos('RB')];
  const wrs = [...byPos('WR')];
  const tes = [...byPos('TE')];
  const qbs = [...byPos('QB')];
  const defs = [...byPos('DEF')];
  const ks = [...byPos('K')];
  const take = <T,>(arr: T[], start: number, jitter: number) =>
    arr[Math.min(arr.length - 1, start + Math.floor(Math.random() * jitter))];
  const seq = [
    take(rbs, 0, 4),
    take(wrs, 0, 4),
    take(rbs, 2, 6),
    take(wrs, 2, 6),
    take(wrs, 4, 8),
    take(rbs, 4, 8),
    take(tes, 0, 6),
    take(qbs, 0, 8),
    take(wrs, 8, 10),
    take(rbs, 8, 10),
    take(wrs, 12, 12),
    take(rbs, 12, 12),
    take(defs, 0, 8),
    take(ks, 0, 8),
    take(wrs, 16, 16),
  ];
  const used = new Set<string>();
  const uniq = seq.map((p) => {
    if (!used.has(p.id)) {
      used.add(p.id);
      return p;
    }
    const alt =
      pool.find((x) => !used.has(x.id) && x.position === p.position) ||
      pool.find((x) => !used.has(x.id))!;
    used.add(alt.id);
    return alt;
  });
  const g = computeDraftGrade(
    pack(1 + (n % 12), uniq).map((r) => ({
      pick_number: r.pick_number,
      round_number: r.round_number,
      player: {
        id: r.player.id,
        name: r.player.name,
        adp: r.player.adp,
        position: r.player.position,
        team: r.player.team,
        bye_week: r.player.bye_week,
      },
    })),
    { numTeams: NUM_TEAMS, numRounds: NUM_ROUNDS, playerPool: pool }
  );
  const grade = (g?.grade ?? '?') as LetterGrade;
  hist[grade] = (hist[grade] ?? 0) + 1;
  if (g) scores.push(g.numericScore);
}
scores.sort((a, b) => a - b);
console.log('HIST', hist);
console.log(
  `score p10=${scores[19]} p50=${scores[99]} p90=${scores[179]} min=${scores[0]} max=${scores[scores.length - 1]}`
);
