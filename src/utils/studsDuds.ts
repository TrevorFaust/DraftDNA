import type { RankedPlayer } from '@/types/database';

/**
 * Rankings studs/duds: players in your top N or community top N.
 * Draft Stats uses {@link computeStudsDuds} with `compareMode: 'full'` instead.
 */
export const STUDS_DUDS_RANKINGS_WINDOW = 300;

/** Ignore 1–4 spot jitter from live merge, D/ST holes, and reset/finalize of the default board. */
export const STUDS_DUDS_MIN_ABS_DIFF = 5;

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
  const { studs, duds } = computeStudsDuds(myPlayers, communityPlayers, {
    compareMode: 'window',
    maxRankConsider: STUDS_DUDS_RANKINGS_WINDOW,
  });
  return studs.length > 0 || duds.length > 0;
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
  /** Drop tiny gaps that are not a real take (default {@link STUDS_DUDS_MIN_ABS_DIFF}). */
  minAbsDiff?: number;
};

/**
 * Studs/duds vs community order on the shared player pool.
 * Ranks in the UI stay the board numbers; takes are measured after dropping
 * ids that exist on only one list so missing players cannot create a +60 shift.
 */
export function computeStudsDuds(
  myRankedPlayers: RankedPlayer[],
  communityConsensusOrdered: RankedPlayer[],
  options?: ComputeStudsDudsOptions
): { studs: StudDudEntry[]; duds: StudDudEntry[] } {
  const compareMode = options?.compareMode ?? 'window';
  const windowN = options?.maxRankConsider ?? STUDS_DUDS_RANKINGS_WINDOW;
  const minAbsDiff = options?.minAbsDiff ?? STUDS_DUDS_MIN_ABS_DIFF;

  const myIdSet = new Set(myRankedPlayers.map((p) => p.id));
  const communityIdSet = new Set(communityConsensusOrdered.map((p) => p.id));

  const myShared = myRankedPlayers.filter((p) => communityIdSet.has(p.id));
  const communityShared = communityConsensusOrdered.filter((p) => myIdSet.has(p.id));

  const alignedMyById = new Map<string, number>();
  for (let i = 0; i < myShared.length; i++) alignedMyById.set(myShared[i].id, i + 1);
  const alignedCommunityById = new Map<string, number>();
  for (let i = 0; i < communityShared.length; i++) {
    alignedCommunityById.set(communityShared[i].id, i + 1);
  }

  const studs: StudDudEntry[] = [];
  const duds: StudDudEntry[] = [];
  for (const player of myShared) {
    const alignedMy = alignedMyById.get(player.id);
    const alignedCommunity = alignedCommunityById.get(player.id);
    if (alignedMy == null || alignedCommunity == null) continue;
    if (compareMode === 'window' && (alignedMy > windowN || alignedCommunity > windowN)) continue;
    const alignedDiff = alignedCommunity - alignedMy;
    if (Math.abs(alignedDiff) < minAbsDiff) continue;
    const entry: StudDudEntry = {
      player,
      myRank: alignedMy,
      communityRank: alignedCommunity,
      diff: alignedDiff,
    };
    if (alignedDiff > 0) studs.push(entry);
    else duds.push(entry);
  }
  studs.sort((a, b) => b.diff - a.diff);
  duds.sort((a, b) => a.diff - b.diff);
  return { studs, duds };
}
