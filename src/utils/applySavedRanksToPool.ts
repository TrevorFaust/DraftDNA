/**
 * Apply saved user_rankings rows onto the current player pool.
 * Matches by player UUID first, then espn_id so cross-season id flips
 * (2025 → 2026) do not drop vets to the bottom of the board.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const PAGE_SIZE = 1000;
const ESPN_BATCH = 200;

export async function loadEspnIdsByPlayerId(
  supabase: SupabaseClient,
  playerIds: string[]
): Promise<Map<string, string>> {
  const idToEspn = new Map<string, string>();
  const unique = [...new Set(playerIds.filter(Boolean))];
  for (let i = 0; i < unique.length; i += ESPN_BATCH) {
    const batch = unique.slice(i, i + ESPN_BATCH);
    const { data, error } = await supabase.from('players').select('id, espn_id').in('id', batch);
    if (error) throw error;
    for (const row of data || []) {
      if (row.espn_id) idToEspn.set(row.id, String(row.espn_id));
    }
  }
  return idToEspn;
}

/** Paginate a PostgREST query that supports .range(from, to). */
export async function fetchAllRankRows<T>(
  runPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await runPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

type SavedRankRow = { player_id: string; rank: number };

/**
 * Resolve saved ranks onto pool player ids (UUID, then espn_id).
 * Returns Map<poolPlayerId, rank>.
 */
export async function buildPoolRankMapFromSavedRows(
  supabase: SupabaseClient,
  savedRows: SavedRankRow[],
  pool: { id: string; espn_id?: string | null }[]
): Promise<Map<string, number>> {
  const bySavedId = new Map<string, number>();
  for (const r of savedRows) {
    const rank = Number(r.rank);
    if (!Number.isFinite(rank)) continue;
    const prev = bySavedId.get(r.player_id);
    if (prev == null || rank < prev) bySavedId.set(r.player_id, rank);
  }
  if (bySavedId.size === 0) return new Map();

  const poolById = new Set(pool.map((p) => p.id));
  const idsNeedingEspn = [...bySavedId.keys()].filter((id) => !poolById.has(id));
  const savedEspn = await loadEspnIdsByPlayerId(supabase, idsNeedingEspn);

  const rankByEspn = new Map<string, number>();
  for (const [playerId, rank] of bySavedId) {
    const espn = savedEspn.get(playerId);
    if (!espn) continue;
    const prev = rankByEspn.get(espn);
    if (prev == null || rank < prev) rankByEspn.set(espn, rank);
  }

  const out = new Map<string, number>();
  for (const p of pool) {
    const direct = bySavedId.get(p.id);
    if (direct != null) {
      out.set(p.id, direct);
      continue;
    }
    const espn = p.espn_id != null ? String(p.espn_id) : null;
    if (espn == null) continue;
    const viaEspn = rankByEspn.get(espn);
    if (viaEspn != null) out.set(p.id, viaEspn);
  }
  return out;
}

/**
 * Same as buildPoolRankMapFromSavedRows but keeps every rank sample per pool id
 * (for All-leagues averaging across leagues).
 */
export async function buildPoolRankSamplesFromSavedRows(
  supabase: SupabaseClient,
  savedRows: SavedRankRow[],
  pool: { id: string; espn_id?: string | null }[]
): Promise<Map<string, number[]>> {
  const samplesBySavedId = new Map<string, number[]>();
  for (const r of savedRows) {
    const rank = Number(r.rank);
    if (!Number.isFinite(rank)) continue;
    const list = samplesBySavedId.get(r.player_id) ?? [];
    list.push(rank);
    samplesBySavedId.set(r.player_id, list);
  }
  if (samplesBySavedId.size === 0) return new Map();

  const poolIds = new Set(pool.map((p) => p.id));
  const poolIdByEspn = new Map<string, string>();
  for (const p of pool) {
    if (p.espn_id != null) poolIdByEspn.set(String(p.espn_id), p.id);
  }
  const idsNeedingEspn = [...samplesBySavedId.keys()].filter((id) => !poolIds.has(id));
  const savedEspn = await loadEspnIdsByPlayerId(supabase, idsNeedingEspn);

  const out = new Map<string, number[]>();
  const push = (poolId: string, ranks: number[]) => {
    const list = out.get(poolId) ?? [];
    list.push(...ranks);
    out.set(poolId, list);
  };

  for (const [savedId, ranks] of samplesBySavedId) {
    if (poolIds.has(savedId)) {
      push(savedId, ranks);
      continue;
    }
    const espn = savedEspn.get(savedId);
    if (!espn) continue;
    const poolId = poolIdByEspn.get(espn);
    if (poolId) push(poolId, ranks);
  }
  return out;
}
