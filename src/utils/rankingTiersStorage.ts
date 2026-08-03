import {
  parsePositionTierCuts,
  type PositionTierCuts,
} from '@/utils/positionTiers';

const RANKING_TIERS_KEY_PREFIX = 'ranking_tiers_v1';

export function getRankingTiersStorageKey(params: {
  userId: string | null;
  guestSessionId: string | null;
  leagueId: string | null;
  bucketKey: string;
}): string {
  const safeBucket = params.bucketKey.replace(/\//g, '_');
  const leagueSeg = params.leagueId ?? 'all';
  if (params.userId) {
    return `${RANKING_TIERS_KEY_PREFIX}_u_${params.userId}_${leagueSeg}_${safeBucket}`;
  }
  const gs = params.guestSessionId ?? 'x';
  return `${RANKING_TIERS_KEY_PREFIX}_g_${gs}_${leagueSeg}_${safeBucket}`;
}

export const rankingTiersLocalStorage = {
  get(key: string): PositionTierCuts {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return {};
      return parsePositionTierCuts(JSON.parse(raw));
    } catch {
      return {};
    }
  },

  save(key: string, cuts: PositionTierCuts): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(cuts));
    } catch {
      /* quota or private mode */
    }
  },

  clear(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
