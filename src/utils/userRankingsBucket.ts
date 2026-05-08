import type { SupabaseClient } from '@supabase/supabase-js';

/** DB columns on user_rankings that identify which league-settings bucket a row belongs to. */

export type UserRankingBucketDb = {
  scoring_format: string;
  league_type: string;
  is_superflex: boolean;
  rookies_only: boolean;
};

export function userRankingBucketFromDisplayBucket(b: {
  scoringFormat: string;
  leagueType: string;
  isSuperflex: boolean;
  rookiesOnly?: boolean;
}): UserRankingBucketDb {
  return {
    scoring_format: b.scoringFormat,
    league_type: b.leagueType,
    is_superflex: b.isSuperflex,
    rookies_only: Boolean(b.rookiesOnly),
  };
}

type QueryWithEq = {
  eq: (column: string, value: unknown) => QueryWithEq;
};

/** Narrow user_rankings rows to the current league bucket (signed-in or All Leagues view). */
export function applyUserRankingsBucketMatch<T extends QueryWithEq>(q: T, bucket: UserRankingBucketDb): T {
  return q
    .eq('scoring_format', bucket.scoring_format)
    .eq('league_type', bucket.league_type)
    .eq('is_superflex', bucket.is_superflex)
    .eq('rookies_only', bucket.rookies_only) as T;
}

export function userRankingBucketsEqual(a: UserRankingBucketDb, b: UserRankingBucketDb): boolean {
  return (
    a.scoring_format === b.scoring_format &&
    a.league_type === b.league_type &&
    a.is_superflex === b.is_superflex &&
    Boolean(a.rookies_only) === Boolean(b.rookies_only)
  );
}

/** Short label for dropdowns (e.g. "1/2 PPR · Redraft · 1 QB"). */
export function formatRankingBucketLabel(b: UserRankingBucketDb): string {
  const scoring =
    b.scoring_format === 'half_ppr'
      ? '1/2 PPR'
      : b.scoring_format === 'ppr'
        ? 'PPR'
        : 'Standard';
  const lt = b.league_type === 'dynasty' ? 'Dynasty' : 'Redraft';
  const flex = b.is_superflex ? '2QB' : '1 QB';
  const rook = b.rookies_only ? ' · Rookies only' : '';
  return `${scoring} · ${lt} · ${flex}${rook}`;
}

/** Muted second line in import dialog (comma-separated). */
export function formatRankingBucketImportSubtitle(b: UserRankingBucketDb): string {
  const scoring =
    b.scoring_format === 'half_ppr'
      ? '1/2 PPR'
      : b.scoring_format === 'ppr'
        ? 'PPR'
        : 'Standard';
  const lt = b.league_type === 'dynasty' ? 'Dynasty' : 'Redraft';
  const flex = b.is_superflex ? '2QB' : '1 QB';
  const rook = b.rookies_only ? ', Rookies only' : '';
  return `${scoring}, ${lt}, ${flex}${rook}`;
}

export type UserRankingImportSourceRow = {
  league_id: string | null;
  bucket: UserRankingBucketDb;
};

/**
 * Full rankings vs rookie-only use different player pools — only import within the same pool.
 * Any scoring / season vs dynasty / QB vs SF can import across each other.
 */
export function rankingImportPlayerPoolsMatch(
  destRookiesOnly: boolean,
  templateRookiesOnly: boolean
): boolean {
  return Boolean(destRookiesOnly) === Boolean(templateRookiesOnly);
}

function mapImportSourceRow(r: Record<string, unknown>): UserRankingImportSourceRow {
  return {
    league_id: (r.league_id as string | null) ?? null,
    bucket: {
      scoring_format: String(r.scoring_format ?? 'ppr'),
      league_type: String(r.league_type ?? 'season'),
      is_superflex: Boolean(r.is_superflex),
      rookies_only: Boolean(r.rookies_only),
    },
  };
}

