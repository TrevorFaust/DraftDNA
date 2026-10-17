import { PICKEM_SEASON } from '@/constants/pickem';
import {
  emptySeasonAwardsPicks,
  normalizeSeasonAwardsPicks,
  type SeasonAwardsPicks,
} from '@/constants/seasonAwards';
import {
  allScheduleGames,
  canonScheduleAbbr,
  scheduleGameKey,
} from '@/constants/nfl2026ScheduleGrid';
import { officialResult } from '@/utils/nfl2026Results';
import {
  emptyConferenceBracketPicks,
  emptyPlayoffBracketPicks,
  type PlayoffBracketPicks,
} from '@/utils/seasonPlayoffBracket';

const STORAGE_PREFIX = 'season-predictions:v2';

export type SeasonPredictionPicks = Record<string, string>;

/** When a signed-in slate was saved. Guests keep this in memory for the visit only. */
export type SeasonPredictionMeta = {
  /** NFL week of the first game pick. 0 means before Week 1. */
  startedWeek: number | null;
  /** NFL week of the latest game-pick change. */
  lastAdjustedWeek: number | null;
  /** Schedule weeks whose picks are frozen on the account. */
  committedWeeks: number[];
  /** Signed-in lock after the season has started. */
  slateLocked: boolean;
  awardsCommitted: boolean;
  awardsWeek: number | null;
  playoffsCommitted: boolean;
  playoffsWeek: number | null;
};

export type SeasonPredictionBoardState = {
  picks: SeasonPredictionPicks;
  bracket: PlayoffBracketPicks;
  awards: SeasonAwardsPicks;
  meta: SeasonPredictionMeta;
};

type StoredPayload = {
  season: number;
  picks: SeasonPredictionPicks;
  bracket?: PlayoffBracketPicks;
  awards?: SeasonAwardsPicks;
  meta?: SeasonPredictionMeta;
};

export function emptySeasonPredictionMeta(): SeasonPredictionMeta {
  return {
    startedWeek: null,
    lastAdjustedWeek: null,
    committedWeeks: [],
    slateLocked: false,
    awardsCommitted: false,
    awardsWeek: null,
    playoffsCommitted: false,
    playoffsWeek: null,
  };
}

function clampStoredWeek(week: number): number | null {
  if (!Number.isInteger(week)) return null;
  if (week < 0 || week > 18) return null;
  return week;
}

export function normalizeSeasonPredictionMeta(raw: unknown): SeasonPredictionMeta {
  const empty = emptySeasonPredictionMeta();
  if (!raw || typeof raw !== 'object') return empty;
  const meta = raw as Record<string, unknown>;
  const committed = Array.isArray(meta.committedWeeks)
    ? [
        ...new Set(
          meta.committedWeeks.filter(
            (week): week is number => typeof week === 'number' && Number.isInteger(week) && week >= 1 && week <= 18
          )
        ),
      ].sort((a, b) => a - b)
    : [];
  return {
    startedWeek: typeof meta.startedWeek === 'number' ? clampStoredWeek(meta.startedWeek) : null,
    lastAdjustedWeek:
      typeof meta.lastAdjustedWeek === 'number' ? clampStoredWeek(meta.lastAdjustedWeek) : null,
    committedWeeks: committed,
    slateLocked: meta.slateLocked === true,
    awardsCommitted: meta.awardsCommitted === true,
    awardsWeek: typeof meta.awardsWeek === 'number' ? clampStoredWeek(meta.awardsWeek) : null,
    playoffsCommitted: meta.playoffsCommitted === true,
    playoffsWeek: typeof meta.playoffsWeek === 'number' ? clampStoredWeek(meta.playoffsWeek) : null,
  };
}

export function stampAdjustment(meta: SeasonPredictionMeta, nflWeek: number): SeasonPredictionMeta {
  const week = clampStoredWeek(nflWeek);
  if (week == null) return meta;
  if (meta.startedWeek != null && meta.lastAdjustedWeek === week) return meta;
  return {
    ...meta,
    startedWeek: meta.startedWeek ?? week,
    lastAdjustedWeek: week,
  };
}

