/**
 * Badges page — single grid: standard archetypes (master order), then chaos badges (master order).
 * Earned = composed art; unearned = locked.png. Click an earned badge for detail + roster.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { ArchetypeBadge } from '@/components/ArchetypeBadge';
import { PositionBadge } from '@/components/PositionBadge';
import { getArchetypeIndexForTeam } from '@/utils/archetypeDetection';
import { tempDraftStorage, tempSettingsStorage } from '@/utils/temporaryStorage';
import { ARCHETYPE_LIST, FULL_ARCHETYPE_LIST } from '@/constants/archetypeListWithImproviser';
import { getArchetypeByName } from '@/constants/archetypeMappings.generated';
import { getArchetypeDescription } from '@/constants/archetypeDescriptions';
import { BADGE_MASTER_SORT_ID_BY_NAME, getArchetypeBadgePublicUrl } from '@/constants/archetypeBadgeAssets.generated';
import { CHAOS_ARCHETYPES, getChaosArchetypeByName } from '@/constants/chaosArchetypes';
import { Loader2, Award, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn, capitalizeSentenceStart } from '@/lib/utils';
import type { DraftPick } from '@/types/database';

interface EarnedSlot {
  draftName: string;
  draftId: string;
  /** ISO timestamp — most recent draft wins when merging. */
  unlockedAt: string;
}

function mergeEarnedIndex(map: Map<number, EarnedSlot>, idx: number, slot: EarnedSlot) {
  const cur = map.get(idx);
  if (!cur || new Date(slot.unlockedAt) > new Date(cur.unlockedAt)) {
    map.set(idx, slot);
  }
}

function mergeEarnedChaos(map: Map<string, EarnedSlot>, name: string, slot: EarnedSlot) {
  const cur = map.get(name);
  if (!cur || new Date(slot.unlockedAt) > new Date(cur.unlockedAt)) {
    map.set(name, slot);
  }
}

function unlockedAtFromDraft(d: { completed_at?: string | null; created_at?: string }): string {
  return (d.completed_at || d.created_at || '').trim() || new Date(0).toISOString();
}

/** Flavor text for standard archetypes; chaos uses its own copy. Falls back to strategy summary. */
function badgeDetailArchetypeCopy(archetypeName: string): string {
  const chaos = getChaosArchetypeByName(archetypeName);
  if (chaos?.flavorText?.trim()) return capitalizeSentenceStart(chaos.flavorText);
  const named = getArchetypeByName(archetypeName);
  if (named?.flavorText?.trim()) return capitalizeSentenceStart(named.flavorText);
  if (named?.strategies) return getArchetypeDescription(named.strategies);
  return '';
}

/** Map: archetype index -> slot for the most recent draft that earned that index. */
interface EarnedState {
  byIndex: Map<number, EarnedSlot>;
  count: number;
}
/** Map: chaos archetype name -> slot (most recent). */
interface EarnedChaosState {
  byName: Map<string, EarnedSlot>;
  count: number;
}

