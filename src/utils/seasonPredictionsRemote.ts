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
};

export async function fetchSeasonPredictionBoard(
  userId: string,
  season: number = PICKEM_SEASON
): Promise<SeasonPredictionBoardState | null> {
  const { data, error } = await supabase
    .from(TABLE as never)
    .select('payload')
    .eq('user_id', userId)
    .eq('season', season)
    .maybeSingle();

  if (error || !data) return null;
  const payload = (data as BoardRow).payload;
  if (!payload || typeof payload !== 'object') return null;
  const board = normalizeSeasonPredictionBoard(payload, season);
  return seasonBoardHasContent(board) ? board : null;
}

export async function saveSeasonPredictionBoard(
  userId: string,
  picks: SeasonPredictionPicks,
  bracket: PlayoffBracketPicks,
  awards: SeasonAwardsPicks,
  season: number = PICKEM_SEASON
): Promise<boolean> {
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
  return !error;
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
  return !error;
}

/**
 * Upload browser-local Season Predictions when the account has no cloud board yet.
 * Does not overwrite an existing remote board.
 */
export async function migrateLocalSeasonPredictions(userId: string): Promise<boolean> {
  try {
    const season = PICKEM_SEASON;
    const remote = await fetchSeasonPredictionBoard(userId, season);
    if (remote) return false;

    const local = loadSeasonPredictionState(season);
    if (!seasonBoardHasContent(local)) return false;

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
