import { readFileSync } from 'node:fs';
import type { RankedPlayer } from '../../src/types/database';
import {
  assignRandomNamedArchetypesForDraft,
  selectCpuPick,
} from '../../src/utils/cpuDraftLogic';
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
const players = pool.slice(0, 400);
const NUM_TEAMS = 12;
const NUM_ROUNDS = 15;
const userSlot = Number(process.argv[2] ?? 1);

function snakeTeam(pickNumber: number) {
  const round = Math.ceil(pickNumber / NUM_TEAMS);
  const idx = (pickNumber - 1) % NUM_TEAMS;
  return round % 2 === 1 ? idx + 1 : NUM_TEAMS - idx;
}

const available = [...players];
const teamPicks = new Map<number, RankedPlayer[]>();
for (let t = 1; t <= NUM_TEAMS; t++) teamPicks.set(t, []);
const archetypes = assignRandomNamedArchetypesForDraft(NUM_TEAMS, userSlot);
const userRows: { pick_number: number; round_number: number; player: RankedPlayer }[] = [];

for (let pickNumber = 1; pickNumber <= NUM_TEAMS * NUM_ROUNDS; pickNumber++) {
  const team = snakeTeam(pickNumber);
  const round = Math.ceil(pickNumber / NUM_TEAMS);
  const drafted = teamPicks.get(team)!;
  let chosen: RankedPlayer | undefined;
  if (team === userSlot) {
    const sorted = [...available].sort((a, b) => a.adp - b.adp);
    const rb = drafted.filter((p) => p.position === 'RB').length;
    const wr = drafted.filter((p) => p.position === 'WR').length;
    chosen =
      sorted.find((p) => {
        const pos = p.position;
        if (round <= 10 && (pos === 'K' || pos === 'DEF' || pos === 'D/ST')) return false;
        if (round <= 6) {
          if (rb < 2 && pos === 'RB') return true;
          if (wr < 2 && pos === 'WR') return true;
          if (rb >= 2 && wr >= 2) return pos === 'RB' || pos === 'WR' || pos === 'TE' || pos === 'QB';
          return pos === 'RB' || pos === 'WR';
        }
        return true;
      }) || sorted[0];
  } else {
    chosen = selectCpuPick(available, archetypes[team], {
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
    if (!chosen) chosen = [...available].sort((a, b) => a.rank - b.rank)[0];
  }
  const idx = available.findIndex((p) => p.id === chosen!.id);
  if (idx >= 0) available.splice(idx, 1);
  drafted.push(chosen!);
  if (team === userSlot) {
    userRows.push({ pick_number: pickNumber, round_number: round, player: chosen! });
  }
}

const g = computeDraftGrade(
  userRows.map((r) => ({
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
  {
    numTeams: NUM_TEAMS,
    numRounds: NUM_ROUNDS,
    playerPool: players,
  }
);

console.log(
  'Picks:\n' +
    userRows
      .map(
        (r) =>
          `R${r.round_number} #${r.pick_number} ${r.player.name} (${r.player.position} ADP${r.player.adp}) val=${r.player.adp - r.pick_number}`
      )
      .join('\n')
);
console.log('Grade', g?.grade, g?.numericScore);
console.log(JSON.stringify(g?.breakdown, null, 2));
console.log('tagline:', g?.tagline?.slice(0, 240));