/** Paginate all user_rankings rows and collect DISTINCT (league, bucket) — avoids PostgREST ~1000 row cap on a single select. */
async function paginateDistinctImportSources(
  client: SupabaseClient,
  userId: string
): Promise<UserRankingImportSourceRow[]> {
  const pageSize = 1000;
  const seen = new Set<string>();
  const out: UserRankingImportSourceRow[] = [];
  let from = 0;

  const ingest = (
    rows: {
      league_id: unknown;
      scoring_format: unknown;
      league_type: unknown;
      is_superflex: unknown;
      rookies_only: unknown;
    }[]
  ) => {
    for (const r of rows) {
      const bucket: UserRankingBucketDb = {
        scoring_format: r.scoring_format as string,
        league_type: r.league_type as string,
        is_superflex: Boolean(r.is_superflex),
        rookies_only: Boolean(r.rookies_only),
      };
      const lid = r.league_id as string | null;
      const dedupeKey = `${lid ?? 'null'}|${bucket.scoring_format}|${bucket.league_type}|${bucket.is_superflex}|${bucket.rookies_only}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push({ league_id: lid, bucket });
    }
  };

  for (;;) {
    let res = await client
      .from('user_rankings')
      .select('league_id, scoring_format, league_type, is_superflex, rookies_only')
      .eq('user_id', userId)
      .order('player_id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (res.error && from === 0) {
      res = await client
        .from('user_rankings')
        .select('league_id, scoring_format, league_type, is_superflex, rookies_only')
        .eq('user_id', userId)
        .order('rank', { ascending: true })
        .order('player_id', { ascending: true })
        .range(from, from + pageSize - 1);
    }

    if (res.error) throw res.error;
    const rows = res.data ?? [];
    if (rows.length === 0) break;
    ingest(rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return out;
}

/** Minimal league fields needed to probe user_rankings per league. */
export type LeagueRowForImport = {
  id: string;
};

/**
 * When DISTINCT/RPC scans return nothing (PostgREST/RLS quirks), probe each league_id separately —
 * matches how the Rankings page loads rows and reliably finds saved buckets.
 */
async function discoverImportSourcesByLeagueProbe(
  client: SupabaseClient,
  userId: string,
  leagues: LeagueRowForImport[]
): Promise<UserRankingImportSourceRow[]> {
  const seen = new Set<string>();
  const out: UserRankingImportSourceRow[] = [];

  for (const league of leagues) {
    const { data, error } = await client
      .from('user_rankings')
      .select('scoring_format, league_type, is_superflex, rookies_only')
      .eq('user_id', userId)
      .eq('league_id', league.id)
      .limit(2000);

    if (error) {
      console.error('[Import rankings] Probe league row failed', league.id, error.message);
      continue;
    }
    if (!data?.length) continue;

    for (const r of data) {
      const bucket: UserRankingBucketDb = {
        scoring_format: String(r.scoring_format ?? 'ppr'),
        league_type: String(r.league_type ?? 'season'),
        is_superflex: Boolean(r.is_superflex),
        rookies_only: Boolean(r.rookies_only),
      };
      const dedupeKey = `${league.id}|${bucket.scoring_format}|${bucket.league_type}|${bucket.is_superflex}|${bucket.rookies_only}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push({ league_id: league.id, bucket });
    }
  }

  const { data: nullRows, error: nullErr } = await client
    .from('user_rankings')
    .select('scoring_format, league_type, is_superflex, rookies_only')
    .eq('user_id', userId)
    .is('league_id', null)
    .limit(2000);

  if (nullErr) {
    console.error('[Import rankings] Probe null-league_id rows failed', nullErr.message);
  }

  for (const r of nullRows ?? []) {
    const bucket: UserRankingBucketDb = {
      scoring_format: String(r.scoring_format ?? 'ppr'),
      league_type: String(r.league_type ?? 'season'),
      is_superflex: Boolean(r.is_superflex),
      rookies_only: Boolean(r.rookies_only),
    };
    const dedupeKey = `null|${bucket.scoring_format}|${bucket.league_type}|${bucket.is_superflex}|${bucket.rookies_only}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({ league_id: null, bucket });
  }

  return out;
}

function dedupeImportSources(rows: UserRankingImportSourceRow[]): UserRankingImportSourceRow[] {
  const seen = new Set<string>();
  const out: UserRankingImportSourceRow[] = [];
  for (const row of rows) {
    const lid = row.league_id ?? 'null';
    const b = row.bucket;
    const k = `${lid}|${b.scoring_format}|${b.league_type}|${b.is_superflex}|${b.rookies_only}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(row);
  }
  return out;
}

/**
 * Distinct saved (league + bucket) for import UI.
 * Merges RPC + paginated scan + per-league probe so any path that can see rows contributes.
 */
