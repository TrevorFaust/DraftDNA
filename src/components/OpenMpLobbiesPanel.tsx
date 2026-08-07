import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandedLoader } from '@/components/BrandedLoader';
import { fetchOpenMpLobbies, mpExpireStaleOpenLobbies } from '@/utils/multiplayerDraftApi';
import {
  clockSkewFromServerNow,
  formatMpLineupSummary,
  formatMpLobbyMeta,
  formatOpenLobbyCountdown,
  OPEN_LOBBY_WARN_MS,
  openLobbyRemainingMs,
} from '@/utils/mpLobbyFormat';
import type { OpenMpLobby } from '@/types/multiplayerDraft';
import type { PositionLimitsLike } from '@/utils/rosterSlots';
import { cn } from '@/lib/utils';

const POLL_MS = 4000;

export function OpenMpLobbiesPanel({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [lobbies, setLobbies] = useState<OpenMpLobby[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [clockSkewMs, setClockSkewMs] = useState(0);

  const refresh = useCallback(async () => {
    try {
      try {
        const expired = await mpExpireStaleOpenLobbies();
        if (expired.serverNow) {
          setClockSkewMs(clockSkewFromServerNow(expired.serverNow));
        }
      } catch {
        /* list still works if expire flakes */
      }
      const rows = await fetchOpenMpLobbies(40);
      setLobbies(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load open lobbies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className={cn(
        'rounded-lg border border-border/50 bg-secondary/30 p-3 space-y-2',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Radio className="w-4 h-4 text-accent shrink-0" aria-hidden />
          <p className="text-sm font-medium truncate">Live open lobbies</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="shrink-0 h-8"
          onClick={() => {
            setLoading(true);
            void refresh();
          }}
        >
          Refresh
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Join a public mock without an invite code. Empty seats stay CPU when the host
        starts. Idle lobbies and lobbies without a host for 10 minutes close
        automatically.
      </p>

      {loading && lobbies.length === 0 && (
        <div className="flex justify-center py-4">
          <BrandedLoader size={28} />
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!loading && !error && lobbies.length === 0 && (
        <p className="text-xs text-muted-foreground py-2">
          No open lobbies right now. Create one as Open to the site so others can jump
          in.
        </p>
      )}

      <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin pr-1">
        {lobbies.map((lobby) => {
          const meta = formatMpLobbyMeta({
            scoringFormat: lobby.scoring_format,
            leagueType: lobby.league_type,
            isSuperflex: lobby.is_superflex,
          });
          const lineup = formatMpLineupSummary(
            lobby.position_limits as PositionLimitsLike | null,
            lobby.is_superflex
          );
          const seatsLeft = Math.max(0, lobby.num_teams - lobby.seats_filled);
          const remaining = openLobbyRemainingMs(
            lobby.lobby_last_activity_at,
            nowMs,
            clockSkewMs
          );
          const hostAwayRemaining = lobby.host_absent_since
            ? openLobbyRemainingMs(lobby.host_absent_since, nowMs, clockSkewMs)
            : null;
          const hostWarn =
            hostAwayRemaining != null && hostAwayRemaining <= OPEN_LOBBY_WARN_MS;
          const idleWarn =
            !hostWarn && remaining != null && remaining <= OPEN_LOBBY_WARN_MS;
          const warn = hostWarn || idleWarn;
          return (
            <div
              key={lobby.draft_id}
              className={cn(
                'rounded-md border bg-background/50 p-2.5 flex items-start justify-between gap-2',
                warn ? 'border-destructive/40' : 'border-border/40'
              )}
            >
              <div className="min-w-0 space-y-0.5">
                <div className="font-medium text-sm truncate">{lobby.name}</div>
                <div className="text-xs text-muted-foreground">
                  <span className="text-foreground/80 font-medium">
                    {lobby.seats_filled}/{lobby.num_teams} filled
                  </span>
                  {seatsLeft > 0 ? ` · ${seatsLeft} open` : ' · full'}
                  {' · '}
                  Host {lobby.host_display_name}
                  {lobby.host_absent_since ? ' · host away' : ''}
                </div>
                <div className="text-xs text-muted-foreground truncate">{meta}</div>
                <div className="text-[11px] text-muted-foreground/90 truncate">
                  {lineup}
                </div>
                {hostWarn && hostAwayRemaining != null && (
                  <div className="text-[11px] font-medium text-destructive">
                    {hostAwayRemaining <= 0
                      ? 'Closing now (host away)'
                      : `Host away — closes in ${formatOpenLobbyCountdown(hostAwayRemaining)}`}
                  </div>
                )}
                {idleWarn && remaining != null && (
                  <div className="text-[11px] font-medium text-destructive">
                    {remaining <= 0
                      ? 'Closing now (inactivity)'
                      : `Closes in ${formatOpenLobbyCountdown(remaining)} (inactivity)`}
                  </div>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="shrink-0"
                disabled={seatsLeft <= 0}
                onClick={() => navigate(`/lobby/${lobby.invite_code}`)}
              >
                Join
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
