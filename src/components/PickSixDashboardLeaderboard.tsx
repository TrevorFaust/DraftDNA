import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePickSixPositionLeaderboard } from '@/hooks/usePickSixPositionLeaderboard';
import type { PickSixPositionRankLookup } from '@/hooks/usePickSixPositionLeaderboard';
import {
  formatPickSixKickoffDisplay,
  PICK_SIX_VIEW_OTHERS_PICKS,
  SEASON,
} from '@/constants/contest';
import { BrandedLoader } from '@/components/BrandedLoader';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Medal, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  evaluatePickSixSlot,
  formatPickSixOverallRank,
  formatPickSixSlotPoints,
  pickSixCurrentTop6Heading,
  pickSixLeaderboardHeading,
  pickSixTheirTop6Heading,
  pickSixYourTop6Heading,
  type PickSixPosition,
} from '@/utils/pickSixScoring';
import {
  formatPickSixFantasyPoints,
  formatPickSixTiebreaker,
  pickSixTiebreakerLabel,
} from '@/utils/pickSixActualTop6';
import type {
  PickSixLeaderboardEntry,
  PickSixLeaderboardPick,
} from '@/hooks/usePickSixPositionLeaderboard';
import type { PickSixTopPlayer } from '@/utils/pickSixActualTop6';

const RANKS = [1, 2, 3, 4, 5, 6] as const;

