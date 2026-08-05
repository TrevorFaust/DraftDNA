/**
 * In-process twin of multiplayer draft server rules (snake, keepers, BPA CPU, uniqueness).
 * Used by Builder/Judge without live DB flakiness.
 */

import { mpNormalizePos, mpRoundForPick, mpTeamForPick } from '../../src/utils/multiplayerDraftMath';

export type SimPlayer = { id: string; position: string; adp?: number };
export type SimKeeper = { team_number: number; player_id: string; round_number: number };
export type SimPick = {
  player_id: string;
  team_number: number;
  round_number: number;
  pick_number: number;
  is_autodraft: boolean;
  is_keeper: boolean;
};
export type SimHuman = { team_number: number; user_id?: string | null; guest_session_id?: string | null };

export type SimDraftResult = {
  numTeams: number;
  numRounds: number;
  humanTeams: number[];
  picks: SimPick[];
  grades: Array<{
    team_number: number;
    grade_letter: string;
    badge_awarded: boolean;
    has_user_id: boolean;
  }>;
  keeperLocked: boolean;
  completed: boolean;
  duplicatePlayers: number;
  rosterSizes: Record<number, number>;
  /** Per-team: can fill QB/2RB/2WR/TE/DEF/K starters from drafted players */
  starterFillOk: Record<number, boolean>;
  starterFillErrors: string[];
};

function positionAllowed(
  teamPicks: SimPick[],
  board: SimPlayer[],
  position: string,
  numRounds: number,
  limits: Record<string, number>
): boolean {
  if (teamPicks.length >= numRounds) return false;
  const pos = mpNormalizePos(position);
  const limit = limits[pos];
  if (limit != null) {
    const count = teamPicks.filter((p) => {
      const pl = board.find((b) => b.id === p.player_id);
      return pl && mpNormalizePos(pl.position) === pos;
    }).length;
    if (count >= limit) return false;
  }
  return true;
}

function countPos(teamPicks: SimPick[], board: SimPlayer[], pos: string): number {
  const want = mpNormalizePos(pos);
  return teamPicks.filter((p) => {
    const pl = board.find((b) => b.id === p.player_id);
    return pl && mpNormalizePos(pl.position) === want;
  }).length;
}

/** Starter holes to prioritize when remaining rounds are tight. */
function neededPositions(
  teamPicks: SimPick[],
  board: SimPlayer[],
  numRounds: number
): string[] {
  const remaining = Math.max(0, numRounds - teamPicks.length);
  const needed: string[] = [];
  const qb = countPos(teamPicks, board, 'QB');
  const rb = countPos(teamPicks, board, 'RB');
  const wr = countPos(teamPicks, board, 'WR');
  const te = countPos(teamPicks, board, 'TE');
  const def = countPos(teamPicks, board, 'DEF');
  const k = countPos(teamPicks, board, 'K');

  // Last 5 picks: force missing starters so DEF/K aren't skipped
  if (remaining <= 5) {
    if (qb < 1) needed.push('QB');
    if (rb < 2) {
      needed.push('RB');
      if (rb < 1) needed.push('RB');
    }
    if (wr < 2) {
      needed.push('WR');
      if (wr < 1) needed.push('WR');
    }
    if (te < 1) needed.push('TE');
    if (def < 1) needed.push('DEF');
    if (k < 1) needed.push('K');
  }
  return needed;
}

/** Greedy starter fill: QB, RB, RB, WR, WR, TE, DEF, K (flex ignored for this check). */
export function teamFillsRequiredStarters(
  teamPicks: SimPick[],
  board: SimPlayer[]
): boolean {
  const pool = teamPicks
    .map((p) => board.find((b) => b.id === p.player_id))
    .filter((p): p is SimPlayer => !!p)
    .map((p) => mpNormalizePos(p.position));
  const take = (pos: string) => {
    const idx = pool.indexOf(pos);
    if (idx < 0) return false;
    pool.splice(idx, 1);
    return true;
  };
  return (
    take('QB') &&
    take('RB') &&
    take('RB') &&
    take('WR') &&
    take('WR') &&
    take('TE') &&
    take('DEF') &&
    take('K')
  );
}

function selectBpa(
  board: SimPlayer[],
  picks: SimPick[],
  keepers: SimKeeper[],
  team: number,
  numRounds: number,
  limits: Record<string, number>
): string | null {
  const drafted = new Set(picks.map((p) => p.player_id));
  const keeperIds = new Set(keepers.map((k) => k.player_id));
  const teamPicks = picks.filter((p) => p.team_number === team);
  const needed = neededPositions(teamPicks, board, numRounds);

  const tryPick = (predicate: (pl: SimPlayer) => boolean): string | null => {
    for (const pl of board) {
      if (drafted.has(pl.id)) continue;
      if (keeperIds.has(pl.id)) continue;
      if (!predicate(pl)) continue;
      if (positionAllowed(teamPicks, board, pl.position, numRounds, limits)) {
        return pl.id;
      }
    }
    return null;
  };

  for (const need of needed) {
    const hit = tryPick((pl) => mpNormalizePos(pl.position) === need);
    if (hit) return hit;
  }

  // BPA: avoid hoarding a 2nd DEF/K while other teams still need one
  const bpa = tryPick((pl) => {
    const pos = mpNormalizePos(pl.position);
    if (pos === 'DEF' && countPos(teamPicks, board, 'DEF') >= 1) return false;
    if (pos === 'K' && countPos(teamPicks, board, 'K') >= 1) return false;
    return true;
  });
  if (bpa) return bpa;

  for (const pl of board) {
    if (drafted.has(pl.id)) continue;
    if (keeperIds.has(pl.id)) continue;
    return pl.id;
  }
  return null;
}

