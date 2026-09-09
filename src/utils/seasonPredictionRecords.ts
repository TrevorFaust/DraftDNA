import { allScheduleGames, scheduleGameKey, type ScheduleGame } from '@/constants/nfl2026ScheduleGrid';
import { getTeams, type TeamRow } from '@/lib/newsletter/teams';
import { teamNickname } from '@/utils/nfl2026Schedule';
import { canonicalTeamAbbr } from '@/utils/teamMapping';
import type { SeasonPredictionPicks } from '@/utils/seasonPredictionsStorage';

export type Conference = 'AFC' | 'NFC';

export type TeamRecord = {
  abbr: string;
  name: string;
  nick: string;
  conference: Conference;
  division: string;
  wins: number;
  losses: number;
  divWins: number;
  divLosses: number;
  confWins: number;
  confLosses: number;
  pct: number;
};

export type PlayoffSeed = TeamRecord & {
  seed: number;
  isDivisionWinner: boolean;
};

export type DivisionStanding = {
  conference: Conference;
  division: string;
  label: string;
  teams: TeamRecord[];
};

type ResolvedGame = {
  week: number;
  home: string;
  away: string;
  winner: string;
  loser: string;
  key: string;
};

type SeasonContext = {
  teams: Map<string, TeamRecord>;
  games: ResolvedGame[];
  byTeam: Map<string, ResolvedGame[]>;
};

function toCanonAbbr(raw: string): string {
  return canonicalTeamAbbr(raw.trim().toUpperCase()) ?? raw.trim().toUpperCase();
}

function emptyRecord(team: TeamRow): TeamRecord {
  const abbr = toCanonAbbr(team.abbrev);
  return {
    abbr,
    name: team.name,
    nick: teamNickname(abbr, team.name),
    conference: team.conference as Conference,
    division: team.division,
    wins: 0,
    losses: 0,
    divWins: 0,
    divLosses: 0,
    confWins: 0,
    confLosses: 0,
    pct: 0,
  };
}

function winningPct(wins: number, losses: number): number {
  const games = wins + losses;
  if (games === 0) return 0;
  return wins / games;
}

function sameDivision(a: TeamRecord, b: TeamRecord): boolean {
  return a.conference === b.conference && a.division === b.division;
}

function coinToss(a: string, b: string): number {
  let hash = 0;
  const s = `${a}|${b}`;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return hash < 0 ? -1 : 1;
}

function buildContext(picks: SeasonPredictionPicks): SeasonContext {
  const teams = new Map<string, TeamRecord>();
  for (const team of getTeams()) {
    const row = emptyRecord(team);
    teams.set(row.abbr, row);
  }

  const games: ResolvedGame[] = [];
  const byTeam = new Map<string, ResolvedGame[]>();

  for (const game of allScheduleGames()) {
    const key = scheduleGameKey(game.week, game.away, game.home);
    const picked = picks[key];
    if (!picked) continue;

    const winner = toCanonAbbr(picked);
    const home = toCanonAbbr(game.home);
    const away = toCanonAbbr(game.away);
    if (winner !== home && winner !== away) continue;

    const loser = winner === home ? away : home;
    const resolved: ResolvedGame = { week: game.week, home, away, winner, loser, key };
    games.push(resolved);

    for (const abbr of [home, away]) {
      const list = byTeam.get(abbr) ?? [];
      list.push(resolved);
      byTeam.set(abbr, list);
    }

    const winRow = teams.get(winner);
    const loseRow = teams.get(loser);
    if (winRow) winRow.wins += 1;
    if (loseRow) loseRow.losses += 1;

    if (winRow && loseRow && sameDivision(winRow, loseRow)) {
      winRow.divWins += 1;
      loseRow.divLosses += 1;
    }
    if (winRow && loseRow && winRow.conference === loseRow.conference) {
      winRow.confWins += 1;
      loseRow.confLosses += 1;
    }
  }

  for (const row of teams.values()) {
    row.pct = winningPct(row.wins, row.losses);
  }

  return { teams, games, byTeam };
}