export function withCommittedWeeks(
  meta: SeasonPredictionMeta,
  weeks: readonly number[],
  nflWeek: number
): SeasonPredictionMeta {
  const add = weeks.filter((week) => !meta.committedWeeks.includes(week));
  if (add.length === 0) return meta;
  const week = clampStoredWeek(nflWeek);
  return {
    ...meta,
    committedWeeks: [...meta.committedWeeks, ...add].sort((a, b) => a - b),
    startedWeek: meta.startedWeek ?? week,
    lastAdjustedWeek: week ?? meta.lastAdjustedWeek,
  };
}

function storageKey(season: number): string {
  return `${STORAGE_PREFIX}:${season}`;
}

function normalizeConferencePicks(raw: unknown): PlayoffBracketPicks['afc'] {
  const empty = emptyConferenceBracketPicks();
  if (!raw || typeof raw !== 'object') return empty;
  const c = raw as Record<string, unknown>;
  const wc = Array.isArray(c.wildCard) ? c.wildCard : [];
  const div = Array.isArray(c.divisional) ? c.divisional : [];
  return {
    wildCard: [normalizeAbbr(wc[0]), normalizeAbbr(wc[1]), normalizeAbbr(wc[2])],
    divisional: [normalizeAbbr(div[0]), normalizeAbbr(div[1])],
    conference: normalizeAbbr(c.conference),
  };
}

function normalizeBracket(raw: unknown): PlayoffBracketPicks {
  if (!raw || typeof raw !== 'object') return emptyPlayoffBracketPicks();
  const b = raw as Partial<PlayoffBracketPicks>;
  return {
    afc: normalizeConferencePicks(b.afc),
    nfc: normalizeConferencePicks(b.nfc),
    superBowl: normalizeAbbr(b.superBowl),
  };
}

