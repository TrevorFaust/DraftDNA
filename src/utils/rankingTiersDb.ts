import { supabase } from '@/integrations/supabase/client';
import {
  applyUserRankingsBucketMatch,
  type UserRankingBucketDb,
} from '@/utils/userRankingsBucket';
import { parsePositionTierCuts, type PositionTierCuts } from '@/utils/positionTiers';

/** Generated DB types omit this table until regenerated — cast at the boundary. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tiersTable = () => supabase.from('user_ranking_tiers' as any);

export async function fetchUserRankingTiers(params: {
  userId: string;
  leagueId: string | null;
  bucket: UserRankingBucketDb;
}): Promise<PositionTierCuts> {
  let query = tiersTable().select('cuts').eq('user_id', params.userId);
  query = params.leagueId
    ? query.eq('league_id', params.leagueId)
    : query.is('league_id', null);
  const { data, error } = await applyUserRankingsBucketMatch(query, params.bucket).maybeSingle();
  if (error) throw error;
  return parsePositionTierCuts((data as { cuts?: unknown } | null)?.cuts);
}

export async function upsertUserRankingTiers(params: {
  userId: string;
  leagueId: string | null;
  bucket: UserRankingBucketDb;
  cuts: PositionTierCuts;
}): Promise<void> {
  const updatedAt = new Date().toISOString();
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
      .update({ cuts: params.cuts, updated_at: updatedAt })
      .eq('id', existingId);
    if (error) throw error;
    return;
  }

  const { error } = await tiersTable().insert({
    user_id: params.userId,
    league_id: params.leagueId,
    ...params.bucket,
    cuts: params.cuts,
    updated_at: updatedAt,
  });
  if (error) throw error;
}
