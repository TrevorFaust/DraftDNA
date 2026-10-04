import { memo, type ReactNode } from 'react';
import { PositionBadge } from '@/components/PositionBadge';
import { PlayerHeaderStatsLine } from '@/components/PlayerHeaderStatsLine';
import { RankingsPosRankCompare } from '@/components/rankings/RankingsPosRankCompare';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getTierTone } from '@/utils/positionTiers';
import type { RankedPlayer } from '@/types/database';
import { Check } from 'lucide-react';

function positionRankClass(position: string): string {
  switch (position.toUpperCase()) {
    case 'QB':
      return 'bg-qb/20 text-qb border border-qb/50';
    case 'RB':
      return 'bg-rb/20 text-rb border border-rb/50';
    case 'WR':
      return 'bg-wr/20 text-wr border border-wr/50';
    case 'TE':
      return 'bg-te/20 text-te border border-te/50';
    case 'K':
      return 'bg-k/20 text-k border border-k/50';
    case 'DEF':
    case 'D/ST':
      return 'bg-def/20 text-def border border-def/50';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export type DraftAvailablePlayerRowProps = {
  player: RankedPlayer;
  /** Overall rank shown in the badge — personal board when available */
  displayRank: number;
  myPosRank?: number | null;
  tier?: number | null;
  hasTierBreakBefore?: boolean;
  /**
   * Per-player T1/T2 badge. Off for All Positions (breaks + left border only);
   * on for position filters.
   */
  showPlayerTier?: boolean;
  highlighted?: boolean;
  draftDisabled?: boolean;
  draftLabel?: string;
  onNameClick?: (player: RankedPlayer) => void;
  onDraft: (player: RankedPlayer) => void;
  /** Extra meta under the name (team / ADP). Defaults to compact ADP+bye line. */
  meta?: ReactNode;
};

/**
 * Rank, name, position, positional rank, draft. The name track is the only
 * one that flexes, and it is allowed to shrink so the row never scrolls sideways.
 */
export const draftAvailableListClass =
  'grid min-h-0 flex-1 content-start grid-cols-[2.5rem_minmax(0,1fr)_2.75rem_5.75rem_max-content] gap-x-2.5 gap-y-0.5 overflow-x-hidden overflow-y-auto pr-1 scrollbar-thin';

/** Available-player row for solo + multiplayer mock drafts (personal rank + tier). */
export const DraftAvailablePlayerRow = memo(function DraftAvailablePlayerRow({
  player,
  displayRank,
  myPosRank = null,
  tier = null,
  hasTierBreakBefore = false,
  showPlayerTier = false,
  highlighted = false,
  draftDisabled = false,
  draftLabel = 'Draft',
  onNameClick,
  onDraft,
  meta,
}: DraftAvailablePlayerRowProps) {
  // Left border always follows the player's tier; T-badge is position-filter only.
  const borderTone = tier != null && tier >= 1 ? getTierTone(tier) : null;
  const badgeTone = showPlayerTier ? borderTone : null;
  // Label the tier that just ended (first Tier 3 player → "Tier 2" break).
  const breakTone =
    hasTierBreakBefore && tier != null && tier >= 2
      ? getTierTone(tier - 1)
      : null;

  return (
    <>
      {breakTone != null && (
        <div
          className="col-span-full flex items-center gap-2 px-1 py-1"
          role="separator"
          aria-label={`End of tier ${breakTone.tier}`}
        >
          <span
            className="h-[2px] flex-1 rounded-full opacity-90"
            style={{ backgroundColor: breakTone.color }}
          />
          <span
            className="shrink-0 text-[11px] uppercase tracking-[0.14em] font-display font-bold px-2 py-0.5 rounded-md border"
            style={{
              color: breakTone.color,
              backgroundColor: breakTone.bgColor,
              borderColor: breakTone.color,
            }}
          >
            Tier {breakTone.tier}
          </span>
          <span
            className="h-[2px] flex-1 rounded-full opacity-90"
            style={{ backgroundColor: breakTone.color }}
          />
        </div>
      )}

      <div
        className={cn(
          'col-span-full grid grid-cols-subgrid items-center px-1.5 py-1.5 rounded-lg hover:bg-secondary/50 transition-colors group min-h-11 sm:px-2',
          highlighted && 'bg-accent/20 border-2 border-accent/50 ring-2 ring-accent/30',
          borderTone && 'border-l-4',
          !borderTone && 'border-l-4 border-l-transparent'
        )}
        style={borderTone ? { borderLeftColor: borderTone.color } : undefined}
      >
        <div
          className={cn(
            'flex h-7 min-w-7 items-center justify-center justify-self-center rounded px-1 text-xs font-bold tabular-nums',
            positionRankClass(player.position)
          )}
          title="Your overall ranking"
        >
          {displayRank}
        </div>

        <div className="min-w-0">
          <span
            className={cn(
              'block truncate font-medium text-sm',
              onNameClick && 'cursor-pointer hover:text-primary transition-colors'
            )}
            title={player.name}
            onClick={
              onNameClick
                ? () => {
                    onNameClick(player);
                  }
                : undefined
            }
          >
            {player.name}
          </span>
          {meta ?? (
            <PlayerHeaderStatsLine
              position={player.position}
              team={player.team}
              adp={player.adp}
              byeWeek={player.bye_week}
              layout="compact"
              className="mt-0 truncate text-[11px] leading-tight"
            />
          )}
        </div>

        <div className="flex items-center justify-center">
          <PositionBadge position={player.position} />
        </div>

        <div className="flex items-center justify-center">
          <RankingsPosRankCompare
            position={player.position}
            myPosRank={myPosRank}
            tier={showPlayerTier ? tier : null}
            tierSource="personal"
            className="border-0 px-0"
          />
          {badgeTone != null && myPosRank == null && (
            <span
              className="inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded-md border border-border/60 px-1.5 font-display text-[11px] font-bold tracking-wide"
              style={{ color: badgeTone.color, backgroundColor: badgeTone.bgColor }}
              title={`Your tier ${badgeTone.tier}`}
            >
              {badgeTone.label}
            </span>
          )}
        </div>

        <Button
          size="sm"
          variant="ghost"
          disabled={draftDisabled}
          className="h-9 shrink-0 justify-self-end px-2 sm:px-3"
          aria-label={draftLabel}
          onClick={(e) => {
            e.stopPropagation();
            onDraft(player);
          }}
        >
          <Check className="w-4 h-4" />
          <span className="hidden sm:inline">{draftLabel}</span>
        </Button>
      </div>
    </>
  );
});
