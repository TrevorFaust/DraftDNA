const COMMUNITY_RANK_HISTORY_PREFIX = 'community_rank_history_v1_';
const MAX_SNAPSHOTS = 30;
const MIN_TREND_AGE_MS = 2 * 24 * 60 * 60 * 1000;

export type CommunityRankSnapshot = {
  at: string;
  ranks: Record<string, number>;
};

export type CommunityRankHistory = {
  v: 1;
  snapshots: CommunityRankSnapshot[];
};

export type CommunityRankTrend = {
  delta: number;
  previousRank: number;
  daysAgo: number;
};

function historyKey(bucketKey: string): string {
  return `${COMMUNITY_RANK_HISTORY_PREFIX}${bucketKey.replace(/\//g, '_')}`;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseHistory(raw: string): CommunityRankHistory | null {
  try {
    const parsed = JSON.parse(raw) as CommunityRankHistory;
    if (parsed?.v !== 1 || !Array.isArray(parsed.snapshots)) return null;
    return {
      v: 1,
      snapshots: parsed.snapshots.filter(
        (s) => s && typeof s.at === 'string' && s.ranks && typeof s.ranks === 'object'
      ),
    };
  } catch {
    return null;
  }
}

/** Persist today's community overall ranks for trend comparison (one snapshot per calendar day). */
export function recordCommunityRankSnapshot(
  bucketKey: string,
  ranks: Map<string, number>
): void {
  if (typeof window === 'undefined' || ranks.size === 0) return;
  const key = historyKey(bucketKey);
  const today = todayDateString();
  const ranksObj: Record<string, number> = {};
  for (const [id, rank] of ranks) ranksObj[id] = rank;

  let history: CommunityRankHistory = { v: 1, snapshots: [] };
  const existing = localStorage.getItem(key);
  if (existing) {
    const parsed = parseHistory(existing);
    if (parsed) history = parsed;
  }

  const withoutToday = history.snapshots.filter((s) => s.at !== today);
  const nextSnapshots = [...withoutToday, { at: today, ranks: ranksObj }];
  if (nextSnapshots.length > MAX_SNAPSHOTS) {
    nextSnapshots.splice(0, nextSnapshots.length - MAX_SNAPSHOTS);
  }

  try {
    localStorage.setItem(key, JSON.stringify({ v: 1, snapshots: nextSnapshots }));
  } catch {
    /* quota or private mode */
  }
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(`${dateA}T12:00:00Z`).getTime();
  const b = new Date(`${dateB}T12:00:00Z`).getTime();
  return Math.round(Math.abs(b - a) / (24 * 60 * 60 * 1000));
}

/**
 * Community rank movement vs an older snapshot (≥2 days ago when available).
 * Positive delta = rank number increased (stock dropped); negative = rose.
 */
export function getCommunityRankTrend(
  bucketKey: string,
  playerId: string,
  currentRank: number
): CommunityRankTrend | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(historyKey(bucketKey));
  if (!raw) return null;
  const history = parseHistory(raw);
  if (!history || history.snapshots.length < 2) return null;

  const today = todayDateString();
  const todayMs = new Date(`${today}T12:00:00Z`).getTime();
  const eligible = history.snapshots
    .filter((s) => s.at !== today)
    .map((s) => ({
      ...s,
      ageMs: todayMs - new Date(`${s.at}T12:00:00Z`).getTime(),
    }))
    .filter((s) => s.ageMs >= MIN_TREND_AGE_MS)
    .sort((a, b) => b.ageMs - a.ageMs);

  const baseline = eligible[0] ?? history.snapshots.find((s) => s.at !== today);
  if (!baseline) return null;

  const previousRank = baseline.ranks[playerId];
  if (previousRank == null || previousRank === currentRank) return null;

  return {
    delta: currentRank - previousRank,
    previousRank,
    daysAgo: daysBetween(baseline.at, today),
  };
}
