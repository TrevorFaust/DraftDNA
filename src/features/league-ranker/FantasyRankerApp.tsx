import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Board } from './components/Board';
import { RoomRanker } from './components/RoomRanker';
import { RosterEditor } from './components/RosterEditor';
import { WeightsPanel } from './components/WeightsPanel';
import { useLeague } from './useLeague';
import type { Room } from './types';
import { clampTeamCount, storageKeyForLeague, type LeagueSeed } from './storage';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BrandedLoader } from '@/components/BrandedLoader';
import { TeamSeatPicker } from '@/components/league/TeamSeatPicker';
import { useAuth } from '@/hooks/useAuth';
import { useLeagues } from '@/hooks/useLeagues';
import { supabase } from '@/integrations/supabase/client';
import { tempSettingsStorage } from '@/utils/temporaryStorage';
import { isLeagueOwner } from '@/utils/leagueAccess';
import { leagueClaimTeam, leagueListSeats } from '@/utils/leagueSocialApi';
import { userFacingErrorMessage } from '@/utils/userFacingError';
import { cn } from '@/lib/utils';
import type { LeagueSeat } from '@/types/leagueSocial';
import type { PositionLimitsLike } from '@/utils/rosterSlots';

type Panel = 'rooms' | 'rosters' | 'weights';

