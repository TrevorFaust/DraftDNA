import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '@/components/Navbar';
import { BrandedLoader } from '@/components/BrandedLoader';
import { PickemMatchupRow } from '@/components/pickem/PickemMatchupRow';
import { PickemWeekBubbles } from '@/components/pickem/PickemWeekBubbles';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useLeagues } from '@/hooks/useLeagues';
import { PICKEM_SEASON, formatPickemRecord } from '@/constants/pickem';
import { gamesForWeek } from '@/constants/nfl2026ScheduleGrid';
import { pickemGetWeek, pickemSetWeekPicks, syncNflScoreboard } from '@/utils/pickemApi';
import { isMatchupLocked, matchupsForWeek, savedPickFor } from '@/utils/nfl2026Schedule';
import { userFacingErrorMessage } from '@/utils/userFacingError';
import type { PickemGame, PickemStanding, PickemWeekBoard } from '@/types/leagueSocial';
import { cn } from '@/lib/utils';

const EMPTY_GAMES: PickemGame[] = [];

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function StandingsList({ standings }: { standings: PickemStanding[] }) {
  if (standings.length === 0) {
    return <p className="text-sm text-muted-foreground">No members yet.</p>;
  }

  const youIndex = standings.findIndex((row) => row.is_you);
  const you = youIndex >= 0 ? standings[youIndex] : null;
  const place = youIndex + 1;
  const leader = standings[0];
  const winsBack = you && leader ? leader.wins - you.wins : 0;

  return (
    <div className="space-y-4">
      {you && (
        <div className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3">
          <p className="font-display text-2xl tracking-wide text-accent">
            {ordinal(place)} of {standings.length}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatPickemRecord(you.wins, you.losses, you.pushes)}
            {place === 1
              ? standings.length > 1
                ? ' · league lead'
                : ''
              : winsBack > 0
                ? ` · ${winsBack} win${winsBack === 1 ? '' : 's'} behind ${leader.username}`
                : ` · tied with ${leader.username} on wins`}
          </p>
        </div>
      )}
      <ol className="space-y-1.5">
        {standings.map((row, index) => (
          <li
            key={row.user_id}
            className={cn(
              'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5',
              row.is_you ? 'border-primary/50 bg-primary/10' : 'border-border/40 bg-secondary/20'
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="w-6 font-mono text-sm tabular-nums text-muted-foreground">{index + 1}</span>
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {row.username}
                  {row.is_you ? ' (you)' : ''}
                </p>
                {row.role === 'owner' && (
                  <p className="text-[11px] text-muted-foreground">Owner</p>
                )}
              </div>
            </div>
            <span className="font-mono text-sm tabular-nums">
              {formatPickemRecord(row.wins, row.losses, row.pushes)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Pickem() {
  const { user, loading: authLoading } = useAuth();
  const { selectedLeague, leagues, loading: leaguesLoading } = useLeagues();
  const navigate = useNavigate();
  const weekChosenRef = useRef(false);
  const weekRef = useRef(1);

  const [week, setWeek] = useState(1);
  weekRef.current = week;
  const [board, setBoard] = useState<PickemWeekBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draftByWeek, setDraftByWeek] = useState<Record<number, Record<string, string>>>({});
  const [view, setView] = useState<'picks' | 'standings'>('picks');

  const leagueId = selectedLeague?.id ?? null;

  const loadBoard = useCallback(
    async (targetWeek: number | null, opts?: { silent?: boolean }) => {
      if (!leagueId) return;
      if (!opts?.silent) setLoading(true);
      try {
        const next = await pickemGetWeek(leagueId, targetWeek);
        setBoard(next);
        if (!weekChosenRef.current && targetWeek == null) {
          setWeek(next.week);
        }
      } catch (error) {
        toast.error(userFacingErrorMessage(error, "Couldn't load this week's games."));
      } finally {
        setLoading(false);
      }
    },
    [leagueId]
  );

  useEffect(() => {
    if (authLoading || leaguesLoading) return;
    if (!user || !leagueId) {
      setLoading(false);
      setBoard(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await syncNflScoreboard({ season: PICKEM_SEASON });
      } catch (error) {
        console.warn('NFL schedule sync failed', error);
      }
      if (!cancelled) {
        const target = weekChosenRef.current ? weekRef.current : null;
        await loadBoard(target, { silent: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, leaguesLoading, user, leagueId, loadBoard]);

  const boardGames = board?.week === week ? board.games : EMPTY_GAMES;
  const matchups = useMemo(() => matchupsForWeek(week, boardGames), [week, boardGames]);

  useEffect(() => {
    setDraftByWeek((prev) => {
      const current = { ...(prev[week] ?? {}) };
      let changed = false;
      for (const matchup of matchups) {
        const saved = savedPickFor(matchup);
        if (current[matchup.key] == null && saved) {
          current[matchup.key] = saved;
          changed = true;
        }
      }
      if (!changed && prev[week]) return prev;
      if (!changed && Object.keys(current).length === 0) return prev;
      return { ...prev, [week]: current };
    });
  }, [week, matchups]);

  const draft = draftByWeek[week] ?? {};
  const openMatchups = matchups.filter((m) => !isMatchupLocked(m));
  const pickedOpen = openMatchups.filter((m) => Boolean(draft[m.key])).length;
  const remaining = openMatchups.length - pickedOpen;
  const dirty = openMatchups.some((m) => (draft[m.key] ?? null) !== savedPickFor(m));

  const you = useMemo(
    () => board?.standings.find((row) => row.is_you) ?? null,
    [board]
  );

  const selectWeek = (nextWeek: number) => {
    weekChosenRef.current = true;
    setView('picks');
    setWeek(nextWeek);
    void loadBoard(nextWeek, { silent: true });
  };

  const selectStandings = () => {
    setView('standings');
    if (leagueId) void loadBoard(week, { silent: true });
  };

  const handlePick = (key: string, abbr: string) => {
    setDraftByWeek((prev) => ({
      ...prev,
      [week]: { ...(prev[week] ?? {}), [key]: abbr },
    }));
  };

  const handleSave = async () => {
    if (!user) {
      navigate('/auth?next=/pickem');
      return;
    }
    if (!selectedLeague) {
      navigate(leagues.length === 0 ? '/settings' : '/dashboard');
      return;
    }
    if (!leagueId || remaining > 0 || openMatchups.length === 0 || !dirty || saving) return;
    setSaving(true);
    try {
      const picks = openMatchups.map((m) => ({
        away: m.away,
        home: m.home,
        picked: draft[m.key],
        kickoff_at: m.kickoffAt,
      }));
      const result = await pickemSetWeekPicks(leagueId, week, picks);
      await loadBoard(week, { silent: true });
      if (result.skipped_locked > 0) {
        toast.message(`Saved ${result.saved} picks. ${result.skipped_locked} already locked.`);
      } else {
        toast.success(`Saved ${result.saved} pick${result.saved === 1 ? '' : 's'} for week ${week}.`);
      }
    } catch (error) {
      toast.error(userFacingErrorMessage(error, "Couldn't save this week's picks."));
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex min-h-[40vh] items-center justify-center">
          <BrandedLoader />
        </div>
      </div>
    );
  }

  const gameCount = gamesForWeek(week).length;
  const saveLabel = !user
    ? remaining > 0
      ? `Pick ${remaining} more`
      : 'Sign in to save'
    : !selectedLeague
      ? remaining > 0
        ? `Pick ${remaining} more`
        : leagues.length === 0
          ? 'Create a league'
          : 'Select a league'
      : openMatchups.length === 0
        ? 'This week is locked'
        : remaining > 0
          ? `Pick ${remaining} more`
          : dirty
            ? `Save week ${week} picks`
            : `Week ${week} saved`;

  const saveEnabled = remaining === 0 && openMatchups.length > 0 && !saving && (
    !user || !selectedLeague || (Boolean(leagueId) && dirty)
  );

  return (
    <div className={cn('min-h-screen bg-background', view === 'picks' && 'pb-28')}>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground">
              {selectedLeague?.name ?? '2026 NFL'}
            </p>
            <h1 className="font-display text-4xl tracking-wide text-gradient md:text-5xl">PICK 'EM</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Pick a week, tap a winner in each game, then save. Change picks until kickoff.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {you && (
              <button
                type="button"
                onClick={selectStandings}
                className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-left transition-colors hover:border-accent"
              >
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Your record</p>
                <p className="font-display text-3xl tabular-nums tracking-wide text-accent">
                  {formatPickemRecord(you.wins, you.losses, you.pushes)}
                </p>
              </button>
            )}
            {user && selectedLeague && (
              <Button asChild variant="outline" className="gap-2">
                <Link to="/league-settings">
                  <UserPlus className="h-4 w-4" />
                  Invite league
                </Link>
              </Button>
            )}
          </div>
        </div>

        <section className="mb-4" aria-labelledby="week-heading">
          <h2 id="week-heading" className="sr-only">
            Select week or standings
          </h2>
          <PickemWeekBubbles
            selectedWeek={week}
            standingsSelected={view === 'standings'}
            onSelectWeek={selectWeek}
            onSelectStandings={selectStandings}
          />
        </section>

        {view === 'standings' ? (
          <section className="mx-auto max-w-xl">
            <h2 className="font-display mb-3 text-xl tracking-wide">Standings</h2>
            {!user ? (
              <p className="text-sm text-muted-foreground">Sign in to see how you stack up in your league.</p>
            ) : !selectedLeague ? (
              <p className="text-sm text-muted-foreground">
                {leagues.length === 0
                  ? 'Create a league to keep a season record against your group.'
                  : 'Select a league in the nav to share this board.'}
              </p>
            ) : loading && !board ? (
              <div className="flex justify-center py-10">
                <BrandedLoader />
              </div>
            ) : (
              <StandingsList standings={board?.standings ?? []} />
            )}
          </section>
        ) : (
          <section className="mb-6">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-xl tracking-wide">Week {week}</h2>
              <p className="text-sm text-muted-foreground">
                {`${gameCount} ${gameCount === 1 ? 'game' : 'games'}`}
                {openMatchups.length < matchups.length
                  ? ` · ${matchups.length - openMatchups.length} locked`
                  : ''}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {matchups.map((matchup) => (
                <PickemMatchupRow
                  key={matchup.key}
                  matchup={matchup}
                  picked={draft[matchup.key] ?? null}
                  onPick={(abbr) => handlePick(matchup.key, abbr)}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {view === 'picks' && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {openMatchups.length === 0
                ? 'All games this week have locked.'
                : `${pickedOpen} of ${openMatchups.length} picked`}
            </p>
            <Button onClick={() => void handleSave()} disabled={!saveEnabled} className="min-h-11 min-w-[10.5rem]">
              {saving ? 'Saving…' : saveLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