/** Humans auto-pick BPA (simulates ready humans + autodraft path). */
export function simulateMultiplayerDraft(opts: {
  numTeams: number;
  numRounds: number;
  board: SimPlayer[];
  humans: SimHuman[];
  keepers?: SimKeeper[];
  draftOrder?: string;
  positionLimits?: Record<string, number>;
}): SimDraftResult {
  const draftOrder = opts.draftOrder ?? 'snake';
  const keepers = opts.keepers ?? [];
  const limits = opts.positionLimits ?? {};
  const humanTeams = new Set(opts.humans.map((h) => h.team_number));
  const picks: SimPick[] = [];
  const total = opts.numTeams * opts.numRounds;

  if (opts.board.length < total) {
    throw new Error(`Board too small: ${opts.board.length} < ${total}`);
  }

  const keeperByTeamRound = new Map<string, string>();
  for (const k of keepers) {
    keeperByTeamRound.set(`${k.team_number}:${k.round_number}`, k.player_id);
  }

  for (let pickNumber = 1; pickNumber <= total; pickNumber++) {
    const team = mpTeamForPick(pickNumber, opts.numTeams, draftOrder);
    const round = mpRoundForPick(pickNumber, opts.numTeams);
    const keeperId = keeperByTeamRound.get(`${team}:${round}`);

    if (keeperId) {
      if (picks.some((p) => p.player_id === keeperId)) {
        throw new Error(`Keeper already drafted: ${keeperId}`);
      }
      picks.push({
        player_id: keeperId,
        team_number: team,
        round_number: round,
        pick_number: pickNumber,
        is_autodraft: true,
        is_keeper: true,
      });
      continue;
    }

    const playerId = selectBpa(opts.board, picks, keepers, team, opts.numRounds, limits);
    if (!playerId) throw new Error(`No player for pick ${pickNumber} team ${team}`);
    picks.push({
      player_id: playerId,
      team_number: team,
      round_number: round,
      pick_number: pickNumber,
      is_autodraft: true,
      is_keeper: false,
    });
  }

  const ids = picks.map((p) => p.player_id);
  const duplicatePlayers = ids.length - new Set(ids).size;
  const rosterSizes: Record<number, number> = {};
  const starterFillOk: Record<number, boolean> = {};
  const starterFillErrors: string[] = [];
  for (let t = 1; t <= opts.numTeams; t++) {
    const teamPicks = picks.filter((p) => p.team_number === t);
    rosterSizes[t] = teamPicks.length;
    const ok = teamFillsRequiredStarters(teamPicks, opts.board);
    starterFillOk[t] = ok;
    if (!ok) starterFillErrors.push(`team ${t} missing required starters (QB/2RB/2WR/TE/DEF/K)`);
  }

  let keeperLocked = true;
  for (const k of keepers) {
    const hit = picks.find((p) => p.player_id === k.player_id);
    if (!hit || hit.team_number !== k.team_number || hit.round_number !== k.round_number || !hit.is_keeper) {
      keeperLocked = false;
    }
    // Keeper must not appear on any other team
    const stolen = picks.some(
      (p) => p.player_id === k.player_id && p.team_number !== k.team_number
    );
    if (stolen) keeperLocked = false;
  }

  const grades = opts.humans.map((h) => {
    const teamPicks = picks.filter((p) => p.team_number === h.team_number);
    let value = 0;
    for (const p of teamPicks) {
      const pl = opts.board.find((b) => b.id === p.player_id);
      const adp = pl?.adp ?? p.pick_number;
      value += p.pick_number - adp;
    }
    const avg = teamPicks.length ? value / teamPicks.length : 0;
    let grade_letter = 'C';
    if (avg > 8) grade_letter = 'A';
    else if (avg > 3) grade_letter = 'B';
    else if (avg < -8) grade_letter = 'F';
    else if (avg < -3) grade_letter = 'D';

    const has_user_id = Boolean(h.user_id);
    return {
      team_number: h.team_number,
      grade_letter,
      badge_awarded: has_user_id,
      has_user_id,
    };
  });

  return {
    numTeams: opts.numTeams,
    numRounds: opts.numRounds,
    humanTeams: [...humanTeams],
    picks,
    grades,
    keeperLocked,
    completed: picks.length === total,
    duplicatePlayers,
    rosterSizes,
    starterFillOk,
    starterFillErrors,
  };
}

export function makeSyntheticBoard(size: number, numTeams = 12): SimPlayer[] {
  // Seed enough DEF/K for every team, then fill with a normal skill mix
  const board: SimPlayer[] = [];
  for (let t = 0; t < numTeams; t++) {
    board.push({ id: `def${t + 1}`, position: 'DEF', adp: 200 + t });
    board.push({ id: `k${t + 1}`, position: 'K', adp: 220 + t });
  }
  const skill = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'RB', 'WR', 'QB', 'TE'];
  let i = 0;
  while (board.length < size) {
    board.push({
      id: `p${i + 1}`,
      position: skill[i % skill.length],
      adp: i + 1,
    });
    i += 1;
  }
  // Sort by ADP so early BPA is skill-heavy; DEF/K sit late until need-based
  return board.sort((a, b) => (a.adp ?? 0) - (b.adp ?? 0));
}
