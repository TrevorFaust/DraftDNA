import { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Dices, Lock, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '@/components/Navbar';
import { BrandedLoader } from '@/components/BrandedLoader';
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
  SEASON_AWARD_IDS,
  emptySeasonAwardsPicks,
  type SeasonAwardId,
  type SeasonAwardPick,
  type SeasonAwardsPicks,
} from '@/constants/seasonAwards';
import { PICKEM_SEASON, PICKEM_WEEKS } from '@/constants/pickem';
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
  preferRicherSeasonBoard,
  saveSeasonPredictionBoard,
  seasonBoardPickCount,
} from '@/utils/seasonPredictionsRemote';
import {
  clearSeasonPredictionPicks,
  emptySeasonPredictionMeta,
  fillRemainingRandomPicks,
  loadSeasonPredictionState,
  saveSeasonPredictionState,
  seasonBoardHasContent,
  stampAdjustment,
  withCommittedWeeks,
  type SeasonPredictionBoardState,
  type SeasonPredictionMeta,
  type SeasonPredictionPicks,
} from '@/utils/seasonPredictionsStorage';
import { officialPickemGame, officialResult, weekIsFinal } from '@/utils/nfl2026Results';
import {
  adjustmentWeekPhrase,
  firstEditableWeek,
  formatWeekList,
  gameIsEditable,
  hasGameKickedOff,
  nflPredictionWeek,
  openWeekProgress,
  seasonHasStarted,
  slateIsLocked,
  slateStatus,
} from '@/utils/seasonWeekClock';
import { cn } from '@/lib/utils';

