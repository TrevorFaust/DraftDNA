import { canonicalTeamAbbr } from '@/utils/teamMapping';
import { PICKEM_WEEKS } from '@/constants/pickem';

/** 2026 regular-season grid. Index 0 = week 1. `BYE` or `@OPP` / `OPP`. */
export const NFL_2026_SCHEDULE_GRID: Record<string, readonly string[]> = {
  ARI: ['@LAC', 'SEA', '@SF', '@NYG', 'DET', '@LAR', 'DEN', '@DAL', '@SEA', 'LAR', '@KC', 'WSH', 'PHI', 'BYE', 'NYJ', '@NO', 'LV', 'SF'],
  ATL: ['@PIT', 'CAR', '@GB', '@NO', 'BAL', 'CHI', 'SF', '@TB', 'CIN', 'KC', 'BYE', '@MIN', 'DET', '@CLE', '@WSH', 'TB', 'NO', '@CAR'],
  BAL: ['@IND', 'NO', '@DAL', 'TEN', '@ATL', '@CLE', 'CIN', '@BUF', 'JAX', 'LAC', '@CAR', '@HOU', 'BYE', 'TB', '@PIT', 'CLE', '@CIN', 'PIT'],
  BUF: ['@HOU', 'DET', 'LAC', 'NE', '@LAR', '@LV', 'BYE', 'BAL', '@MIN', '@NYJ', 'MIA', 'KC', '@NE', '@GB', 'CHI', '@DEN', '@MIA', 'NYJ'],
  CAR: ['CHI', '@ATL', '@CLE', 'DET', 'BYE', '@PHI', 'TB', '@GB', 'DEN', '@NO', 'BAL', '@TB', '@MIN', 'NO', 'CIN', '@PIT', 'SEA', 'ATL'],
  CHI: ['@CAR', 'MIN', 'PHI', 'NYJ', '@GB', '@ATL', 'NE', '@SEA', 'TB', 'BYE', 'NO', '@DET', 'JAX', '@MIA', '@BUF', 'GB', 'DET', '@MIN'],
  CIN: ['TB', '@HOU', '@PIT', 'JAX', '@MIA', 'BYE', '@BAL', 'TEN', '@ATL', 'PIT', '@WSH', 'NO', '@CLE', 'KC', '@CAR', '@IND', 'BAL', 'CLE'],
  CLE: ['@JAX', '@TB', 'CAR', 'PIT', '@NYJ', 'BAL', '@TEN', '@PIT', '@NO', 'HOU', 'BYE', 'LV', 'CIN', 'ATL', '@NYG', '@BAL', 'IND', '@CIN'],
  DAL: ['@NYG', 'WSH', 'BAL', '@HOU', 'TB', '@GB', '@PHI', 'ARI', '@IND', 'SF', 'TEN', 'PHI', '@SEA', 'BYE', '@LAR', 'JAX', 'NYG', '@WSH'],
  DEN: ['@KC', 'JAX', 'LAR', '@SF', '@LAC', 'SEA', '@ARI', 'KC', '@CAR', 'BYE', 'LV', '@PIT', 'MIA', '@NYJ', '@LV', 'BUF', '@NE', 'LAC'],
  DET: ['NO', '@BUF', 'NYJ', '@CAR', '@ARI', 'BYE', 'GB', 'MIN', '@MIA', 'NE', 'TB', 'CHI', '@ATL', 'TEN', '@MIN', 'NYG', '@CHI', '@GB'],
  GB: ['@MIN', '@NYJ', 'ATL', '@TB', 'CHI', 'DAL', '@DET', 'CAR', '@NE', 'MIN', 'BYE', '@LAR', '@NO', 'BUF', 'MIA', '@CHI', 'HOU', 'DET'],
  HOU: ['BUF', 'CIN', '@IND', 'DAL', '@TEN', '@JAX', 'NYG', 'BYE', '@LAC', '@CLE', 'IND', 'BAL', '@PIT', '@WSH', 'JAX', '@PHI', '@GB', 'TEN'],
  IND: ['BAL', '@KC', 'HOU', '@WSH', '@PIT', 'TEN', '@MIN', '@JAX', 'DAL', 'MIA', '@HOU', 'NYG', 'BYE', '@PHI', '@TEN', 'CIN', '@CLE', 'JAX'],
  JAX: ['CLE', '@DEN', 'NE', '@CIN', 'PHI', 'HOU', 'BYE', 'IND', '@BAL', '@TEN', '@NYG', 'TEN', '@CHI', 'PIT', '@HOU', '@DAL', 'WSH', '@IND'],
  KC: ['DEN', 'IND', '@MIA', '@LV', 'BYE', 'LAC', '@SEA', '@DEN', 'NYJ', '@ATL', 'ARI', '@BUF', '@LAR', '@CIN', 'NE', 'SF', '@LAC', 'LV'],
  LV: ['MIA', '@LAC', '@NO', 'KC', '@NE', 'BUF', 'LAR', '@NYJ', '@SF', 'SEA', '@DEN', '@CLE', 'BYE', 'LAC', 'DEN', 'TEN', '@ARI', '@KC'],
  LAR: ['SF', 'NYG', '@DEN', '@PHI', 'BUF', 'ARI', '@LV', 'LAC', '@WSH', '@ARI', 'BYE', 'GB', 'KC', '@SF', 'DAL', '@SEA', '@TB', 'SEA'],
  LAC: ['ARI', 'LV', '@BUF', '@SEA', 'DEN', '@KC', 'BYE', '@LAR', 'HOU', '@BAL', 'NYJ', 'NE', '@TB', '@LV', 'SF', '@MIA', 'KC', '@DEN'],
  MIA: ['@LV', '@SF', 'KC', '@MIN', 'CIN', 'BYE', '@NYJ', 'NE', 'DET', '@IND', '@BUF', 'NYJ', '@DEN', 'CHI', '@GB', 'LAC', 'BUF', '@NE'],
  MIN: ['GB', '@CHI', '@TB', 'MIA', '@NO', 'BYE', 'IND', '@DET', 'BUF', '@GB', '@SF', 'ATL', 'CAR', '@NE', 'DET', 'WSH', '@NYJ', 'CHI'],
  NE: ['@SEA', 'PIT', '@JAX', '@BUF', 'LV', 'NYJ', '@CHI', '@MIA', 'GB', '@DET', 'BYE', '@LAC', 'BUF', 'MIN', '@KC', '@NYJ', 'DEN', 'MIA'],
  NO: ['@DET', '@BAL', 'LV', 'ATL', 'MIN', '@NYG', 'PIT', 'BYE', 'CLE', 'CAR', '@CHI', '@CIN', 'GB', '@CAR', '@TB', 'ARI', '@ATL', 'TB'],
  NYG: ['DAL', '@LAR', 'TEN', 'ARI', '@WSH', 'NO', '@HOU', 'BYE', '@PHI', 'WSH', 'JAX', '@IND', 'SF', '@SEA', 'CLE', '@DET', '@DAL', 'PHI'],
  NYJ: ['@TEN', 'GB', '@DET', '@CHI', 'CLE', '@NE', 'MIA', 'LV', '@KC', 'BUF', '@LAC', '@MIA', 'BYE', 'DEN', '@ARI', 'NE', 'MIN', '@BUF'],
  PHI: ['WSH', '@TEN', '@CHI', 'LAR', '@JAX', 'CAR', 'DAL', '@WSH', 'NYG', 'BYE', 'PIT', '@DAL', '@ARI', 'IND', 'SEA', 'HOU', '@SF', '@NYG'],
  PIT: ['ATL', '@NE', 'CIN', '@CLE', 'IND', '@TB', '@NO', 'CLE', 'BYE', '@CIN', '@PHI', 'DEN', 'HOU', '@JAX', 'BAL', 'CAR', '@TEN', '@BAL'],
  SF: ['@LAR', 'MIA', 'ARI', 'DEN', '@SEA', 'WSH', '@ATL', 'BYE', 'LV', '@DAL', 'MIN', 'SEA', '@NYG', 'LAR', '@LAC', '@KC', 'PHI', '@ARI'],
  SEA: ['NE', '@ARI', '@WSH', 'LAC', 'SF', '@DEN', 'KC', 'CHI', 'ARI', '@LV', 'BYE', '@SF', 'DAL', 'NYG', '@PHI', 'LAR', '@CAR', '@LAR'],
  TB: ['@CIN', 'CLE', 'MIN', 'GB', '@DAL', 'PIT', '@CAR', 'ATL', '@CHI', 'BYE', '@DET', 'CAR', 'LAC', '@BAL', 'NO', '@ATL', 'LAR', '@NO'],
  TEN: ['NYJ', 'PHI', '@NYG', '@BAL', 'HOU', '@IND', 'CLE', '@CIN', 'BYE', 'JAX', '@DAL', '@JAX', 'WSH', '@DET', 'IND', '@LV', 'PIT', '@HOU'],
  WSH: ['@PHI', '@DAL', 'SEA', 'IND', 'NYG', '@SF', 'BYE', 'PHI', 'LAR', '@NYG', 'CIN', '@ARI', '@TEN', 'HOU', 'ATL', '@MIN', '@JAX', 'DAL'],
};

