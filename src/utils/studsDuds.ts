import type { RankedPlayer } from '@/types/database';

/**
 * Rankings studs/duds: only your ranks 1..N and community consensus ranks 1..N count.
 * Draft Stats uses {@link computeStudsDuds} with `compareMode: 'full'` instead.
 */
export const STUDS_DUDS_RANKINGS_WINDOW = 300;

/** Finalize saves the full UUID board; stale/partial leftover rows should not count. */
export const STUDS_DUDS_MIN_SAVED_POOL_FRACTION = 0.5;

type IdRow = { id: string } | string;

function rowId(row: IdRow): string {
  return typeof row === 'string' ? row : row.id;
}

/** True when both lists are the same player ids in the same order. */
export function playerIdOrderEquals(a: IdRow[], b: IdRow[]): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (rowId(a[i]) !== rowId(b[i])) return false;
  }
  return true;
}

/**
 * True when `myPlayers` is still the default seed (community or ADP), allowing a little
 * shuffle from D/ST / unmatched ids. A real ranking moves far more than 5% of slots.
 */
export function boardMatchesSeedOrder(
  myPlayers: IdRow[],
  seed: IdRow[],
  maxMismatchFraction = 0.05
): boolean {
  if (myPlayers.length === 0 || seed.length === 0) return false;
  if (myPlayers.length < 50 || seed.length < 50) {
    return playerIdOrderEquals(myPlayers, seed);
  }
  const seedIndex = new Map<string, number>();
  for (let i = 0; i < seed.length; i++) {
    seedIndex.set(rowId(seed[i]), i);
  }
  let compared = 0;
  let mismatches = 0;
  for (let i = 0; i < myPlayers.length; i++) {
    const si = seedIndex.get(rowId(myPlayers[i]));
    if (si == null) continue;
    compared++;
    if (si !== i) mismatches++;
  }
  if (compared < myPlayers.length * 0.8) return false;
  return mismatches / compared <= maxMismatchFraction;
}

/**
 * Saved ranking rows that barely overlap the current pool are leftover / other-season data,
 * not a ranking the user completed for this board.
 */
export function savedRankingCoversPool(
  savedPlayerIds: Iterable<string>,
  pool: Array<{ id: string }>,
  minFraction = STUDS_DUDS_MIN_SAVED_POOL_FRACTION
): boolean {
  const saved = savedPlayerIds instanceof Set ? savedPlayerIds : new Set(savedPlayerIds);
  if (saved.size === 0 || pool.length === 0) return false;
  let matched = 0;
  for (const p of pool) {
    if (saved.has(p.id)) matched++;
  }
  return matched / pool.length >= minFraction;
}

/**
 * Studs/duds need a real saved ranking that is not still the default community or ADP seed.
 * New users (and leftover ADP dumps) compare those two seeds and produce fake late-board diffs.
 */
export function shouldComputeStudsDuds(
  hasSavedRanking: boolean,
  myPlayers: RankedPlayer[],
  communityPlayers: RankedPlayer[],
  adpSeedOrder: IdRow[]
): boolean {
  if (!hasSavedRanking || myPlayers.length === 0 || communityPlayers.length === 0) {
    return false;
  }
  if (boardMatchesSeedOrder(myPlayers, communityPlayers)) return false;
  if (adpSeedOrder.length > 0 && boardMatchesSeedOrder(myPlayers, adpSeedOrder)) return false;
  return true;
}

export type StudsDudsCompareMode = 'window' | 'full';

export type StudDudEntry = {
  player: RankedPlayer;
  myRank: number;
  communityRank: number;
  diff: number;
};

export type ComputeStudsDudsOptions = {
  /**
   * `window` (default): Rankings-style — only ranks 1..N on your board and in community order.
   * `full`: Draft Stats — every row on your ordered board vs community; expects the same player pool
   * as `communityConsensusOrdered` (one entry per id in both lists).
   */
  compareMode?: StudsDudsCompareMode;
  /** Used only when `compareMode === 'window'` (default {@link STUDS_DUDS_RANKINGS_WINDOW}). */
  maxRankConsider?: number;
};

/**
 * Studs/duds vs pure community consensus order (same scale as `buildCommunityFromRpc` from
 * get_community_rankings rank_position, excluding the current user from the RPC).
 */
export function computeStudsDuds(
  myRankedPlayers: RankedPlayer[],
  communityConsensusOrdered: RankedPlayer[],
  options?: ComputeStudsDudsOptions
): { studs: StudDudEntry[]; duds: StudDudEntry[] } {
  const compareMode = options?.compareMode ?? 'window';
  const windowN = options?.maxRankConsider ?? STUDS_DUDS_RANKINGS_WINDOW;

  const sourceList =
    compareMode === 'full'
      ? myRankedPlayers
      : myRankedPlayers.slice(0, windowN);

  const diffs: StudDudEntry[] = sourceList.map((myPlayer) => {
    const myRank = myPlayer.rank;
    const idx = communityConsensusOrdered.findIndex((p) => p.id === myPlayer.id);
    const communityRank = idx + 1;
    return { player: myPlayer, myRank, communityRank, diff: communityRank - myRank };
  });

  const studs: StudDudEntry[] = [];
  const duds: StudDudEntry[] = [];
  for (const d of diffs) {
    if (d.communityRank < 1) continue;
    if (compareMode === 'window') {
      if (d.myRank > windowN || d.communityRank > windowN) continue;
    }
    if (d.diff > 0) studs.push(d);
    else if (d.diff < 0) duds.push(d);
  }
  studs.sort((a, b) => b.diff - a.diff);
  duds.sort((a, b) => a.diff - b.diff);
  return { studs, duds };
}
