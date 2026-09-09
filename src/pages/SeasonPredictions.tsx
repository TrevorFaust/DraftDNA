import { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Dices, Lock, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '@/components/Navbar';
import { PickemMatchupRow } from '@/components/pickem/PickemMatchupRow';
import { SeasonAwardsPanel } from '@/components/season-predictions/SeasonAwardsPanel';
import { SeasonPlayoffBracketBoard } from '@/components/season-predictions/SeasonPlayoffBracket';
import {
  SeasonPredictionWeekBubbles,
  type SeasonPredictionView,
} from '@/components/season-predictions/SeasonPredictionWeekBubbles';
import { SeasonStandingsBoard } from '@/components/season-predictions/SeasonStandingsBoard';
import { SeasonTeamEditor } from '@/components/season-predictions/SeasonTeamEditor';
import { Button } from '@/components/ui/button';
import {
  emptySeasonAwardsPicks,
  type SeasonAwardId,
  type SeasonAwardPick,
  type SeasonAwardsPicks,
} from '@/constants/seasonAwards';
import {
  isSeasonPredictionsLocked,
  PICKEM_SEASON,
  PICKEM_WEEKS,
} from '@/constants/pickem';
import { gamesForWeek, scheduleGameKey } from '@/constants/nfl2026ScheduleGrid';
import { useAuth } from '@/hooks/useAuth';
import { buildAllPlayoffSeeds } from '@/utils/seasonPredictionRecords';
import { officialKickoff, type WeekMatchup } from '@/utils/nfl2026Schedule';
import {
  applyConferencePick,
  applySuperBowlPick,
  bracketComplete,
  emptyPlayoffBracketPicks,
  type PlayoffBracketPicks,
} from '@/utils/seasonPlayoffBracket';
import {
  clearSeasonPredictionBoard,
  fetchSeasonPredictionBoard,
  saveSeasonPredictionBoard,
} from '@/utils/seasonPredictionsRemote';
import {
  clearSeasonPredictionPicks,
  fillRemainingRandomPicks,
  loadSeasonPredictionState,
  saveSeasonPredictionState,
  seasonBoardHasContent,
  seasonPickProgress,
  weekPickProgress,
  type SeasonPredictionPicks,
} from '@/utils/seasonPredictionsStorage';
import { cn } from '@/lib/utils';

function predictionMatchupsForWeek(week: number): WeekMatchup[] {
  return gamesForWeek(week)
    .map((slot) => ({
      key: scheduleGameKey(week, slot.away, slot.home),
      week,
      home: slot.home,
      away: slot.away,
      game: null,
      kickoffAt: officialKickoff(week, slot.away, slot.home),
    }))
    .sort((a, b) => {
      const timeA = a.kickoffAt ? Date.parse(a.kickoffAt) : Number.POSITIVE_INFINITY;
      const timeB = b.kickoffAt ? Date.parse(b.kickoffAt) : Number.POSITIVE_INFINITY;
      if (timeA !== timeB) return timeA - timeB;
      return a.away.localeCompare(b.away) || a.home.localeCompare(b.home);
    });
}

function fireChampionConfetti() {
  const duration = 2200;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 32, spread: 360, ticks: 70, zIndex: 80 };

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  const interval = window.setInterval(() => {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) {
      window.clearInterval(interval);
      return;
    }
    const particleCount = 55 * (timeLeft / duration);
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.15, 0.35), y: Math.random() - 0.2 },
    });
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.65, 0.85), y: Math.random() - 0.2 },
    });
  }, 220);
}

function lockedToast() {
  toast.message('Season Predictions locked after September 11, 2026.');
}

