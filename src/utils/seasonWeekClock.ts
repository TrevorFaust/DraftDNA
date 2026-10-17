import { PICKEM_WEEKS } from '@/constants/pickem';
import { NFL_2026_KICKOFFS } from '@/constants/nfl2026Kickoffs.generated';
import { gamesForWeek, scheduleGameKey, type ScheduleGame } from '@/constants/nfl2026ScheduleGrid';
import { officialResult, weekIsFinal } from '@/utils/nfl2026Results';

type Picks = Record<string, string>;

export function gameKickoffMs(week: number, away: string, home: string): number | null {
  const iso = NFL_2026_KICKOFFS[scheduleGameKey(week, away, home)];
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

export function hasGameKickedOff(
  week: number,
  away: string,
  home: string,
  now = Date.now()
): boolean {
  const ms = gameKickoffMs(week, away, home);
  return ms != null && ms <= now;
}

/** A week has passed once every game on that slate has kicked off. */
export function isWeekPassed(week: number, now = Date.now()): boolean {
  const games = gamesForWeek(week);
  if (games.length === 0) return false;
  return games.every((game) => hasGameKickedOff(week, game.away, game.home, now));
}

/**
 * NFL week used for the "started in week X" line.
 * 0 before the first kickoff, 1–18 while that week still has a game ahead.
 */
export function nflPredictionWeek(now = Date.now()): number {
  const opener = gamesForWeek(1)
    .map((game) => gameKickoffMs(1, game.away, game.home))
    .filter((ms): ms is number => ms != null);
  if (opener.length > 0 && now < Math.min(...opener)) return 0;
  for (let week = 1; week <= PICKEM_WEEKS; week++) {
    if (!isWeekPassed(week, now)) return week;
  }
  return PICKEM_WEEKS;
}

export function seasonHasStarted(now = Date.now()): boolean {
  return nflPredictionWeek(now) > 0;
}

export type SlateLockState = {
  slateLocked: boolean;
  startedWeek: number | null;
  committedWeeks: readonly number[];
};

/**
 * Before Week 1, the slate locks as games kick off, and a board started
 * before Week 1 locks once the season starts. After the season has started,
 * a new board stays open until the user locks it in.
 */
export function slateIsLocked(meta: SlateLockState, now = Date.now()): boolean {
  if (meta.slateLocked) return true;
  if (seasonHasStarted(now) && meta.startedWeek === 0) return true;
  return false;
}

export function gameIsEditable(
  meta: SlateLockState,
  week: number,
  away: string,
  home: string,
  now = Date.now()
): boolean {
  if (officialResult(week, away, home)) return false;
  if (slateIsLocked(meta, now)) return false;
  if (meta.committedWeeks.includes(week)) return false;
  if (!seasonHasStarted(now) && hasGameKickedOff(week, away, home, now)) return false;
  return true;
}

/** Games that still need a pick. Final scores are already counted. Before Week 1, kickoff also closes a game. */
export function openGamesForWeek(week: number, now = Date.now()): ScheduleGame[] {
  return gamesForWeek(week).filter((game) => {
    if (officialResult(game.week, game.away, game.home)) return false;
    if (!seasonHasStarted(now) && hasGameKickedOff(week, game.away, game.home, now)) return false;
    return true;
  });
}

export function isOpenWeekComplete(picks: Picks, week: number, now = Date.now()): boolean {
  if (weekIsFinal(week)) return false;
  const open = openGamesForWeek(week, now);
  if (open.length === 0) return false;
  return open.every((game) => Boolean(picks[scheduleGameKey(game.week, game.away, game.home)]));
}

export function openWeekProgress(
  picks: Picks,
  week: number,
  now = Date.now()
): { total: number; picked: number; complete: boolean } {
  const open = openGamesForWeek(week, now);
  const picked = open.filter((game) =>
    Boolean(picks[scheduleGameKey(game.week, game.away, game.home)])
  ).length;
  return {
    total: open.length,
    picked,
    complete: open.length > 0 && picked === open.length,
  };
}

export type SlateStatus = {
  passedWeeks: number[];
  completedWeeks: number[];
  total: number;
  picked: number;
  complete: boolean;
};

/** Progress counts games that still need a pick. Weeks with a final score do not block the slate. */
export function slateStatus(picks: Picks, now = Date.now()): SlateStatus {
  const passedWeeks: number[] = [];
  const completedWeeks: number[] = [];
  let total = 0;
  let picked = 0;

  for (let week = 1; week <= PICKEM_WEEKS; week++) {
    if (weekIsFinal(week)) {
      passedWeeks.push(week);
      continue;
    }
    const open = openGamesForWeek(week, now);
    const weekPicked = open.filter((game) =>
      Boolean(picks[scheduleGameKey(game.week, game.away, game.home)])
    ).length;
    total += open.length;
    picked += weekPicked;
    if (open.length > 0 && weekPicked === open.length) completedWeeks.push(week);
  }

  return {
    passedWeeks,
    completedWeeks,
    total,
    picked,
    complete: total > 0 && picked === total,
  };
}

export function firstOpenWeek(_now = Date.now()): number {
  for (let week = 1; week <= PICKEM_WEEKS; week++) {
    if (!weekIsFinal(week)) return week;
  }
  return PICKEM_WEEKS;
}

export function firstEditableWeek(
  committedWeeks: readonly number[],
  now = Date.now(),
  slateLocked = false
): number {
  for (let week = 1; week <= PICKEM_WEEKS; week++) {
    if (weekIsFinal(week)) continue;
    if (slateLocked || committedWeeks.includes(week)) continue;
    return week;
  }
  return firstOpenWeek(now);
}

export function formatWeekList(weeks: readonly number[]): string {
  if (weeks.length === 0) return '';
  const sorted = [...weeks].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
      continue;
    }
    ranges.push(start === end ? `Week ${start}` : `Weeks ${start}–${end}`);
    start = end = sorted[i];
  }
  ranges.push(start === end ? `Week ${start}` : `Weeks ${start}–${end}`);
  if (ranges.length === 1) return ranges[0];
  if (ranges.length === 2) return `${ranges[0]} and ${ranges[1]}`;
  return `${ranges.slice(0, -1).join(', ')}, and ${ranges[ranges.length - 1]}`;
}

export function adjustmentWeekPhrase(week: number | null): string | null {
  if (week == null) return null;
  if (week <= 0) return 'before Week 1';
  return `Week ${week}`;
}
