import { PICKEM_SEASON } from '@/constants/pickem';
import type { SeasonAwardsPicks } from '@/constants/seasonAwards';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { PlayoffBracketPicks } from '@/utils/seasonPlayoffBracket';
import {
  loadSeasonPredictionState,
  normalizeSeasonPredictionBoard,
  seasonBoardHasContent,
  type SeasonPredictionBoardState,
  type SeasonPredictionPicks,
} from '@/utils/seasonPredictionsStorage';

const TABLE = 'user_season_prediction_boards';

type BoardRow = {
  payload: unknown;
  updated_at?: string;
};

export type SeasonPredictionFetch =
  | { ok: true; board: SeasonPredictionBoardState | null; updatedAt: string | null }
  | { ok: false; error: string };

export function seasonBoardPickCount(board: SeasonPredictionBoardState): number {
  return Object.keys(board.picks).length;
}

/** Pick the fuller board (pick count, then awards/bracket content). */
export function preferRicherSeasonBoard(
  a: SeasonPredictionBoardState,
  b: SeasonPredictionBoardState
): SeasonPredictionBoardState {
  const aPicks = seasonBoardPickCount(a);
  const bPicks = seasonBoardPickCount(b);
  if (aPicks !== bPicks) return aPicks > bPicks ? a : b;
  const aContent = seasonBoardHasContent(a);
  const bContent = seasonBoardHasContent(b);
  if (aContent !== bContent) return aContent ? a : b;
  return a;
}

export async function fetchSeasonPredictionBoard(
  userId: string,
  season: number = PICKEM_SEASON
): Promise<SeasonPredictionFetch> {
  const { data, error } = await supabase
    .from(TABLE as never)
    .select('payload, updated_at')
    .eq('user_id', userId)
    .eq('season', season)
    .maybeSingle();

  if (error) {
    console.error('fetchSeasonPredictionBoard', error);
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: true, board: null, updatedAt: null };

  const row = data as BoardRow;
  const payload = row.payload;
  if (!payload || typeof payload !== 'object') {
    return { ok: true, board: null, updatedAt: row.updated_at ?? null };
  }
  return {
    ok: true,
    board: normalizeSeasonPredictionBoard(payload, season),
    updatedAt: row.updated_at ?? null,
  };
}

export async function saveSeasonPredictionBoard(
  userId: string,
  picks: SeasonPredictionPicks,
  bracket: PlayoffBracketPicks,
  awards: SeasonAwardsPicks,
  season: number = PICKEM_SEASON,
  opts?: { allowEmpty?: boolean }
): Promise<boolean> {
  const board: SeasonPredictionBoardState = { picks, bracket, awards };
  if (!opts?.allowEmpty && !seasonBoardHasContent(board)) {
    // Never clobber a cloud slate with an empty autosave (phone/incognito wipe).
    return true;
  }

  const payload = {
    season,
    picks,
    bracket,
    awards,
  };
  const { error } = await supabase.from(TABLE as never).upsert(
    {
      user_id: userId,
      season,
      payload: JSON.parse(JSON.stringify(payload)) as Json,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: 'user_id,season' }
  );
  if (error) {
    console.error('saveSeasonPredictionBoard', error);
    return false;
  }
  return true;
}

export async function clearSeasonPredictionBoard(
  userId: string,
  season: number = PICKEM_SEASON
): Promise<boolean> {
  const { error } = await supabase
    .from(TABLE as never)
    .delete()
    .eq('user_id', userId)
    .eq('season', season);
  if (error) {
    console.error('clearSeasonPredictionBoard', error);
    return false;
  }
  return true;
}

/**
 * Upload browser-local Season Predictions when the account has no richer cloud board.
 */
export async function migrateLocalSeasonPredictions(userId: string): Promise<boolean> {
  try {
    const season = PICKEM_SEASON;
    const local = loadSeasonPredictionState(season);
    if (!seasonBoardHasContent(local)) return false;

    const remote = await fetchSeasonPredictionBoard(userId, season);
    if (!remote.ok) return false;

    if (remote.board && seasonBoardPickCount(remote.board) >= seasonBoardPickCount(local)) {
      return false;
    }

    return saveSeasonPredictionBoard(
      userId,
      local.picks,
      local.bracket,
      local.awards,
      season
    );
  } catch (error) {
    console.error('Error migrating season predictions:', error);
    return false;
  }
}