function recordAmong(
  abbr: string,
  opponents: Set<string>,
  ctx: SeasonContext
): { wins: number; losses: number; pct: number } {
  let wins = 0;
  let losses = 0;
  for (const game of ctx.byTeam.get(abbr) ?? []) {
    const opp = game.winner === abbr ? game.loser : game.winner;
    if (!opponents.has(opp)) continue;
    if (game.winner === abbr) wins += 1;
    else losses += 1;
  }
  return { wins, losses, pct: winningPct(wins, losses) };
}

function commonOpponents(teamAbbrs: string[], ctx: SeasonContext): Set<string> {
  if (teamAbbrs.length === 0) return new Set();
  const sets = teamAbbrs.map((abbr) => {
    const ops = new Set<string>();
    for (const game of ctx.byTeam.get(abbr) ?? []) {
      ops.add(game.winner === abbr ? game.loser : game.winner);
    }
    return ops;
  });
  const common = new Set(sets[0]);
  for (let i = 1; i < sets.length; i++) {
    for (const opp of [...common]) {
      if (!sets[i].has(opp)) common.delete(opp);
    }
  }
  for (const abbr of teamAbbrs) common.delete(abbr);
  return common;
}

function strengthOfVictory(abbr: string, ctx: SeasonContext): number {
  const beaten: string[] = [];
  for (const game of ctx.byTeam.get(abbr) ?? []) {
    if (game.winner === abbr) beaten.push(game.loser);
  }
  if (beaten.length === 0) return 0;
  let sum = 0;
  for (const opp of beaten) sum += ctx.teams.get(opp)?.pct ?? 0;
  return sum / beaten.length;
}

function strengthOfSchedule(abbr: string, ctx: SeasonContext): number {
  const opps: string[] = [];
  for (const game of ctx.byTeam.get(abbr) ?? []) {
    opps.push(game.winner === abbr ? game.loser : game.winner);
  }
  if (opps.length === 0) return 0;
  let sum = 0;
  for (const opp of opps) sum += ctx.teams.get(opp)?.pct ?? 0;
  return sum / opps.length;
}

/**
 * Apply NFL-style elimination steps until one club advances, then repeat for the rest.
 * Points-based steps are skipped (no predicted scores). Final fallback: coin toss.
 */
function orderBySteps(
  teams: TeamRecord[],
  twoClubSteps: Array<(group: TeamRecord[]) => TeamRecord[] | null>,
  multiClubSteps: Array<(group: TeamRecord[]) => TeamRecord[] | null>
): TeamRecord[] {
  if (teams.length <= 1) return [...teams];

  const remaining = [...teams];
  const ordered: TeamRecord[] = [];

  while (remaining.length > 1) {
    const winner = advanceOneClub(remaining, twoClubSteps, multiClubSteps);
    ordered.push(winner);
    const idx = remaining.findIndex((t) => t.abbr === winner.abbr);
    if (idx >= 0) remaining.splice(idx, 1);
  }

  if (remaining.length === 1) ordered.push(remaining[0]);
  return ordered;
}

function advanceOneClub(
  group: TeamRecord[],
  twoClubSteps: Array<(group: TeamRecord[]) => TeamRecord[] | null>,
  multiClubSteps: Array<(group: TeamRecord[]) => TeamRecord[] | null>
): TeamRecord {
  let current = [...group];

  for (let guard = 0; guard < 64; guard++) {
    if (current.length === 1) return current[0];

    const steps = current.length === 2 ? twoClubSteps : multiClubSteps;
    let eliminated = false;

    for (const step of steps) {
      const survivors = step(current);
      if (!survivors || survivors.length === 0 || survivors.length === current.length) continue;

      if (survivors.length === 1) return survivors[0];

      // Clubs eliminated — restart with survivors (2-club format if only two left).
      current = survivors;
      eliminated = true;
      break;
    }

    if (!eliminated) {
      const sorted = [...current].sort((a, b) => coinToss(a.abbr, b.abbr));
      return sorted[0];
    }
  }

  return current[0];
}

