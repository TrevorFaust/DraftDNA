import type { RankedPlayer } from '@/types/database';

/** Merge my current rankings into community (excluding me) for live update when dragging. */
/** ADP = position in merged list so ADP always matches community rank (updates as user drags). */
export function mergeLiveCommunity(
  allPlayersData: any[],
  communityRaw: { player_id: string; avg_rank: number; sample_count: number }[],
  myRankedPlayers: RankedPlayer[]
): RankedPlayer[] {
  const playerById = new Map(allPlayersData.map((p) => [p.id, p]));
  const communityMap = new Map(communityRaw.map((r) => [r.player_id, { avg: Number(r.avg_rank), n: Number(r.sample_count) || 1 }]));
  const myRankMap = new Map(myRankedPlayers.map((p) => [p.id, p.rank]));

  const withNewAvg: { id: string; newAvg: number }[] = [];
  const seen = new Set<string>();
  for (const p of myRankedPlayers) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const entry = communityMap.get(p.id);
    const myRank = myRankMap.get(p.id) ?? 9999;
    const avg = entry ? entry.avg : 0;
    const n = entry ? entry.n : 0;
    const newAvg = n > 0 ? (avg * n + myRank) / (n + 1) : myRank;
    withNewAvg.push({ id: p.id, newAvg });
  }
  for (const r of communityRaw) {
    if (seen.has(r.player_id)) continue;
    seen.add(r.player_id);
    const myRank = myRankMap.get(r.player_id) ?? 9999;
    const n = Number(r.sample_count) || 1;
    const newAvg = (Number(r.avg_rank) * n + myRank) / (n + 1);
    withNewAvg.push({ id: r.player_id, newAvg });
  }
  withNewAvg.sort((a, b) => a.newAvg - b.newAvg);
  const result: RankedPlayer[] = [];
  for (let i = 0; i < withNewAvg.length; i++) {
    const p = playerById.get(withNewAvg[i].id);
    if (p) {
      const communityRank = i + 1;
      result.push({
        ...p,
        adp: communityRank,
        rank: communityRank,
      } as RankedPlayer);
    }
  }
  return result;
}

/** Reapply in-session draft order onto a freshly fetched list (new players append by rank). */
export function mergeRankingsWithDraftOrder(fetched: RankedPlayer[], draftIds: string[]): RankedPlayer[] {
  const byId = new Map(fetched.map((p) => [p.id, p]));
  const used = new Set<string>();
  const ordered: RankedPlayer[] = [];
  for (const id of draftIds) {
    const p = byId.get(id);
    if (p) {
      used.add(p.id);
      ordered.push({ ...p });
    }
  }
  const rest = fetched.filter((p) => !used.has(p.id)).sort((a, b) => a.rank - b.rank);
  for (const p of rest) ordered.push({ ...p });
  return ordered.map((p, i) => ({ ...p, rank: i + 1 }));
}
