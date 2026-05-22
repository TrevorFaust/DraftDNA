/**
 * Merge community consensus rankings into a draft player pool (CPU + board order).
 * Matches by player_id and espn_id (cross-season UUID fixes).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RankedPlayer } from '@/types/database';
import { fetchRookiesRankings } from '@/utils/rookiesFilter';

export type CommunityRankingsBucket = {
  scoringFormat: string;
  leagueType: string;
  isSuperflex: boolean;
  rookiesOnly?: boolean;
};

type CommunityRow = {
  player_id: string;
  rank_position: number;
};

const SCORING_FALLBACKS: Array<'ppr' | 'half_ppr' | 'standard'> = ['ppr', 'half_ppr', 'standard'];

/**
 * Fetch community consensus for a league bucket. CPUs should exclude the drafter's own
 * user_rankings / guest_rankings so opponents draft from league consensus, not your board.
 */
export async function fetchCommunityRankingsForDraft(
  supabase: SupabaseClient,
  bucket: CommunityRankingsBucket,
  opts?: { excludeUserId?: string | null; excludeGuestSessionId?: string | null }
): Promise<CommunityRow[]> {
  if (bucket.rookiesOnly) {
    const rookiesRows = await fetchRookiesRankings({
      scoringFormat: bucket.scoringFormat,
      leagueType: bucket.leagueType,
      isSuperflex: bucket.isSuperflex,
    });
    return rookiesRows.map((r) => ({
      player_id: r.player_id,
      rank_position: Number(r.rank),
    }));
  }

  const rpcArgs = {
    p_scoring_format: bucket.scoringFormat,
    p_league_type: bucket.leagueType,
    p_is_superflex: bucket.isSuperflex,
    p_exclude_user_id: opts?.excludeUserId ?? null,
    p_exclude_guest_session_id: opts?.excludeGuestSessionId ?? null,
  };

  const runRpc = async (scoringFormat: string) => {
    const { data } = (await supabase.rpc('get_community_rankings' as never, {
      ...rpcArgs,
      p_scoring_format: scoringFormat,
    })) as { data: { player_id: string; rank_position: number }[] | null };
    if (!Array.isArray(data) || data.length === 0) return [];
    return data.map((r) => ({
      player_id: r.player_id,
      rank_position: Number(r.rank_position),
    }));
  };

  let rows = await runRpc(bucket.scoringFormat);
  if (rows.length > 0) return rows;

  for (const fmt of SCORING_FALLBACKS) {
    if (fmt === bucket.scoringFormat) continue;
    rows = await runRpc(fmt);
    if (rows.length > 0) return rows;
  }

  return [];
}

/** Map community player_id → espn_id for cross-season pool matching. */
async function loadEspnIdsForCommunity(
  supabase: SupabaseClient,
  communityRows: CommunityRow[]
): Promise<Map<string, string>> {
  const idToEspn = new Map<string, string>();
  const ids = [...new Set(communityRows.map((r) => r.player_id))];
  const batchSize = 200;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const { data } = await supabase.from('players').select('id, espn_id').in('id', batch);
    for (const row of data || []) {
      if (row.espn_id) idToEspn.set(row.id, String(row.espn_id));
    }
  }
  return idToEspn;
}

/**
 * Build ranked draft pool from community consensus + DB ADP for gaps.
 * CPUs and the available-player list both use this order (not the user's personal board).
 */
export async function buildDraftRankingsFromCommunity(
  supabase: SupabaseClient,
  allPlayersData: Array<Record<string, unknown> & { id: string; adp?: number | null; espn_id?: string | null }>,
  communityData: CommunityRow[]
): Promise<RankedPlayer[]> {
  if (communityData.length === 0) {
    const sorted = [...allPlayersData].sort(
      (a, b) => (Number(a.adp) || 9999) - (Number(b.adp) || 9999)
    );
    return sorted.map((p, index) => ({
      ...(p as RankedPlayer),
      adp: Number(p.adp) || index + 1,
      rank: index + 1,
    }));
  }

  const communityEspn = await loadEspnIdsForCommunity(supabase, communityData);
  const rankByEspn = new Map<string, number>();
  for (const r of communityData) {
    const espn = communityEspn.get(r.player_id);
    if (espn) rankByEspn.set(espn, r.rank_position);
  }

  const playerById = new Map(allPlayersData.map((p) => [p.id, p]));
  const poolByEspn = new Map<string, (typeof allPlayersData)[number]>();
  for (const p of allPlayersData) {
    if (p.espn_id) poolByEspn.set(String(p.espn_id), p);
  }

  const resolvePoolPlayer = (communityPlayerId: string): (typeof allPlayersData)[number] | undefined => {
    const direct = playerById.get(communityPlayerId);
    if (direct) return direct;
    const espn = communityEspn.get(communityPlayerId);
    if (espn) return poolByEspn.get(espn);
    return undefined;
  };

  const sortKeyByPoolId = new Map<string, number>();

  for (const r of communityData) {
    const poolPlayer = resolvePoolPlayer(r.player_id);
    if (!poolPlayer) continue;
    const existing = sortKeyByPoolId.get(poolPlayer.id);
    if (existing == null || r.rank_position < existing) {
      sortKeyByPoolId.set(poolPlayer.id, r.rank_position);
    }
  }

  for (const p of allPlayersData) {
    if (sortKeyByPoolId.has(p.id)) continue;
    const espn = p.espn_id ? String(p.espn_id) : null;
    const fromEspn = espn ? rankByEspn.get(espn) : undefined;
    if (fromEspn != null) {
      sortKeyByPoolId.set(p.id, fromEspn);
    } else {
      const dbAdp = Number(p.adp);
      sortKeyByPoolId.set(p.id, dbAdp > 0 && dbAdp < 9000 ? dbAdp : 9999);
    }
  }

  const sorted = [...allPlayersData].sort(
    (a, b) => (sortKeyByPoolId.get(a.id) ?? 9999) - (sortKeyByPoolId.get(b.id) ?? 9999)
  );

  return sorted.map((p, index) => {
    const sortKey = sortKeyByPoolId.get(p.id) ?? index + 1;
    return {
      ...(p as RankedPlayer),
      adp: sortKey,
      rank: index + 1,
    };
  });
}
