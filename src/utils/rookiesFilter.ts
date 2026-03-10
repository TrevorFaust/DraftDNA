import { supabase } from '@/integrations/supabase/client';

export interface RookieRankRow {
  player_id: string;
  name: string;
  position: string;
  rank: number;
}

export interface RookiesFilterParams {
  scoringFormat: string;
  leagueType: string;
  isSuperflex: boolean;
}

/**
 * Fetches rookies-only rankings via get_rookies_rankings RPC.
 * Returns players that exist in the DB and match baseline_rookies for the bucket.
 * Excludes D/ST and K.
 */
export async function fetchRookiesRankings(
  params: RookiesFilterParams
): Promise<RookieRankRow[]> {
  const { data, error } = (await supabase.rpc('get_rookies_rankings' as any, {
    p_scoring_format: params.scoringFormat,
    p_league_type: params.leagueType,
    p_is_superflex: params.isSuperflex,
  })) as { data: RookieRankRow[] | null; error: any };

  if (error || !data || !Array.isArray(data)) {
    return [];
  }
  return data;
}

/**
 * Filters players to rookies-only by player_id set from get_rookies_rankings.
 */
export function filterPlayersToRookieIds<T extends { id: string }>(
  players: T[],
  rookiePlayerIds: Set<string>
): T[] {
  return players.filter((p) => rookiePlayerIds.has(p.id));
}
