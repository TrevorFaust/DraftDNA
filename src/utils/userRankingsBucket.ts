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

/** Short label for dropdowns (e.g. "1/2 PPR · Season · 1 QB"). */
export function formatRankingBucketLabel(b: UserRankingBucketDb): string {
  const scoring =
    b.scoring_format === 'half_ppr'
      ? '1/2 PPR'
      : b.scoring_format === 'ppr'
        ? 'PPR'
        : 'Standard';
  const lt = b.league_type === 'dynasty' ? 'Dynasty' : 'Season';
  const flex = b.is_superflex ? 'Superflex' : '1 QB';
  const rook = b.rookies_only ? ' · Rookies only' : '';
  return `${scoring} · ${lt} · ${flex}${rook}`;
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

/**
 * Distinct saved (league + bucket) combinations for import UI.
 * Uses RPC when it returns rows; otherwise paginates (plain one-shot `.select()` caps at ~1000 rows and misses leagues).
 */
/** Minimal league fields needed to probe user_rankings per league (same rows the app already loads). */
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

    if (error || !data?.length) continue;

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

  const { data: nullRows } = await client
    .from('user_rankings')
    .select('scoring_format, league_type, is_superflex, rookies_only')
    .eq('user_id', userId)
    .is('league_id', null)
    .limit(2000);

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

/**
 * Distinct saved (league + bucket) for import UI.
 * 1) RPC (SECURITY DEFINER DISTINCT)
 * 2) Paginated full scan
 * 3) Per-league probe using `leagues` from the client — succeeds when global scans do not
 */
export async function fetchUserRankingImportSources(
  client: SupabaseClient,
  userId: string,
  leaguesForProbe?: LeagueRowForImport[]
): Promise<UserRankingImportSourceRow[]> {
  const { data: rpcData, error: rpcError } = await client.rpc('list_user_ranking_import_sources');
  if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
    return (rpcData as Record<string, unknown>[]).map((r) => mapImportSourceRow(r));
  }

  const paginated = await paginateDistinctImportSources(client, userId);
  if (paginated.length > 0) return paginated;

  if (leaguesForProbe?.length) {
    const probed = await discoverImportSourcesByLeagueProbe(client, userId, leaguesForProbe);
    if (probed.length > 0) return probed;
  }

  return [];
}
