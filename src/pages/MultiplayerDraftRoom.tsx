import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { BrandedLoader } from '@/components/BrandedLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { PositionBadge } from '@/components/PositionBadge';
import { DraftAvailablePlayerRow } from '@/components/DraftAvailablePlayerRow';
import { MyRoster } from '@/components/MyRoster';
import {
  DraftMobilePanelTabs,
  draftMobilePanelClass,
  type DraftMobilePanel,
} from '@/components/DraftMobilePanelTabs';
import { MultiplayerDraftChat } from '@/components/MultiplayerDraftChat';
import { DraftGradeBanner } from '@/components/DraftGradeDisplay';
import { ArchetypeBadge } from '@/components/ArchetypeBadge';
import {
  DraftTeamResultDialog,
  fillDraftTeamLineup,
} from '@/components/DraftTeamResultDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { usePlayer2025Stats } from '@/hooks/usePlayer2025Stats';
import { useStickScrollToBottom } from '@/hooks/useStickScrollToBottom';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateGuestSessionId } from '@/utils/temporaryStorage';
import {
  fetchMpDraft,
  fetchMpKeepers,
  fetchMpParticipants,
  fetchMpPicks,
  fetchMpResults,
  mpMakePick,
  mpSaveResults,
  mpSetAutodraft,
  mpSetConnected,
  mpTickDraft,
} from '@/utils/multiplayerDraftApi';
import {
  mpCanDraftPosition,
  mpNormalizePos,
  mpRoundForPick,
  mpTeamForPick,
} from '@/utils/multiplayerDraftMath';
import { fetchPlayersByIds } from '@/utils/fetchPlayersByIds';
import {
  computeDraftGrade,
  parseStoredDraftGrade,
  toDraftGradePicks,
  type DraftGradeResult,
} from '@/utils/draftGrade';
import {
  detectArchetypeIndex,
  detectArchetypeName,
  type DraftPickWithPlayer,
} from '@/utils/archetypeDetection';
import { detectChaosArchetype, type ChaosPick } from '@/utils/chaosDetection';
import { buildDraftConfig } from '@/constants/buildDraftConfig';
import { getArchetypeByNameOrImproviser } from '@/constants/archetypeListWithImproviser';
import { getChaosArchetypeByName, isChaosReplace } from '@/constants/chaosArchetypes';
import {
  buildDefenseRankFromList,
  buildPositionAdpRankMap,
  resolvePositionAdpRankForDisplay,
} from '@/utils/positionAdpRank';
import { PlayerDetailDialog } from '@/components/PlayerDetailDialog';
import type {
  MultiplayerDraft,
  MultiplayerKeeper,
  MultiplayerParticipant,
  MultiplayerPick,
  MultiplayerResult,
} from '@/types/multiplayerDraft';
import type { DraftPick, Player, RankedPlayer } from '@/types/database';
import { toast } from 'sonner';
import { ChevronRight, LogOut, Search, Timer, Trophy, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { displayTeamAbbrevOrFa } from '@/utils/teamMapping';
import { Label } from '@/components/ui/label';
import {
  buildDraftListTierBreakBeforeIds,
  loadPersonalDraftBoardOverlay,
  type PersonalDraftBoardOverlay,
} from '@/utils/draftPersonalBoard';

const RAPID_CPU_PICK_GAP_MS = 360;

function cpuPickDelayMs(speed: string): number {
  const baseDelay = 750;
  switch (speed) {
    case 'slow':
      return baseDelay * 2;
    case 'fast':
      return baseDelay / 2;
    case 'rapid':
    case 'instant':
      return RAPID_CPU_PICK_GAP_MS;
    default:
      return baseDelay;
  }
}

const MultiplayerDraftRoom = () => {
  const { draftId } = useParams<{ draftId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const player2025Stats = usePlayer2025Stats();
  const guestSessionId = useMemo(
    () => (!user ? getOrCreateGuestSessionId() : null),
    [user]
  );

  const [draft, setDraft] = useState<MultiplayerDraft | null>(null);
  const [participants, setParticipants] = useState<MultiplayerParticipant[]>([]);
  const [keepers, setKeepers] = useState<MultiplayerKeeper[]>([]);
  const [picks, setPicks] = useState<MultiplayerPick[]>([]);
  const {
    containerRef: draftBoardRef,
    onScroll: handleDraftBoardScroll,
    scrolledUp: draftBoardScrolledUp,
  } = useStickScrollToBottom(picks.length);
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [personalBoard, setPersonalBoard] = useState<PersonalDraftBoardOverlay | null>(null);
  const [results, setResults] = useState<MultiplayerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [mobilePanel, setMobilePanel] = useState<DraftMobilePanel>('players');
  const [viewingResultTeam, setViewingResultTeam] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [myGrade, setMyGrade] = useState<DraftGradeResult | null>(null);
  const [selectedPlayerForStats, setSelectedPlayerForStats] = useState<Player | null>(null);
  const [isStatsDialogOpen, setIsStatsDialogOpen] = useState(false);

  const positionAdpRankMap = useMemo(() => buildPositionAdpRankMap(players), [players]);
  const communityDefenseRankFromList = useMemo(
    () =>
      buildDefenseRankFromList(
        players.map((p) => ({ id: p.id, position: p.position, rank: p.rank }))
      ),
    [players]
  );

  const openPlayerStats = useCallback((player: RankedPlayer) => {
    setSelectedPlayerForStats(player);
    setIsStatsDialogOpen(true);
  }, []);
  const tickLock = useRef(false);
  const gradedRef = useRef(false);
  const boardLoadedRef = useRef(false);
  const lastCpuTickAtRef = useRef(0);
  const nextCpuDueAtRef = useRef(0);
  const autodraftToastRef = useRef(false);
  const leavingRef = useRef(false);
  const draftRef = useRef<MultiplayerDraft | null>(null);
  const participantsRef = useRef<MultiplayerParticipant[]>([]);
  const keepersRef = useRef<MultiplayerKeeper[]>([]);
  const picksRef = useRef<MultiplayerPick[]>([]);
  const guestSessionIdRef = useRef<string | null>(null);
  const draftIdRef = useRef<string | undefined>(draftId);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  /** Display clock epoch — resets to pick_timer on every pick (human or CPU). */
  const pickClockRef = useRef<{ pick: number; startedAt: number; seconds: number } | null>(null);
  guestSessionIdRef.current = guestSessionId;
  draftIdRef.current = draftId;

  const me = useMemo(() => {
    if (user) return participants.find((p) => p.user_id === user.id) || null;
    if (guestSessionId) {
      return participants.find((p) => p.guest_session_id === guestSessionId) || null;
    }
    return null;
  }, [participants, user, guestSessionId]);

  const myTeam = me?.team_number ?? null;
  const currentTeam = draft
    ? mpTeamForPick(draft.current_pick_number, draft.num_teams, draft.draft_order)
    : 1;
  const currentRound = draft
    ? mpRoundForPick(draft.current_pick_number, draft.num_teams)
    : 1;
  const isMyTurn =
    draft?.status === 'drafting' && me?.team_number != null && me.team_number === currentTeam;
  const humanOnClock = participants.some((p) => p.team_number === currentTeam);
  const onClockParticipant = participants.find((p) => p.team_number === currentTeam) || null;

  const positionLimits = (draft?.position_limits || { BENCH: 6 }) as {
    QB?: number;
    RB?: number;
    WR?: number;
    TE?: number;
    FLEX?: number;
    K?: number;
    DEF?: number;
    BENCH?: number;
  };

  const draftedIds = useMemo(() => new Set(picks.map((p) => p.player_id)), [picks]);
  const keeperIds = useMemo(() => new Set(keepers.map((k) => k.player_id)), [keepers]);

  const picksAsDraftPicks: DraftPick[] = useMemo(
    () =>
      picks.map((p) => ({
        id: p.id,
        mock_draft_id: p.draft_id,
        player_id: p.player_id,
        team_number: p.team_number,
        round_number: p.round_number,
        pick_number: p.pick_number,
        created_at: p.created_at,
        is_autodraft: p.is_autodraft,
      })),
    [picks]
  );

  const myTeamPosCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of picks) {
      if (p.team_number !== myTeam) continue;
      const pl = players.find((x) => x.id === p.player_id);
      const pos = mpNormalizePos(pl?.position);
      if (!pos) continue;
      counts[pos] = (counts[pos] ?? 0) + 1;
    }
    // Future keepers on my team count toward position caps
    for (const k of keepers) {
      if (k.team_number !== myTeam || k.round_number <= currentRound) continue;
      const pl = players.find((x) => x.id === k.player_id);
      const pos = mpNormalizePos(pl?.position);
      if (!pos) continue;
      counts[pos] = (counts[pos] ?? 0) + 1;
    }
    return counts;
  }, [picks, players, keepers, myTeam, currentRound]);

  const myRosterSize = useMemo(
    () => picks.filter((p) => p.team_number === myTeam).length,
    [picks, myTeam]
  );

  const available = useMemo(() => {
    if (!draft) {
      return players.filter((p) => !draftedIds.has(p.id) && !keeperIds.has(p.id));
    }
    const limits = positionLimits as Record<string, number | undefined>;
    return players.filter((p) => {
      if (draftedIds.has(p.id) || keeperIds.has(p.id)) return false;
      return mpCanDraftPosition({
        position: p.position,
        positionCounts: myTeamPosCounts,
        rosterSize: myRosterSize,
        numRounds: draft.num_rounds,
        positionLimits: limits,
      });
    });
  }, [players, draftedIds, keeperIds, draft, positionLimits, myTeamPosCounts, myRosterSize]);

  const personalMetaById = personalBoard?.metaById;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = available.filter((p) => {
      const pos = mpNormalizePos(p.position);
      if (positionFilter !== 'ALL' && pos !== positionFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.team || '').toLowerCase().includes(q) ||
        p.position.toLowerCase().includes(q)
      );
    });
    const personalRank = (p: RankedPlayer) =>
      personalMetaById?.get(p.id)?.overallRank ?? p.rank;
    return list.sort((a, b) => personalRank(a) - personalRank(b));
  }, [available, search, positionFilter, personalMetaById]);

  const availableListRows = useMemo(() => {
    // Keep a deep enough window that short viewports can still scroll a wide board.
    const slice = filtered.slice(0, 200);
    const breakBeforeIds =
      positionFilter === 'ALL'
        ? personalBoard?.allViewBreakBeforeIds ?? new Set<string>()
        : buildDraftListTierBreakBeforeIds(
            slice.map((p) => ({
              id: p.id,
              tier: personalMetaById?.get(p.id)?.tier ?? null,
            }))
          );
    return slice.map((player) => {
      const meta = personalMetaById?.get(player.id);
      return {
        player,
        displayRank: meta?.overallRank ?? player.rank,
        myPosRank: meta?.posRank ?? null,
        tier: meta?.tier ?? null,
        hasTierBreakBefore: breakBeforeIds.has(player.id),
      };
    });
  }, [filtered, personalMetaById, positionFilter, personalBoard?.allViewBreakBeforeIds]);

  const mpBucketKey = draft
    ? `${draft.scoring_format || 'ppr'}/${draft.league_type || 'season'}/${Boolean(draft.is_superflex)}/${
        draft.player_pool === 'rookies' || draft.player_pool === 'rookies_only'
      }/${draft.source_league_id ?? 'none'}`
    : null;
  const mpPoolKey = useMemo(() => players.map((p) => p.id).join(','), [players]);

  // Viewer's personal rankings + tiers (board/CPU order stays community).
  useEffect(() => {
    if (!draft || !mpBucketKey || players.length === 0) {
      setPersonalBoard(null);
      return;
    }
    let cancelled = false;
    const rookiesOnly =
      draft.player_pool === 'rookies' || draft.player_pool === 'rookies_only';
    void loadPersonalDraftBoardOverlay({
      userId: user?.id ?? null,
      leagueId: draft.source_league_id,
      bucket: {
        scoringFormat: draft.scoring_format || 'ppr',
        leagueType: draft.league_type || 'season',
        isSuperflex: Boolean(draft.is_superflex),
        rookiesOnly,
      },
      poolPlayers: players.map((p) => ({ id: p.id, position: p.position })),
    }).then((overlay) => {
      if (!cancelled) setPersonalBoard(overlay);
    });
    return () => {
      cancelled = true;
    };
    // mpPoolKey fingerprints the board; avoid reloading on every draft poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draft fields via mpBucketKey
  }, [mpBucketKey, mpPoolKey, user?.id]);

  // If the active position chip has no draftable players left, snap back to ALL
  useEffect(() => {
    if (positionFilter === 'ALL') return;
    const stillOpen = available.some((p) => mpNormalizePos(p.position) === positionFilter);
    if (!stillOpen) setPositionFilter('ALL');
  }, [available, positionFilter]);

  const teamLabel = useCallback(
    (n: number) => {
      const custom = draft?.team_names?.[String(n)]?.trim();
      if (custom) return custom;
      const part = participants.find((p) => p.team_number === n);
      if (part?.display_name?.trim()) return part.display_name.trim();
      return `Team ${n}`;
    },
    [participants, draft?.team_names]
  );

  const getStartingSlots = useCallback((): { label: string; positions: string[] }[] => {
    const flexCount = positionLimits?.FLEX ?? (draft?.is_superflex ? 2 : 1);
    const base = [
      { label: 'QB', positions: ['QB'] },
      { label: 'RB1', positions: ['RB'] },
      { label: 'RB2', positions: ['RB'] },
      { label: 'WR1', positions: ['WR'] },
      { label: 'WR2', positions: ['WR'] },
      { label: 'TE', positions: ['TE'] },
    ];
    const flexPositions = draft?.is_superflex
      ? ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'D/ST']
      : ['RB', 'WR', 'TE'];
    const flexSlots = Array.from({ length: flexCount }, () => ({
      label: 'FLEX',
      positions: flexPositions,
    }));
    return [
      ...base,
      ...flexSlots,
      { label: 'DEF', positions: ['DEF', 'D/ST'] },
      { label: 'K', positions: ['K'] },
    ];
  }, [positionLimits?.FLEX, draft?.is_superflex]);

  const loadPlayersFromBoard = useCallback(async (d: MultiplayerDraft) => {
    const ids = d.board_player_ids || [];
    if (!ids.length) {
      setPlayers([]);
      boardLoadedRef.current = true;
      return;
    }
    try {
      const data = await fetchPlayersByIds(ids);
      const byId = new Map(data.map((p) => [p.id, p]));
      // Board order is community consensus (same as solo mock). Use board index as ADP.
      const ranked: RankedPlayer[] = ids
        .map((id, idx) => {
          const p = byId.get(id);
          if (!p) return null;
          const boardRank = idx + 1;
          return { ...p, rank: boardRank, adp: boardRank } as RankedPlayer;
        })
        .filter(Boolean) as RankedPlayer[];
      setPlayers(ranked);
      if (ranked.length === 0) {
        toast.error('Could not load the player board');
      } else if (ranked.length < ids.length) {
        console.warn(`Loaded ${ranked.length}/${ids.length} board players`);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to load players');
      setPlayers([]);
    } finally {
      boardLoadedRef.current = true;
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!draftId) return;
    const d = await fetchMpDraft(draftId);
    if (!d) {
      toast.error('Draft not found');
      navigate('/mock-draft');
      return;
    }
    draftRef.current = d;
    setDraft(d);
    const [parts, ks, pk, res] = await Promise.all([
      fetchMpParticipants(d.id),
      fetchMpKeepers(d.id),
      fetchMpPicks(d.id),
      fetchMpResults(d.id),
    ]);
    participantsRef.current = parts;
    keepersRef.current = ks;
    picksRef.current = pk;
    setParticipants(parts);
    setKeepers(ks);
    setPicks(pk);
    setResults(res);
    if (!boardLoadedRef.current && d.board_player_ids?.length) {
      await loadPlayersFromBoard(d);
    }
    if (d.status === 'lobby') {
      navigate(`/lobby/${d.invite_code}`);
      return;
    }

    const self = user
      ? parts.find((p) => p.user_id === user.id) || null
      : guestSessionId
        ? parts.find((p) => p.guest_session_id === guestSessionId) || null
        : null;
    if (
      (d.status === 'drafting' || d.status === 'completed') &&
      self?.team_number == null
    ) {
      toast.message('You’re not seated in this draft.');
      navigate('/mock-draft');
    }
  }, [draftId, navigate, loadPlayersFromBoard, user, guestSessionId]);
  refreshRef.current = refresh;

  useEffect(() => {
    if (authLoading || !draftId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        boardLoadedRef.current = false;
        const d = await fetchMpDraft(draftId);
        if (!d) {
          toast.error('Draft not found');
          navigate('/mock-draft');
          return;
        }
        if (!cancelled) {
          setDraft(d);
          await loadPlayersFromBoard(d);
          await refresh();
          try {
            await mpSetConnected(d.id, true, guestSessionId);
          } catch {
            // Guest may still view; rejoin via invite if needed
          }
        }
      } catch (e: any) {
        toast.error(e?.message || 'Failed to load draft');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, draftId]);

  useEffect(() => {
    if (!draft?.id) return;
    const channel = supabase
      .channel(`mp-draft-${draft.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'multiplayer_draft_picks',
          filter: `draft_id=eq.${draft.id}`,
        },
        () => {
          void refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'multiplayer_drafts',
          filter: `id=eq.${draft.id}`,
        },
        () => {
          void refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'multiplayer_draft_participants',
          filter: `draft_id=eq.${draft.id}`,
        },
        () => {
          void refresh();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [draft?.id, refresh]);

  const runTick = useCallback(async () => {
    const id = draftIdRef.current;
    if (!id || tickLock.current || leavingRef.current) return false;
    tickLock.current = true;
    try {
      const result = await mpTickDraft(id, guestSessionIdRef.current);
      await refreshRef.current();
      return Boolean(result?.actions?.length) || result?.status === 'completed';
    } catch (e) {
      console.warn('[mp] tick failed', e);
      return false;
    } finally {
      tickLock.current = false;
    }
  }, []);

  // Stable heartbeat: sync from server + pace CPU/autodraft without being
  // cancelled by realtime refresh storms (that was freezing the draft at 1s).
  useEffect(() => {
    if (!draftId || authLoading) return;
    let stopped = false;

    const computeClock = () => {
      const d = draftRef.current;
      if (!d || d.status !== 'drafting') {
        setTimeRemaining(null);
        pickClockRef.current = null;
        return {
          humanOnClock: false,
          forcedAuto: false,
          deadlineExpired: false,
          keeperDue: false,
          needsAutoTick: false,
        };
      }
      const team = mpTeamForPick(d.current_pick_number, d.num_teams, d.draft_order);
      const round = mpRoundForPick(d.current_pick_number, d.num_teams);
      const onClock = participantsRef.current.find((p) => p.team_number === team) || null;
      const isHuman = Boolean(onClock);
      const forcedAuto =
        Boolean(onClock?.is_autodraft) || onClock?.is_connected === false;
      const keeperDue = keepersRef.current.some((k) => {
        if (k.team_number !== team || k.round_number !== round) return false;
        return !picksRef.current.some((p) => p.player_id === k.player_id);
      });

      // Display clock: always reset to pick_timer when the pick advances (human or CPU).
      // Keeper rounds resolve immediately — don't run a fake countdown while waiting on tick.
      if (d.pick_timer > 0 && !keeperDue) {
        if (
          !pickClockRef.current ||
          pickClockRef.current.pick !== d.current_pick_number
        ) {
          pickClockRef.current = {
            pick: d.current_pick_number,
            startedAt: Date.now(),
            seconds: d.pick_timer,
          };
        }
        const localLeft = Math.max(
          0,
          Math.ceil(
            pickClockRef.current.seconds -
              (Date.now() - pickClockRef.current.startedAt) / 1000
          )
        );
        setTimeRemaining(localLeft);
      } else if (keeperDue) {
        pickClockRef.current = null;
        setTimeRemaining(d.pick_timer > 0 ? d.pick_timer : null);
      } else {
        pickClockRef.current = null;
        setTimeRemaining(null);
      }

      const deadlineExpired =
        !forcedAuto &&
        isHuman &&
        !keeperDue &&
        d.pick_timer > 0 &&
        Boolean(
          pickClockRef.current &&
            pickClockRef.current.pick === d.current_pick_number &&
            pickClockRef.current.seconds -
              (Date.now() - pickClockRef.current.startedAt) / 1000 <=
              0
        );

      return {
        humanOnClock: isHuman,
        forcedAuto,
        deadlineExpired,
        keeperDue,
        needsAutoTick: !isHuman || forcedAuto || deadlineExpired || keeperDue,
      };
    };

    const displayId = window.setInterval(() => {
      if (!stopped) computeClock();
    }, 250);

    const beat = async () => {
      if (stopped || leavingRef.current) return;
      try {
        await refreshRef.current();
      } catch {
        // keep beating
      }
      if (stopped) return;

      const d = draftRef.current;
      if (!d || d.status !== 'drafting') return;

      const clock = computeClock();
      if (!clock.needsAutoTick) {
        nextCpuDueAtRef.current = 0;
        return;
      }

      // Keepers (and forced autodraft) should fire immediately; only pace true CPU seats.
      const delayMs = clock.keeperDue
        ? 50
        : !clock.humanOnClock
          ? cpuPickDelayMs(d.cpu_speed || 'normal')
          : 200;

      if (nextCpuDueAtRef.current <= 0) {
        nextCpuDueAtRef.current = Date.now() + delayMs;
      }

      if (Date.now() < nextCpuDueAtRef.current) return;

      const advanced = await runTick();
      lastCpuTickAtRef.current = performance.now();
      // Schedule next CPU gap only if draft still needs pacing
      const after = draftRef.current;
      if (after?.status === 'drafting') {
        const team = mpTeamForPick(
          after.current_pick_number,
          after.num_teams,
          after.draft_order
        );
        const stillHuman = participantsRef.current.some((p) => p.team_number === team);
        nextCpuDueAtRef.current = stillHuman ? 0 : Date.now() + cpuPickDelayMs(after.cpu_speed || 'normal');
      } else {
        nextCpuDueAtRef.current = 0;
      }
      if (!advanced) {
        // Retry soon if tick no-oped or raced
        nextCpuDueAtRef.current = Date.now() + Math.min(delayMs, 500);
      }
    };

    void beat();
    const beatId = window.setInterval(() => {
      void beat();
    }, 400);

    return () => {
      stopped = true;
      window.clearInterval(displayId);
      window.clearInterval(beatId);
    };
  }, [draftId, authLoading, runTick]);

  useEffect(() => {
    if (me?.is_autodraft && me.missed_turns_streak >= 2 && !autodraftToastRef.current) {
      autodraftToastRef.current = true;
      toast.info('Autodraft enabled after two missed picks in a row');
    }
    if (!me?.is_autodraft) autodraftToastRef.current = false;
  }, [me?.is_autodraft, me?.missed_turns_streak]);

  const handlePick = async (player: RankedPlayer) => {
    if (!draftId || !draft || !isMyTurn || picking || me?.is_autodraft) return;
    if (
      !mpCanDraftPosition({
        position: player.position,
        positionCounts: myTeamPosCounts,
        rosterSize: myRosterSize,
        numRounds: draft.num_rounds,
        positionLimits: positionLimits as Record<string, number | undefined>,
      })
    ) {
      toast.error('That position is full or you need a different starter first');
      return;
    }
    setPicking(true);
    try {
      await mpMakePick(draftId, player.id, guestSessionId);
      await refresh();
      void runTick();
    } catch (e: any) {
      toast.error(e?.message || 'Pick failed');
    } finally {
      setPicking(false);
    }
  };
  const handlePickRef = useRef(handlePick);
  handlePickRef.current = handlePick;
  const onDraftAvailable = useCallback((player: RankedPlayer) => {
    void handlePickRef.current(player);
  }, []);

  const handleToggleAutodraft = async (enabled: boolean) => {
    if (!draftId) return;
    try {
      await mpSetAutodraft(draftId, enabled, guestSessionId);
      await refresh();
      if (enabled) {
        toast.message('Autodraft on — you’ll take the top available player');
        void runTick();
      } else {
        toast.message('Autodraft off');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Could not update autodraft');
    }
  };

  const handleExit = async () => {
    if (!draftId) {
      navigate('/mock-draft');
      return;
    }
    leavingRef.current = true;
    try {
      await mpSetConnected(draftId, false, guestSessionId);
    } catch {
      // still leave
    }
    const code = draft?.invite_code;
    toast.message(
      code
        ? `Left the room. Rejoin anytime via /lobby/${code} or Mock Draft.`
        : 'Left the room. Rejoin from Mock Draft if the draft is still going.'
    );
    navigate('/mock-draft');
  };

  // Only mark disconnected on explicit Exit — pagehide/tab switches were
  // freezing seats and desyncing multi-window sessions.

  useEffect(() => {
    if (!draft || draft.status !== 'completed' || gradedRef.current || !players.length) return;
    gradedRef.current = true;
    (async () => {
      const humans = participants.filter((p) => p.team_number != null);
      const limits = draft.position_limits || {};
      const flexCount = limits.FLEX ?? (draft.is_superflex ? 2 : 1);
      const benchCount = limits.BENCH ?? 6;
      const config = buildDraftConfig(flexCount, benchCount, draft.num_teams);
      const payload: Array<Record<string, unknown>> = [];

      for (const human of humans) {
        const teamRows = picks.filter((p) => p.team_number === human.team_number);
        const gradePicks = toDraftGradePicks(
          teamRows.map((p) => {
            const pl = players.find((x) => x.id === p.player_id);
            return {
              pick_number: p.pick_number,
              round_number: p.round_number,
              is_autodraft: p.is_autodraft,
              is_keeper: p.is_keeper,
              player: pl
                ? {
                    id: pl.id,
                    name: pl.name,
                    position: pl.position,
                    team: pl.team,
                    adp: pl.adp,
                    bye_week: pl.bye_week,
                  }
                : undefined,
            };
          })
        );
        const grade = computeDraftGrade(gradePicks, {
          numTeams: draft.num_teams,
          numRounds: draft.num_rounds,
        });

        const detectionPicks: DraftPickWithPlayer[] = teamRows.map((p) => {
          const pl = players.find((x) => x.id === p.player_id);
          return {
            pick_number: p.pick_number,
            round_number: p.round_number,
            position: pl?.position || 'FLEX',
            rank: pl?.rank ?? p.pick_number,
            adp: pl?.adp ?? p.pick_number,
          };
        });
        const archIdx = detectArchetypeIndex(detectionPicks, config);
        const archName = detectArchetypeName(detectionPicks, config);
        const chaosPicks: ChaosPick[] = detectionPicks.map((p, i) => {
          const pl = players.find((x) => x.id === teamRows[i]?.player_id);
          return { ...p, team: pl?.team, name: pl?.name };
        });
        const chaosName = detectChaosArchetype(chaosPicks, {
          totalRounds: config.totalRounds,
          leagueSize: config.leagueSize,
          isSuperflex: draft.is_superflex,
        });

        const loggedIn = Boolean(human.user_id);
        payload.push({
          team_number: human.team_number,
          user_id: human.user_id,
          guest_session_id: human.guest_session_id,
          grade_letter: grade?.grade ?? null,
          grade_score: grade?.numericScore ?? null,
          grade_payload: grade,
          detected_archetype: archName,
          detected_archetype_index: archIdx,
          detected_chaos_archetype: chaosName,
          badge_awarded: loggedIn && Boolean(archName || chaosName),
        });

        if (human.team_number === me?.team_number && grade) {
          setMyGrade(grade);
        }
      }

      try {
        if (!results.length) {
          await mpSaveResults(draft.id, payload);
          setResults(await fetchMpResults(draft.id));
        } else if (me?.team_number != null) {
          const existing = results.find((r) => r.team_number === me.team_number);
          if (existing?.grade_payload) {
            setMyGrade(existing.grade_payload as unknown as DraftGradeResult);
          }
        }
      } catch (e: any) {
        console.warn('save results', e);
      }
    })();
  }, [draft, participants, picks, players, me?.team_number, results]);

  if (authLoading || loading || !draft || myTeam == null) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="flex min-h-[70vh] items-center justify-center">
          <BrandedLoader />
        </main>
      </div>
    );
  }

  const totalPicks = draft.num_teams * draft.num_rounds;
  const displayPick = Math.min(draft.current_pick_number, totalPicks);
  const myResult = results.find((r) => r.team_number === myTeam) || null;

  if (draft.status === 'completed') {
    const userPicks = picks
      .filter((p) => p.team_number === myTeam)
      .sort((a, b) => a.pick_number - b.pick_number);
    const draftedPlayers = userPicks
      .map((pick) => players.find((p) => p.id === pick.player_id))
      .filter((p): p is RankedPlayer => !!p);
    const startingSlots = getStartingSlots();
    const benchCount = positionLimits?.BENCH ?? 6;
    const myKeeperIds = keepers
      .filter((k) => k.team_number === myTeam)
      .map((k) => k.player_id);
    const { filledSlots, benchPlayers } = fillDraftTeamLineup(
      draftedPlayers,
      startingSlots,
      benchCount,
      { keeperPlayerIds: myKeeperIds, isSuperflex: draft.is_superflex }
    );

    const detectedArchetype =
      myResult?.detected_archetype ||
      (userPicks.length
        ? detectArchetypeName(
            userPicks.map((p) => {
              const pl = players.find((x) => x.id === p.player_id);
              return {
                pick_number: p.pick_number,
                round_number: p.round_number,
                position: pl?.position || '',
                rank: pl?.rank ?? p.pick_number,
                adp: pl?.adp ?? p.pick_number,
              };
            }),
            buildDraftConfig(
              positionLimits.FLEX ?? (draft.is_superflex ? 2 : 1),
              positionLimits.BENCH ?? 6,
              draft.num_teams
            )
          )
        : '');
    const chaosName = myResult?.detected_chaos_archetype ?? null;
    const chaosMeta = chaosName ? getChaosArchetypeByName(chaosName) : null;
    const isReplaceChaos = chaosName != null && isChaosReplace(chaosName);
    const archetypeMeta = getArchetypeByNameOrImproviser(detectedArchetype);
    const mainFlavor = archetypeMeta?.flavorText;
    const flavorText = isReplaceChaos ? (chaosMeta?.flavorText ?? null) : mainFlavor;
    const headlineBadgeLabel =
      isReplaceChaos && chaosName
        ? chaosName
        : !isReplaceChaos && chaosName && chaosMeta && detectedArchetype
          ? `${detectedArchetype} & ${chaosName}`
          : detectedArchetype;
    const showBadge = Boolean(user && (myResult?.badge_awarded || detectedArchetype || chaosName));
    const completionGrade =
      myGrade ||
      (myResult?.grade_payload as unknown as DraftGradeResult | null) ||
      null;

    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 py-4 sm:py-5">
          <div className="text-center mb-3">
            <Trophy className="w-8 h-8 text-accent mx-auto mb-1.5" />
            <h1 className="font-display text-2xl sm:text-3xl mb-0.5">DRAFT COMPLETE!</h1>
            {showBadge && headlineBadgeLabel && (
              <p className="text-sm font-medium text-accent mb-2">
                You&apos;re {headlineBadgeLabel}
              </p>
            )}
            {!user && (
              <p className="text-xs text-muted-foreground mb-2">
                Sign in next time to earn and keep badges.
              </p>
            )}
            {completionGrade && (
              <DraftGradeBanner
                compact
                result={completionGrade}
                className="w-full max-w-4xl mx-auto mb-2 text-left"
              >
                {showBadge &&
                  (isReplaceChaos && chaosMeta ? (
                    <ArchetypeBadge
                      archetypeName={chaosName!}
                      iconOnly
                      size="lg"
                      flavorText={chaosMeta.flavorText}
                      locked={false}
                      className="shrink-0"
                    />
                  ) : !isReplaceChaos && chaosName && chaosMeta ? (
                    <>
                      <ArchetypeBadge
                        archetypeName={detectedArchetype}
                        archetypeIndex={
                          typeof myResult?.detected_archetype_index === 'number'
                            ? myResult.detected_archetype_index
                            : undefined
                        }
                        iconOnly
                        size="lg"
                        flavorText={mainFlavor}
                        locked={false}
                        className="shrink-0"
                      />
                      <ArchetypeBadge
                        archetypeName={chaosName}
                        iconOnly
                        size="lg"
                        flavorText={chaosMeta.flavorText}
                        locked={false}
                        className="shrink-0"
                      />
                    </>
                  ) : detectedArchetype ? (
                    <ArchetypeBadge
                      archetypeName={detectedArchetype}
                      archetypeIndex={
                        typeof myResult?.detected_archetype_index === 'number'
                          ? myResult.detected_archetype_index
                          : undefined
                      }
                      iconOnly
                      size="lg"
                      flavorText={flavorText ?? undefined}
                      locked={false}
                      className="shrink-0"
                    />
                  ) : null)}
              </DraftGradeBanner>
            )}
            <p className="text-muted-foreground text-xs sm:text-sm mt-1 mb-0">{draft.name}</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,22rem)] lg:items-start mt-2">
            <div className="space-y-4 min-w-0">
              <div className="glass-card p-6">
                <h2 className="font-display text-2xl mb-4 text-center">{teamLabel(myTeam)}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-sm text-muted-foreground uppercase tracking-wider mb-3 font-semibold">
                      Starting Lineup
                    </div>
                    <div className="space-y-2">
                      {startingSlots.map((slot, index) => {
                        const player = filledSlots[index];
                        return (
                          <div
                            key={`${slot.label}-${index}`}
                            className={cn(
                              'flex items-center gap-2 p-3 rounded-lg text-sm border',
                              player
                                ? 'bg-secondary/50 border-border/30'
                                : 'bg-secondary/30 border-border/30'
                            )}
                          >
                            <div className="w-14 text-xs font-semibold text-muted-foreground shrink-0">
                              {slot.label}
                            </div>
                            {player ? (
                              <>
                                <div className="flex-1 truncate font-medium">{player.name}</div>
                                <PositionBadge position={player.position} className="text-[10px]" />
                                <div className="text-xs text-muted-foreground shrink-0">
                                  {displayTeamAbbrevOrFa(player.team, player.position, player.name)}
                                </div>
                              </>
                            ) : (
                              <div className="flex-1 text-muted-foreground/50 italic">Empty</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground uppercase tracking-wider mb-3 font-semibold">
                      Bench
                    </div>
                    <div className="space-y-2">
                      {Array.from({ length: benchCount }, (_, index) => {
                        const player = benchPlayers[index];
                        return (
                          <div
                            key={`bench-${index}`}
                            className={cn(
                              'flex items-center gap-2 p-3 rounded-lg text-sm border',
                              player
                                ? 'bg-secondary/50 border-border/30'
                                : 'bg-secondary/30 border-border/30'
                            )}
                          >
                            <div className="w-14 text-xs font-semibold text-muted-foreground shrink-0">
                              BN
                            </div>
                            {player ? (
                              <>
                                <div className="flex-1 truncate font-medium">{player.name}</div>
                                <PositionBadge position={player.position} className="text-[10px]" />
                                <div className="text-xs text-muted-foreground shrink-0">
                                  {displayTeamAbbrevOrFa(player.team, player.position, player.name)}
                                </div>
                              </>
                            ) : (
                              <div className="flex-1 text-muted-foreground/50 italic">Empty</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {results.length > 0 && (
                <div className="glass-card p-4 space-y-2">
                  <h3 className="font-display text-lg">Everyone&apos;s grades</h3>
                  <p className="text-xs text-muted-foreground">
                    Tap a team to see their roster and grade.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {results.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setViewingResultTeam(r.team_number)}
                        className={cn(
                          'rounded-md border border-border/50 p-2 text-sm text-left w-full min-h-11',
                          'hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                          'flex items-center gap-2 transition-colors',
                          r.team_number === myTeam && 'border-accent/50 bg-accent/5'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">
                            {teamLabel(r.team_number)}
                            {r.team_number === myTeam ? ' (you)' : ''}
                          </div>
                          <div className="text-muted-foreground truncate">
                            Grade {r.grade_letter}
                            {r.user_id && (r.detected_chaos_archetype || r.detected_archetype)
                              ? ` · ${r.detected_chaos_archetype || r.detected_archetype}`
                              : !r.user_id
                                ? ' · Guest (no badge)'
                                : ''}
                          </div>
                        </div>
                        <ChevronRight
                          className="w-4 h-4 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-center gap-3 pt-2">
                <Button variant="outline" onClick={() => navigate('/mock-draft')}>
                  New draft
                </Button>
                {user && (
                  <Button variant="hero" onClick={() => navigate('/badges')}>
                    View badges
                  </Button>
                )}
              </div>
            </div>

            <aside className="lg:sticky lg:top-20 min-w-0">
              <MultiplayerDraftChat
                draftId={draft.id}
                guestSessionId={guestSessionId}
                userId={user?.id}
                participantId={me?.id}
                canSend={Boolean(me)}
                variant="results"
                fillHeight
                className="lg:min-h-[28rem]"
              />
            </aside>
          </div>

          {(() => {
            if (viewingResultTeam == null) return null;
            const result = results.find((r) => r.team_number === viewingResultTeam);
            if (!result) return null;
            const teamPicks = picks
              .filter((p) => p.team_number === viewingResultTeam)
              .sort((a, b) => a.pick_number - b.pick_number);
            const drafted = teamPicks
              .map((pick) => players.find((p) => p.id === pick.player_id))
              .filter((p): p is RankedPlayer => !!p);
            const slots = getStartingSlots();
            const bench = positionLimits?.BENCH ?? 6;
            const teamKeeperIds = keepers
              .filter((k) => k.team_number === viewingResultTeam)
              .map((k) => k.player_id);
            const { filledSlots: viewFilled, benchPlayers: viewBench } = fillDraftTeamLineup(
              drafted,
              slots,
              bench,
              { keeperPlayerIds: teamKeeperIds, isSuperflex: draft.is_superflex }
            );
            const viewGrade =
              parseStoredDraftGrade(result.grade_payload) ||
              (result.team_number === myTeam ? myGrade : null);
            const showBadges = Boolean(result.user_id);

            return (
              <DraftTeamResultDialog
                open
                onOpenChange={(open) => {
                  if (!open) setViewingResultTeam(null);
                }}
                teamLabel={teamLabel(viewingResultTeam)}
                isYou={viewingResultTeam === myTeam}
                showBadges={showBadges}
                grade={viewGrade}
                gradeLetter={result.grade_letter}
                detectedArchetype={result.detected_archetype}
                detectedArchetypeIndex={result.detected_archetype_index}
                detectedChaosArchetype={result.detected_chaos_archetype}
                startingSlots={slots}
                filledSlots={viewFilled}
                benchPlayers={viewBench}
                benchCount={bench}
              />
            );
          })()}
        </main>
      </div>
    );
  }

  const timerLabel =
    timeRemaining != null
      ? `${timeRemaining}s`
      : draft.pick_timer > 0
        ? '—'
        : 'Off';

  const turnStatus =
    players.length === 0
      ? 'Loading board…'
      : me?.is_autodraft
        ? 'Autodraft on'
        : isMyTurn
          ? 'Your turn — pick a player'
          : `Waiting on ${teamLabel(currentTeam)}`;

  return (
    <div className="h-screen bg-background overflow-hidden flex flex-col">
      {/* Hide site nav on short viewports so the pick list keeps height */}
      <div className="shrink-0 [@media(max-height:640px)]:hidden">
        <Navbar />
      </div>
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col max-w-[1400px] w-full mx-auto px-3 py-2 gap-2 sm:px-4 sm:py-3 sm:gap-3 [@media(max-height:700px)]:py-1.5 [@media(max-height:700px)]:gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 glass-card px-3 py-2 shrink-0 [@media(max-height:700px)]:py-1.5">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="text-center min-w-[3.25rem]">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center justify-center gap-0.5 leading-none mb-0.5">
                <Timer className="w-3 h-3" /> Timer
              </div>
              <div
                className={cn(
                  'font-display text-xl sm:text-2xl text-gradient leading-none',
                  timeRemaining != null && timeRemaining <= 5 && 'text-destructive animate-pulse'
                )}
              >
                {timerLabel}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none mb-0.5">
                Round
              </div>
              <div className="font-display text-xl sm:text-2xl text-gradient leading-none">
                {currentRound}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none mb-0.5">
                Pick
              </div>
              <div className="font-display text-xl sm:text-2xl text-gradient leading-none">
                {displayPick}
              </div>
            </div>
            <div className="text-center min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none mb-0.5">
                On the clock
              </div>
              <div
                className={cn(
                  'font-display text-xl sm:text-2xl leading-none truncate max-w-[10rem] sm:max-w-[14rem]',
                  isMyTurn ? 'text-accent' : 'text-foreground'
                )}
              >
                {teamLabel(currentTeam)}
                {isMyTurn && <span className="text-xs ml-1 font-sans font-medium">(YOU)</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-md border border-border/40 px-2 py-1">
              <Zap className={cn('w-3.5 h-3.5', me?.is_autodraft ? 'text-accent' : 'text-muted-foreground')} />
              <Label htmlFor="mp-autodraft" className="text-xs cursor-pointer">
                Autodraft
              </Label>
              <Switch
                id="mp-autodraft"
                checked={Boolean(me?.is_autodraft)}
                onCheckedChange={(v) => void handleToggleAutodraft(v)}
                disabled={!me}
              />
            </div>
            <div className="text-right mr-0.5 hidden md:block [@media(max-height:700px)]:hidden">
              <div className="font-display text-sm tracking-wide leading-tight">{draft.name}</div>
              <div className="text-[10px] text-muted-foreground leading-tight">
                {picks.length}/{totalPicks} · Multiplayer
              </div>
            </div>
            <Button variant="destructive" size="sm" className="h-8" onClick={() => void handleExit()}>
              <LogOut className="w-4 h-4 mr-1" /> Exit
            </Button>
          </div>
        </div>

        <DraftMobilePanelTabs
          value={mobilePanel}
          onChange={setMobilePanel}
          includeChat
        />

        <div className="flex flex-col lg:grid lg:grid-cols-4 gap-2 sm:gap-3 flex-1 min-h-0 overflow-hidden">
          <div
            className={cn(
              'lg:col-span-1 flex-col justify-start overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin',
              draftMobilePanelClass(mobilePanel, 'roster')
            )}
          >
            <MyRoster
              picks={picksAsDraftPicks}
              players={players}
              userPickPosition={myTeam}
              positionLimits={positionLimits}
              isSuperflex={draft.is_superflex}
              teamName={teamLabel(myTeam)}
              userKeepers={keepers
                .filter((k) => k.team_number === myTeam)
                .map((k) => ({ player_id: k.player_id, round_number: k.round_number }))}
              currentRound={currentRound}
            />
          </div>

          <div
            className={cn(
              'lg:col-span-2 glass-card p-2.5 sm:p-3 flex-col overflow-hidden',
              draftMobilePanelClass(mobilePanel, 'players')
            )}
          >
            <div className="flex flex-wrap gap-1.5 items-center shrink-0 mb-1.5">
              <div className="relative flex-1 min-w-[10rem]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-8 bg-secondary/50 text-sm"
                  placeholder="Search players"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger className="w-[104px] h-8 bg-secondary/50 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div
              className={cn(
                'text-xs px-0.5 shrink-0 mb-1',
                isMyTurn && !me?.is_autodraft
                  ? 'text-accent font-medium'
                  : 'text-muted-foreground'
              )}
            >
              {turnStatus}
            </div>
            {!user && (
              <p className="text-xs text-muted-foreground px-0.5 shrink-0 mb-1 leading-snug">
                Guest view: player order and tier breaks use community rankings for this league
                type. Sign in to draft from your personal board and tiers.
              </p>
            )}

            <div className="space-y-0.5 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin">
              {availableListRows.map((row) => (
                <DraftAvailablePlayerRow
                  key={row.player.id}
                  player={row.player}
                  displayRank={row.displayRank}
                  myPosRank={row.myPosRank}
                  tier={row.tier}
                  hasTierBreakBefore={row.hasTierBreakBefore}
                  showPlayerTier={positionFilter !== 'ALL'}
                  draftDisabled={
                    !isMyTurn || picking || players.length === 0 || Boolean(me?.is_autodraft)
                  }
                  onNameClick={openPlayerStats}
                  onDraft={onDraftAvailable}
                />
              ))}
              {players.length > 0 && filtered.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No players match your filters.
                </div>
              )}
            </div>
          </div>

          {/* Board + chat share one column so only one chat instance mounts (realtime-safe). */}
          <div
            className={cn(
              'flex-col gap-2 overflow-hidden min-h-0',
              mobilePanel === 'board' || mobilePanel === 'chat' ? 'flex flex-1' : 'hidden',
              'lg:flex'
            )}
          >
            <div
              className={cn(
                'glass-card p-2.5 sm:p-3 flex-col overflow-hidden min-h-0',
                mobilePanel === 'board' ? 'flex flex-1' : 'hidden',
                'lg:flex lg:flex-1'
              )}
            >
              <h2 className="font-display text-base sm:text-lg mb-2 flex-shrink-0">DRAFT BOARD</h2>
              <div
                ref={draftBoardRef}
                onScroll={handleDraftBoardScroll}
                className={cn(
                  'space-y-1 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-2',
                  draftBoardScrolledUp ? 'scrollbar-thin' : 'scrollbar-hide'
                )}
              >
                {picks.map((p) => {
                  const pl = players.find((x) => x.id === p.player_id);
                  if (!pl) return null;
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded-lg text-sm min-w-0',
                        p.team_number === myTeam
                          ? 'bg-accent/10 border border-accent/30'
                          : 'bg-secondary/30'
                      )}
                    >
                      <div className="w-6 shrink-0 text-muted-foreground text-xs">
                        {p.round_number}.{((p.pick_number - 1) % draft.num_teams) + 1}
                      </div>
                      <div className="font-medium w-16 shrink-0 truncate">
                        {teamLabel(p.team_number)}
                      </div>
                      <button
                        type="button"
                        className="flex-1 min-w-0 truncate text-left text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => openPlayerStats(pl)}
                      >
                        {pl.name}
                        {p.is_keeper ? ' · K' : p.is_autodraft ? ' · A' : ''}
                      </button>
                      <PositionBadge position={pl.position} className="shrink-0 text-[10px]" />
                    </div>
                  );
                })}
                {picks.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No picks yet. Click a player to draft them.
                  </div>
                )}
              </div>
            </div>

            <div
              className={cn(
                'flex-col overflow-hidden min-h-0',
                mobilePanel === 'chat' ? 'flex flex-1' : 'hidden',
                'lg:flex lg:flex-none'
              )}
            >
              <MultiplayerDraftChat
                draftId={draft.id}
                guestSessionId={guestSessionId}
                userId={user?.id}
                participantId={me?.id}
                canSend={Boolean(me)}
                variant={mobilePanel === 'chat' ? 'lobby' : 'room'}
                fillHeight={mobilePanel === 'chat'}
                className={cn(mobilePanel === 'chat' && 'flex-1 min-h-0')}
              />
            </div>
          </div>
        </div>
      </main>
      <PlayerDetailDialog
        player={selectedPlayerForStats}
        open={isStatsDialogOpen}
        onOpenChange={setIsStatsDialogOpen}
        stats2025={
          selectedPlayerForStats ? player2025Stats.get(selectedPlayerForStats.id) : undefined
        }
        allStats2025={player2025Stats}
        positionAdpRank={
          selectedPlayerForStats
            ? resolvePositionAdpRankForDisplay(
                selectedPlayerForStats,
                positionAdpRankMap,
                communityDefenseRankFromList
              )
            : null
        }
      />
    </div>
  );
};

export default MultiplayerDraftRoom;
