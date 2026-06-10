import { useCallback, useEffect, useState } from 'react';
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
import { PickSixPointsInfo } from '@/components/PickSixPointsInfo';
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
import { formatPickSixFantasyPoints } from '@/utils/pickSixActualTop6';
import type {
  PickSixLeaderboardEntry,
  PickSixLeaderboardPick,
} from '@/hooks/usePickSixPositionLeaderboard';
import type { PickSixTopPlayer } from '@/utils/pickSixActualTop6';

const RANKS = [1, 2, 3, 4, 5, 6] as const;

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

function PickSixComparisonTable({
  position,
  actualTop6,
  actualTop6Keys,
  picks,
  picksHeading,
  playersById,
  positionRankLookup,
  hidden,
}: {
  position: PickSixPosition;
  actualTop6: PickSixTopPlayer[];
  actualTop6Keys: string[];
  picks: PickSixLeaderboardPick[];
  picksHeading: string;
  playersById: Map<string, { espn_id?: string | null }>;
  positionRankLookup: PickSixPositionRankLookup;
  hidden: boolean;
}) {
  const pickByRank = new Map(picks.map((p) => [p.rank, p]));
  const actualByRank = new Map(actualTop6.map((p) => [p.positionRank, p]));

  if (hidden) {
    return (
      <p className="text-sm text-muted-foreground italic py-2">
        Picks hidden until the entry deadline.
      </p>
    );
  }

  if (picks.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">No picks submitted.</p>;
  }

  return (
    <div className="text-xs sm:text-sm">
      <div className="flex gap-2 sm:gap-3 mb-1.5 pb-1.5 border-b border-border/50 text-muted-foreground font-medium text-xs">
        <span className="w-5 shrink-0" />
        <div className="flex-[1.15] min-w-0 flex gap-1.5 sm:gap-2 border-r border-border/50 pr-3 sm:pr-4">
          <span className="flex-1 min-w-0 leading-snug">
            {pickSixCurrentTop6Heading(position)}
          </span>
          <span className="w-[4.75rem] sm:w-[5.25rem] shrink-0 text-right leading-snug">
            Fantasy points
          </span>
        </div>
        <div className="flex-1 min-w-0 flex gap-2">
          <span className="flex-1 min-w-0 leading-snug">{picksHeading}</span>
          <span className="w-9 shrink-0 text-right">Pts</span>
        </div>
      </div>
      <ol className="space-y-1">
        {RANKS.map((rank) => {
          const actual = actualByRank.get(rank);
          const pick = pickByRank.get(rank);
          const status = pick
            ? evaluatePickSixSlot(
                actualTop6Keys,
                pick.playerId,
                pick.rank,
                playersById
              )
            : null;

          let pickAnnotation: string | null = null;
          if (pick && status?.kind === 'miss') {
            const overall = positionRankLookup.getOverallRank(
              pick.playerId,
              pick.playerName
            );
            if (overall != null && overall > 6) {
              pickAnnotation = formatPickSixOverallRank(overall);
            }
          }

          return (
            <li key={rank} className="flex gap-2 sm:gap-3 items-center min-w-0">
              <span className="w-5 shrink-0 text-muted-foreground font-mono tabular-nums text-xs">
                {rank}.
              </span>
              <div className="flex-[1.15] min-w-0 flex gap-1.5 sm:gap-2 items-center border-r border-border/50 pr-3 sm:pr-4">
                <span className="flex-1 min-w-0 truncate font-medium">
                  {actual?.name ?? '—'}
                </span>
                <span className="w-[4.75rem] sm:w-[5.25rem] shrink-0 text-right font-mono tabular-nums text-xs text-muted-foreground">
                  {actual ? formatPickSixFantasyPoints(actual.fantasyPoints) : '—'}
                </span>
              </div>
              <div className="flex-1 min-w-0 flex gap-2 items-center">
                <div className="flex-1 min-w-0">
                  {pick ? (
                    <span
                      className={cn(
                        'block min-w-0',
                        status?.kind === 'exact' &&
                          'text-green-600 dark:text-green-400 font-medium'
                      )}
                    >
                      <span className="truncate">{pick.playerName}</span>
                      {pickAnnotation && (
                        <span className="text-[10px] text-muted-foreground/80 font-normal whitespace-nowrap">
                          {' '}
                          ({pickAnnotation})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <span
                  className={cn(
                    'w-9 shrink-0 text-right font-mono tabular-nums text-sm font-semibold leading-none',
                    status && status.points > 0
                      ? 'text-foreground'
                      : 'text-muted-foreground/70'
                  )}
                >
                  {status ? formatPickSixSlotPoints(status.points) : '—'}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
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
          <PickSixComparisonTable
            position={position}
            actualTop6={actualTop6}
            actualTop6Keys={actualTop6Keys}
            picks={entry.picks}
            picksHeading={
              isCurrentUser
                ? pickSixYourTop6Heading(position)
                : pickSixTheirTop6Heading(position)
            }
            playersById={playersById}
            positionRankLookup={positionRankLookup}
            hidden={false}
          />
        </div>
      )}
    </div>
  );
}

export function PickSixDashboardLeaderboard() {
  const { user } = useAuth();
  const {
    position,
    setPosition,
    positions,
    liveScoringActive,
    actualTop6,
    actualTop6Keys,
    positionRankLookup,
    playersById,
    leaderboard,
    currentUserEntry,
    currentUserPicks,
    loading,
    entriesError,
    statsReady,
  } = usePickSixPositionLeaderboard(user?.id);

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const toggleExpand = useCallback((userId: string) => {
    setExpandedUserId((prev) => (prev === userId ? null : userId));
  }, []);

  useEffect(() => {
    setExpandedUserId(null);
  }, [position]);

  const entryCount = leaderboard.length;

  return (
    <div className="flex flex-col h-full min-h-[280px]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <h3 className="font-display text-sm font-medium text-foreground flex items-center gap-2">
          <Medal className="w-4 h-4 text-amber-500" />
          Leaderboard
        </h3>
        <Tabs
          value={position}
          onValueChange={(v) => setPosition(v as PickSixPosition)}
          className="w-auto"
        >
          <TabsList className="h-8 p-0.5 grid grid-cols-6 gap-0">
            {positions.map((pos) => (
              <TabsTrigger
                key={pos}
                value={pos}
                className="px-1.5 py-1 text-[10px] sm:text-xs h-7 data-[state=active]:shadow-sm"
                aria-label={`${pos} leaderboard`}
              >
                {pos === 'D/ST' ? 'DST' : pos}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground py-6">
          <BrandedLoader size={32} force3D />
          Loading…
        </div>
      ) : entriesError ? (
        <p className="text-sm text-destructive">{entriesError}</p>
      ) : !liveScoringActive ? (
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
        <div className="flex flex-col gap-3 min-h-0 flex-1">
          {currentUserEntry && (
            <div className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-2">
                <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  Your {position} picks
                </span>
                <div className="flex items-center gap-2 text-xs shrink-0">
                  <span className="rounded bg-secondary px-1.5 py-0.5 font-medium tabular-nums">
                    {currentUserEntry.exactMatches}/6 exact
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    Rank #{currentUserEntry.rank}
                  </span>
                  <PickSixPointsInfo
                    scoreLabel={currentUserEntry.scoreLabel}
                    className="text-xs"
                  />
                </div>
              </div>
              <PickSixComparisonTable
                position={position}
                actualTop6={actualTop6}
                actualTop6Keys={actualTop6Keys}
                picks={currentUserEntry.picks}
                picksHeading={pickSixYourTop6Heading(position)}
                playersById={playersById}
                positionRankLookup={positionRankLookup}
                hidden={false}
              />
            </div>
          )}

          <div className="flex flex-col min-h-0 flex-1">
            <div className="flex items-center justify-between gap-2 mb-1.5 shrink-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {pickSixLeaderboardHeading(position)}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {entryCount} {entryCount === 1 ? 'player' : 'players'}
              </p>
            </div>
            <div
              className="space-y-1.5 overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin flex-1 min-h-0"
              style={{ maxHeight: 'min(26rem, 50vh)' }}
            >
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
              <p className="text-[11px] text-muted-foreground mt-1.5 shrink-0">
                Showing every entrant in rank order — scroll to find your spot.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