export const NFL_2026_SCHEDULE_TEAMS = Object.keys(NFL_2026_SCHEDULE_GRID);

export type ScheduleCell =
  | { kind: 'bye' }
  | { kind: 'game'; opponent: string; atHome: boolean };

export type ScheduleGame = {
  week: number;
  home: string;
  away: string;
};

export function canonScheduleAbbr(raw: string): string {
  const c = canonicalTeamAbbr(raw.trim().toUpperCase());
  return c ?? raw.trim().toUpperCase();
}

export function parseScheduleCell(raw: string): ScheduleCell {
  const v = raw.trim().toUpperCase();
  if (v === 'BYE') return { kind: 'bye' };
  if (v.startsWith('@')) {
    return { kind: 'game', opponent: canonScheduleAbbr(v.slice(1)), atHome: false };
  }
  return { kind: 'game', opponent: canonScheduleAbbr(v), atHome: true };
}

export function scheduleGameKey(week: number, away: string, home: string): string {
  return `${week}:${away}@${home}`;
}

function gamesFromGrid(): ScheduleGame[] {
  const seen = new Set<string>();
  const games: ScheduleGame[] = [];

  for (const [teamRaw, cells] of Object.entries(NFL_2026_SCHEDULE_GRID)) {
    const team = canonScheduleAbbr(teamRaw);
    cells.forEach((raw, index) => {
      const cell = parseScheduleCell(raw);
      if (cell.kind === 'bye') return;
      const week = index + 1;
      const home = cell.atHome ? team : cell.opponent;
      const away = cell.atHome ? cell.opponent : team;
      const key = scheduleGameKey(week, away, home);
      if (seen.has(key)) return;
      seen.add(key);
      games.push({ week, home, away });
    });
  }

  return games;
}

const ALL_GAMES = gamesFromGrid();

export function gamesForWeek(week: number): ScheduleGame[] {
  return ALL_GAMES.filter((g) => g.week === week).sort((a, b) =>
    a.away.localeCompare(b.away)
  );
}

export function allScheduleGames(): readonly ScheduleGame[] {
  return ALL_GAMES;
}

export function gridCellFor(team: string, week: number): ScheduleCell {
  const row = NFL_2026_SCHEDULE_GRID[team] ?? NFL_2026_SCHEDULE_GRID[team === 'WAS' ? 'WSH' : team];
  const raw = row?.[week - 1];
  if (!raw) return { kind: 'bye' };
  return parseScheduleCell(raw);
}

export function isValidPickemWeek(week: number): boolean {
  return Number.isInteger(week) && week >= 1 && week <= PICKEM_WEEKS;
}