interface RosterRow {
  pick_number: number;
  round_number: number;
  name: string;
  position: string;
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
  const [earnedChaos, setEarnedChaos] = useState<EarnedChaosState>({ byName: new Map(), count: 0 });
  const [loading, setLoading] = useState(true);
  const [lastDiagnostics, setLastDiagnostics] = useState<FetchDiagnostics | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailArchetypeName, setDetailArchetypeName] = useState('');
  const [detailImageUrl, setDetailImageUrl] = useState<string | undefined>();
  const [detailRoster, setDetailRoster] = useState<RosterRow[]>([]);
  const [detailArchetypeCopy, setDetailArchetypeCopy] = useState('');

  /** Master list order 1–360 (icon_prompts #). `listIndex` is index into ARCHETYPE_LIST / FULL_ARCHETYPE_LIST. */
  const badgeGridRows = useMemo(() => {
    return ARCHETYPE_LIST.map((archetype, listIndex) => ({
      archetype,
      listIndex,
      sortId: BADGE_MASTER_SORT_ID_BY_NAME[archetype.name] ?? 99999,
    })).sort((x, y) => x.sortId - y.sortId || x.listIndex - y.listIndex);
  }, []);

  const chaosDisplayOrder = useMemo(
    () =>
      [...CHAOS_ARCHETYPES].sort(
        (a, b) =>
          (BADGE_MASTER_SORT_ID_BY_NAME[a.name] ?? 0) - (BADGE_MASTER_SORT_ID_BY_NAME[b.name] ?? 0)
      ),
    []
  );

  const loadBadgeRoster = useCallback(async (draftId: string) => {
    setDetailLoading(true);
    setDetailRoster([]);
    try {
      const temp = tempDraftStorage.getDraft(draftId);
      if (temp?.picks?.length && temp.draft) {
        const team = temp.draft.user_pick_position;
        const userPicks = temp.picks
          .filter((p) => p.team_number === team)
          .sort((a, b) => a.pick_number - b.pick_number);
        const ids = [...new Set(userPicks.map((p) => p.player_id).filter(Boolean))];
        if (ids.length === 0) {
          return;
        }
        const { data: players } = await supabase.from('players').select('id, name, position').in('id', ids);
        const pm = new Map((players || []).map((p) => [p.id, p]));
        setDetailRoster(
          userPicks.map((p) => ({
            pick_number: p.pick_number,
            round_number: p.round_number,
            name: pm.get(p.player_id)?.name ?? 'Unknown',
            position: pm.get(p.player_id)?.position ?? '—',
          }))
        );
        return;
      }

      const { data: draftRow, error: de } = await supabase
        .from('mock_drafts')
        .select('user_pick_position')
        .eq('id', draftId)
        .maybeSingle();
      if (de || !draftRow) {
        return;
      }
      const { data: picks, error: pe } = await supabase
        .from('draft_picks')
        .select('pick_number, round_number, player_id')
        .eq('mock_draft_id', draftId)
        .eq('team_number', draftRow.user_pick_position)
        .order('pick_number');
      if (pe || !picks?.length) {
        return;
      }
      const pids = picks.map((p) => p.player_id).filter(Boolean);
      const { data: players } = await supabase.from('players').select('id, name, position').in('id', pids);
      const pm = new Map((players || []).map((p) => [p.id, p]));
      setDetailRoster(
        picks.map((p) => ({
          pick_number: p.pick_number,
          round_number: p.round_number,
          name: pm.get(p.player_id)?.name ?? 'Unknown',
          position: pm.get(p.player_id)?.position ?? '—',
        }))
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openUnlockDetail = useCallback(
    (archetypeName: string, slot: EarnedSlot) => {
      setDetailArchetypeName(archetypeName);
      setDetailArchetypeCopy(badgeDetailArchetypeCopy(archetypeName));
      setDetailImageUrl(getArchetypeBadgePublicUrl(archetypeName));
      setDetailOpen(true);
      void loadBadgeRoster(slot.draftId);
    },
    [loadBadgeRoster]
  );

  const fetchEarnedArchetypes = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const byIndex = new Map<number, EarnedSlot>();
    const chaosByName = new Map<string, EarnedSlot>();

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
          .select(
            'id, name, num_teams, user_pick_position, league_id, user_detected_chaos_archetype, user_detected_archetype_index, created_at, completed_at'
          )
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
          const leagueBatchSize = 100;
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
          const idBatchSize = 80;
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
            const playerBatchSize = 100;
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
            const unlockedAt = unlockedAtFromDraft(draft as { completed_at?: string | null; created_at?: string });
            const picks = picksData.filter((p) => p.mock_draft_id === draft.id);
            const picksWithPlayer = picks.map((p) => ({
              ...p,
              player: playersMap.get(p.player_id) || null,
            }));
            const dRow = draft as { user_detected_archetype_index?: number | null };
            const storedIndexOk =
              typeof dRow.user_detected_archetype_index === 'number' &&
              dRow.user_detected_archetype_index >= 0 &&
              dRow.user_detected_archetype_index < ARCHETYPE_LIST.length;

            let idx: number | null = null;
            if (storedIndexOk) {
              idx = dRow.user_detected_archetype_index!;
            } else if (picksWithPlayer.length > 0) {
              const limits = draft.league_id ? leaguesMap.get(draft.league_id)?.position_limits : undefined;
              const flex = limits?.FLEX ?? 1;
              const bench = limits?.BENCH ?? 6;
              idx = getArchetypeIndexForTeam(picksWithPlayer, draft.user_pick_position, {
                flexSlots: flex,
                benchSize: bench,
                numTeams: draft.num_teams,
              });
            }
            if (idx !== null) {
              mergeEarnedIndex(byIndex, idx, {
                draftName: draft.name,
                draftId: draft.id,
                unlockedAt,
              });
            }
            const chaosName = (draft as { user_detected_chaos_archetype?: string | null }).user_detected_chaos_archetype;
            if (chaosName) {
              mergeEarnedChaos(chaosByName, chaosName, {
                draftName: draft.name,
                draftId: draft.id,
                unlockedAt,
              });
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
        const tempBatchSize = 100;
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
        const unlockedAt = unlockedAtFromDraft(draft);
        const picks = temp.picks.map((p: DraftPick) => ({
          ...p,
          player: tempPlayersMap.get(p.player_id) || null,
        }));
        const tempRow = draft as { user_detected_archetype_index?: number | null };
        const tempStoredOk =
          typeof tempRow.user_detected_archetype_index === 'number' &&
          tempRow.user_detected_archetype_index >= 0 &&
          tempRow.user_detected_archetype_index < ARCHETYPE_LIST.length;

        let idx: number | null = null;
        if (tempStoredOk) {
          idx = tempRow.user_detected_archetype_index!;
        } else {
          idx = getArchetypeIndexForTeam(picks, draft.user_pick_position, {
            flexSlots: tempLimits?.FLEX ?? 1,
            benchSize: tempLimits?.BENCH ?? 6,
            numTeams: draft.num_teams,
          });
        }
        if (idx !== null) {
          mergeEarnedIndex(byIndex, idx, {
            draftName: draft.name,
            draftId: draft.id,
            unlockedAt,
          });
        }
        const chaosName = (draft as { user_detected_chaos_archetype?: string | null }).user_detected_chaos_archetype;
        if (chaosName) {
          mergeEarnedChaos(chaosByName, chaosName, {
            draftName: draft.name,
            draftId: draft.id,
            unlockedAt,
          });
        }
      }

      diagnostics.earnedCount = byIndex.size;
      setLastDiagnostics(diagnostics);
      console.log('[Badges]', 'drafts=', diagnostics.draftsCount, 'picks=', diagnostics.picksCount, 'playerIds=', diagnostics.playerIdsCount, 'playersLoaded=', diagnostics.playersLoaded, 'playerBatchesFailed=', diagnostics.playerBatchesFailed, 'tempBatchesFailed=', diagnostics.tempPlayerBatchesFailed, 'earned=', diagnostics.earnedCount);
      if (diagnostics.playerBatchesFailed > 0 || diagnostics.tempPlayerBatchesFailed > 0) {
        console.warn('[Badges] Some player batches failed — badge count may be incomplete. Try refreshing.');
      }

      setEarned({ byIndex, count: byIndex.size });
      setEarnedChaos({ byName: chaosByName, count: chaosByName.size });
    } catch (err) {
      console.error('Failed to fetch earned archetypes:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEarnedArchetypes(true);
  }, [fetchEarnedArchetypes]);

  useEffect(() => {
    const state = location.state as { fromDraftComplete?: boolean } | null;
    if (state?.fromDraftComplete) {
      navigate(location.pathname, { replace: true, state: {} });
      setTimeout(() => fetchEarnedArchetypes(false), 300);
    }
  }, [location.state, location.pathname, navigate, fetchEarnedArchetypes]);

  useEffect(() => {
    const onFocus = () => fetchEarnedArchetypes(false);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchEarnedArchetypes]);

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
  const totalBadgeSlots = FULL_ARCHETYPE_LIST.length + CHAOS_ARCHETYPES.length;
  const unlockedBadgeCount = earned.count + earnedChaos.count;

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
                {unlockedBadgeCount} of {totalBadgeSlots} badges unlocked — complete drafts to earn more
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

        <Dialog
          open={detailOpen}
          onOpenChange={(open) => {
            setDetailOpen(open);
            if (!open) {
              setDetailRoster([]);
              setDetailLoading(false);
              setDetailArchetypeCopy('');
            }
          }}
        >
          <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle className="font-display pr-8 text-2xl sm:text-3xl md:text-[2rem] font-semibold tracking-[0.06em] leading-snug normal-case">
                {detailArchetypeName}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-3 text-left pr-8">
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {detailArchetypeCopy || 'No description is available for this badge.'}
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:items-start">
              <div className="flex justify-center md:justify-start">
                {detailImageUrl ? (
                  <img
                    src={detailImageUrl}
                    alt=""
                    className="max-h-[min(72vh,560px)] w-full max-w-md object-contain select-none"
                  />
                ) : (
                  <div className="flex max-w-md justify-center py-8">
                    <ArchetypeBadge archetypeName={detailArchetypeName} iconOnly={false} size="md" locked={false} />
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Your roster</h3>
                {detailLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : detailRoster.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Could not load roster for this draft.</p>
                ) : (
                  <ul className="space-y-2 max-h-[min(60vh,480px)] overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin">
                    {detailRoster.map((row) => (
                      <li
                        key={`${row.pick_number}-${row.name}`}
                        className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm"
                      >
                        <span className="text-muted-foreground tabular-nums shrink-0">
                          R{row.round_number} · #{row.pick_number}
                        </span>
                        <span className="flex-1 truncate font-medium text-foreground">{row.name}</span>
                        <PositionBadge position={row.position} className="text-[10px] shrink-0" />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {badgeGridRows.map(({ archetype: a, listIndex }) => {
            const earnedInfo = earnedByIndex.get(listIndex);
            const isEarned = !!earnedInfo;
            return (
              <div
                key={`std-${listIndex}`}
                className={cn(
                  'flex flex-col items-center justify-center min-h-[14rem] py-2',
                  !isEarned && 'opacity-90',
                  isEarned &&
                    'cursor-pointer rounded-lg outline-offset-4 hover:opacity-95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring'
                )}
                role={isEarned ? 'button' : undefined}
                tabIndex={isEarned ? 0 : undefined}
                onClick={isEarned && earnedInfo ? () => openUnlockDetail(a.name, earnedInfo) : undefined}
                onKeyDown={
                  isEarned && earnedInfo
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openUnlockDetail(a.name, earnedInfo);
                        }
                      }
                    : undefined
                }
              >
                <ArchetypeBadge
                  archetypeName={a.name}
                  archetypeIndex={listIndex}
                  iconOnly
                  size="md"
                  earnedFromDraft={earnedInfo?.draftName}
                  locked={!isEarned}
                  className="shrink-0"
                />
              </div>
            );
          })}
          {chaosDisplayOrder.map((chaos) => {
            const earnedInfo = earnedChaos.byName.get(chaos.name);
            const isEarned = !!earnedInfo;
            return (
              <div
                key={`chaos-${chaos.name}`}
                className={cn(
                  'flex flex-col items-center justify-center min-h-[14rem] py-2',
                  !isEarned && 'opacity-90',
                  isEarned &&
                    'cursor-pointer rounded-lg outline-offset-4 hover:opacity-95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring'
                )}
                role={isEarned ? 'button' : undefined}
                tabIndex={isEarned ? 0 : undefined}
                onClick={isEarned && earnedInfo ? () => openUnlockDetail(chaos.name, earnedInfo) : undefined}
                onKeyDown={
                  isEarned && earnedInfo
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openUnlockDetail(chaos.name, earnedInfo);
                        }
                      }
                    : undefined
                }
              >
                <ArchetypeBadge
                  archetypeName={chaos.name}
                  iconOnly
                  size="md"
                  earnedFromDraft={earnedInfo?.draftName}
                  locked={!isEarned}
                  flavorText={chaos.flavorText}
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