export default function SeasonPredictions() {
  const { user } = useAuth();
  const initial = loadSeasonPredictionState();
  const initialProgress = seasonPickProgress(initial.picks);
  const seasonLocked = isSeasonPredictionsLocked();

  const [week, setWeek] = useState(1);
  const [view, setView] = useState<SeasonPredictionView>(() =>
    initialProgress.complete ? 'records' : 'picks'
  );
  const [editTeamAbbr, setEditTeamAbbr] = useState<string | null>(null);
  const [picks, setPicks] = useState<SeasonPredictionPicks>(() => initial.picks);
  const [bracket, setBracket] = useState<PlayoffBracketPicks>(() => initial.bracket);
  const [awards, setAwards] = useState<SeasonAwardsPicks>(() => initial.awards);
  /** When signed in, wait for cloud hydrate before writing remote (avoids wiping account with empty local). */
  const [cloudReady, setCloudReady] = useState(() => !user);
  const cloudUserIdRef = useRef<string | null>(user?.id ?? null);

  useEffect(() => {
    cloudUserIdRef.current = user?.id ?? null;
    if (!user) {
      setCloudReady(true);
      return;
    }

    let cancelled = false;
    setCloudReady(false);

    (async () => {
      const remote = await fetchSeasonPredictionBoard(user.id, PICKEM_SEASON);
      if (cancelled) return;

      if (remote) {
        setPicks(remote.picks);
        setBracket(remote.bracket);
        setAwards(remote.awards);
        saveSeasonPredictionState(remote.picks, remote.bracket, remote.awards, PICKEM_SEASON);
        const remoteProgress = seasonPickProgress(remote.picks);
        setView(remoteProgress.complete ? 'records' : 'picks');
      } else {
        const local = loadSeasonPredictionState(PICKEM_SEASON);
        if (seasonBoardHasContent(local)) {
          await saveSeasonPredictionBoard(
            user.id,
            local.picks,
            local.bracket,
            local.awards,
            PICKEM_SEASON
          );
        }
      }

      if (!cancelled) setCloudReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    saveSeasonPredictionState(picks, bracket, awards, PICKEM_SEASON);
    const userId = cloudUserIdRef.current;
    if (!userId || !cloudReady) return;

    const timer = window.setTimeout(() => {
      void saveSeasonPredictionBoard(userId, picks, bracket, awards, PICKEM_SEASON);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [picks, bracket, awards, cloudReady]);

  const progress = useMemo(() => seasonPickProgress(picks), [picks]);
  const playoffSeeds = useMemo(
    () => (progress.complete ? buildAllPlayoffSeeds(picks) : null),
    [picks, progress.complete]
  );
  const completedWeeks = useMemo(() => new Set(progress.completedWeeks), [progress.completedWeeks]);
  const weekProgress = useMemo(() => weekPickProgress(picks, week), [picks, week]);
  const matchups = useMemo(() => predictionMatchupsForWeek(week), [week]);
  const gameCount = matchups.length;
  const playoffsComplete = useMemo(
    () =>
      playoffSeeds
        ? bracketComplete(playoffSeeds.afc, playoffSeeds.nfc, bracket)
        : false,
    [playoffSeeds, bracket]
  );

  const selectWeek = (nextWeek: number) => {
    setView('picks');
    setWeek(nextWeek);
  };

  const selectByTeam = () => {
    setView('byTeam');
  };

  const selectTeamEditor = (abbr: string) => {
    setEditTeamAbbr(abbr);
    setView('byTeam');
  };

  const selectRecords = () => {
    if (!progress.complete) {
      toast.message('Finish every week to unlock projected records.');
      return;
    }
    setView('records');
  };

  const selectPlayoffs = () => {
    if (!progress.complete) {
      toast.message('Finish every week to unlock the playoff bracket.');
      return;
    }
    setView('playoffs');
  };

  const selectAwards = () => {
    if (!progress.complete) {
      toast.message('Finish every week to unlock awards.');
      return;
    }
    setView('awards');
  };

  const handleAwardChange = (awardId: SeasonAwardId, pick: SeasonAwardPick | null) => {
    if (seasonLocked) {
      lockedToast();
      return;
    }
    setAwards((prev) => ({ ...prev, [awardId]: pick }));
  };

  const handlePick = (key: string, abbr: string) => {
    if (seasonLocked) {
      lockedToast();
      return;
    }
    setPicks((prev) => {
      const next = { ...prev, [key]: abbr };
      if (seasonPickProgress(prev).complete) {
        setBracket(emptyPlayoffBracketPicks());
      }
      const after = seasonPickProgress(next);
      if (after.complete && !seasonPickProgress(prev).complete) {
        queueMicrotask(() => {
          toast.success('Season slate complete — records and playoffs unlocked.');
          setView('records');
        });
      }
      return next;
    });
  };

  const handleConferenceBracketPick = (
    conference: 'AFC' | 'NFC',
    round: 'wildCard' | 'divisional' | 'conference',
    index: number | null,
    winnerAbbr: string
  ) => {
    if (seasonLocked) {
      lockedToast();
      return;
    }
    setBracket((prev) => {
      const key = conference.toLowerCase() as 'afc' | 'nfc';
      const nextConf = applyConferencePick(prev[key], round, index, winnerAbbr);
      return { ...prev, [key]: nextConf, superBowl: null };
    });
  };

  const handleSuperBowlPick = (winnerAbbr: string) => {
    if (seasonLocked) {
      lockedToast();
      return;
    }
    setBracket((prev) => {
      const next = applySuperBowlPick(prev, winnerAbbr);
      if (playoffSeeds && bracketComplete(playoffSeeds.afc, playoffSeeds.nfc, next)) {
        queueMicrotask(() => {
          fireChampionConfetti();
          toast.success('Super Bowl champion locked in.');
        });
      }
      return next;
    });
  };

  const handleFooterAction = () => {
    if (!weekProgress.complete) return;

    if (week < PICKEM_WEEKS) {
      setWeek(week + 1);
      setView('picks');
      return;
    }

    if (progress.complete) {
      setView('records');
    }
  };

  const handleReset = () => {
    if (seasonLocked) {
      lockedToast();
      return;
    }
    clearSeasonPredictionPicks();
    setPicks({});
    setBracket(emptyPlayoffBracketPicks());
    setAwards(emptySeasonAwardsPicks());
    setWeek(1);
    setEditTeamAbbr(null);
    setView('picks');
    const userId = cloudUserIdRef.current;
    if (userId) {
      void clearSeasonPredictionBoard(userId, PICKEM_SEASON);
    }
    toast.message('Cleared your season predictions.');
  };

  const handleRandomFill = () => {
    if (seasonLocked) {
      lockedToast();
      return;
    }
    const { picks: next, filled } = fillRemainingRandomPicks(picks);
    if (filled === 0) {
      toast.message('Every game already has a pick.');
      return;
    }
    setPicks(next);
    setBracket(emptyPlayoffBracketPicks());
    toast.success(
      filled === 1
        ? 'Filled 1 remaining game.'
        : `Filled ${filled} remaining games with random winners.`
    );
    if (seasonPickProgress(next).complete) {
      setView('records');
    }
  };

  const remainingThisWeek = weekProgress.total - weekProgress.picked;
  const remainingSeason = progress.total - progress.picked;
  const footerLabel = !weekProgress.complete
    ? `Pick ${remainingThisWeek} more`
    : week < PICKEM_WEEKS
      ? `Continue to week ${week + 1}`
      : progress.complete
        ? 'View projected records'
        : 'Finish earlier weeks first';

  const footerEnabled =
    !seasonLocked && weekProgress.complete && (week < PICKEM_WEEKS || progress.complete);

  return (
    <div className={cn('min-h-screen bg-background', view === 'picks' && !seasonLocked && 'pb-28')}>
      <Navbar />
      <main
        className={cn(
          'mx-auto w-full px-4 py-5',
          view === 'playoffs' ? 'max-w-[90rem]' : 'max-w-6xl'
        )}
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground">{PICKEM_SEASON} NFL</p>
            <h1 className="font-display text-4xl tracking-wide text-gradient md:text-5xl">
              SEASON PREDICTIONS
            </h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Pick every regular-season game, then play out the playoffs through the Super Bowl.
              {user
                ? ' Signed in — your slate syncs across devices.'
                : ' Sign in to sync this slate across devices.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-border/60 bg-secondary/20 px-4 py-3">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Progress</p>
              <p className="font-display text-2xl tabular-nums tracking-wide">
                {progress.picked}
                <span className="text-muted-foreground"> / {progress.total}</span>
              </p>
            </div>
            {!seasonLocked && remainingSeason > 0 && (
              <Button type="button" variant="outline" className="gap-2" onClick={handleRandomFill}>
                <Dices className="h-4 w-4" />
                Random fill
              </Button>
            )}
            {!seasonLocked &&
              (progress.picked > 0 ||
                playoffsComplete ||
                Object.values(awards).some(Boolean)) && (
              <Button type="button" variant="outline" className="gap-2" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            )}
          </div>
        </div>

        {seasonLocked && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-border/60 bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              Predictions locked after September 11, 2026. You can still view standings, bracket,
              and awards, but picks can no longer change.
            </p>
          </div>
        )}

        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-secondary/60" aria-hidden>
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{
              width: `${progress.total === 0 ? 0 : (progress.picked / progress.total) * 100}%`,
            }}
          />
        </div>

        <section className="mb-4" aria-labelledby="season-week-heading">
          <h2 id="season-week-heading" className="sr-only">
            Select week, team editor, records, playoffs, or awards
          </h2>
          <SeasonPredictionWeekBubbles
            selectedWeek={week}
            activeView={view}
            completedWeeks={completedWeeks}
            recordsReady={progress.complete}
            onSelectWeek={selectWeek}
            onSelectByTeam={selectByTeam}
            onSelectRecords={selectRecords}
            onSelectPlayoffs={selectPlayoffs}
            onSelectAwards={selectAwards}
          />
        </section>

        {view === 'records' ? (
          <section>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-xl tracking-wide">Projected records</h2>
                <p className="text-sm text-muted-foreground">
                  {seasonLocked
                    ? 'Your locked standings, playoff seeds, and awards.'
                    : "Tap a team to edit that club's games, or use week bubbles / By team."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!seasonLocked && (
                  <>
                    <Button type="button" variant="outline" onClick={() => selectWeek(1)}>
                      Edit by week
                    </Button>
                    <Button type="button" variant="outline" onClick={selectByTeam}>
                      Edit by team
                    </Button>
                  </>
                )}
                <Button type="button" variant="outline" onClick={selectAwards}>
                  Awards
                </Button>
                <Button type="button" onClick={selectPlayoffs}>
                  Playoff bracket
                </Button>
              </div>
            </div>
            <SeasonStandingsBoard
              picks={picks}
              awards={awards}
              awardsLocked={seasonLocked}
              onAwardChange={handleAwardChange}
              onSelectTeam={seasonLocked ? undefined : selectTeamEditor}
            />
          </section>
        ) : view === 'awards' ? (
          <section>
            <div className="mb-4 flex justify-end">
              <Button type="button" variant="outline" onClick={selectRecords}>
                View records
              </Button>
            </div>
            <SeasonAwardsPanel
              awards={awards}
              locked={seasonLocked}
              onChange={handleAwardChange}
            />
          </section>
        ) : view === 'playoffs' && playoffSeeds ? (
          <section>
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-xl tracking-wide">Playoff bracket</h2>
                <p className="text-sm text-muted-foreground">
                  Wild card: 7 @ 2, 6 @ 3, 5 @ 4. #1 gets a bye. Tap a team to advance them.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={selectRecords}>
                View records
              </Button>
            </div>
            <SeasonPlayoffBracketBoard
              afcSeeds={playoffSeeds.afc}
              nfcSeeds={playoffSeeds.nfc}
              bracket={bracket}
              locked={seasonLocked}
              onConferencePick={handleConferenceBracketPick}
              onSuperBowlPick={handleSuperBowlPick}
            />
          </section>
        ) : view === 'byTeam' ? (
          <section className="mb-6">
            <div className="mb-3">
              <h2 className="font-display text-xl tracking-wide">
                {seasonLocked ? 'View by team' : 'Edit by team'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {seasonLocked
                  ? 'Browse each team’s predicted games.'
                  : "Changing a game updates both teams' records immediately."}
              </p>
            </div>
            <SeasonTeamEditor
              picks={picks}
              selectedAbbr={editTeamAbbr}
              onSelectTeam={setEditTeamAbbr}
              onPick={handlePick}
              locked={seasonLocked}
            />
          </section>
        ) : (
          <section className="mb-6">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-xl tracking-wide">Week {week}</h2>
              <p className="text-sm text-muted-foreground">
                {weekProgress.picked} of {gameCount} picked
                {weekProgress.complete ? ' · complete' : ''}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {matchups.map((matchup) => (
                <PickemMatchupRow
                  key={matchup.key}
                  matchup={matchup}
                  picked={picks[matchup.key] ?? null}
                  onPick={(abbr) => handlePick(matchup.key, abbr)}
                  alwaysUnlocked={!seasonLocked}
                  forceLocked={seasonLocked}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {view === 'picks' && !seasonLocked && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {weekProgress.picked} of {weekProgress.total} this week · {progress.picked} of{' '}
              {progress.total} season
            </p>
            <Button
              onClick={handleFooterAction}
              disabled={!footerEnabled}
              className="min-h-11 min-w-[11rem]"
            >
              {footerLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