export async function fetchUserRankingImportSources(
  client: SupabaseClient,
  userId: string,
  leaguesForProbe?: LeagueRowForImport[]
): Promise<UserRankingImportSourceRow[]> {
  const merged: UserRankingImportSourceRow[] = [];

  const { data: rpcData, error: rpcError } = await client.rpc('list_user_ranking_import_sources');
  const rpcLen = Array.isArray(rpcData) ? rpcData.length : 0;
  if (rpcError) {
    console.error('[Import rankings] RPC list_user_ranking_import_sources:', rpcError.message, rpcError);
  } else if (rpcLen > 0) {
    merged.push(...(rpcData as Record<string, unknown>[]).map((r) => mapImportSourceRow(r)));
  }

  let pageLen = 0;
  try {
    const paginated = await paginateDistinctImportSources(client, userId);
    pageLen = paginated.length;
    merged.push(...paginated);
  } catch (e) {
    console.error('[Import rankings] Paginated scan failed', e);
  }

  let probeLen = 0;
  if (leaguesForProbe?.length) {
    const probed = await discoverImportSourcesByLeagueProbe(client, userId, leaguesForProbe);
    probeLen = probed.length;
    merged.push(...probed);
  }

  const out = dedupeImportSources(merged);
  if (out.length === 0) {
    const sample = await client
      .from('user_rankings')
      .select('league_id, scoring_format, league_type, is_superflex, rookies_only')
      .eq('user_id', userId)
      .limit(5);
    const countRes = await client
      .from('user_rankings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    console.error('[Import rankings] No distinct buckets after RPC + pagination + probe.', {
      userId,
      rpcError: rpcError?.message ?? null,
      rpcRowCount: rpcLen,
      paginatedDistinctRows: pageLen,
      probeRows: probeLen,
      leaguesProbed: leaguesForProbe?.length ?? 0,
      clientVisibleRankingsCount: countRes.count,
      countQueryError: countRes.error?.message,
      sampleSelectError: sample.error?.message,
      sampleRows: sample.data?.length ?? 0,
    });
  }

  return out;
}

const BUCKET_KEY_SEP = '\x1f';

function bucketKeyFromRow(r: {
  scoring_format: unknown;
  league_type: unknown;
  is_superflex: unknown;
  rookies_only: unknown;
}): string {
  return `${String(r.scoring_format ?? 'ppr')}${BUCKET_KEY_SEP}${String(r.league_type ?? 'season')}${BUCKET_KEY_SEP}${Boolean(r.is_superflex)}${BUCKET_KEY_SEP}${Boolean(r.rookies_only)}`;
}

function userRankingBucketFromKey(key: string): UserRankingBucketDb {
  const [scoring_format, league_type, isf, rok] = key.split(BUCKET_KEY_SEP);
  return {
    scoring_format,
    league_type,
    is_superflex: isf === 'true',
    rookies_only: rok === 'true',
  };
}

function bestBucketFromCounts(counts: Map<string, number>): UserRankingBucketDb | null {
  let bestKey: string | null = null;
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      bestN = n;
      bestKey = k;
    }
  }
  if (!bestKey) return null;
  return userRankingBucketFromKey(bestKey);
}

/** One paginated scan: leagues with rows in this pool + largest bucket per league (for import UI). */
export type ImportPoolScanResult = {
  leagueIds: string[];
  bestBucketByLeagueId: Map<string, UserRankingBucketDb>;
  nullLeagueRowCount: number;
  bestBucketNullLeague: UserRankingBucketDb | null;
};