function headToHeadStep(ctx: SeasonContext) {
  return (group: TeamRecord[]): TeamRecord[] | null => {
    const abbrs = new Set(group.map((t) => t.abbr));
    const scored = group.map((t) => ({
      team: t,
      ...recordAmong(t.abbr, abbrs, ctx),
    }));
    // Need at least one game among the group for H2H to apply
    const played = scored.some((s) => s.wins + s.losses > 0);
    if (!played) return null;

    const best = Math.max(...scored.map((s) => s.pct));
    const survivors = scored.filter((s) => s.pct === best).map((s) => s.team);
    return survivors.length === group.length ? null : survivors;
  };
}

function divisionRecordStep() {
  return (group: TeamRecord[]): TeamRecord[] | null => {
    const scored = group.map((t) => ({
      team: t,
      pct: winningPct(t.divWins, t.divLosses),
    }));
    const best = Math.max(...scored.map((s) => s.pct));
    const survivors = scored.filter((s) => s.pct === best).map((s) => s.team);
    return survivors.length === group.length ? null : survivors;
  };
}

function commonGamesStep(ctx: SeasonContext, minGames = 0) {
  return (group: TeamRecord[]): TeamRecord[] | null => {
    const common = commonOpponents(
      group.map((t) => t.abbr),
      ctx
    );
    if (common.size < minGames) return null;
    if (common.size === 0) return null;

    const scored = group.map((t) => ({
      team: t,
      ...recordAmong(t.abbr, common, ctx),
    }));
    const best = Math.max(...scored.map((s) => s.pct));
    const survivors = scored.filter((s) => s.pct === best).map((s) => s.team);
    return survivors.length === group.length ? null : survivors;
  };
}

function conferenceRecordStep() {
  return (group: TeamRecord[]): TeamRecord[] | null => {
    const scored = group.map((t) => ({
      team: t,
      pct: winningPct(t.confWins, t.confLosses),
    }));
    const best = Math.max(...scored.map((s) => s.pct));
    const survivors = scored.filter((s) => s.pct === best).map((s) => s.team);
    return survivors.length === group.length ? null : survivors;
  };
}

function sovStep(ctx: SeasonContext) {
  return (group: TeamRecord[]): TeamRecord[] | null => {
    const scored = group.map((t) => ({
      team: t,
      sov: strengthOfVictory(t.abbr, ctx),
    }));
    const best = Math.max(...scored.map((s) => s.sov));
    const survivors = scored.filter((s) => s.sov === best).map((s) => s.team);
    return survivors.length === group.length ? null : survivors;
  };
}

function sosStep(ctx: SeasonContext) {
  return (group: TeamRecord[]): TeamRecord[] | null => {
    const scored = group.map((t) => ({
      team: t,
      sos: strengthOfSchedule(t.abbr, ctx),
    }));
    const best = Math.max(...scored.map((s) => s.sos));
    const survivors = scored.filter((s) => s.sos === best).map((s) => s.team);
    return survivors.length === group.length ? null : survivors;
  };
}

function headToHeadSweepStep(ctx: SeasonContext) {
  return (group: TeamRecord[]): TeamRecord[] | null => {
    if (group.length < 3) return null;

    for (const team of group) {
      let beatAll = true;
      let lostAll = true;

      for (const other of group) {
        if (other.abbr === team.abbr) continue;
        const rec = recordAmong(team.abbr, new Set([other.abbr]), ctx);
        if (rec.wins + rec.losses === 0) {
          beatAll = false;
          lostAll = false;
          continue;
        }
        if (rec.losses > 0 || rec.wins === 0) beatAll = false;
        if (rec.wins > 0 || rec.losses === 0) lostAll = false;
      }

      if (beatAll) return [team];
      if (lostAll) {
        const survivors = group.filter((t) => t.abbr !== team.abbr);
        return survivors.length > 0 && survivors.length < group.length ? survivors : null;
      }
    }
    return null;
  };
}

