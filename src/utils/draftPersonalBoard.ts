/**
 * Personal rankings + tier cuts for mock draft UIs.
 * CPUs / frozen boards stay on community order; this overlay is display-only.
 */

import { supabase } from '@/integrations/supabase/client';
import { buildPositionRankFromList } from '@/utils/positionAdpRank';
import {
  buildOverallTierBreakBeforeIds,
  eligiblePositionTierCuts,
  getCutsForPosition,
  getTierNumber,
  mergePositionTierCuts,
  type PositionTierCuts,
} from '@/utils/positionTiers';
import { fetchCommunityRankingTiers, fetchUserRankingTiers } from '@/utils/rankingTiersDb';
import {
  getRankingTiersStorageKey,
  rankingTiersLocalStorage,
} from '@/utils/rankingTiersStorage';
import {
  applyUserRankingsBucketMatch,
  userRankingBucketFromDisplayBucket,
  type UserRankingBucketDb,
} from '@/utils/userRankingsBucket';
import {
  getOrCreateGuestSessionId,
  getRankingsDraftSessionStorageKey,
  rankingsDraftSessionStorage,
  tempRankingsStorage,
} from '@/utils/temporaryStorage';

export type DraftDisplayBucket = {
  scoringFormat: string;
  leagueType: string;
  isSuperflex: boolean;
  rookiesOnly: boolean;
};

export function draftBucketKey(b: DraftDisplayBucket): string {
  return `${b.scoringFormat}/${b.leagueType}/${b.isSuperflex}/${Boolean(b.rookiesOnly)}`;
}

export type PersonalDraftPlayerMeta = {
  overallRank: number;
  posRank: number | null;
  tier: number | null;
};

export type PersonalDraftBoardOverlay = {
  myOverallRankById: Map<string, number>;
  myPosRankById: Map<string, number>;
  positionTierCuts: PositionTierCuts;
  /** True when a saved/session personal order was found (not just community fallback). */
  hasPersonalRankings: boolean;
  /** True when tier cuts came from community consensus (no personal breaks for this bucket). */
  usesCommunityTiers: boolean;
  /**
   * Precomputed per-player display fields for the draft list.
   * Built once when the overlay loads — do not recompute tiers per render/pick.
   */
  metaById: Map<string, PersonalDraftPlayerMeta>;
  /**
   * Fixed All-Players tier breaks from the full personal board at load.
   * One player id per tier number (first Tier 2, first Tier 3, …).
   * Never recomputed from whoever is currently at the top of available.
   */
  allViewBreakBeforeIds: Set<string>;
};

type PoolPlayer = { id: string; position: string };

function densifyOverallRanks(orderedIds: string[]): Map<string, number> {
  const map = new Map<string, number>();
  orderedIds.forEach((id, i) => map.set(id, i + 1));
  return map;
}

function orderFromRankMap(
  poolIds: string[],
  rankById: Map<string, number>
): string[] {
  const poolIndex = new Map(poolIds.map((id, i) => [id, i]));
  return [...poolIds].sort((a, b) => {
    const ra = rankById.get(a) ?? Number.POSITIVE_INFINITY;
    const rb = rankById.get(b) ?? Number.POSITIVE_INFINITY;
    if (ra !== rb) return ra - rb;
    return (poolIndex.get(a) ?? 0) - (poolIndex.get(b) ?? 0);
  });
}

