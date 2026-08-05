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
  fetchMpParticipants,
  mpClaimSlot,
  mpHostMoveKick,
  mpJoinDraft,
  mpReleaseSlot,
  mpSetReady,
  mpSetTeamName,
  mpStartDraft,
} from '@/utils/multiplayerDraftApi';
import type { MultiplayerDraft, MultiplayerParticipant } from '@/types/multiplayerDraft';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Check, Copy, Link2, Play, UserMinus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const MultiplayerLobby = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<MultiplayerDraft | null>(null);
  const [participants, setParticipants] = useState<MultiplayerParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  /** Local edits for team-name inputs keyed by seat number. */
  const [nameDrafts, setNameDrafts] = useState<Record<number, string>>({});
  /** True once this browser session has been a lobby participant (used to detect kicks). */
  const wasParticipantRef = useRef(false);

  const guestSessionId = useMemo(
    () => (!user ? getOrCreateGuestSessionId() : null),
    [user]
  );

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

  const refresh = useCallback(async () => {
    if (!inviteCode) return;
    const d = await fetchMpDraftByInvite(inviteCode);
    if (!d) {
      toast.error('Lobby not found');
      navigate('/mock-draft');
      return;
    }
    setDraft(d);
    const parts = await fetchMpParticipants(d.id);
    setParticipants(parts);

    const self = user
      ? parts.find((p) => p.user_id === user.id) || null
      : guestSessionId
        ? parts.find((p) => p.guest_session_id === guestSessionId) || null
        : null;

    if (self) {
      wasParticipantRef.current = true;
    } else if (wasParticipantRef.current && d.status === 'lobby') {
      // Host kicked this user — leave the lobby instead of showing a dead join/claim state.
      wasParticipantRef.current = false;
      toast.message('You were removed from the lobby.');
      navigate('/mock-draft', { replace: true });
      return;
    }

    // Kicked / queue-only users must not follow the room into the draft as spectators.
    if (d.status === 'drafting' || d.status === 'completed') {
      if (self?.team_number != null) {
        navigate(`/multiplayer-draft/${d.id}`);
      } else {
        toast.message(
          d.status === 'drafting'
            ? 'This draft started without you (kicked or no seat).'
            : 'This draft already finished.'
        );
        navigate('/mock-draft');
      }
    }
  }, [inviteCode, navigate, user, guestSessionId]);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await refresh();
      } catch (e: any) {
        toast.error(e?.message || 'Failed to load lobby');
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
      toast.error(e?.message || 'Failed to join');
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
      toast.error(e?.message || 'Seat taken');
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
      toast.error(e?.message || 'Could not update ready');
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
      toast.error(e?.message || 'Cannot start yet');
    } finally {
      setBusy(false);
    }
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
      toast.error(e?.message || 'Could not update team name');
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

  if (authLoading || loading || !draft) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="flex min-h-[70vh] items-center justify-center">
          <BrandedLoader />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-3 shadow-glow">
            <Users className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl tracking-wide">{draft.name}</h1>
          <p className="text-muted-foreground mt-1">
            {draft.num_teams}-team lobby · Code {draft.invite_code}
          </p>
        </div>

        <div className="glass-card p-4 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link2 className="w-4 h-4" />
            Share invite so friends can claim a seat
          </div>
          <Button variant="secondary" size="sm" onClick={copyInvite}>
            <Copy className="w-4 h-4" />
            Copy invite link
          </Button>
        </div>

        {!me && (
          <div className="glass-card p-4 space-y-3">
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

        <div className="glass-card p-4 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-display text-xl">DRAFT SLOTS</h2>
            <p className="text-xs text-muted-foreground">
              Seated players can rename their team before the draft starts
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
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => handleClaim(team)}>
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
                              toast.error(e?.message || 'Could not release');
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
                              toast.error(e?.message || 'Kick failed');
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
                              toast.error(err?.message || 'Move failed');
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

      </main>
    </div>
  );
};

export default MultiplayerLobby;
