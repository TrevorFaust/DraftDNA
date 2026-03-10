import { supabase } from '@/integrations/supabase/client';
import { tempDraftStorage, tempRankingsStorage, tempSettingsStorage } from './temporaryStorage';
import type { MockDraft, DraftPick, RankedPlayer } from '@/types/database';

/**
 * Migrates temporary drafts from localStorage to the user's account in the database
 */
export const migrateTemporaryDrafts = async (userId: string): Promise<{ migrated: number; errors: number }> => {
  const draftIds = tempDraftStorage.getDraftList();
  let migrated = 0;
  let errors = 0;

  for (const draftId of draftIds) {
    try {
      const tempData = tempDraftStorage.getDraft(draftId);
      if (!tempData || !tempData.draft) continue;

      const { draft, picks } = tempData;

      // Skip if draft is not completed
      if (draft.status !== 'completed') continue;

      // Create the draft in the database
      const { data: newDraft, error: draftError } = await supabase
        .from('mock_drafts')
        .insert({
          user_id: userId,
          name: draft.name,
          num_teams: draft.num_teams,
          num_rounds: draft.num_rounds,
          user_pick_position: draft.user_pick_position,
          draft_order: draft.draft_order,
          scoring_format: draft.scoring_format,
          status: 'completed',
          created_at: draft.created_at,
          completed_at: draft.completed_at,
          pick_timer: draft.pick_timer,
          cpu_speed: (draft as any).cpu_speed || 'normal',
        } as any)
        .select()
        .single();

      if (draftError) {
        console.error(`Error migrating draft ${draftId}:`, draftError);
        errors++;
        continue;
      }

      // Migrate picks if there are any
      if (picks && picks.length > 0) {
        const picksToInsert = picks.map((pick) => ({
          mock_draft_id: newDraft.id,
          player_id: pick.player_id,
          team_number: pick.team_number,
          round_number: pick.round_number,
          pick_number: pick.pick_number,
        }));

        // Insert picks in batches to avoid timeout
        const BATCH_SIZE = 500;
        for (let i = 0; i < picksToInsert.length; i += BATCH_SIZE) {
          const batch = picksToInsert.slice(i, i + BATCH_SIZE);
          const { error: picksError } = await supabase
            .from('draft_picks')
            .insert(batch);

          if (picksError) {
            console.error(`Error migrating picks for draft ${draftId}:`, picksError);
            errors++;
            break;
          }
        }
      }

      // Remove from localStorage after successful migration
      tempDraftStorage.deleteDraft(draftId);
      migrated++;
    } catch (error) {
      console.error(`Error migrating draft ${draftId}:`, error);
      errors++;
    }
  }

  return { migrated, errors };
};

/**
 * Migrates temporary rankings from localStorage to the user's account.
 * Uses the bucket from temp settings (guest's last league type) so we migrate the right rankings.
 */
export const migrateTemporaryRankings = async (userId: string): Promise<boolean> => {
  try {
    const settings = tempSettingsStorage.get();
    const bucketKey = settings
      ? `${settings.scoringFormat || 'ppr'}/${settings.leagueType || 'season'}/${settings.isSuperflex || false}/${settings.rookiesOnly || false}`
      : 'ppr/season/false/false';
    let tempRankingsData = tempRankingsStorage.get(bucketKey);
    // Backwards compat: legacy single key (no bucket)
    if ((!tempRankingsData || tempRankingsData.length === 0) && typeof localStorage !== 'undefined') {
      try {
        const legacy = localStorage.getItem('temp_rankings');
        if (legacy) tempRankingsData = JSON.parse(legacy);
      } catch {
        /* ignore */
      }
    }
    if (!tempRankingsData || !Array.isArray(tempRankingsData) || tempRankingsData.length === 0) {
      return false; // No rankings to migrate
    }

    // Check if user already has rankings
    const { data: existingRankings } = await supabase
      .from('user_rankings')
      .select('*')
      .eq('user_id', userId)
      .is('league_id', null)
      .limit(1);

    // Only migrate if user doesn't have existing rankings
    if (existingRankings && existingRankings.length > 0) {
      // User already has rankings, don't overwrite
      tempRankingsStorage.clear(bucketKey);
      return false;
    }

    // Insert rankings in batches
    const rankings = tempRankingsData.map((p, index) => ({
      user_id: userId,
      player_id: p.id,
      rank: index + 1,
      league_id: null,
    }));

    const BATCH_SIZE = 500;
    for (let i = 0; i < rankings.length; i += BATCH_SIZE) {
      const batch = rankings.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('user_rankings').insert(batch);
      
      if (error) {
        console.error('Error migrating rankings:', error);
        return false;
      }
    }

    // Clear temporary rankings for this bucket after successful migration
    tempRankingsStorage.clear(bucketKey);
    return true;
  } catch (error) {
    console.error('Error migrating rankings:', error);
    return false;
  }
};

/**
 * Migrates all temporary data (drafts and rankings) when a user signs in
 */
export const migrateAllTemporaryData = async (userId: string): Promise<{
  draftsMigrated: number;
  draftsErrors: number;
  rankingsMigrated: boolean;
}> => {
  const { migrated, errors } = await migrateTemporaryDrafts(userId);
  const rankingsMigrated = await migrateTemporaryRankings(userId);

  return {
    draftsMigrated: migrated,
    draftsErrors: errors,
    rankingsMigrated,
  };
};
