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
import {
  emptyConferenceBracketPicks,
  emptyPlayoffBracketPicks,
  type PlayoffBracketPicks,
} from '@/utils/seasonPlayoffBracket';

const STORAGE_PREFIX = 'season-predictions:v2';

export type SeasonPredictionPicks = Record<string, string>;

export type SeasonPredictionBoardState = {
  picks: SeasonPredictionPicks;
  bracket: PlayoffBracketPicks;
  awards: SeasonAwardsPicks;
};

type StoredPayload = {
  season: number;
  picks: SeasonPredictionPicks;
  bracket?: PlayoffBracketPicks;
  awards?: SeasonAwardsPicks;
};

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
  season: number = PICKEM_SEASON
): void {
  const payload: StoredPayload = { season, picks, bracket, awards };
  localStorage.setItem(storageKey(season), JSON.stringify(payload));
}

export function saveSeasonPredictionPicks(
  picks: SeasonPredictionPicks,
  season: number = PICKEM_SEASON
): void {
  const { bracket, awards } = loadSeasonPredictionState(season);
  saveSeasonPredictionState(picks, bracket, awards, season);
}

export function clearSeasonPredictionPicks(season: number = PICKEM_SEASON): void {
  localStorage.removeItem(storageKey(season));
  localStorage.removeItem(`season-predictions:v1:${season}`);
}

/** Random-fill only games that are still unpicked. Returns how many were filled. */
export function fillRemainingRandomPicks(
  existing: SeasonPredictionPicks
): { picks: SeasonPredictionPicks; filled: number } {
  const picks = { ...existing };
  let filled = 0;
  for (const game of allScheduleGames()) {
    const key = scheduleGameKey(game.week, game.away, game.home);
    if (picks[key]) continue;
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
