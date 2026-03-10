/**
 * Badges page — all archetype achievements. Earned = full color; unearned = greyed with ?.
 * Uses archetype index (not name) so duplicate names in the list each have one correct slot.
 */

import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { ArchetypeBadge } from '@/components/ArchetypeBadge';
import { getArchetypeIndexForTeam } from '@/utils/archetypeDetection';
import { tempDraftStorage, tempSettingsStorage } from '@/utils/temporaryStorage';
import { FULL_ARCHETYPE_LIST } from '@/constants/archetypeListWithImproviser';
import { Loader2, Award, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DraftPick } from '@/types/database';

/** Map: archetype index -> { draftName, draftId } for tooltip (first draft that earned it). */
interface EarnedState {
  byIndex: Map<number, { draftName: string; draftId: string }>;
  count: number;
}

/** Summary of last fetch for debugging (when something went wrong). */
interface FetchDiagnostics {
  draftsCount: number;
  picksCount: number;
  playerIdsCount: number;
  playersLoaded: number;
  playerBatchesFailed: number;
  tempPlayerBatchesFailed: number;
  earnedCount: number;
}

const Badges = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [earned, setEarned] = useState<EarnedState>({ byIndex: new Map(), count: 0 });
  const [loading, setLoading] = useState(true);
  const [lastDiagnostics, setLastDiagnostics] = useState<FetchDiagnostics | null>(null);

  const fetchEarnedArchetypes = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const byIndex = new Map<number, { draftName: string; draftId: string }>();

    try {
      setLastDiagnostics(null);
      let diagnostics: FetchDiagnostics = {
        draftsCount: 0,
        picksCount: 0,
        playerIdsCount: 0,
        playersLoaded: 0,
        playerBatchesFailed: 0,
        tempPlayerBatchesFailed: 0,
        earnedCount: 0,
      };
      if (user) {
        const { data: drafts, error: draftsError } = await supabase
          .from('mock_drafts')
          .select('id, name, num_teams, user_pick_position, league_id')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .limit(500);

        if (draftsError) {
          console.error('Badges: failed to fetch drafts', draftsError);
        }

        diagnostics.draftsCount = drafts?.length ?? 0;

        const leagueIds = [...new Set((drafts || []).map((d) => d.league_id).filter(Boolean))] as string[];
        const leaguesMap = new Map<string, { position_limits?: { FLEX?: number; BENCH?: number } }>();
        if (leagueIds.length > 0) {
          const leagueBatchSize = 30;
          for (let lb = 0; lb < leagueIds.length; lb += leagueBatchSize) {
            const batch = leagueIds.slice(lb, lb + leagueBatchSize);
            const { data: leagues } = await supabase
              .from('leagues')
              .select('id, position_limits')
              .in('id', batch);
            (leagues || []).forEach((l) => leaguesMap.set(l.id, l));
          }
        }

        if (drafts?.length) {
          const draftIds = drafts.map((d) => d.id);
          let picksData: { mock_draft_id: string; team_number: number; round_number: number; pick_number: number; player_id: string }[] = [];
          const idBatchSize = 25;
          for (let b = 0; b < draftIds.length; b += idBatchSize) {
            const batchIds = draftIds.slice(b, b + idBatchSize);
            let offset = 0;
            const pageSize = 1000;
            let hasMore = true;
            while (hasMore) {
              const { data: page } = await supabase
                .from('draft_picks')
                .select('mock_draft_id, team_number, round_number, pick_number, player_id')
                .in('mock_draft_id', batchIds)
                .order('pick_number')
                .range(offset, offset + pageSize - 1);
              const rows = page || [];
              picksData = picksData.concat(rows);
              hasMore = rows.length === pageSize;
              offset += pageSize;
            }
          }

          const playerIds = [...new Set(picksData.map((p) => p.player_id).filter(Boolean))];
          const playersMap = new Map<string, { position?: string; rank?: number; adp?: number }>();
          let playerBatchesFailed = 0;
          if (playerIds.length > 0) {
            const playerBatchSize = 15;
            for (let i = 0; i < playerIds.length; i += playerBatchSize) {
              const batch = playerIds.slice(i, i + playerBatchSize);
              const { data: players, error: playersError } = await supabase
                .from('players')
                .select('id, position, adp')
                .in('id', batch);
              if (playersError) {
                playerBatchesFailed += 1;
                console.warn('[Badges] Player batch failed:', playersError.message, 'batch size:', batch.length);
              }
              (players || []).forEach((p) => playersMap.set(p.id, { ...p, rank: p.adp }));
            }
          }
          diagnostics.picksCount = picksData.length;
          diagnostics.playerIdsCount = playerIds.length;
          diagnostics.playersLoaded = playersMap.size;
          diagnostics.playerBatchesFailed = playerBatchesFailed;

          for (const draft of drafts) {
            const d = draft as { user_detected_archetype_index?: number | null };
            let idx: number | null =
              typeof d.user_detected_archetype_index === 'number' &&
              d.user_detected_archetype_index >= 0 &&
              d.user_detected_archetype_index < FULL_ARCHETYPE_LIST.length
                ? d.user_detected_archetype_index
                : null;
            if (idx === null) {
              const picks = picksData.filter((p) => p.mock_draft_id === draft.id);
              const picksWithPlayer = picks.map((p) => ({
                ...p,
                player: playersMap.get(p.player_id) || null,
              }));
              const limits = draft.league_id ? leaguesMap.get(draft.league_id)?.position_limits : undefined;
              const flex = limits?.FLEX ?? 1;
              const bench = limits?.BENCH ?? 6;
              idx = getArchetypeIndexForTeam(picksWithPlayer, draft.user_pick_position, {
                flexSlots: flex,
                benchSize: bench,
                numTeams: draft.num_teams,
              });
            }
            if (idx !== null && !byIndex.has(idx)) {
              byIndex.set(idx, { draftName: draft.name, draftId: draft.id });
            }
          }
        }
      }

      const tempIds = tempDraftStorage.getDraftList();
      const tempPlayerIds = new Set<string>();
      for (const id of tempIds) {
        const temp = tempDraftStorage.getDraft(id);
        if (!temp || temp.draft.status !== 'completed' || !temp.picks?.length) continue;
        temp.picks.forEach((p: DraftPick) => {
          if (p.player_id) tempPlayerIds.add(p.player_id);
        });
      }
      const tempPlayersMap = new Map<string, { position?: string; rank?: number; adp?: number }>();
      let tempPlayerBatchesFailed = 0;
      if (tempPlayerIds.size > 0) {
        const ids = Array.from(tempPlayerIds);
        const tempBatchSize = 15;
        for (let i = 0; i < ids.length; i += tempBatchSize) {
          const batch = ids.slice(i, i + tempBatchSize);
          const { data: pl, error: plError } = await supabase.from('players').select('id, position, adp').in('id', batch);
          if (plError) {
            tempPlayerBatchesFailed += 1;
            console.warn('[Badges] Temp player batch failed:', plError.message);
          }
          (pl || []).forEach((p) => tempPlayersMap.set(p.id, { ...p, rank: p.adp }));
        }
      }
      diagnostics.tempPlayerBatchesFailed = tempPlayerBatchesFailed;
      const tempSettings = tempSettingsStorage.get();
      const tempLimits = tempSettings?.positionLimits as { FLEX?: number; BENCH?: number } | undefined;
      for (const id of tempIds) {
        const temp = tempDraftStorage.getDraft(id);
        if (!temp || temp.draft.status !== 'completed' || !temp.picks?.length) continue;
        const draft = temp.draft;
        let idx: number | null =
          typeof draft.user_detected_archetype_index === 'number' &&
          draft.user_detected_archetype_index >= 0 &&
          draft.user_detected_archetype_index < FULL_ARCHETYPE_LIST.length
            ? draft.user_detected_archetype_index
            : null;
        if (idx === null) {
          const picks = temp.picks.map((p: DraftPick) => ({
            ...p,
            player: tempPlayersMap.get(p.player_id) || null,
          }));
          const flex = tempLimits?.FLEX ?? 1;
          const bench = tempLimits?.BENCH ?? 6;
          idx = getArchetypeIndexForTeam(picks, draft.user_pick_position, {
            flexSlots: flex,
            benchSize: bench,
            numTeams: draft.num_teams,
          });
        }
        if (idx !== null && !byIndex.has(idx)) {
          byIndex.set(idx, { draftName: draft.name, draftId: draft.id });
        }
      }

      diagnostics.earnedCount = byIndex.size;
      setLastDiagnostics(diagnostics);
      console.log('[Badges]', 'drafts=', diagnostics.draftsCount, 'picks=', diagnostics.picksCount, 'playerIds=', diagnostics.playerIdsCount, 'playersLoaded=', diagnostics.playersLoaded, 'playerBatchesFailed=', diagnostics.playerBatchesFailed, 'tempBatchesFailed=', diagnostics.tempPlayerBatchesFailed, 'earned=', diagnostics.earnedCount);
      if (diagnostics.playerBatchesFailed > 0 || diagnostics.tempPlayerBatchesFailed > 0) {
        console.warn('[Badges] Some player batches failed — badge count may be incomplete. Try refreshing.');
      }

      setEarned({ byIndex, count: byIndex.size });
    } catch (err) {
      console.error('Failed to fetch earned archetypes:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEarnedArchetypes(true);
  }, [fetchEarnedArchetypes]);

  // Refetch when arriving from draft completion (state passed by DraftRoom)
  useEffect(() => {
    const state = location.state as { fromDraftComplete?: boolean } | null;
    if (state?.fromDraftComplete) {
      navigate(location.pathname, { replace: true, state: {} });
      setTimeout(() => fetchEarnedArchetypes(false), 300);
    }
  }, [location.state, location.pathname, navigate, fetchEarnedArchetypes]);

  // Refetch when page gains focus (e.g. after completing a draft)
  useEffect(() => {
    const onFocus = () => fetchEarnedArchetypes(false);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchEarnedArchetypes]);

  // Delayed refetch on mount to catch drafts that just completed (DB/temp save may be in-flight)
  useEffect(() => {
    const t = setTimeout(() => fetchEarnedArchetypes(false), 1500);
    return () => clearTimeout(t);
  }, [fetchEarnedArchetypes]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  const earnedByIndex = earned.byIndex;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Award className="w-10 h-10 text-amber-500" />
            <div>
              <h1 className="font-display text-3xl tracking-wide">Archetype Badges</h1>
              <p className="text-muted-foreground">
                {earned.count} of {FULL_ARCHETYPE_LIST.length} unlocked — complete drafts to earn more
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchEarnedArchetypes(true)} disabled={loading} className="gap-2">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {lastDiagnostics && (lastDiagnostics.playerBatchesFailed > 0 || lastDiagnostics.tempPlayerBatchesFailed > 0) && (
          <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200">
            <p className="font-medium">Some player data failed to load</p>
            <p className="text-sm mt-1 text-muted-foreground">
              DB player batches failed: {lastDiagnostics.playerBatchesFailed}
              {lastDiagnostics.tempPlayerBatchesFailed > 0 && ` • Temp batches failed: ${lastDiagnostics.tempPlayerBatchesFailed}`}
              — badge count may be incomplete. Check the console for &quot;[Badges]&quot; logs and try Refresh.
            </p>
            <p className="text-xs mt-2 opacity-80">
              Drafts: {lastDiagnostics.draftsCount} • Picks: {lastDiagnostics.picksCount} • Player IDs: {lastDiagnostics.playerIdsCount} • Loaded: {lastDiagnostics.playersLoaded} • Earned: {lastDiagnostics.earnedCount}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {FULL_ARCHETYPE_LIST.map((a, index) => {
            const earnedInfo = earnedByIndex.get(index);
            const isEarned = !!earnedInfo;
            return (
              <div
                key={index}
                className={cn(
                  'glass-card p-3 rounded-xl flex flex-col items-center justify-center min-h-[90px]',
                  !isEarned && 'opacity-80'
                )}
              >
                <ArchetypeBadge
                  archetypeName={a.name}
                  archetypeIndex={index}
                  iconOnly
                  size="md"
                  earnedFromDraft={earnedInfo?.draftName}
                  locked={!isEarned}
                  className="shrink-0"
                />
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default Badges;
