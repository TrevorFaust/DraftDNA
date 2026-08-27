import { supabase } from '@/integrations/supabase/client';
import { PICKEM_SEASON } from '@/constants/pickem';
import type { PickemWeekBoard } from '@/types/leagueSocial';

type SyncResult = {
  success?: boolean;
  season?: number;
  week?: number;
  upserted?: number;
  error?: string;
};

export async function syncNflScoreboard(opts?: { season?: number; week?: number; full?: boolean }): Promise<SyncResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Sign in to refresh the schedule');
  }

  const { data, error } = await supabase.functions.invoke<SyncResult>('sync-nfl-scoreboard', {
    body: {
      season: opts?.season ?? PICKEM_SEASON,
      week: opts?.week,
      full: opts?.full,
    },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data ?? {};
}

export async function pickemGetWeek(
  leagueId: string,
  week?: number | null,
  season: number = PICKEM_SEASON
): Promise<PickemWeekBoard> {
  const { data, error } = await supabase.rpc('pickem_get_week' as never, {
    p_league_id: leagueId,
    p_season: season,
    p_week: week ?? null,
  });
  if (error) throw error;
  const board = data as PickemWeekBoard;
  return {
    season: board.season,
    week: board.week,
    games: board.games ?? [],
    standings: board.standings ?? [],
  };
}

export async function pickemSetPick(leagueId: string, gameId: string, pickedAbbr: string): Promise<void> {
  const { error } = await supabase.rpc('pickem_set_pick' as never, {
    p_league_id: leagueId,
    p_game_id: gameId,
    p_picked_abbr: pickedAbbr,
  });
  if (error) throw error;
}

export type WeekPickInput = {
  away: string;
  home: string;
  picked: string;
  kickoff_at?: string | null;
};

export type WeekPicksResult = {
  saved: number;
  skipped_locked: number;
};

export async function pickemSetWeekPicks(
  leagueId: string,
  week: number,
  picks: WeekPickInput[],
  season: number = PICKEM_SEASON
): Promise<WeekPicksResult> {
  const { data, error } = await supabase.rpc('pickem_set_week_picks' as never, {
    p_league_id: leagueId,
    p_season: season,
    p_week: week,
    p_picks: picks,
  });
  if (error) throw error;
  const result = data as WeekPicksResult | null;
  return {
    saved: result?.saved ?? 0,
    skipped_locked: result?.skipped_locked ?? 0,
  };
}
