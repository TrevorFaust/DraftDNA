import type { RankedPlayer } from '@/types/database';

/**
 * Rankings studs/duds: only your ranks 1..N and community consensus ranks 1..N count.
 * Draft Stats uses {@link computeStudsDuds} with `compareMode: 'full'` instead.
 */
export const STUDS_DUDS_RANKINGS_WINDOW = 300;

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