function divisionTiebreakerSteps(ctx: SeasonContext) {
  return [
    headToHeadStep(ctx),
    divisionRecordStep(),
    commonGamesStep(ctx, 0),
    conferenceRecordStep(),
    sovStep(ctx),
    sosStep(ctx),
  ];
}

function wildCardTwoClubSteps(ctx: SeasonContext) {
  return [
    headToHeadStep(ctx),
    conferenceRecordStep(),
    commonGamesStep(ctx, 4),
    sovStep(ctx),
    sosStep(ctx),
  ];
}

function wildCardMultiClubSteps(ctx: SeasonContext) {
  return [
    headToHeadSweepStep(ctx),
    conferenceRecordStep(),
    commonGamesStep(ctx, 4),
    sovStep(ctx),
    sosStep(ctx),
  ];
}

/** Fully order a division using overall PCT, then NFL division tiebreakers. */
function orderDivision(teams: TeamRecord[], ctx: SeasonContext): TeamRecord[] {
  const byPct = new Map<number, TeamRecord[]>();
  for (const team of teams) {
    const list = byPct.get(team.pct) ?? [];
    list.push(team);
    byPct.set(team.pct, list);
  }

  const pctKeys = [...byPct.keys()].sort((a, b) => b - a);
  const result: TeamRecord[] = [];
  for (const pct of pctKeys) {
    const group = byPct.get(pct)!;
    if (group.length === 1) result.push(group[0]);
    else {
      const steps = divisionTiebreakerSteps(ctx);
      result.push(...orderBySteps(group, steps, steps));
    }
  }
  return result;
}

function orderDivisionWinners(winners: TeamRecord[], ctx: SeasonContext): TeamRecord[] {
  const byPct = new Map<number, TeamRecord[]>();
  for (const team of winners) {
    const list = byPct.get(team.pct) ?? [];
    list.push(team);
    byPct.set(team.pct, list);
  }
  const pctKeys = [...byPct.keys()].sort((a, b) => b - a);
  const result: TeamRecord[] = [];
  for (const pct of pctKeys) {
    const group = byPct.get(pct)!;
    if (group.length === 1) result.push(group[0]);
    else {
      result.push(
        ...orderBySteps(group, wildCardTwoClubSteps(ctx), wildCardMultiClubSteps(ctx))
      );
    }
  }
  return result;
}

/**
 * Pick the next wild-card team from candidates using NFL WC procedures.
 */
function pickNextWildCard(candidates: TeamRecord[], ctx: SeasonContext): TeamRecord {
  if (candidates.length === 1) return candidates[0];

  const bestPct = Math.max(...candidates.map((t) => t.pct));
  let group = candidates.filter((t) => t.pct === bestPct);
  if (group.length === 1) return group[0];

  const allSameDivision = group.every((t) => sameDivision(t, group[0]));
  if (allSameDivision) {
    const steps = divisionTiebreakerSteps(ctx);
    return orderBySteps(group, steps, steps)[0];
  }

  // Different divisions: keep only the highest-ranked club in each division.
  const byDiv = new Map<string, TeamRecord[]>();
  for (const team of group) {
    const key = `${team.conference}-${team.division}`;
    const list = byDiv.get(key) ?? [];
    list.push(team);
    byDiv.set(key, list);
  }

  const reduced: TeamRecord[] = [];
  for (const divTeams of byDiv.values()) {
    if (divTeams.length === 1) reduced.push(divTeams[0]);
    else {
      const steps = divisionTiebreakerSteps(ctx);
      reduced.push(orderBySteps(divTeams, steps, steps)[0]);
    }
  }

  if (reduced.length === 1) return reduced[0];

  return orderBySteps(
    reduced,
    wildCardTwoClubSteps(ctx),
    wildCardMultiClubSteps(ctx)
  )[0];
}

