import { supabase } from '@/integrations/supabase/client';
import {
  PLAYER_POOL_CURRENT_SEASON,
  PLAYER_POOL_PRIOR_SEASON,
} from '@/constants/playerPoolSeason';
import { mergePlayerPoolAcrossSeasons } from '@/utils/playerDeduplication';

/** Columns needed by Rankings / Player Stats / draft boards — avoid `select('*')`. */
export const PLAYER_POOL_SELECT =
  'id, name, position, team, adp, bye_week, jersey_number, season, years_exp, espn_id, sleeper_id, created_at';

export const PLAYER_POOL_QUERY_KEY = [
  'player-pool',
  PLAYER_POOL_PRIOR_SEASON,
  PLAYER_POOL_CURRENT_SEASON,
] as const;

const PAGE_SIZE = 1000;
const STALE_MS = 30 * 60 * 1000;
const GC_MS = 60 * 60 * 1000;

export type PlayerPoolRow = {
  id: string;
  name: string;
  position: string;
  team: string | null;
  adp: number;
  bye_week: number | null;
  jersey_number: number | null;
  season: number | null;
  years_exp?: number | null;
  espn_id?: string | null;
  sleeper_id?: string | null;
  created_at: string;
};

/** Shared in-flight promise so concurrent page mounts share one paginated fetch. */
let sharedFetch: Promise<PlayerPoolRow[]> | null = null;
let sharedCache: { at: number; rows: PlayerPoolRow[] } | null = null;

export async function fetchMergedPlayerPool(): Promise<PlayerPoolRow[]> {
  if (sharedCache && Date.now() - sharedCache.at < STALE_MS) {
    return sharedCache.rows;
  }
  if (sharedFetch) return sharedFetch;

  sharedFetch = (async () => {
    let allPlayersData: PlayerPoolRow[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('players')
        .select(PLAYER_POOL_SELECT)
        .in('season', [PLAYER_POOL_PRIOR_SEASON, PLAYER_POOL_CURRENT_SEASON])
        .order('adp', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allPlayersData = allPlayersData.concat(data as PlayerPoolRow[]);
        from += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    const merged = mergePlayerPoolAcrossSeasons(
      allPlayersData,
      PLAYER_POOL_PRIOR_SEASON,
      PLAYER_POOL_CURRENT_SEASON
    ) as PlayerPoolRow[];

    sharedCache = { at: Date.now(), rows: merged };
    return merged;
  })().finally(() => {
    sharedFetch = null;
  });

  return sharedFetch;
}

export function getPlayerPoolCacheTtl() {
  return { staleTime: STALE_MS, gcTime: GC_MS };
}