function orderFromSessionIds(poolIds: string[], sessionIds: string[]): string[] {
  const poolSet = new Set(poolIds);
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of sessionIds) {
    if (!poolSet.has(id) || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  for (const id of poolIds) {
    if (seen.has(id)) continue;
    ordered.push(id);
  }
  return ordered;
}

async function fetchSignedInRankMap(params: {
  userId: string;
  leagueId: string | null;
  bucket: UserRankingBucketDb;
}): Promise<Map<string, number> | null> {
  const { userId, leagueId, bucket } = params;

  if (leagueId) {
    const q = applyUserRankingsBucketMatch(
      supabase
        .from('user_rankings')
        .select('player_id, rank')
        .eq('user_id', userId)
        .eq('league_id', leagueId),
      bucket
    );
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) return null;
    return new Map(data.map((r) => [r.player_id as string, Number(r.rank)]));
  }

  // No league (quick mock / all-leagues style): prefer null-league row for bucket.
  const qNull = applyUserRankingsBucketMatch(
    supabase
      .from('user_rankings')
      .select('player_id, rank')
      .eq('user_id', userId)
      .is('league_id', null),
    bucket
  );
  const { data: nullRows, error: nullErr } = await qNull;
  if (nullErr) throw nullErr;
  if (nullRows?.length) {
    return new Map(nullRows.map((r) => [r.player_id as string, Number(r.rank)]));
  }

  // Fall back to any league rows in this bucket (average ranks across leagues).
  const qAny = applyUserRankingsBucketMatch(
    supabase
      .from('user_rankings')
      .select('player_id, rank')
      .eq('user_id', userId)
      .not('league_id', 'is', null),
    bucket
  );
  const { data: anyRows, error: anyErr } = await qAny;
  if (anyErr) throw anyErr;
  if (!anyRows?.length) return null;

  const buckets = new Map<string, number[]>();
  for (const r of anyRows) {
    const id = r.player_id as string;
    const list = buckets.get(id) ?? [];
    list.push(Number(r.rank));
    buckets.set(id, list);
  }
  const avg = new Map<string, number>();
  buckets.forEach((ranks, id) => {
    avg.set(id, ranks.reduce((s, n) => s + n, 0) / ranks.length);
  });
  return avg;
}

async function loadPositionTierCuts(params: {
  userId: string | null;
  guestSessionId: string | null;
  leagueId: string | null;
  bucket: DraftDisplayBucket;
  bucketKey: string;
}): Promise<PositionTierCuts> {
  const localKey = getRankingTiersStorageKey({
    userId: params.userId,
    guestSessionId: params.guestSessionId,
    leagueId: params.leagueId,
    bucketKey: params.bucketKey,
  });
  const local = eligiblePositionTierCuts(rankingTiersLocalStorage.get(localKey));

  if (!params.userId) return local;

  try {
    const remote = await fetchUserRankingTiers({
      userId: params.userId,
      leagueId: params.leagueId,
      bucket: userRankingBucketFromDisplayBucket(params.bucket),
    });
    return mergePositionTierCuts(remote, local);
  } catch (err) {
    console.error('[draftPersonalBoard] Failed to load ranking tiers:', err);
    return local;
  }
}

/**
 * Load the viewer's personal board order + tier cuts for a mock draft bucket.
 * Falls back to community pool order when no personal rankings exist (tiers still apply).
 */