function predictionMatchupsForWeek(week: number): WeekMatchup[] {
  return gamesForWeek(week)
    .map((slot) => ({
      key: scheduleGameKey(week, slot.away, slot.home),
      week,
      home: slot.home,
      away: slot.away,
      game: officialPickemGame(week, slot.away, slot.home),
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

function awardsComplete(awards: SeasonAwardsPicks): boolean {
  return SEASON_AWARD_IDS.every((id) => awards[id] != null);
}

function weekFromGameKey(key: string): number | null {
  const weekNumber = Number(key.split(':')[0]);
  return Number.isInteger(weekNumber) ? weekNumber : null;
}

function PredictionFootnote({
  meta,
  includeAwards = false,
  includePlayoffs = false,
}: {
  meta: SeasonPredictionMeta;
  includeAwards?: boolean;
  includePlayoffs?: boolean;
}) {
  const edited = adjustmentWeekPhrase(meta.lastAdjustedWeek ?? meta.startedWeek);
  const awardsWhen = meta.awardsCommitted ? adjustmentWeekPhrase(meta.awardsWeek) : null;
  const playoffsWhen = meta.playoffsCommitted ? adjustmentWeekPhrase(meta.playoffsWeek) : null;
  const lines = [
    edited ? `Last edited ${edited}.` : null,
    includeAwards && awardsWhen ? `Awards last edited ${awardsWhen}.` : null,
    includePlayoffs && playoffsWhen ? `Playoff bracket last edited ${playoffsWhen}.` : null,
  ].filter((line): line is string => Boolean(line));

  if (lines.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-border/60 bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

export default function SeasonPredictions() {
  const { user, loading: authLoading } = useAuth();
  const [now, setNow] = useState(() => Date.now());
  const [week, setWeek] = useState(() => firstEditableWeek([]));
  const [view, setView] = useState<SeasonPredictionView>('picks');
  const [editTeamAbbr, setEditTeamAbbr] = useState<string | null>(null);
  const [picks, setPicks] = useState<SeasonPredictionPicks>({});
  const [bracket, setBracket] = useState<PlayoffBracketPicks>(() => emptyPlayoffBracketPicks());
  const [awards, setAwards] = useState<SeasonAwardsPicks>(() => emptySeasonAwardsPicks());
  const [meta, setMeta] = useState<SeasonPredictionMeta>(() => emptySeasonPredictionMeta());
  const [hydrated, setHydrated] = useState(false);
  /** Wait for auth + cloud hydrate before writing remote. */
  const [cloudReady, setCloudReady] = useState(false);
  const cloudUserIdRef = useRef<string | null>(null);
  const applyingRemoteRef = useRef(false);
  const picksRef = useRef(picks);
  const bracketRef = useRef(bracket);
  const awardsRef = useRef(awards);
  const metaRef = useRef(meta);
  const userRef = useRef(user);
  const placeRef = useRef({ view, week });
  const hydratedRef = useRef(false);

  picksRef.current = picks;
  bracketRef.current = bracket;
  awardsRef.current = awards;
  metaRef.current = meta;
  userRef.current = user;
  hydratedRef.current = hydrated;

  const status = useMemo(() => slateStatus(picks, now), [picks, now]);
  const playoffSeeds = useMemo(
    () => (status.complete ? buildAllPlayoffSeeds(picks) : null),
    [picks, status.complete]
  );
  const playoffSeedsRef = useRef(playoffSeeds);
  playoffSeedsRef.current = playoffSeeds;

  const completedWeeks = useMemo(() => new Set(status.completedWeeks), [status.completedWeeks]);
  const passedWeeks = useMemo(() => new Set(status.passedWeeks), [status.passedWeeks]);
  const weekProgress = useMemo(() => openWeekProgress(picks, week, now), [picks, week, now]);
  const matchups = useMemo(() => predictionMatchupsForWeek(week), [week]);
  const gameCount = matchups.length;

  const applyBoard = (board: SeasonPredictionBoardState) => {
    applyingRemoteRef.current = true;
    const nextWeek = firstEditableWeek(
      board.meta.committedWeeks,
      Date.now(),
      slateIsLocked(board.meta)
    );
    placeRef.current = { view: 'picks', week: nextWeek };
    picksRef.current = board.picks;
    bracketRef.current = board.bracket;
    awardsRef.current = board.awards;
    metaRef.current = board.meta;
    setPicks(board.picks);
    setBracket(board.bracket);
    setAwards(board.awards);
    setMeta(board.meta);
    setWeek(nextWeek);
    setView('picks');
    saveSeasonPredictionState(board.picks, board.bracket, board.awards, PICKEM_SEASON, board.meta);
    queueMicrotask(() => {
      applyingRemoteRef.current = false;
    });
  };

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onHide = () => {
      if (!userRef.current || !hydratedRef.current) return;
      const snapshot = metaRef.current;
      saveSeasonPredictionState(
        picksRef.current,
        bracketRef.current,
        awardsRef.current,
        PICKEM_SEASON,
        snapshot
      );
      void saveSeasonPredictionBoard(
        userRef.current.id,
        picksRef.current,
        bracketRef.current,
        awardsRef.current,
        PICKEM_SEASON,
        { meta: snapshot }
      );
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  useEffect(() => {
    placeRef.current = { view, week };
  }, [view, week]);

  const signedInId = user?.id ?? null;

  useEffect(() => {
    if (authLoading) return;

    cloudUserIdRef.current = signedInId;
    if (!signedInId) {
      setPicks({});
      setBracket(emptyPlayoffBracketPicks());
      setAwards(emptySeasonAwardsPicks());
      setMeta(emptySeasonPredictionMeta());
      setWeek(firstEditableWeek([]));
      setView('picks');
      setCloudReady(true);
      setHydrated(true);
      return;
    }

    let cancelled = false;
    setCloudReady(false);
    setHydrated(false);

    (async () => {
      const remote = await fetchSeasonPredictionBoard(signedInId, PICKEM_SEASON);
      if (cancelled) return;

      if (!remote.ok) {
        toast.error('Could not load synced Season Predictions. Using this device only for now.');
        const local = loadSeasonPredictionState(PICKEM_SEASON);
        if (seasonBoardHasContent(local)) applyBoard(local);
        if (!cancelled) {
          setCloudReady(true);
          setHydrated(true);
        }
        return;
      }

      const local = loadSeasonPredictionState(PICKEM_SEASON);
      const remoteBoard = remote.board;
      const remoteHasPicks = remoteBoard ? seasonBoardPickCount(remoteBoard) > 0 : false;
      const localHasPicks = seasonBoardPickCount(local) > 0;

      if (remoteBoard && remoteHasPicks && localHasPicks) {
        const chosen = preferRicherSeasonBoard(remoteBoard, local);
        applyBoard(chosen);
        if (seasonBoardPickCount(chosen) > seasonBoardPickCount(remoteBoard)) {
          await saveSeasonPredictionBoard(
            signedInId,
            chosen.picks,
            chosen.bracket,
            chosen.awards,
            PICKEM_SEASON,
            { meta: chosen.meta }
          );
        }
      } else if (remoteBoard && (remoteHasPicks || seasonBoardHasContent(remoteBoard))) {
        applyBoard(remoteBoard);
      } else if (seasonBoardHasContent(local)) {
        applyBoard(local);
        await saveSeasonPredictionBoard(signedInId, local.picks, local.bracket, local.awards, PICKEM_SEASON, {
          meta: local.meta,
        });
      }

      if (!cancelled) {
        setCloudReady(true);
        setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signedInId, authLoading]);

  useEffect(() => {
    if (!hydrated || !user) return;
    saveSeasonPredictionState(picks, bracket, awards, PICKEM_SEASON, meta);
    const userId = cloudUserIdRef.current;
    if (!userId || !cloudReady || applyingRemoteRef.current) return;
    if (!seasonBoardHasContent({ picks, bracket, awards, meta })) return;

    const timer = window.setTimeout(() => {
      void saveSeasonPredictionBoard(userId, picks, bracket, awards, PICKEM_SEASON, { meta }).then((ok) => {
        if (!ok) toast.error('Could not sync Season Predictions to your account.');
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [picks, bracket, awards, meta, cloudReady, hydrated, user]);

  const slateLocked = slateIsLocked(meta, now);
  const weekSaved = Boolean(user) && meta.committedWeeks.includes(week);
  const weekFinal = weekIsFinal(week);
  const weekCalendarLocked = weekFinal || slateLocked || weekSaved;
  const jumpWeek = firstEditableWeek(user ? meta.committedWeeks : [], now, slateLocked);
  const canJump = !slateLocked && jumpWeek !== week && !weekIsFinal(jumpWeek);

  const rowLocked = (matchup: WeekMatchup) =>
    !gameIsEditable(meta, matchup.week, matchup.away, matchup.home, now);

  const explainLockedGame = (gameWeek: number, away: string, home: string) => {
    if (officialResult(gameWeek, away, home)) {
      toast.message(`Week ${gameWeek} is final.`);
      return;
    }
    if (slateIsLocked(meta, now)) {
      toast.message(
        meta.startedWeek === 0 && !meta.slateLocked
          ? 'This slate locked when the season started.'
          : 'This slate is locked in.'
      );
      return;
    }
    if (user && meta.committedWeeks.includes(gameWeek)) {
      toast.message(`Week ${gameWeek} is saved to your account.`);
      return;
    }
    if (!seasonHasStarted(now) && hasGameKickedOff(gameWeek, away, home, now)) {
      toast.message('That game has already kicked off.');
    }
  };

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
    if (!status.complete) {
      toast.message('Finish the weeks still ahead to open projected records.');
      return;
    }
    setView('records');
  };

  const selectPlayoffs = () => {
    if (!status.complete) {
      toast.message('Finish the weeks still ahead to open the playoff bracket.');
      return;
    }
    setView('playoffs');
  };

  const selectAwards = () => {
    if (!status.complete) {
      toast.message('Finish the weeks still ahead to open awards.');
      return;
    }
    setView('awards');
  };

  const handleAwardChange = (awardId: SeasonAwardId, pick: SeasonAwardPick | null) => {
    if (user && meta.awardsCommitted) {
      toast.message('Awards are locked in.');
      return;
    }
    setAwards((prev) => ({ ...prev, [awardId]: pick }));
  };

  const handlePick = (key: string, abbr: string) => {
    const gameWeek = weekFromGameKey(key);
    const parts = key.split(':')[1]?.split('@') ?? [];
    const away = parts[0] ?? '';
    const home = parts[1] ?? '';
    if (gameWeek != null && !gameIsEditable(meta, gameWeek, away, home, now)) {
      explainLockedGame(gameWeek, away, home);
      return;
    }

    setMeta((prev) => {
      const next = stampAdjustment(prev, nflPredictionWeek(now));
      metaRef.current = next;
      return next;
    });
    setPicks((prev) => {
      const next = { ...prev, [key]: abbr };
      picksRef.current = next;
      if (!metaRef.current.playoffsCommitted && slateStatus(prev, now).complete) {
        const cleared = emptyPlayoffBracketPicks();
        bracketRef.current = cleared;
        setBracket(cleared);
      }
      const after = slateStatus(next, now);
      if (after.complete && !slateStatus(prev, now).complete) {
        queueMicrotask(() => {
          toast.success('Season slate complete. Records and playoffs are open.');
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
    if (user && meta.playoffsCommitted) {
      toast.message('The playoff bracket is locked in.');
      return;
    }
    setBracket((prev) => {
      const key = conference.toLowerCase() as 'afc' | 'nfc';
      const nextConf = applyConferencePick(prev[key], round, index, winnerAbbr);
      const next = { ...prev, [key]: nextConf, superBowl: null };
      bracketRef.current = next;
      return next;
    });
  };

  const handleSuperBowlPick = (winnerAbbr: string) => {
    if (user && meta.playoffsCommitted) {
      toast.message('The playoff bracket is locked in.');
      return;
    }
    setBracket((prev) => {
      const wasComplete =
        playoffSeeds != null && bracketComplete(playoffSeeds.afc, playoffSeeds.nfc, prev);
      const next = applySuperBowlPick(prev, winnerAbbr);
      bracketRef.current = next;
      if (
        playoffSeeds &&
        bracketComplete(playoffSeeds.afc, playoffSeeds.nfc, next) &&
        !wasComplete
      ) {
        queueMicrotask(() => {
          fireChampionConfetti();
          toast.success('Super Bowl champion picked.');
        });
      }
      return next;
    });
  };

  const handleFooterAction = () => {
    if (!weekFinal && !weekProgress.complete) return;

    if (week < PICKEM_WEEKS) {
      setWeek(week + 1);
      setView('picks');
      return;
    }

    if (status.complete) {
      setView('records');
    }
  };

  const handleLockIn = () => {
    if (!user) {
      toast.message('Sign in to lock this slate to your account.');
      return;
    }
    const current = metaRef.current;
    const alreadyLocked = slateIsLocked(current, now);
    const boardStatus = slateStatus(picksRef.current, now);
    if (!alreadyLocked && !boardStatus.complete) {
      toast.message('Finish the games still ahead before you lock them in.');
      return;
    }
    const nflWeek = nflPredictionWeek(now);
    let next = current;
    let changed = false;
    if (!current.slateLocked) {
      next = {
        ...withCommittedWeeks(next, boardStatus.completedWeeks, nflWeek),
        slateLocked: true,
      };
      changed = true;
    }
    if (awardsComplete(awardsRef.current) && !next.awardsCommitted) {
      next = { ...next, awardsCommitted: true, awardsWeek: nflWeek };
      changed = true;
    }
    const seeds = playoffSeedsRef.current;
    if (
      seeds &&
      bracketComplete(seeds.afc, seeds.nfc, bracketRef.current) &&
      !next.playoffsCommitted
    ) {
      next = { ...next, playoffsCommitted: true, playoffsWeek: nflWeek };
      changed = true;
    }
    if (!changed) {
      toast.message('Nothing new to lock in.');
      return;
    }
    metaRef.current = next;
    setMeta(next);
    toast.message('Locked in.');
  };

  const handleReset = () => {
    if (
      user &&
      (slateIsLocked(meta, now) ||
        meta.committedWeeks.length > 0 ||
        meta.awardsCommitted ||
        meta.playoffsCommitted)
    ) {
      toast.message('Locked picks stay on your account.');
      return;
    }
    if (user) clearSeasonPredictionPicks();
    const clearedMeta = emptySeasonPredictionMeta();
    metaRef.current = clearedMeta;
    picksRef.current = {};
    setPicks({});
    setBracket(emptyPlayoffBracketPicks());
    setAwards(emptySeasonAwardsPicks());
    setMeta(clearedMeta);
    setWeek(firstEditableWeek([]));
    setEditTeamAbbr(null);
    setView('picks');
    const userId = cloudUserIdRef.current;
    if (userId) {
      void clearSeasonPredictionBoard(userId, PICKEM_SEASON);
    }
    toast.message('Cleared your season predictions.');
  };

  const handleRandomFill = () => {
    const { picks: next, filled } = fillRemainingRandomPicks(picks, (game) =>
      gameIsEditable(meta, game.week, game.away, game.home, now)
    );
    if (filled === 0) {
      toast.message('No open games left to fill.');
      return;
    }
    setMeta((prev) => {
      const stamped = stampAdjustment(prev, nflPredictionWeek(now));
      metaRef.current = stamped;
      return stamped;
    });
    picksRef.current = next;
    setPicks(next);
    if (!meta.playoffsCommitted) {
      const cleared = emptyPlayoffBracketPicks();
      bracketRef.current = cleared;
      setBracket(cleared);
    }
    toast.success(
      filled === 1 ? 'Filled 1 remaining game.' : `Filled ${filled} remaining games with random winners.`
    );
    if (slateStatus(next, now).complete) {
      toast.success('Season slate complete. Records and playoffs are open.');
    }
  };

  const seasonStarted = seasonHasStarted(now);
  const accountLocked =
    Boolean(user) &&
    (slateLocked || meta.committedWeeks.length > 0 || meta.awardsCommitted || meta.playoffsCommitted);
  const showReset =
    !accountLocked && seasonBoardHasContent({ picks, bracket, awards, meta });
  const remainingThisWeek = weekProgress.total - weekProgress.picked;
  const remainingSeason = status.total - status.picked;
  const footerLabel = weekFinal
    ? week < PICKEM_WEEKS
      ? `Continue to week ${week + 1}`
      : status.complete
        ? 'View projected records'
        : 'Finish the games still ahead'
    : !weekProgress.complete
      ? `Pick ${remainingThisWeek} more`
      : week < PICKEM_WEEKS
        ? `Continue to week ${week + 1}`
        : status.complete
          ? 'View projected records'
          : 'Finish earlier weeks first';
  const footerEnabled = weekFinal
    ? week < PICKEM_WEEKS || status.complete
    : weekProgress.complete && (week < PICKEM_WEEKS || status.complete);
  const preseasonBoardLocked = seasonStarted && meta.startedWeek === 0;
  const awardsLocked = Boolean(user) && (meta.awardsCommitted || preseasonBoardLocked);
  const playoffsLocked = Boolean(user) && (meta.playoffsCommitted || preseasonBoardLocked);
  const awardsReadyToLock = awardsComplete(awards) && !awardsLocked;
  const playoffsReadyToLock = Boolean(
    playoffSeeds && bracketComplete(playoffSeeds.afc, playoffSeeds.nfc, bracket) && !playoffsLocked
  );
  const showLockIn = seasonStarted && (!slateLocked || awardsReadyToLock || playoffsReadyToLock);
  const awardsNote = awardsLocked
    ? 'Awards are locked in.'
    : user
      ? 'Fill in every award, then lock them in.'
      : 'These award picks reset when you leave the site.';
  const intro = !user
    ? 'Finished games keep the real score. Sign in to lock the rest to your account. The slate resets when you leave.'
    : slateLocked
      ? 'Finished games keep the real score. This slate is locked in.'
      : seasonStarted
        ? 'Finished games keep the real score. You can change the rest until you lock it in.'
        : 'You can change picks until the season starts. A game locks at kickoff.';

  if (authLoading || !hydrated) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex min-h-[40vh] items-center justify-center">
          <BrandedLoader />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('min-h-screen bg-background', view === 'picks' && 'pb-28')}>
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
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{intro}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-border/60 bg-secondary/20 px-4 py-3">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {status.passedWeeks.length > 0 ? 'Still ahead' : 'Progress'}
              </p>
              <p className="font-display text-2xl tabular-nums tracking-wide">
                {status.picked}
                <span className="text-muted-foreground"> / {status.total}</span>
              </p>
            </div>
            {!slateLocked && remainingSeason > 0 && (
              <Button type="button" variant="outline" className="gap-2" onClick={handleRandomFill}>
                <Dices className="h-4 w-4" />
                Random fill
              </Button>
            )}
            {showLockIn && (
              <Button type="button" className="min-h-11" onClick={handleLockIn}>
                Lock in
              </Button>
            )}
            {showReset && (
              <Button type="button" variant="outline" className="gap-2" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            )}
          </div>
        </div>

        {status.passedWeeks.length > 0 && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-border/60 bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              {formatWeekList(status.passedWeeks)} {status.passedWeeks.length === 1 ? 'is' : 'are'}{' '}
              final. Those wins and losses stay in the standings.
            </p>
          </div>
        )}

        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-secondary/60" aria-hidden>
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{
              width: `${status.total === 0 ? 0 : (status.picked / status.total) * 100}%`,
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
            passedWeeks={passedWeeks}
            slateLocked={slateLocked}
            recordsReady={status.complete}
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
                  Finished weeks use the real scores. Tap a team to change a game that is still open.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => selectWeek(jumpWeek)}>
                  Edit by week
                </Button>
                <Button type="button" variant="outline" onClick={selectByTeam}>
                  Edit by team
                </Button>
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
              awardsLocked={awardsLocked}
              awardsNote={awardsNote}
              onAwardChange={handleAwardChange}
              onSelectTeam={selectTeamEditor}
            />
            <PredictionFootnote meta={meta} includeAwards includePlayoffs />
          </section>
        ) : view === 'awards' ? (
          <section>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <p className="max-w-xl text-sm text-muted-foreground">{awardsNote}</p>
              <Button type="button" variant="outline" onClick={selectRecords}>
                View records
              </Button>
            </div>
            <SeasonAwardsPanel awards={awards} locked={awardsLocked} onChange={handleAwardChange} />
            <PredictionFootnote meta={meta} includeAwards />
          </section>
        ) : view === 'playoffs' && playoffSeeds ? (
          <section>
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-xl tracking-wide">Playoff bracket</h2>
                <p className="text-sm text-muted-foreground">
                  Wild card: 7 @ 2, 6 @ 3, 5 @ 4. #1 gets a bye. Tap a team to advance them.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {playoffsLocked
                    ? 'This bracket is locked in.'
                    : user
                      ? 'Pick through the Super Bowl, then lock the bracket in.'
                      : 'This bracket resets when you leave the site.'}
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
              locked={playoffsLocked}
              onConferencePick={handleConferenceBracketPick}
              onSuperBowlPick={handleSuperBowlPick}
            />
            <PredictionFootnote meta={meta} includePlayoffs />
          </section>
        ) : view === 'byTeam' ? (
          <section className="mb-6">
            <div className="mb-3">
              <h2 className="font-display text-xl tracking-wide">Edit by team</h2>
              <p className="text-sm text-muted-foreground">
                Changing an open game updates both teams. Finished games keep the real score.
              </p>
            </div>
            <SeasonTeamEditor
              picks={picks}
              selectedAbbr={editTeamAbbr}
              onSelectTeam={setEditTeamAbbr}
              onPick={handlePick}
              isRowLocked={rowLocked}
            />
          </section>
        ) : (
          <section className="mb-6">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-xl tracking-wide">Week {week}</h2>
              <p className="text-sm text-muted-foreground">
                {weekFinal
                  ? 'Final'
                  : slateLocked
                    ? 'Locked'
                    : weekSaved
                      ? 'Saved to your account'
                      : `${weekProgress.picked} of ${weekProgress.total || gameCount} picked`}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {matchups.map((matchup) => {
                const result = officialResult(matchup.week, matchup.away, matchup.home);
                return (
                  <PickemMatchupRow
                    key={matchup.key}
                    matchup={matchup}
                    picked={result ? result.winner : (picks[matchup.key] ?? null)}
                    onPick={(abbr) => handlePick(matchup.key, abbr)}
                    forceLocked={rowLocked(matchup)}
                    showOutcome={!result}
                  />
                );
              })}
            </div>
          </section>
        )}
      </main>

      {view === 'picks' && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            {weekCalendarLocked || weekSaved ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {weekFinal
                    ? `Week ${week} is final.`
                    : slateLocked
                      ? 'This slate is locked in.'
                      : `Week ${week} is saved to your account.`}
                </p>
                {canJump && (
                  <Button onClick={() => selectWeek(jumpWeek)} className="min-h-11 min-w-[11rem]">
                    Go to week {jumpWeek}
                  </Button>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {weekProgress.picked} of {weekProgress.total} this week · {status.picked} of{' '}
                  {status.total} still ahead
                </p>
                <Button
                  onClick={handleFooterAction}
                  disabled={!footerEnabled}
                  className="min-h-11 min-w-[11rem]"
                >
                  {footerLabel}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
