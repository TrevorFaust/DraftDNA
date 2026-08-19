import type { RankedPlayer } from '@/types/database';
import { adpBucketKey, type AdpSourceBoardFile } from '@/constants/adpRankingSources';

const boardCache = new Map<string, Promise<AdpSourceBoardFile | null>>();

export function fetchAdpSourceBoard(bucketKey: string): Promise<AdpSourceBoardFile | null> {
  const existing = boardCache.get(bucketKey);
  if (existing) return existing;
  const pending = fetch(`/adp-sources/${bucketKey}.json`)
    .then((res) => (res.ok ? (res.json() as Promise<AdpSourceBoardFile>) : null))
    .catch(() => null);
  boardCache.set(bucketKey, pending);
  return pending;
}

export function fetchAdpSourceBoardForBucket(bucket: {
  scoringFormat: string;
  leagueType: string;
  isSuperflex: boolean;
  rookiesOnly?: boolean;
}): Promise<AdpSourceBoardFile | null> {
  return fetchAdpSourceBoard(adpBucketKey(bucket));
}

/** Source order first, then anyone still on the consensus board. */
export function orderPlayersBySourceBoard<T extends { id: string; adp?: number | null }>(
  community: T[],
  sourceRows: Array<{ id: string; adp: number }> | null | undefined
): T[] {
  if (!sourceRows?.length) return community;
  const byId = new Map(community.map((p) => [p.id, p]));
  const used = new Set<string>();
  const out: T[] = [];
  for (const row of sourceRows) {
    const player = byId.get(row.id);
    if (!player || used.has(player.id)) continue;
    used.add(player.id);
    out.push({ ...player, adp: row.adp });
  }
  for (const player of community) {
    if (used.has(player.id)) continue;
    out.push(player);
  }
  return out;
}

export function sourceRowsForBoard(
  board: AdpSourceBoardFile | null | undefined,
  source: string | null | undefined
): Array<{ id: string; adp: number }> | null {
  if (!board) return null;
  const id = source === 'community' || !source ? 'consensus' : source;
  if (id === 'yours' || id === 'mine') return null;
  if (id === 'consensus') return board.community;
  return board.boards[id] ?? null;
}

export function applySourceAdpToPlayers(
  players: RankedPlayer[],
  sourceRows: Array<{ id: string; adp: number }> | null | undefined
): RankedPlayer[] {
  const ordered = orderPlayersBySourceBoard(players, sourceRows);
  return ordered.map((p, i) => ({ ...p, rank: i + 1, adp: i + 1 }));
}

export function applyNamedBoardToPlayers(
  players: RankedPlayer[],
  board: AdpSourceBoardFile | null | undefined,
  source: string | null | undefined
): RankedPlayer[] {
  const rows = sourceRowsForBoard(board, source);
  if (!rows?.length) return players;
  return applySourceAdpToPlayers(players, rows);
}

export function reorderIdsByBoard<T extends { id: string }>(
  existing: T[],
  sourceRows: Array<{ id: string; adp: number }> | null | undefined
): T[] {
  if (!sourceRows?.length) return existing;
  const byId = new Map(existing.map((p) => [p.id, p]));
  const used = new Set<string>();
  const out: T[] = [];
  for (const row of sourceRows) {
    const hit = byId.get(row.id);
    if (!hit || used.has(hit.id)) continue;
    used.add(hit.id);
    out.push(hit);
  }
  for (const p of existing) {
    if (used.has(p.id)) continue;
    out.push(p);
  }
  return out;
}