function CurrentTopSixBox({
  position,
  liveScoringActive,
  actualTop6,
  statsReady,
}: {
  position: PickSixPosition;
  liveScoringActive: boolean;
  actualTop6: PickSixTopPlayer[];
  statsReady: boolean;
}) {
  return (
    <section
      className="flex h-full min-h-0 flex-col rounded-lg border border-border/60 bg-secondary/30 px-3 py-3"
      aria-label={pickSixCurrentTop6Heading(position)}
    >
      <h4 className="mb-2 shrink-0 font-display text-lg leading-snug">{pickSixCurrentTop6Heading(position)}</h4>
      {!liveScoringActive ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{pickSixPreSeasonNotice()}</p>
      ) : actualTop6.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {statsReady ? 'No stats for this position yet.' : 'Loading stats…'}
        </p>
      ) : (
        <ol className="grid min-h-0 flex-1 grid-cols-[1.75rem_auto_auto_auto] content-between gap-x-4 text-sm">
          <span />
          <span />
          <span className="whitespace-nowrap text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {pickSixTiebreakerLabel(position)}
          </span>
          <span className="whitespace-nowrap text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Fantasy points
          </span>
          {actualTop6.map((player) => (
            <li key={player.identityKey} className="contents">
              <span className="font-mono tabular-nums text-muted-foreground">{player.positionRank}.</span>
              <span className="whitespace-nowrap font-medium">{player.name}</span>
              <span className="text-center font-mono tabular-nums text-muted-foreground">
                {player.tiebreaker == null ? '—' : formatPickSixTiebreaker(player.tiebreaker)}
              </span>
              <span className="text-center font-mono tabular-nums text-muted-foreground">
                {formatPickSixFantasyPoints(player.fantasyPoints)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function pickSixPreSeasonNotice(): string {
  const kickoff = formatPickSixKickoffDisplay();
  return `The ${SEASON} season hasn't started yet. Live rankings and scoring will appear here after kickoff (${kickoff}). Check back once games are underway.`;
}

function PickSixYourPicksOnlyTable({
  position,
  picks,
}: {
  position: PickSixPosition;
  picks: PickSixLeaderboardPick[];
}) {
  const pickByRank = new Map(picks.map((p) => [p.rank, p]));

  return (
    <div className="text-xs sm:text-sm">
      <p className="text-muted-foreground font-medium text-xs mb-1.5 pb-1.5 border-b border-border/50">
        {pickSixYourTop6Heading(position)}
      </p>
      <ol className="space-y-1">
        {RANKS.map((rank) => {
          const pick = pickByRank.get(rank);
          return (
            <li key={rank} className="flex gap-2 sm:gap-3 items-center min-w-0">
              <span className="w-5 shrink-0 text-muted-foreground font-mono tabular-nums text-xs">
                {rank}.
              </span>
              <span className="flex-1 min-w-0 truncate font-medium">
                {pick?.playerName ?? '—'}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs text-muted-foreground leading-relaxed border-t border-border/40 pt-3">
        {pickSixPreSeasonNotice()}
      </p>
    </div>
  );
}

function TheirPicksTable({
  position,
  picks,
  picksHeading,
  actualTop6Keys,
  playersById,
  positionRankLookup,
}: {
  position: PickSixPosition;
  picks: PickSixLeaderboardPick[];
  picksHeading: string;
  actualTop6Keys: string[];
  playersById: Map<string, { espn_id?: string | null }>;
  positionRankLookup: PickSixPositionRankLookup;
}) {
  const pickByRank = new Map(picks.map((pick) => [pick.rank, pick]));
  const tieLabel = pickSixTiebreakerLabel(position);

  return (
    <div className="pt-1.5">
      <p className="pb-1 text-sm font-medium text-foreground">{picksHeading}</p>
      <div className="grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto_auto_auto] items-baseline gap-x-4 gap-y-0.5 text-sm leading-tight">
        <span />
        <span />
        <span className="whitespace-nowrap text-center text-xs font-medium text-muted-foreground">
          Fantasy points
        </span>
        <span className="whitespace-nowrap text-center text-xs font-medium text-muted-foreground">
          {tieLabel}
        </span>
        <span className="whitespace-nowrap text-center text-xs font-medium text-muted-foreground">Pts</span>
        {RANKS.map((rank) => {
          const pick = pickByRank.get(rank);
          const status = pick
            ? evaluatePickSixSlot(actualTop6Keys, pick.playerId, pick.rank, playersById)
            : null;
          const fantasyPoints = pick
            ? positionRankLookup.getFantasyPoints(pick.playerId, pick.playerName)
            : null;
          const tiebreaker = pick
            ? positionRankLookup.getTiebreaker(pick.playerId, pick.playerName)
            : null;
          return (
            <div key={rank} className="contents">
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{rank}.</span>
              <span
                className={cn(
                  'min-w-0 truncate font-medium',
                  status?.kind === 'exact' && 'text-green-600 dark:text-green-400'
                )}
              >
                {pick?.playerName ?? '—'}
              </span>
              <span className="text-center font-mono tabular-nums text-muted-foreground">
                {fantasyPoints == null ? '—' : formatPickSixFantasyPoints(fantasyPoints)}
              </span>
              <span className="text-center font-mono tabular-nums text-muted-foreground">
                {tiebreaker == null ? '—' : formatPickSixTiebreaker(tiebreaker)}
              </span>
              <span
                className={cn(
                  'text-center font-mono font-semibold tabular-nums',
                  status && status.points > 0 ? 'text-foreground' : 'text-muted-foreground/70'
                )}
              >
                {status ? formatPickSixSlotPoints(status.points) : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LeaderboardListRow({
  entry,
  position,
  isCurrentUser,
  showPicks,
  expanded,
  onToggleExpand,
  actualTop6,
  actualTop6Keys,
  positionRankLookup,
  playersById,
}: {
  entry: PickSixLeaderboardEntry;
  position: PickSixPosition;
  isCurrentUser: boolean;
  showPicks: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  actualTop6: PickSixTopPlayer[];
  actualTop6Keys: string[];
  positionRankLookup: PickSixPositionRankLookup;
  playersById: Map<string, { espn_id?: string | null }>;
}) {
  const displayName = isCurrentUser
    ? 'You'
    : entry.username?.trim() || `Player #${entry.rank}`;
  const canExpand = showPicks && entry.picks.length > 0;

  return (
    <div
      className={cn(
        'rounded-lg border border-border/50 overflow-hidden',
        isCurrentUser && 'border-amber-500/40 bg-amber-500/5'
      )}
    >
      <button
        type="button"
        onClick={canExpand ? onToggleExpand : undefined}
        disabled={!canExpand}
        className={cn(
          'w-full flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-2 text-left',
          canExpand && 'hover:bg-muted/40 cursor-pointer',
          !canExpand && 'cursor-default'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-muted-foreground font-mono text-xs tabular-nums w-6 shrink-0 text-right">
            #{entry.rank}
          </span>
          <span
            className={cn(
              'text-sm font-medium truncate',
              isCurrentUser && 'text-amber-600 dark:text-amber-400'
            )}
          >
            {displayName}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium tabular-nums">
            {entry.exactMatches}/6 exact
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {entry.scoreLabel} pts
          </span>
          {canExpand && (
            <ChevronDown
              className={cn(
                'w-4 h-4 text-muted-foreground transition-transform',
                expanded && 'rotate-180'
              )}
              aria-hidden
            />
          )}
        </div>
      </button>
      {expanded && canExpand && (
        <div className="px-3 pb-3 pt-0 border-t border-border/40">
          <TheirPicksTable
            position={position}
            picks={entry.picks}
            picksHeading={
              isCurrentUser
                ? pickSixYourTop6Heading(position)
                : pickSixTheirTop6Heading(position)
            }
            actualTop6Keys={actualTop6Keys}
            playersById={playersById}
            positionRankLookup={positionRankLookup}
          />
        </div>
      )}
    </div>
  );
}

export function PickSixDashboardLeaderboard({
  position: lockedPosition,
}: {
  /** Follow one position and hide this board's own position tabs. */
  position?: PickSixPosition;
} = {}) {
  const { user } = useAuth();
  const {
    position: selectedPosition,
    displayPosition: position,
    setPosition,
    positions,
    liveScoringActive,
    actualTop6,
    actualTop6Keys,
    positionRankLookup,
    playersById,
    leaderboard,
    currentUserPicks,
    loading,
    entriesError,
    statsReady,
  } = usePickSixPositionLeaderboard(user?.id, lockedPosition ?? 'QB');

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const toggleExpand = useCallback((userId: string) => {
    setExpandedUserId((prev) => (prev === userId ? null : userId));
  }, []);

  useEffect(() => {
    if (lockedPosition && lockedPosition !== selectedPosition) setPosition(lockedPosition);
  }, [lockedPosition, selectedPosition, setPosition]);

  useEffect(() => {
    setExpandedUserId(null);
  }, [selectedPosition]);

  const entryCount = leaderboard.length;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <h3 className="font-display text-sm font-medium text-foreground flex items-center gap-2">
          <Medal className="w-4 h-4 text-amber-500" />
          Leaderboard
        </h3>
        {!lockedPosition && (
        <Tabs
          value={selectedPosition}
          onValueChange={(v) => setPosition(v as PickSixPosition)}
          className="w-auto"
        >
          <TabsList className="grid h-11 grid-cols-6 gap-0.5 p-1">
            {positions.map((pos) => (
              <TabsTrigger
                key={pos}
                value={pos}
                className="h-9 px-1.5 text-xs data-[state=active]:shadow-sm"
                aria-label={`${pos} leaderboard`}
              >
                {pos === 'D/ST' ? 'DST' : pos}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        )}
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground py-6">
          <BrandedLoader size={32} />
          Loading…
        </div>
      ) : entriesError ? (
        <p className="text-sm text-destructive">{entriesError}</p>
      ) : (
        <div className="grid items-stretch gap-4 lg:min-h-[24rem] lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <CurrentTopSixBox
            position={position}
            liveScoringActive={liveScoringActive}
            actualTop6={actualTop6}
            statsReady={statsReady}
          />
          <div className="flex min-w-0 flex-col lg:h-0 lg:min-h-full lg:overflow-hidden">
      {!liveScoringActive ? (
        <div className="flex flex-col gap-3 flex-1">
          {!user ? (
            <p className="text-sm text-muted-foreground leading-relaxed">
              Log in and submit your Pick Six picks to see them here before the season
              starts.
            </p>
          ) : currentUserPicks.length === 0 ? (
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                No {position} picks yet. Submit your top 6 before the entry deadline.
              </p>
              <Link
                to="/prediction-challenge"
                className="text-primary hover:underline font-medium"
              >
                Go to Pick Six Challenge
              </Link>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2.5">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">
                Your {position} picks
              </p>
              <PickSixYourPicksOnlyTable
                position={position}
                picks={currentUserPicks}
              />
            </div>
          )}
        </div>
      ) : actualTop6.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {statsReady ? 'No stats for this position yet.' : 'Loading stats…'}
        </p>
      ) : entryCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          No {position} entries yet. Submit your top 6 to appear here.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex flex-col min-h-0 flex-1">
            <div className="flex items-center justify-between gap-2 mb-1.5 shrink-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {pickSixLeaderboardHeading(position)}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {entryCount} {entryCount === 1 ? 'player' : 'players'}
              </p>
            </div>
            <div className="scrollbar-thin min-h-0 flex-1 space-y-1.5 overflow-x-hidden pr-1 lg:overflow-y-auto">
              {leaderboard.map((entry) => {
                const isCurrentUser = !!user && entry.userId === user.id;
                const showPicks =
                  PICK_SIX_VIEW_OTHERS_PICKS || isCurrentUser;

                return (
                  <LeaderboardListRow
                    key={entry.userId}
                    entry={entry}
                    position={position}
                    isCurrentUser={isCurrentUser}
                    showPicks={showPicks}
                    expanded={expandedUserId === entry.userId}
                    onToggleExpand={() => toggleExpand(entry.userId)}
                    actualTop6={actualTop6}
                    actualTop6Keys={actualTop6Keys}
                    positionRankLookup={positionRankLookup}
                    playersById={playersById}
                  />
                );
              })}
            </div>
            {entryCount > 12 && (
              <p className="text-xs text-muted-foreground mt-1.5 shrink-0">
                Showing every entrant in rank order. Scroll to find your spot.
              </p>
            )}
          </div>
        </div>
      )}
          </div>
        </div>
      )}
    </div>
  );
}

function SelectedLeaderPicks({
  position,
  entry,
  isCurrentUser,
  actualTop6Keys,
  playersById,
  positionRankLookup,
}: {
  position: PickSixPosition;
  entry: PickSixLeaderboardEntry;
  isCurrentUser: boolean;
  actualTop6Keys: string[];
  playersById: Map<string, { espn_id?: string | null }>;
  positionRankLookup: PickSixPositionRankLookup;
}) {
  const pickByRank = new Map(entry.picks.map((p) => [p.rank, p]));
  const name = entry.username?.trim();
  const heading = isCurrentUser
    ? pickSixYourTop6Heading(position)
    : name
      ? `${name}'s top 6`
      : pickSixTheirTop6Heading(position);

  return (
    <>
      <h3 className="mb-3 shrink-0 break-words font-display text-lg leading-snug">{heading}</h3>
      <ol className="flex w-full flex-col gap-1.5 md:min-h-0 md:flex-1">
        {RANKS.map((rank) => {
          const pick = pickByRank.get(rank);
          const status = pick
            ? evaluatePickSixSlot(actualTop6Keys, pick.playerId, pick.rank, playersById)
            : null;
          const overall =
            pick && status?.kind === 'miss'
              ? positionRankLookup.getOverallRank(pick.playerId, pick.playerName)
              : null;
          return (
            <li
              key={rank}
              className="grid shrink-0 grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg border border-border/50 bg-secondary/40 px-2.5 py-2 text-base md:min-h-0 md:flex-1 md:py-1.5"
            >
              <span className="font-mono text-sm tabular-nums text-muted-foreground">
                {rank}.
              </span>
              <div className="min-w-0">
                <p
                  className={cn(
                    'truncate leading-snug',
                    status?.kind === 'exact' && 'font-medium text-green-600 dark:text-green-400'
                  )}
                >
                  {pick?.playerName ?? '—'}
                </p>
                {overall != null && overall > 6 && (
                  <p className="truncate text-xs leading-snug text-muted-foreground">
                    ({formatPickSixOverallRank(overall)})
                  </p>
                )}
              </div>
              <span className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                {status ? formatPickSixSlotPoints(status.points) : '—'}
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/**
 * Same card size on every position tab. Height fits six leaderboard rows;
 * extra entrants scroll inside the leaderboard instead of growing the row.
 */
export const pickSixChallengeCardClass =
  'glass-card flex w-full flex-col overflow-hidden p-4 md:h-[29rem]';

/** Challenge page: actual top 6, a scrollable leader list, and the selected entry's picks. */
export function PickSixChallengeColumns({
  position: lockedPosition,
  renderAside,
}: {
  position: PickSixPosition;
  /** First column on the challenge grid. Receives live position ranks for the saved picks. */
  renderAside?: (positionRankLookup: PickSixPositionRankLookup) => ReactNode;
}) {
  const { user } = useAuth();
  const {
    position,
    setPosition,
    liveScoringActive,
    actualTop6,
    actualTop6Keys,
    positionRankLookup,
    playersById,
    leaderboard,
    loading,
    entriesError,
    statsReady,
  } = usePickSixPositionLeaderboard(user?.id, lockedPosition);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const leaderIds = leaderboard.map((entry) => entry.userId).join('\0');

  useEffect(() => {
    if (lockedPosition !== position) setPosition(lockedPosition);
  }, [lockedPosition, position, setPosition]);

  useEffect(() => {
    setSelectedUserId((prev) => {
      if (prev && leaderboard.some((entry) => entry.userId === prev)) return prev;
      return leaderboard[0]?.userId ?? null;
    });
  }, [leaderIds, leaderboard]);

  const selected = leaderboard.find((entry) => entry.userId === selectedUserId) ?? null;
  const selectedIsYou = !!user && selected?.userId === user.id;
  const aside = renderAside?.(positionRankLookup) ?? null;

  if (loading) {
    return (
      <>
        {aside}
        <div className={`${pickSixChallengeCardClass} items-center justify-center lg:col-span-3`}>
          <BrandedLoader size={32} />
        </div>
      </>
    );
  }

  if (entriesError) {
    return (
      <>
        {aside}
        <div className={`${pickSixChallengeCardClass} lg:col-span-3`}>
          <p className="text-sm text-destructive">{entriesError}</p>
        </div>
      </>
    );
  }

  return (
    <>
      {aside}
      <section className={pickSixChallengeCardClass} aria-label={pickSixCurrentTop6Heading(position)}>
        <h3 className="mb-3 shrink-0 break-words font-display text-lg leading-snug">{pickSixCurrentTop6Heading(position)}</h3>
        <div className="flex flex-col md:min-h-0 md:flex-1">
          {!liveScoringActive ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{pickSixPreSeasonNotice()}</p>
          ) : actualTop6.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {statsReady ? 'No stats for this position yet.' : 'Loading stats…'}
            </p>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mb-1 grid shrink-0 grid-cols-[1.25rem_minmax(0,1fr)_4.5rem_4.25rem] items-end gap-x-2 px-2.5 text-[10px] font-medium leading-tight text-muted-foreground">
                <span className="col-span-2" />
                <span className="text-right">{pickSixTiebreakerLabel(position)}</span>
                <span className="text-right">Fantasy pts</span>
              </div>
              <ol className="flex w-full flex-col gap-1.5 md:min-h-0 md:flex-1">
                {actualTop6.map((player) => (
                  <li
                    key={player.identityKey}
                    className="grid shrink-0 grid-cols-[1.25rem_minmax(0,1fr)_4.5rem_4.25rem] items-center gap-x-2 rounded-lg border border-border/50 bg-secondary/40 px-2.5 py-2 text-base md:min-h-0 md:flex-1 md:py-1.5"
                  >
                    <span className="font-mono text-sm tabular-nums text-muted-foreground">
                      {player.positionRank}.
                    </span>
                    <span className="min-w-0 truncate font-medium leading-snug">{player.name}</span>
                    <span className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {player.tiebreaker == null ? '—' : formatPickSixTiebreaker(player.tiebreaker)}
                    </span>
                    <span className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {formatPickSixFantasyPoints(player.fantasyPoints)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </section>

      <section className={`${pickSixChallengeCardClass} h-full min-h-0 overflow-hidden`} aria-label={pickSixLeaderboardHeading(position)}>
        <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
          <h3 className="flex min-w-0 items-center gap-2 break-words font-display text-lg leading-snug">
            <Medal className="h-5 w-5 text-amber-500" aria-hidden />
            Leaderboard
          </h3>
          <p className="text-xs tabular-nums text-muted-foreground">
            {leaderboard.length} {leaderboard.length === 1 ? 'player' : 'players'}
          </p>
        </div>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No {position} entries yet.
          </p>
        ) : (
          <div
            className={cn(
              'pick-six-leader-scroll flex min-h-0 flex-col gap-1.5 overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin md:flex-1',
              leaderboard.length > 6 && 'is-capped max-h-[18.375rem] md:max-h-none'
            )}
            tabIndex={leaderboard.length > 6 ? 0 : undefined}
            aria-label={leaderboard.length > 6 ? 'Leaderboard, scroll for more players' : undefined}
          >
            {leaderboard.map((entry) => {
              const isCurrentUser = !!user && entry.userId === user.id;
              const canSelect = (PICK_SIX_VIEW_OTHERS_PICKS || isCurrentUser) && entry.picks.length > 0;
              const isSelected = selectedUserId === entry.userId;
              const displayName = isCurrentUser
                ? 'You'
                : entry.username?.trim() || `Player #${entry.rank}`;
              return (
                <button
                  key={entry.userId}
                  type="button"
                  aria-pressed={isSelected}
                  aria-controls="pick-six-selected-picks"
                  disabled={!canSelect}
                  onClick={() => setSelectedUserId(entry.userId)}
                  className={cn(
                    'flex w-full shrink-0 items-center justify-between gap-2 overflow-hidden rounded-lg border px-3 py-2 text-left',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    leaderboard.length > 6
                      ? 'h-11 md:h-auto md:min-h-0'
                      : 'min-h-11 md:min-h-0 md:flex-1',
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-border/50 hover:bg-muted/40',
                    isCurrentUser && !isSelected && 'border-amber-500/40 bg-amber-500/5',
                    !canSelect && 'cursor-default opacity-80'
                  )}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      #{entry.rank}
                    </span>
                    <span
                      className={cn(
                        'min-w-0 truncate text-sm font-medium leading-snug',
                        isCurrentUser && 'text-amber-600 dark:text-amber-400'
                      )}
                    >
                      {displayName}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums">
                    <span className="rounded bg-secondary px-1.5 py-0.5 font-medium">
                      {entry.exactMatches}/6
                    </span>
                    <span className="text-muted-foreground">{entry.scoreLabel} pts</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section
        id="pick-six-selected-picks"
        className={pickSixChallengeCardClass}
        aria-live="polite"
        aria-label={selected ? undefined : 'Selected picks'}
      >
        {selected && (selectedIsYou || PICK_SIX_VIEW_OTHERS_PICKS) ? (
          <SelectedLeaderPicks
            position={position}
            entry={selected}
            isCurrentUser={selectedIsYou}
            actualTop6Keys={actualTop6Keys}
            playersById={playersById}
            positionRankLookup={positionRankLookup}
          />
        ) : (
          <>
            <h3 className="mb-3 shrink-0 font-display text-lg">Picks</h3>
            <p className="text-sm text-muted-foreground">
              {leaderboard.length === 0
                ? `No ${position} entries yet.`
                : 'Select a name on the leaderboard to see their top 6.'}
            </p>
          </>
        )}
      </section>
    </>
  );
}