export function FantasyRankerApp() {
  const { user } = useAuth();
  const { selectedLeague, leagues } = useLeagues();
  const [seed, setSeed] = useState<LeagueSeed | null>(null);
  const [guestLineup, setGuestLineup] = useState<{
    limits: PositionLimitsLike | null;
    isSuperflex: boolean;
  }>({ limits: null, isSuperflex: false });
  const [seedReady, setSeedReady] = useState(false);

  useEffect(() => {
    if (user && !selectedLeague) {
      setSeed(null);
      setSeedReady(true);
      return;
    }

    if (!selectedLeague) {
      const temp = tempSettingsStorage.get();
      const count = clampTeamCount(temp?.numTeams, 12);
      const names = Array.from({ length: count }, (_, index) => {
        const row = temp?.teamNames?.find(
          (team: { team_number?: number; team_name?: string }) => team.team_number === index + 1,
        );
        return row?.team_name?.trim() || `Team ${index + 1}`;
      });
      setSeed({ teamCount: count, names });
      setGuestLineup({
        limits: (temp?.positionLimits as PositionLimitsLike | undefined) ?? null,
        isSuperflex: Boolean(temp?.isSuperflex),
      });
      setSeedReady(true);
      return;
    }

    let cancelled = false;
    setSeedReady(false);

    void (async () => {
      const { data } = await supabase
        .from('league_teams')
        .select('team_number, team_name')
        .eq('league_id', selectedLeague.id);

      if (cancelled) return;

      const count = clampTeamCount(selectedLeague.num_teams, 12);
      const names = Array.from({ length: count }, (_, index) => {
        const row = data?.find((team) => team.team_number === index + 1);
        return row?.team_name?.trim() || `Team ${index + 1}`;
      });
      setSeed({ teamCount: count, names });
      setSeedReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, selectedLeague]);

  if (!seedReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <BrandedLoader label="Loading team rankings" />
      </div>
    );
  }

  if (user && !selectedLeague) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">In season</p>
        <h1 className="font-display mt-2 text-4xl tracking-wide md:text-5xl">Team Rankings</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {leagues.length > 0
            ? 'Pick a league in the navbar to rank those teams. Each league keeps its own board.'
            : 'Create a league first, then come back to rank those teams.'}
        </p>
        {leagues.length === 0 ? (
          <Button asChild className="mt-6">
            <Link to="/settings">Create a league</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  if (!seed) return null;

  const canManageRosters = !selectedLeague || isLeagueOwner(selectedLeague, user?.id);
  const storageKey = storageKeyForLeague(selectedLeague?.id ?? null, user?.id ?? null);

  return (
    <RankerBoard
      key={storageKey}
      storageKey={storageKey}
      seed={seed}
      leagueName={selectedLeague?.name ?? null}
      canManageRosters={canManageRosters}
      leagueId={selectedLeague?.id ?? null}
      userId={user?.id ?? null}
      ownerId={selectedLeague?.user_id ?? null}
      lineupLimits={
        (selectedLeague?.position_limits as PositionLimitsLike | null) ?? guestLineup.limits
      }
      isSuperflex={
        selectedLeague ? Boolean(selectedLeague.is_superflex) : guestLineup.isSuperflex
      }
    />
  );
}

function RankerBoard({
  storageKey,
  seed,
  leagueName,
  canManageRosters,
  leagueId,
  userId,
  ownerId,
  lineupLimits,
  isSuperflex,
}: {
  storageKey: string;
  seed: LeagueSeed;
  leagueName: string | null;
  canManageRosters: boolean;
  leagueId: string | null;
  userId: string | null;
  ownerId: string | null;
  lineupLimits: PositionLimitsLike | null;
  isSuperflex: boolean;
}) {
  const [seats, setSeats] = useState<LeagueSeat[] | null>(leagueId ? null : []);
  const [pickedTeam, setPickedTeam] = useState<number | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const didDefaultTeam = useRef(false);

  const loadSeats = useCallback(async () => {
    if (!leagueId || !userId) {
      setSeats([]);
      return;
    }
    setSeats(await leagueListSeats(leagueId));
  }, [leagueId, userId]);

  useEffect(() => {
    void loadSeats();
  }, [loadSeats]);

  const mySeat = useMemo(
    () => (userId && seats ? seats.find((seat) => seat.user_id === userId) ?? null : null),
    [seats, userId],
  );
  const lineupTeamIndex: number | 'all' | null =
    !leagueId || canManageRosters ? 'all' : mySeat ? mySeat.team_number - 1 : null;
  const canEditLineup = !leagueId || canManageRosters || Boolean(mySeat);
  const needsSeat = Boolean(leagueId && userId && !canManageRosters && seats && !mySeat);

  const api = useLeague(storageKey, seed, {
    canEdit: true,
    canManageRosters,
    canEditLineup,
    lineupTeamIndex,
    leagueId,
    userId,
    ownerId,
    lineupLimits,
    isSuperflex,
  });
  const [panel, setPanel] = useState<Panel>('rooms');
  const [activeRoom, setActiveRoom] = useState<Room>('WR');
  const [activeTeamId, setActiveTeamId] = useState(api.league.teams[0]?.id ?? '');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const teamCount = api.league.teams.length;
  const yourTeamId =
    typeof lineupTeamIndex === 'number' ? api.league.teams[lineupTeamIndex]?.id ?? null : null;

  const canSwapTeam = useCallback(
    (teamId: string) => {
      if (lineupTeamIndex === 'all') return true;
      return Boolean(yourTeamId && teamId === yourTeamId);
    },
    [lineupTeamIndex, yourTeamId],
  );

  useEffect(() => {
    if (!api.league.teams.some((team) => team.id === activeTeamId)) {
      setActiveTeamId(api.league.teams[0]?.id ?? '');
    }
  }, [activeTeamId, api.league.teams]);

  useEffect(() => {
    if (didDefaultTeam.current || !yourTeamId) return;
    setActiveTeamId(yourTeamId);
    setExpandedId(yourTeamId);
    didDefaultTeam.current = true;
  }, [yourTeamId]);

  const claim = async () => {
    if (!leagueId || pickedTeam == null) return;
    setClaiming(true);
    setClaimError(null);
    try {
      await leagueClaimTeam(leagueId, pickedTeam);
      await loadSeats();
    } catch (error) {
      setClaimError(userFacingErrorMessage(error, "Couldn't claim that team."));
    } finally {
      setClaiming(false);
    }
  };

  useEffect(() => {
    if (!canManageRosters && panel === 'weights') setPanel('rooms');
  }, [canManageRosters, panel]);

  if (!api.hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <BrandedLoader label="Loading team rankings" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {leagueName
            ? `${teamCount}-team · ${leagueName}`
            : `${teamCount}-team war room`}
        </p>
        <h1 className="font-display text-4xl tracking-wide md:text-5xl">Team Rankings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rank each position room, 1st at the top. The board on the left updates from those ranks.
          {leagueId && canManageRosters
            ? ' You can swap any lineup. Members only swap the team they claimed.'
            : null}
          {leagueId && !canManageRosters && mySeat
            ? ` Swap starters on ${mySeat.team_name} only.`
            : null}
        </p>
      </div>

      {needsSeat ? (
        <div className="mb-6 space-y-4 rounded-lg border border-border/60 bg-card/40 p-4">
          <div>
            <h2 className="font-display text-2xl tracking-wide">Pick your team</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You can only move starters on the roster you claim. Ask the commissioner if you need a
              different seat later.
            </p>
          </div>
          <TeamSeatPicker
            seats={seats ?? []}
            value={pickedTeam}
            onChange={setPickedTeam}
            disabled={claiming}
            currentUserId={userId}
          />
          <Button
            type="button"
            className="h-11"
            disabled={claiming || pickedTeam == null}
            onClick={() => void claim()}
          >
            {claiming ? 'Saving…' : 'Claim this team'}
          </Button>
          {claimError ? (
            <p className="text-sm text-destructive" role="alert">
              {claimError}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid min-h-0 gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-lg border border-border/60 bg-card/40 p-4 max-h-[min(75dvh,720px)] overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin">
          <Board
            board={api.board}
            weights={api.league.weights}
            expandedId={expandedId}
            canEdit
            canSwapTeam={canSwapTeam}
            yourTeamId={yourTeamId}
            lineupLimits={lineupLimits}
            isSuperflex={isSuperflex}
            onToggle={(id) => {
              setExpandedId((current) => (current === id ? null : id));
              setActiveTeamId(id);
            }}
            onGutBump={api.setGutBump}
            onSwapLineup={api.swapLineup}
          />
        </div>
        <div className="rounded-lg border border-border/60 bg-card/40 p-4 max-h-[min(75dvh,720px)] overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin">
          <Tabs value={panel} onValueChange={(value) => setPanel(value as Panel)}>
            <TabsList
              className={cn('mb-3 grid w-full', canManageRosters ? 'grid-cols-3' : 'grid-cols-2')}
            >
              <TabsTrigger value="rooms">Rank rooms</TabsTrigger>
              <TabsTrigger value="rosters">Rosters</TabsTrigger>
              {canManageRosters ? <TabsTrigger value="weights">Weights</TabsTrigger> : null}
            </TabsList>
            <TabsContent value="rooms">
              <RoomRanker
                league={api.league}
                activeRoom={activeRoom}
                canEdit
                onRoomChange={setActiveRoom}
                onReorder={api.setOrdinalOrder}
              />
            </TabsContent>
            <TabsContent value="rosters">
              <RosterEditor
                teams={api.league.teams}
                activeTeamId={activeTeamId || api.league.teams[0].id}
                canEdit={canManageRosters}
                canSwap={canSwapTeam(activeTeamId || api.league.teams[0].id)}
                yourTeamId={yourTeamId}
                lineupLimits={lineupLimits}
                isSuperflex={isSuperflex}
                onSelectTeam={setActiveTeamId}
                onRename={api.renameTeam}
                onSetRoster={api.setRoster}
                onRemovePlayer={api.removePlayer}
                onResetTeam={api.resetTeam}
                onSwapLineup={api.swapLineup}
              />
            </TabsContent>
            {canManageRosters ? (
              <TabsContent value="weights" forceMount className="data-[state=inactive]:hidden">
                <WeightsPanel league={api.league} canEdit onSave={api.setWeights} />
              </TabsContent>
            ) : null}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
