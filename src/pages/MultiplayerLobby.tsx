import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { BrandedLoader } from '@/components/BrandedLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { getOrCreateGuestSessionId } from '@/utils/temporaryStorage';
import {
  fetchMpDraftByInvite,
  fetchMpKeepers,
  fetchMpParticipants,
  mpClaimSlot,
  mpCloseLobby,
  mpExpireStaleOpenLobbies,
  mpHostMoveKick,
  mpJoinDraft,
  mpReleaseSlot,
  mpReplaceKeepers,
  mpSetHostPresence,
  mpSetReady,
  mpSetTeamName,
  mpStartDraft,
} from '@/utils/multiplayerDraftApi';
import type {
  MultiplayerDraft,
  MultiplayerKeeper,
  MultiplayerParticipant,
} from '@/types/multiplayerDraft';
import type { Player } from '@/types/database';
import { MultiplayerDraftChat } from '@/components/MultiplayerDraftChat';
import {
  LobbyTeamKeepers,
  type LobbyKeeperPlayer,
} from '@/components/LobbyTeamKeepers';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  clockSkewFromServerNow,
  formatMpLineupSummary,
  formatMpLobbyMeta,
  formatOpenLobbyCountdown,
  OPEN_LOBBY_WARN_MS,
  openLobbyRemainingMs,
} from '@/utils/mpLobbyFormat';
import type { PositionLimitsLike } from '@/utils/rosterSlots';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Check, Copy, DoorClosed, Link2, Play, Radio, Timer, UserMinus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { userFacingErrorMessage } from '@/utils/userFacingError';