export async function loadPersonalDraftBoardOverlay(params: {
  userId: string | null;
  leagueId: string | null;
  bucket: DraftDisplayBucket;
  poolPlayers: PoolPlayer[];
}): Promise<PersonalDraftBoardOverlay> {
  const guestSessionId = params.userId ? null : getOrCreateGuestSessionId();
  const bucketKey = draftBucketKey(params.bucket);
  const dbBucket = userRankingBucketFromDisplayBucket(params.bucket);
  const poolIds = params.poolPlayers.map((p) => p.id);

  const sessionKey = getRankingsDraftSessionStorageKey({
    userId: params.userId,
    guestSessionId,
    leagueId: params.leagueId,
    bucketKey,
  });
  const session = rankingsDraftSessionStorage.get(sessionKey);

  let rankMap: Map<string, number> | null = null;
  let hasPersonalRankings = false;

  if (session?.ids?.length) {
    hasPersonalRankings = true;
  } else if (params.userId) {
    try {
      rankMap = await fetchSignedInRankMap({
        userId: params.userId,
        leagueId: params.leagueId,
        bucket: dbBucket,
      });
      if (rankMap && rankMap.size > 0) hasPersonalRankings = true;
    } catch (err) {
      console.error('[draftPersonalBoard] Failed to load user rankings:', err);
    }
  } else {
    const guestList = tempRankingsStorage.get(bucketKey);
    if (guestList?.length) {
      rankMap = new Map(guestList.map((p, i) => [p.id, p.rank ?? i + 1]));
      hasPersonalRankings = true;
    }
  }

  const orderedIds = session?.ids?.length
    ? orderFromSessionIds(poolIds, session.ids)
    : rankMap && rankMap.size > 0
      ? orderFromRankMap(poolIds, rankMap)
      : poolIds;

  const myOverallRankById = densifyOverallRanks(orderedIds);
  const posById = new Map(params.poolPlayers.map((p) => [p.id, p.position]));
  const orderedPlayers = orderedIds.map((id) => ({
    id,
    position: posById.get(id) ?? 'WR',
    rank: myOverallRankById.get(id) ?? 999,
  }));
  const myPosRankById = buildPositionRankFromList(orderedPlayers);

  let positionTierCuts = await loadPositionTierCuts({
    userId: params.userId,
    guestSessionId,
    leagueId: params.leagueId,
    bucket: params.bucket,
    bucketKey,
  });
  let usesCommunityTiers = false;

  // Fill positions the viewer never cut (e.g. only QB/RB saved) from community.
  // Personal cuts win per position; empty personal board uses community fully.
  try {
    const communityCuts = eligiblePositionTierCuts(
      await fetchCommunityRankingTiers(dbBucket)
    );
    if (Object.keys(communityCuts).length > 0) {
      const personalKeys = new Set(Object.keys(positionTierCuts));
      positionTierCuts = mergePositionTierCuts(positionTierCuts, communityCuts);
      usesCommunityTiers =
        personalKeys.size === 0 ||
        Object.keys(communityCuts).some((pos) => !personalKeys.has(pos));
    }
  } catch (err) {
    console.error('[draftPersonalBoard] Failed to load community ranking tiers:', err);
  }

  const metaById = new Map<string, PersonalDraftPlayerMeta>();
  for (const p of params.poolPlayers) {
    const overallRank = myOverallRankById.get(p.id) ?? 9999;
    const posRank = myPosRankById.get(p.id) ?? null;
    const cuts = getCutsForPosition(positionTierCuts, p.position);
    const tier =
      posRank != null && cuts.length > 0 ? getTierNumber(posRank, cuts) : null;
    metaById.set(p.id, { overallRank, posRank, tier });
  }

  // Lock All-view breaks to the opening board: first player of each tier number.
  // Drafting a late Tier 1 QB to the top must not recreate Tier 1/2/3 banners.
  const allViewBreakBeforeIds = buildOverallTierBreakBeforeIds(orderedIds, (id) =>
    metaById.get(id)?.tier
  );

  return {
    myOverallRankById,
    myPosRankById,
    positionTierCuts,
    hasPersonalRankings,
    usesCommunityTiers,
    metaById,
    allViewBreakBeforeIds,
  };
}

export function getPersonalPlayerMeta(
  overlay: PersonalDraftBoardOverlay | null | undefined,
  playerId: string
): PersonalDraftPlayerMeta | null {
  return overlay?.metaById.get(playerId) ?? null;
}

/**
 * Position-filter tier breaks only.
 *
 * Frontier = tier of the first still-available player in this position list.
 * Leftover Tier 1 WRs still show a Tier 1 bar on the WR filter; All Players
 * uses the fixed `allViewBreakBeforeIds` from board load instead.
 */
export function buildDraftListTierBreakBeforeIds(
  ordered: readonly { id: string; tier: number | null | undefined }[]
): Set<string> {
  let frontier: number | null = null;
  for (const p of ordered) {
    if (p.tier != null && p.tier >= 1) {
      frontier = p.tier;
      break;
    }
  }
  if (frontier == null) return new Set();

  const out = new Set<string>();
  const seenTiers = new Set<number>();
  for (const p of ordered) {
    const tier = p.tier;
    if (tier == null || tier < 2) continue;
    if (tier <= frontier) continue;
    if (seenTiers.has(tier)) continue;
    seenTiers.add(tier);
    out.add(p.id);
  }
  return out;
}

