import { supabase } from '@/integrations/supabase/client';
import {
  applyUserRankingsBucketMatch,
  type UserRankingBucketDb,
} from '@/utils/userRankingsBucket';
import {
  aggregateCommunityTierCuts,
  eligiblePositionTierCuts,
  parsePositionTierCuts,
  type PositionTierCuts,
} from '@/utils/positionTiers';

/** Generated DB types omit this table until regenerated — cast at the boundary. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tiersTable = () => supabase.from('user_ranking_tiers' as any);

export async function fetchUserRankingTiers(params: {
  userId: string;
  leagueId: string | null;
  bucket: UserRankingBucketDb;
}): Promise<PositionTierCuts> {
  if (params.leagueId) {
    let query = tiersTable()
      .select('cuts')
      .eq('user_id', params.userId)
      .eq('league_id', params.leagueId);
    const { data, error } = await applyUserRankingsBucketMatch(query, params.bucket).maybeSingle();
    if (error) throw error;
    return eligiblePositionTierCuts(
      parsePositionTierCuts((data as { cuts?: unknown } | null)?.cuts)
    );
  }

  // All-leagues / no league: prefer a null-league row, else newest row in this bucket.
  let nullQuery = tiersTable()
    .select('cuts')
    .eq('user_id', params.userId)
    .is('league_id', null);
  const { data: nullRow, error: nullError } = await applyUserRankingsBucketMatch(
    nullQuery,
    params.bucket
  ).maybeSingle();
  if (nullError) throw nullError;
  const nullCuts = eligiblePositionTierCuts(
    parsePositionTierCuts((nullRow as { cuts?: unknown } | null)?.cuts)
  );
  if (Object.keys(nullCuts).length > 0) return nullCuts;

  let anyQuery = tiersTable()
    .select('cuts, updated_at')
    .eq('user_id', params.userId)
    .order('updated_at', { ascending: false })
    .limit(1);
  const { data: anyRows, error: anyError } = await applyUserRankingsBucketMatch(
    anyQuery,
    params.bucket
  );
  if (anyError) throw anyError;
  const row = Array.isArray(anyRows) ? anyRows[0] : anyRows;
  return eligiblePositionTierCuts(
    parsePositionTierCuts((row as { cuts?: unknown } | null)?.cuts)
  );
}

export async function upsertUserRankingTiers(params: {
  userId: string;
  leagueId: string | null;
  bucket: UserRankingBucketDb;
  cuts: PositionTierCuts;
}): Promise<void> {
  const updatedAt = new Date().toISOString();
  const cuts = eligiblePositionTierCuts(params.cuts);
  let findQuery = tiersTable().select('id').eq('user_id', params.userId);
  findQuery = params.leagueId
    ? findQuery.eq('league_id', params.leagueId)
    : findQuery.is('league_id', null);
  const { data: existing, error: findError } = await applyUserRankingsBucketMatch(
    findQuery,
    params.bucket
  ).maybeSingle();
  if (findError) throw findError;

  const existingId = (existing as { id?: string } | null)?.id;
  if (existingId) {
    const { error } = await tiersTable()
      .update({ cuts, updated_at: updatedAt })
      .eq('id', existingId);
    if (error) throw error;
    return;
  }

  const { error } = await tiersTable().insert({
    user_id: params.userId,
    league_id: params.leagueId,
    ...params.bucket,
    cuts,
    updated_at: updatedAt,
  });
  if (error) throw error;
}

function normalizeRpcSubmissionRows(data: unknown): unknown[] {
  if (data == null) return [];
  let parsed: unknown = data;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  if (Array.isArray(parsed)) return parsed;
  return [];
}

/**
 * Consensus position cuts for one rankings bucket
 * (scoring_format × league_type × is_superflex × rookies_only).
 * Dynasty / SF / PPR boards do not share cuts with redraft / 1QB / standard.
 */
export async function fetchCommunityRankingTiers(
  bucket: UserRankingBucketDb
): Promise<PositionTierCuts> {
  const { data, error } = await supabase.rpc('get_community_ranking_tier_submissions' as never, {
    p_scoring_format: bucket.scoring_format,
    p_league_type: bucket.league_type,
    p_is_superflex: bucket.is_superflex,
    p_rookies_only: bucket.rookies_only,
  } as never);
  if (error) throw error;

  const submissions: PositionTierCuts[] = [];
  for (const row of normalizeRpcSubmissionRows(data)) {
    const parsed = eligiblePositionTierCuts(parsePositionTierCuts(row));
    if (Object.keys(parsed).length > 0) submissions.push(parsed);
  }
  return aggregateCommunityTierCuts(submissions);
}