const MultiplayerLobby = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<MultiplayerDraft | null>(null);
  const [participants, setParticipants] = useState<MultiplayerParticipant[]>([]);
  const [keepers, setKeepers] = useState<MultiplayerKeeper[]>([]);
  const [keeperPlayersById, setKeeperPlayersById] = useState<
    Record<string, LobbyKeeperPlayer>
  >({});
  const [closeLobbyOpen, setCloseLobbyOpen] = useState(false);
  /** Forced ack before leaving (closed lobby / kick). */
  const [exitNotice, setExitNotice] = useState<{
    title: string;
    description: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  /** Local edits for team-name inputs keyed by seat number. */
  const [nameDrafts, setNameDrafts] = useState<Record<number, string>>({});
  /** True once this browser session has been a lobby participant (used to detect kicks). */
  const wasParticipantRef = useRef(false);
  const leavingIdleRef = useRef(false);
  /** Host just closed the lobby themselves — skip the kick/closed ack. */
  const closedBySelfRef = useRef(false);
  const draftNameRef = useRef('');
  const hostUserIdRef = useRef<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  /** clientNow - serverNow; keeps the 10-minute idle timer aligned with Postgres. */
  const [clockSkewMs, setClockSkewMs] = useState(0);

  const guestSessionId = useMemo(
    () => (!user ? getOrCreateGuestSessionId() : null),
    [user]
  );

  const syncClockSkew = useCallback((serverNow: string | null | undefined) => {
    if (!serverNow) return;
    setClockSkewMs(clockSkewFromServerNow(serverNow));
  }, []);

  useEffect(() => {
    if (!user) {
      setProfileUsername(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const name =
        data?.username?.trim() ||
        user.email?.split('@')[0]?.trim() ||
        'Player';
      setProfileUsername(name);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const me = useMemo(() => {
    if (!participants.length) return null;
    if (user) return participants.find((p) => p.user_id === user.id) || null;
    if (guestSessionId) {
      return participants.find((p) => p.guest_session_id === guestSessionId) || null;
    }
    return null;
  }, [participants, user, guestSessionId]);

  const isHost = Boolean(me?.is_host || (user && draft && draft.host_user_id === user.id));

  const leaveClosedLobby = useCallback(
    (reason?: string | null, lobbyName?: string | null) => {
      if (leavingIdleRef.current) return;
      leavingIdleRef.current = true;
      // Intentional Close lobby only — idle / host-away timeouts still ack for the host.
      if (closedBySelfRef.current && reason === 'host_closed') {
        navigate('/mock-draft', { replace: true });
        return;
      }
      const name = (lobbyName || draftNameRef.current || 'This lobby').trim() || 'This lobby';
      const iAmHost = Boolean(user?.id && hostUserIdRef.current === user.id);
      if (reason === 'host_closed') {
        setExitNotice({
          title: 'Lobby closed',
          description: `"${name}" was closed by the host and you were removed. Hit OK to return to Mock Draft.`,
        });
      } else if (reason === 'host_absent') {
        setExitNotice({
          title: 'Lobby closed',
          description: iAmHost
            ? `"${name}" closed because you were away for 10 minutes. Hit OK to return to Mock Draft.`
            : `"${name}" closed because the host didn’t return in time. You were removed. Hit OK to return to Mock Draft.`,
        });
      } else if (reason === 'idle') {
        setExitNotice({
          title: 'Lobby closed',
          description: iAmHost
            ? `"${name}" closed due to inactivity. Hit OK to return to Mock Draft.`
            : `"${name}" closed due to inactivity and you were removed. Hit OK to return to Mock Draft.`,
        });
      } else {
        setExitNotice({
          title: 'Lobby closed',
          description: `"${name}" was cancelled. Hit OK to return to Mock Draft.`,
        });
      }
    },
    [navigate, user?.id]
  );

  const acknowledgeExit = useCallback(() => {
    navigate('/mock-draft', { replace: true });
  }, [navigate]);

  const refresh = useCallback(async () => {
    if (!inviteCode || leavingIdleRef.current) return;
    try {
      const expired = await mpExpireStaleOpenLobbies();
      syncClockSkew(expired.serverNow);
    } catch {
      /* listing/lobby still load if expire RPC flakes */
    }
    const d = await fetchMpDraftByInvite(inviteCode);
    if (!d) {
      if (!leavingIdleRef.current) {
        leavingIdleRef.current = true;
        setExitNotice({
          title: 'Lobby not found',
          description: 'This lobby is gone. Hit OK to return to Mock Draft.',
        });
      }
      return;
    }
    if (d.status === 'cancelled') {
      draftNameRef.current = d.name || draftNameRef.current;
      hostUserIdRef.current = d.host_user_id || hostUserIdRef.current;
      leaveClosedLobby(d.cancel_reason, d.name);
      return;
    }
    setDraft(d);
    draftNameRef.current = d.name || '';
    hostUserIdRef.current = d.host_user_id || null;
    const [parts, nextKeepers] = await Promise.all([
      fetchMpParticipants(d.id),
      fetchMpKeepers(d.id),
    ]);
    setParticipants(parts);
    setKeepers(nextKeepers);

    const self = user
      ? parts.find((p) => p.user_id === user.id) || null
      : guestSessionId
        ? parts.find((p) => p.guest_session_id === guestSessionId) || null
        : null;

    if (self) {
      wasParticipantRef.current = true;
    } else if (wasParticipantRef.current && d.status === 'lobby') {
      // Host kicked this user — require ack before leaving.
      wasParticipantRef.current = false;
      if (!leavingIdleRef.current) {
        leavingIdleRef.current = true;
        const name = (d.name || 'This lobby').trim();
        setExitNotice({
          title: 'Removed from lobby',
          description: `You were kicked from "${name}". Hit OK to return to Mock Draft.`,
        });
      }
      return;
    }

    // Kicked / viewer-only users must not follow the room into the draft as spectators.
    if (d.status === 'drafting' || d.status === 'completed') {
      if (self?.team_number != null) {
        navigate(`/multiplayer-draft/${d.id}`);
      } else if (!leavingIdleRef.current) {
        leavingIdleRef.current = true;
        const name = (d.name || 'This lobby').trim();
        setExitNotice({
          title: d.status === 'drafting' ? 'Draft started without you' : 'Draft already finished',
          description:
            d.status === 'drafting'
              ? `"${name}" started without you (kicked or no seat). Hit OK to return to Mock Draft.`
              : `"${name}" already finished. Hit OK to return to Mock Draft.`,
        });
      }
    }
  }, [inviteCode, navigate, user, guestSessionId, syncClockSkew, leaveClosedLobby]);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await refresh();
      } catch (e: any) {
        toast.error(userFacingErrorMessage(e, "Couldn't load lobby"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, refresh]);

  useEffect(() => {
    if (!draft?.id) return;
    const channel = supabase
      .channel(`mp-lobby-${draft.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'multiplayer_draft_participants', filter: `draft_id=eq.${draft.id}` },
        () => {
          void refresh();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'multiplayer_drafts', filter: `id=eq.${draft.id}` },
        () => {
          void refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'multiplayer_draft_keepers',
          filter: `draft_id=eq.${draft.id}`,
        },
        () => {
          void refresh();
        }
      )
      .subscribe();

    // Backup for kick detection: DELETE realtime can miss filtered clients;
    // poll so a removed participant is redirected even if the event never arrives.
    const pollId = window.setInterval(() => {
      void refresh();
    }, 2000);

    return () => {
      window.clearInterval(pollId);
      void supabase.removeChannel(channel);
    };
  }, [draft?.id, refresh]);

  useEffect(() => {
    if (draft?.visibility !== 'open' || draft.status !== 'lobby') return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [draft?.visibility, draft?.status]);

  const openIdleRemainingMs =
    draft?.visibility === 'open' && draft.status === 'lobby'
      ? openLobbyRemainingMs(draft.lobby_last_activity_at, nowMs, clockSkewMs)
      : null;
  const hostAwayRemainingMs =
    draft?.visibility === 'open' &&
    draft.status === 'lobby' &&
    draft.host_absent_since
      ? openLobbyRemainingMs(draft.host_absent_since, nowMs, clockSkewMs)
      : null;
  const showOpenIdleWarning =
    openIdleRemainingMs != null && openIdleRemainingMs <= OPEN_LOBBY_WARN_MS;
  const showHostAwayWarning =
    hostAwayRemainingMs != null && hostAwayRemainingMs <= OPEN_LOBBY_WARN_MS;
  const openLobbyPastDeadline =
    (openIdleRemainingMs != null && openIdleRemainingMs <= 0) ||
    (hostAwayRemainingMs != null && hostAwayRemainingMs <= 0);

  useEffect(() => {
    if (
      draft?.visibility !== 'open' ||
      draft.status !== 'lobby' ||
      !openLobbyPastDeadline ||
      leavingIdleRef.current
    ) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const expired = await mpExpireStaleOpenLobbies();
        if (cancelled) return;
        syncClockSkew(expired.serverNow);

        const d = await fetchMpDraftByInvite(inviteCode!);
        if (cancelled) return;

        if (!d || d.status === 'cancelled') {
          if (d) {
            draftNameRef.current = d.name || draftNameRef.current;
            hostUserIdRef.current = d.host_user_id || hostUserIdRef.current;
          }
          leaveClosedLobby(d?.cancel_reason ?? 'idle', d?.name);
          return;
        }

        // After skew sync, server may still have time left — refresh state and wait.
        const rem = openLobbyRemainingMs(
          d.lobby_last_activity_at,
          Date.now(),
          expired.serverNow ? clockSkewFromServerNow(expired.serverNow) : clockSkewMs
        );
        const hostRem = openLobbyRemainingMs(
          d.host_absent_since,
          Date.now(),
          expired.serverNow ? clockSkewFromServerNow(expired.serverNow) : clockSkewMs
        );
        if ((rem != null && rem <= 0) || (d.host_absent_since && hostRem != null && hostRem <= 0)) {
          draftNameRef.current = d.name || draftNameRef.current;
          hostUserIdRef.current = d.host_user_id || hostUserIdRef.current;
          leaveClosedLobby(
            d.host_absent_since && hostRem != null && hostRem <= 0 ? 'host_absent' : 'idle',
            d.name
          );
          return;
        }
        setDraft(d);
        hostUserIdRef.current = d.host_user_id || null;
      } catch {
        if (!cancelled) leaveClosedLobby('idle');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    draft?.visibility,
    draft?.status,
    openLobbyPastDeadline,
    inviteCode,
    syncClockSkew,
    leaveClosedLobby,
    clockSkewMs,
  ]);

  // Host presence: leaving the page keeps the lobby open, but starts a 10-minute host-away timer.
  useEffect(() => {
    if (!isHost || !draft?.id || draft.status !== 'lobby') return;
    const draftId = draft.id;
    void mpSetHostPresence(draftId, true).catch(() => {
      /* ignore transient presence errors */
    });
    const heartbeat = window.setInterval(() => {
      void mpSetHostPresence(draftId, true).catch(() => undefined);
    }, 30_000);

    const markAway = () => {
      void mpSetHostPresence(draftId, false).catch(() => undefined);
    };
    window.addEventListener('pagehide', markAway);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener('pagehide', markAway);
      markAway();
    };
  }, [isHost, draft?.id, draft?.status]);

  const handleJoin = async () => {
    if (!inviteCode) return;
    const nameForJoin = user
      ? (profileUsername || 'Player').trim()
      : displayName.trim();
    if (!user && nameForJoin.length < 1) {
      toast.error('Enter a display name');
      return;
    }
    setBusy(true);
    try {
      await mpJoinDraft({
        inviteCode,
        guestSessionId,
        displayName: nameForJoin || 'Guest',
      });
      wasParticipantRef.current = true;
      await refresh();
      toast.success('Joined lobby');
    } catch (e: any) {
      toast.error(userFacingErrorMessage(e, "Couldn't join lobby"));
    } finally {
      setBusy(false);
    }
  };

  const handleClaim = async (teamNumber: number) => {
    if (!draft || !me) return;
    setBusy(true);
    try {
      await mpClaimSlot(draft.id, teamNumber, guestSessionId);
      await refresh();
    } catch (e: any) {
      toast.error(userFacingErrorMessage(e, 'Seat taken'));
    } finally {
      setBusy(false);
    }
  };

  const handleReady = async () => {
    if (!draft || !me?.team_number) return;
    setBusy(true);
    try {
      await mpSetReady(draft.id, !me.is_ready, guestSessionId);
      await refresh();
    } catch (e: any) {
      toast.error(userFacingErrorMessage(e, 'Could not update ready'));
    } finally {
      setBusy(false);
    }
  };

  const handleStart = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      await mpStartDraft(draft.id);
      navigate(`/multiplayer-draft/${draft.id}`);
    } catch (e: any) {
      toast.error(userFacingErrorMessage(e, 'Cannot start yet'));
    } finally {
      setBusy(false);
    }
  };

  const handleCloseLobby = async () => {
    if (!draft || !isHost) return;
    setBusy(true);
    try {
      closedBySelfRef.current = true;
      await mpCloseLobby(draft.id);
      setCloseLobbyOpen(false);
      navigate('/mock-draft', { replace: true });
    } catch (e: any) {
      closedBySelfRef.current = false;
      toast.error(userFacingErrorMessage(e, 'Could not close lobby'));
      setBusy(false);
    }
  };

  // Resolve keeper player names for the seat cards.
  useEffect(() => {
    const ids = [...new Set(keepers.map((k) => k.player_id))];
    if (ids.length === 0) {
      setKeeperPlayersById({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('players')
        .select('id, name, position, team')
        .in('id', ids);
      if (cancelled || error) return;
      const map: Record<string, LobbyKeeperPlayer> = {};
      for (const row of data || []) {
        map[row.id] = row;
      }
      setKeeperPlayersById(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [keepers]);

  const allKeeperPlayerIds = useMemo(
    () => new Set(keepers.map((k) => k.player_id)),
    [keepers]
  );

  const maxKeepersPerTeam = useMemo(() => {
    if (!draft) return 0;
    const fromLimits = Number(
      (draft.position_limits as PositionLimitsLike | null)?.KEEPERS ?? 0
    );
    // Host can edit up to roster rounds; prefer league KEEPERS when set higher than 0.
    return Math.max(1, Math.min(draft.num_rounds, fromLimits > 0 ? fromLimits : draft.num_rounds));
  }, [draft]);

  const persistKeepers = async (next: MultiplayerKeeper[]) => {
    if (!draft) return;
    setBusy(true);
    try {
      await mpReplaceKeepers(
        draft.id,
        next.map((k) => ({
          team_number: k.team_number,
          player_id: k.player_id,
          round_number: k.round_number,
        }))
      );
      await refresh();
    } catch (e: any) {
      toast.error(userFacingErrorMessage(e, 'Could not update keepers'));
    } finally {
      setBusy(false);
    }
  };

  const handleAddKeeper = async (team: number, player: Player, round: number) => {
    const conflict = keepers.some(
      (k) =>
        k.player_id === player.id ||
        (k.team_number === team && k.round_number === round)
    );
    if (conflict) {
      toast.error('That player or round is already used as a keeper');
      return;
    }
    const teamCount = keepers.filter((k) => k.team_number === team).length;
    if (teamCount >= maxKeepersPerTeam) {
      toast.error(`This team already has ${maxKeepersPerTeam} keeper${maxKeepersPerTeam === 1 ? '' : 's'}`);
      return;
    }
    await persistKeepers([
      ...keepers,
      {
        id: `local-${player.id}`,
        draft_id: draft!.id,
        team_number: team,
        player_id: player.id,
        round_number: round,
        created_at: new Date().toISOString(),
      },
    ]);
  };

  const handleRemoveKeeper = async (keeperId: string) => {
    await persistKeepers(keepers.filter((k) => k.id !== keeperId));
  };

  const saveTeamName = async (team: number, fallback: string) => {
    if (!draft) return;
    const next = (nameDrafts[team] ?? fallback).trim();
    const current =
      (draft.team_names?.[String(team)] || draft.team_names?.[team as any] || `Team ${team}`).trim();
    if (!next || next === current) {
      setNameDrafts((prev) => {
        const copy = { ...prev };
        delete copy[team];
        return copy;
      });
      return;
    }
    setBusy(true);
    try {
      const result = await mpSetTeamName(draft.id, team, next, guestSessionId);
      setDraft((d) =>
        d
          ? {
              ...d,
              team_names: (result.team_names as Record<string, string>) || {
                ...d.team_names,
                [String(team)]: result.team_name,
              },
            }
          : d
      );
      setNameDrafts((prev) => {
        const copy = { ...prev };
        delete copy[team];
        return copy;
      });
    } catch (e: any) {
      toast.error(userFacingErrorMessage(e, 'Could not update team name'));
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = async () => {
    if (!inviteCode) return;
    const url = `${window.location.origin}/lobby/${inviteCode}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Invite link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const seats = useMemo(() => {
    if (!draft) return [];
    return Array.from({ length: draft.num_teams }, (_, i) => {
      const team = i + 1;
      const occupant = participants.find((p) => p.team_number === team) || null;
      const teamName =
        (draft.team_names && (draft.team_names[String(team)] || draft.team_names[team as any])) ||
        `Team ${team}`;
      return { team, occupant, teamName };
    });
  }, [draft, participants]);

  const allHumansReady = useMemo(() => {
    const seated = participants.filter((p) => p.team_number != null);
    return seated.length > 0 && seated.every((p) => p.is_ready);
  }, [participants]);

  const exitNoticeDialog = (
    <AlertDialog open={Boolean(exitNotice)}>
      <AlertDialogContent
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{exitNotice?.title ?? 'Lobby update'}</AlertDialogTitle>
          <AlertDialogDescription>{exitNotice?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={acknowledgeExit}>OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (exitNotice && !draft) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="flex min-h-[70vh] items-center justify-center px-4">
          <p className="text-sm text-muted-foreground text-center max-w-md">
            {exitNotice.description}
          </p>
        </main>
        {exitNoticeDialog}
      </div>
    );
  }

  if (authLoading || loading || !draft) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="flex min-h-[70vh] items-center justify-center">
          <BrandedLoader />
        </main>
        {exitNoticeDialog}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {exitNoticeDialog}
      <main className={cn('max-w-6xl mx-auto px-4 py-8 space-y-6', exitNotice && 'pointer-events-none opacity-60')}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-3 shadow-glow">
            <Users className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl tracking-wide">{draft.name}</h1>
          <p className="text-muted-foreground mt-1">
            {draft.num_teams}-team lobby · Code {draft.invite_code}
            {draft.visibility === 'open' ? ' · Open to site' : ' · Invite only'}
          </p>
        </div>

        <div className="glass-card p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {draft.visibility === 'open' ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-xs font-medium text-accent">
                <Radio className="w-3.5 h-3.5" aria-hidden />
                Open lobby
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-secondary/40 px-2 py-1 text-xs font-medium text-muted-foreground">
                Invite only
              </span>
            )}
            <span className="text-muted-foreground">
              {formatMpLobbyMeta({
                scoringFormat: draft.scoring_format,
                leagueType: draft.league_type,
                isSuperflex: draft.is_superflex,
              })}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Lineup:{' '}
            {formatMpLineupSummary(
              draft.position_limits as PositionLimitsLike,
              draft.is_superflex
            )}
            {draft.pick_timer > 0 ? ` · ${draft.pick_timer}s pick clock` : ' · No pick clock'}
          </p>
          {draft.visibility === 'open' && (
            <p className="text-xs text-muted-foreground">
              Closes after 10 minutes with no joins, seat changes, ready updates, or chat.
              If the host leaves the page, the lobby stays open — but it closes after 10
              minutes without the host, even if others are active. Use Close lobby to end it
              immediately.
            </p>
          )}
        </div>

        {showHostAwayWarning && hostAwayRemainingMs != null && (
          <div
            role="status"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 flex items-start gap-3"
          >
            <Timer className="w-5 h-5 text-destructive shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium text-destructive">
                {hostAwayRemainingMs <= 0
                  ? 'Closing now — host didn’t return…'
                  : `Host away — closing in ${formatOpenLobbyCountdown(hostAwayRemainingMs)}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {isHost
                  ? 'You’re marked away (another tab or device may be open). Stay on this page to keep the lobby.'
                  : 'The host left this lobby page. If they don’t return in time, everyone goes back to Mock Draft.'}
              </p>
            </div>
          </div>
        )}

        {showOpenIdleWarning && openIdleRemainingMs != null && !showHostAwayWarning && (
          <div
            role="status"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 flex items-start gap-3"
          >
            <Timer className="w-5 h-5 text-destructive shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium text-destructive">
                {openIdleRemainingMs <= 0
                  ? 'Closing now for inactivity…'
                  : `Closing in ${formatOpenLobbyCountdown(openIdleRemainingMs)} for inactivity`}
              </p>
              <p className="text-xs text-muted-foreground">
                {openIdleRemainingMs <= 0
                  ? 'This open lobby hit the 10-minute idle limit. Sending you back to Mock Draft.'
                  : 'Claim a seat, ready up, chat, or rename a team to keep this open lobby alive. Otherwise everyone will be kicked back to Mock Draft.'}
              </p>
            </div>
          </div>
        )}

        <div className="glass-card p-4 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link2 className="w-4 h-4" />
            {draft.visibility === 'open'
              ? 'Listed on Mock Draft for anyone — invite link still works for friends'
              : 'Share invite so friends can claim a seat'}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={copyInvite}>
              <Copy className="w-4 h-4" />
              Copy invite link
            </Button>
            {isHost && draft.status === 'lobby' && (
              <Button
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() => setCloseLobbyOpen(true)}
              >
                <DoorClosed className="w-4 h-4" />
                Close lobby
              </Button>
            )}
          </div>
        </div>

        <AlertDialog open={closeLobbyOpen} onOpenChange={setCloseLobbyOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Close this lobby?</AlertDialogTitle>
              <AlertDialogDescription>
                Everyone here will be kicked back to Mock Draft, and this lobby will leave Live
                open lobbies. You can create a new one anytime.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={busy}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  void handleCloseLobby();
                }}
              >
                Close lobby
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {!me && (
          <div className="glass-card p-4 space-y-3 max-w-3xl">
            <p className="text-sm text-muted-foreground">
              {user
                ? 'Join this lobby to claim a draft slot. You’ll appear under your profile name.'
                : 'Join as a guest (or sign in) to claim a draft slot. Pick a display name so others know who you are.'}
            </p>
            {user ? (
              <div className="rounded-md border border-border/50 bg-secondary/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Display name · </span>
                <span className="font-medium">{profileUsername || 'Loading…'}</span>
              </div>
            ) : (
              <Input
                placeholder="Display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={40}
                className="bg-secondary/50"
                autoComplete="nickname"
              />
            )}
            <Button
              onClick={handleJoin}
              disabled={busy || (user ? !profileUsername : !displayName.trim())}
              className="w-full"
            >
              {busy ? <BrandedLoader size={28} /> : 'Join lobby'}
            </Button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,22rem)] lg:items-start">
          <div className="space-y-6 min-w-0">
            <div className="glass-card p-4 space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="font-display text-xl">DRAFT SLOTS</h2>
                <p className="text-xs text-muted-foreground">
                  Seated players can rename their team before the draft starts.
                  {isHost ? ' Host can add or remove keepers per team.' : ' Keepers show per team.'}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {seats.map(({ team, occupant, teamName }) => {
                  const mine = me?.team_number === team;
                  const open = !occupant;
                  const canEditName = mine || isHost;
                  return (
                    <div
                      key={team}
                      className={cn(
                        'rounded-lg border p-3 flex flex-col gap-2',
                        mine ? 'border-primary bg-primary/10' : 'border-border/50 bg-secondary/30'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="text-xs text-muted-foreground">Pick #{team}</div>
                          {canEditName ? (
                            <Input
                              value={nameDrafts[team] ?? teamName}
                              onChange={(e) =>
                                setNameDrafts((prev) => ({ ...prev, [team]: e.target.value }))
                              }
                              onBlur={() => void saveTeamName(team, teamName)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                }
                              }}
                              disabled={busy}
                              maxLength={40}
                              className="h-8 bg-background/60 text-sm font-medium"
                              placeholder={`Team ${team}`}
                              aria-label={`Team name for pick ${team}`}
                            />
                          ) : (
                            <div className="font-medium text-sm truncate">{teamName}</div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {occupant
                              ? `${occupant.display_name}${occupant.is_host ? ' (Host)' : ''}${
                                  occupant.is_ready ? ' · Ready' : ''
                                }`
                              : 'Open (CPU if empty)'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {me && open && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => handleClaim(team)}
                            >
                              Claim
                            </Button>
                          )}
                          {mine && !me?.is_host && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={async () => {
                                if (!draft) return;
                                setBusy(true);
                                try {
                                  await mpReleaseSlot(draft.id, guestSessionId);
                                  await refresh();
                                } catch (e: any) {
                                  toast.error(userFacingErrorMessage(e, 'Could not release seat'));
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            >
                              Leave seat
                            </Button>
                          )}
                          {isHost && occupant && !occupant.is_host && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Kick"
                              disabled={busy}
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  await mpHostMoveKick({
                                    draftId: draft.id,
                                    participantId: occupant.id,
                                    action: 'kick',
                                  });
                                  await refresh();
                                } catch (e: any) {
                                  toast.error(userFacingErrorMessage(e, "Couldn't kick player"));
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            >
                              <UserMinus className="w-4 h-4" />
                            </Button>
                          )}
                          {isHost && occupant && open === false && (
                            <select
                              className="h-8 rounded-md border border-border bg-background text-xs px-1"
                              value={team}
                              disabled={busy}
                              onChange={async (e) => {
                                const next = parseInt(e.target.value, 10);
                                if (!next || next === team) return;
                                setBusy(true);
                                try {
                                  await mpHostMoveKick({
                                    draftId: draft.id,
                                    participantId: occupant.id,
                                    action: 'move',
                                    newTeamNumber: next,
                                  });
                                  await refresh();
                                } catch (err: any) {
                                  toast.error(userFacingErrorMessage(err, "Couldn't move player"));
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            >
                              {seats.map((s) => (
                                <option key={s.team} value={s.team}>
                                  → #{s.team}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                      <LobbyTeamKeepers
                        teamNumber={team}
                        keepers={keepers}
                        playersById={keeperPlayersById}
                        allKeeperPlayerIds={allKeeperPlayerIds}
                        numRounds={draft.num_rounds}
                        maxKeepersPerTeam={maxKeepersPerTeam}
                        canEdit={isHost && draft.status === 'lobby'}
                        busy={busy}
                        onAdd={(player, round) => handleAddKeeper(team, player, round)}
                        onRemove={handleRemoveKeeper}
                        className="border-t border-border/40 pt-2 mt-0.5"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {me && (
              <div className="glass-card p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  {me.team_number
                    ? me.is_ready
                      ? 'You are ready. Waiting for the host to start.'
                      : 'Claimed a seat — ready up when you are set.'
                    : 'Claim any open pick slot.'}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={me.is_ready ? 'secondary' : 'default'}
                    disabled={busy || me.team_number == null}
                    onClick={handleReady}
                  >
                    {me.is_ready ? (
                      <>
                        <Check className="w-4 h-4" /> Ready
                      </>
                    ) : (
                      'Ready up'
                    )}
                  </Button>
                  {isHost && (
                    <Button variant="hero" disabled={busy || !allHumansReady} onClick={handleStart}>
                      <Play className="w-4 h-4" />
                      Start draft
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <aside className="lg:sticky lg:top-20 min-w-0">
            <MultiplayerDraftChat
              draftId={draft.id}
              guestSessionId={guestSessionId}
              userId={user?.id}
              participantId={me?.id}
              canSend={Boolean(me)}
              variant="lobby"
              fillHeight
              className="lg:min-h-[28rem]"
            />
          </aside>
        </div>
      </main>
    </div>
  );
};

export default MultiplayerLobby;