function selectWildCards(candidates: TeamRecord[], count: number, ctx: SeasonContext): TeamRecord[] {
  const remaining = [...candidates];
  const selected: TeamRecord[] = [];
  while (selected.length < count && remaining.length > 0) {
    const next = pickNextWildCard(remaining, ctx);
    selected.push(next);
    const idx = remaining.findIndex((t) => t.abbr === next.abbr);
    if (idx >= 0) remaining.splice(idx, 1);
  }
  return selected;
}

/** Build projected W-L standings from full-season matchup picks. */
export function buildSeasonStandings(picks: SeasonPredictionPicks): DivisionStanding[] {
  const ctx = buildContext(picks);
  const divisionOrder = ['East', 'North', 'South', 'West'] as const;
  const conferences: Conference[] = ['AFC', 'NFC'];
  const boards: DivisionStanding[] = [];

  for (const conference of conferences) {
    for (const division of divisionOrder) {
      const teams = [...ctx.teams.values()].filter(
        (t) => t.conference === conference && t.division === division
      );
      boards.push({
        conference,
        division,
        label: `${conference} ${division}`,
        teams: orderDivision(teams, ctx),
      });
    }
  }

  return boards;
}

/** Seeds 1–4: division winners. Seeds 5–7: wild cards. Uses NFL tiebreakers. */
export function buildConferencePlayoffSeeds(
  picks: SeasonPredictionPicks,
  conference: Conference
): PlayoffSeed[] {
  const ctx = buildContext(picks);
  const boards = buildSeasonStandings(picks).filter((b) => b.conference === conference);
  const divisionWinners = boards.map((b) => b.teams[0]).filter(Boolean);
  const divisionWinnerAbbrs = new Set(divisionWinners.map((t) => t.abbr));

  const wildCardCandidates = boards
    .flatMap((b) => b.teams)
    .filter((t) => !divisionWinnerAbbrs.has(t.abbr));

  const orderedWinners = orderDivisionWinners(divisionWinners, ctx);
  const wildCards = selectWildCards(wildCardCandidates, 3, ctx);

  const divisionSeeds: PlayoffSeed[] = orderedWinners.map((team, index) => ({
    ...team,
    seed: index + 1,
    isDivisionWinner: true,
  }));

  const wildCardSeeds: PlayoffSeed[] = wildCards.map((team, index) => ({
    ...team,
    seed: index + 5,
    isDivisionWinner: false,
  }));

  return [...divisionSeeds, ...wildCardSeeds];
}

export function buildAllPlayoffSeeds(picks: SeasonPredictionPicks): {
  afc: PlayoffSeed[];
  nfc: PlayoffSeed[];
} {
  return {
    afc: buildConferencePlayoffSeeds(picks, 'AFC'),
    nfc: buildConferencePlayoffSeeds(picks, 'NFC'),
  };
}

/** All games involving a team, sorted by week. */
export function gamesForTeam(teamAbbr: string): ScheduleGame[] {
  const abbr = toCanonAbbr(teamAbbr);
  return allScheduleGames()
    .filter((g) => toCanonAbbr(g.home) === abbr || toCanonAbbr(g.away) === abbr)
    .sort((a, b) => a.week - b.week || a.away.localeCompare(b.away));
}

export function allTeamRecords(picks: SeasonPredictionPicks): TeamRecord[] {
  const boards = buildSeasonStandings(picks);
  return boards.flatMap((b) => b.teams);
}

/** ESPN scoreboard logo path (WAS → wsh). */
export function espnTeamLogoUrl(abbr: string): string {
  const key = toCanonAbbr(abbr);
  const espn = key === 'WAS' ? 'wsh' : key.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${espn}.png`;
}

export function formatWinningPct(pct: number): string {
  if (pct >= 1) return '1.000';
  return pct.toFixed(3).replace(/^0/, '');
}

export function formatSeasonRecord(wins: number, losses: number): string {
  return `${wins}-${losses}`;
}