function loadLegacyV1Picks(season: number): SeasonPredictionPicks {
  try {
    const raw = localStorage.getItem(`season-predictions:v1:${season}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { season?: number; picks?: Record<string, string> };
    if (parsed?.season !== season || !parsed.picks) return {};
    const picks: SeasonPredictionPicks = {};
    for (const [key, value] of Object.entries(parsed.picks)) {
      if (typeof value !== 'string') continue;
      const abbr = canonScheduleAbbr(value);
      if (abbr) picks[key] = abbr;
    }
    return picks;
  } catch {
    return {};
  }
}

function normalizeAbbr(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return canonScheduleAbbr(value) || null;
}

function emptyBoard(): SeasonPredictionBoardState {
  return {
    picks: {},
    bracket: emptyPlayoffBracketPicks(),
    awards: emptySeasonAwardsPicks(),
    meta: emptySeasonPredictionMeta(),
  };
}

/** Normalize local or cloud payload into a board for the given season. */
export function normalizeSeasonPredictionBoard(
  raw: unknown,
  season: number = PICKEM_SEASON
): SeasonPredictionBoardState {
  if (!raw || typeof raw !== 'object') return emptyBoard();
  const parsed = raw as Partial<StoredPayload> & { picks?: unknown };
  if (parsed.season != null && parsed.season !== season) return emptyBoard();
  if (!parsed.picks || typeof parsed.picks !== 'object') return emptyBoard();

  const picks: SeasonPredictionPicks = {};
  for (const [key, value] of Object.entries(parsed.picks as Record<string, unknown>)) {
    if (typeof value !== 'string') continue;
    const abbr = canonScheduleAbbr(value);
    if (abbr) picks[key] = abbr;
  }

  return {
    picks,
    bracket: normalizeBracket(parsed.bracket),
    awards: normalizeSeasonAwardsPicks(parsed.awards),
    meta: normalizeSeasonPredictionMeta(parsed.meta),
  };
}

export function seasonBoardHasContent(board: SeasonPredictionBoardState): boolean {
  if (Object.keys(board.picks).length > 0) return true;
  if (board.bracket.superBowl) return true;
  if (board.bracket.afc.conference || board.bracket.nfc.conference) return true;
  if (board.bracket.afc.wildCard.some(Boolean) || board.bracket.nfc.wildCard.some(Boolean)) {
    return true;
  }
  if (board.bracket.afc.divisional.some(Boolean) || board.bracket.nfc.divisional.some(Boolean)) {
    return true;
  }
  return Object.values(board.awards).some((pick) => pick != null);
}

export function loadSeasonPredictionState(season: number = PICKEM_SEASON): SeasonPredictionBoardState {
  try {
    const raw = localStorage.getItem(storageKey(season));
    if (!raw) {
      const legacyPicks = loadLegacyV1Picks(season);
      return {
        picks: legacyPicks,
        bracket: emptyPlayoffBracketPicks(),
        awards: emptySeasonAwardsPicks(),
        meta: emptySeasonPredictionMeta(),
      };
    }

    const parsed = JSON.parse(raw) as unknown;
    const board = normalizeSeasonPredictionBoard(parsed, season);
    if (Object.keys(board.picks).length === 0 && !seasonBoardHasContent(board)) {
      const legacyPicks = loadLegacyV1Picks(season);
      if (Object.keys(legacyPicks).length > 0) {
        return {
          picks: legacyPicks,
          bracket: emptyPlayoffBracketPicks(),
          awards: emptySeasonAwardsPicks(),
          meta: emptySeasonPredictionMeta(),
        };
      }
    }
    return board;
  } catch {
    return emptyBoard();
  }
}

export function loadSeasonPredictionPicks(season: number = PICKEM_SEASON): SeasonPredictionPicks {
  return loadSeasonPredictionState(season).picks;
}

export function saveSeasonPredictionState(
  picks: SeasonPredictionPicks,
  bracket: PlayoffBracketPicks,
  awards: SeasonAwardsPicks = emptySeasonAwardsPicks(),
  season: number = PICKEM_SEASON,
  meta: SeasonPredictionMeta = emptySeasonPredictionMeta()
): void {
  const payload: StoredPayload = { season, picks, bracket, awards, meta };
  localStorage.setItem(storageKey(season), JSON.stringify(payload));
}

export function saveSeasonPredictionPicks(
  picks: SeasonPredictionPicks,
  season: number = PICKEM_SEASON
): void {
  const { bracket, awards, meta } = loadSeasonPredictionState(season);
  saveSeasonPredictionState(picks, bracket, awards, season, meta);
}

export function clearSeasonPredictionPicks(season: number = PICKEM_SEASON): void {
  localStorage.removeItem(storageKey(season));
  localStorage.removeItem(`season-predictions:v1:${season}`);
}

/** Random-fill only games that are still unpicked and allowed by `canFill`. */
export function fillRemainingRandomPicks(
  existing: SeasonPredictionPicks,
  canFill: (game: { week: number; away: string; home: string }) => boolean = () => true
): { picks: SeasonPredictionPicks; filled: number } {
  const picks = { ...existing };
  let filled = 0;
  for (const game of allScheduleGames()) {
    const key = scheduleGameKey(game.week, game.away, game.home);
    if (officialResult(game.week, game.away, game.home)) continue;
    if (picks[key]) continue;
    if (!canFill(game)) continue;
    picks[key] = Math.random() < 0.5 ? game.home : game.away;
    filled += 1;
  }
  return { picks, filled };
}

export function totalSeasonGames(): number {
  return allScheduleGames().length;
}

export function seasonGamesForWeek(week: number) {
  return allScheduleGames().filter((g) => g.week === week);
}

export function weekPickProgress(picks: SeasonPredictionPicks, week: number): {
  total: number;
  picked: number;
  complete: boolean;
} {
  const games = seasonGamesForWeek(week);
  const picked = games.filter((g) => Boolean(picks[scheduleGameKey(g.week, g.away, g.home)])).length;
  return { total: games.length, picked, complete: games.length > 0 && picked === games.length };
}

export function seasonPickProgress(picks: SeasonPredictionPicks): {
  total: number;
  picked: number;
  complete: boolean;
  completedWeeks: number[];
} {
  const games = allScheduleGames();
  const picked = games.filter((g) => Boolean(picks[scheduleGameKey(g.week, g.away, g.home)])).length;
  const completedWeeks: number[] = [];
  for (let week = 1; week <= 18; week++) {
    if (weekPickProgress(picks, week).complete) completedWeeks.push(week);
  }
  return {
    total: games.length,
    picked,
    complete: games.length > 0 && picked === games.length,
    completedWeeks,
  };
}