export async function scanUserRankingsImportPoolByLeague(
  client: SupabaseClient,
  userId: string,
  destRookiesOnly: boolean
): Promise<ImportPoolScanResult> {
  const perLeagueBucketCounts = new Map<string, Map<string, number>>();
  const nullBucketCounts = new Map<string, number>();
  const pageSize = 1000;
  let from = 0;

  for (;;) {
    const { data, error } = await client
      .from('user_rankings')
      .select('league_id, scoring_format, league_type, is_superflex, rookies_only')
      .eq('user_id', userId)
      .eq('rookies_only', destRookiesOnly)
      .order('league_id', { ascending: true })
      .order('rank', { ascending: true })
      .order('player_id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('[Import rankings] scanUserRankingsImportPoolByLeague:', error.message);
      break;
    }
    const rows = data ?? [];
    for (const r of rows) {
      const lid = r.league_id as string | null;
      const bk = bucketKeyFromRow(r);
      if (lid == null || lid === '') {
        nullBucketCounts.set(bk, (nullBucketCounts.get(bk) ?? 0) + 1);
      } else {
        if (!perLeagueBucketCounts.has(lid)) perLeagueBucketCounts.set(lid, new Map());
        const m = perLeagueBucketCounts.get(lid)!;
        m.set(bk, (m.get(bk) ?? 0) + 1);
      }
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  const bestBucketByLeagueId = new Map<string, UserRankingBucketDb>();
  for (const [lid, m] of perLeagueBucketCounts) {
    const b = bestBucketFromCounts(m);
    if (b) bestBucketByLeagueId.set(lid, b);
  }
  const nullLeagueRowCount = [...nullBucketCounts.values()].reduce((a, n) => a + n, 0);
  const bestBucketNullLeague = nullLeagueRowCount > 0 ? bestBucketFromCounts(nullBucketCounts) : null;
  const leagueIds = [...bestBucketByLeagueId.keys()].sort((a, b) => a.localeCompare(b));

  return { leagueIds, bestBucketByLeagueId, nullLeagueRowCount, bestBucketNullLeague };
}

/**
 * Simple import path: all rows for one league, then pick the largest bucket group that matches the
 * destination rookie vs full pool. Does not depend on DISTINCT/RPC discovery (which can return empty spuriously).
 */
export async function fetchUserRankingsPlayerIdsFlexibleForLeague(
  client: SupabaseClient,
  userId: string,
  leagueId: string,
  destRookiesOnly: boolean
): Promise<string[] | null> {
  const { data: rows, error } = await client
    .from('user_rankings')
    .select('player_id, rank, scoring_format, league_type, is_superflex, rookies_only')
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .order('rank', { ascending: true });

  if (error || !rows?.length) return null;

  const poolOk = rows.filter((r) =>
    rankingImportPlayerPoolsMatch(destRookiesOnly, Boolean(r.rookies_only))
  );
  if (!poolOk.length) return null;

  type R = (typeof poolOk)[number];
  const groups = new Map<string, R[]>();
  for (const r of poolOk) {
    const k = `${r.scoring_format}|${r.league_type}|${r.is_superflex}|${r.rookies_only}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  let best: R[] = [];
  for (const g of groups.values()) {
    if (g.length > best.length) best = g;
  }
  best.sort((a, b) => a.rank - b.rank);
  return best.map((r) => r.player_id);
}

/** Same as flexible league import, for legacy rows with `league_id` null ("All leagues"). */
export async function fetchUserRankingsPlayerIdsFlexibleForNullLeague(
  client: SupabaseClient,
  userId: string,
  destRookiesOnly: boolean
): Promise<string[] | null> {
  const { data: rows, error } = await client
    .from('user_rankings')
    .select('player_id, rank, scoring_format, league_type, is_superflex, rookies_only')
    .eq('user_id', userId)
    .is('league_id', null)
    .order('rank', { ascending: true });

  if (error || !rows?.length) return null;

  const poolOk = rows.filter((r) =>
    rankingImportPlayerPoolsMatch(destRookiesOnly, Boolean(r.rookies_only))
  );
  if (!poolOk.length) return null;

  type R = (typeof poolOk)[number];
  const groups = new Map<string, R[]>();
  for (const r of poolOk) {
    const k = `${r.scoring_format}|${r.league_type}|${r.is_superflex}|${r.rookies_only}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  let best: R[] = [];
  for (const g of groups.values()) {
    if (g.length > best.length) best = g;
  }
  best.sort((a, b) => a.rank - b.rank);
  return best.map((r) => r.player_id);
}

/**
 * Last-resort import source: choose the largest saved ordered list for this user across all leagues and bucket variants.
 */
export async function fetchUserRankingsPlayerIdsFlexibleAny(
  client: SupabaseClient,
  userId: string
): Promise<string[] | null> {
  const pageSize = 1000;
  let from = 0;
  type R = {
    player_id: string;
    rank: number;
    league_id: string | null;
    scoring_format: string;
    league_type: string;
    is_superflex: boolean;
    rookies_only: boolean;
  };
  const rows: R[] = [];

  for (;;) {
    const { data, error } = await client
      .from('user_rankings')
      .select('player_id, rank, league_id, scoring_format, league_type, is_superflex, rookies_only')
      .eq('user_id', userId)
      .order('league_id', { ascending: true })
      .order('rank', { ascending: true })
      .order('player_id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('[Import rankings] fetchUserRankingsPlayerIdsFlexibleAny:', error.message);
      return null;
    }

    const page = (data ?? []) as R[];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  if (!rows.length) return null;

  const groups = new Map<string, R[]>();
  for (const r of rows) {
    const key = `${r.league_id ?? 'null'}|${r.scoring_format}|${r.league_type}|${r.is_superflex}|${r.rookies_only}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  let best: R[] = [];
  for (const g of groups.values()) {
    if (g.length > best.length) best = g;
  }
  if (!best.length) return null;
  best.sort((a, b) => a.rank - b.rank);
  return best.map((r) => r.player_id);
}
