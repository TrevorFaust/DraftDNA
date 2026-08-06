import { memo, type CSSProperties } from 'react';
import { GripVertical, Scissors } from 'lucide-react';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { RankedPlayer } from '@/types/database';
import { PositionBadge } from '@/components/PositionBadge';
import { cn } from '@/lib/utils';
import { displayTeamAbbrevOrFa } from '@/utils/teamMapping';
import { RankingsPosRankCompare } from '@/components/rankings/RankingsPosRankCompare';
import { Rankings2025PpgCell } from '@/components/rankings/Rankings2025PpgCell';
import { RankingsCommunityTrendBadge } from '@/components/rankings/RankingsCommunityTrendBadge';
import type { CommunityRankTrend } from '@/utils/communityRankTrend';
import { getTierTone } from '@/utils/positionTiers';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

function getPositionRankClass(position: string) {
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
      return 'bg-gradient-primary text-primary-foreground';
  }
}

export type RankingsDragRowProps = {
  player: RankedPlayer;
  rank: number;
  displayAdp: number;
  communityPosRank?: number | null;
  myPosRank?: number | null;
  communityTrend?: CommunityRankTrend | null;
  tier?: number | null;
  /** Show scissors control to start/remove a tier break after this player */
  canEditTierBreak?: boolean;
  /** Cut stored after this player (scissors pressed state) */
  hasTierCutAfter?: boolean;
  /** Draw the tier-start bar above this player (first of Tier 2, 3, …) */
  hasTierBreakBefore?: boolean;
  onToggleTierBreak?: () => void;
  stats2025?: { avgPointsPerGame: number | null; gamesPlayed?: number; totalFantasyPoints?: number };
  onPlayerClick?: (player: RankedPlayer) => void;
  isOverlay?: boolean;
  /** In-list placeholder while DragOverlay follows the pointer. */
  isSourceGhost?: boolean;
  isSourceHidden?: boolean;
  dragHandleAttributes?: DraggableAttributes;
  dragHandleListeners?: SyntheticListenerMap;
  dragHandleRef?: (element: HTMLButtonElement | null) => void;
  /** Custom pointer drag (compare view) — no dnd-kit on the row. */
  onHandlePointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  style?: CSSProperties;
  className?: string;
};

/** Lightweight rankings row for drag — no jersey hooks or images. */
export const RankingsDragRow = memo(function RankingsDragRow({
  player,
  rank,
  displayAdp,
  communityPosRank,
  myPosRank,
  communityTrend,
  tier,
  canEditTierBreak = false,
  hasTierCutAfter = false,
  hasTierBreakBefore = false,
  onToggleTierBreak,
  stats2025,
  onPlayerClick,
  isOverlay = false,
  isSourceGhost = false,
  isSourceHidden = false,
  dragHandleAttributes,
  dragHandleListeners,
  dragHandleRef,
  onHandlePointerDown,
  style,
  className,
}: RankingsDragRowProps) {
  const tone = tier != null && tier >= 1 ? getTierTone(tier) : null;
  // Label the tier that just ended (first Tier 2 player → "Tier 1" break, etc.).
  const breakTone =
    hasTierBreakBefore && tone != null && tone.tier >= 2
      ? getTierTone(tone.tier - 1)
      : null;

  return (
    <div
      data-rankings-drag-row
      data-player-id={player.id}
      style={{
        ...style,
        ...(tone ? { borderLeftColor: tone.color } : undefined),
      }}
      className={cn(
        'relative glass-card p-2 sm:p-3 flex items-center gap-1.5 sm:gap-3 border-l-4',
        !tone && 'border-l-transparent',
        breakTone != null && 'mt-3',
        isOverlay && 'border-primary shadow-lg ring-1 ring-primary/40 cursor-grabbing',
        isSourceGhost && 'opacity-40 border-dashed border-2 border-primary/60 bg-primary/5 min-h-[110px]',
        isSourceHidden && 'opacity-0',
        className
      )}
    >
      <div
        role={onPlayerClick ? 'button' : undefined}
        tabIndex={onPlayerClick ? 0 : undefined}
        onClick={onPlayerClick ? () => onPlayerClick(player) : undefined}
        onKeyDown={
          onPlayerClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPlayerClick(player);
                }
              }
            : undefined
        }
        className="flex flex-1 min-w-0 items-start sm:items-center gap-1.5 sm:gap-3"
      >
        <div className="flex flex-col items-center gap-1 shrink-0 w-7 pt-0.5 sm:pt-0">
          <div
            className={cn(
              'w-7 h-7 shrink-0 rounded-md flex items-center justify-center font-display text-sm',
              getPositionRankClass(player.position)
            )}
          >
            {rank}
          </div>
          <RankingsCommunityTrendBadge communityTrend={communityTrend} />
        </div>
        <div className="flex-1 min-w-0 pr-0.5 sm:pr-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-semibold text-sm sm:text-base leading-snug sm:truncate" title={player.name}>
              {player.name}
            </span>
            <PositionBadge position={player.position} className="hidden sm:inline-flex shrink-0" />
          </div>
          <p className="text-[11px] sm:text-xs text-muted-foreground truncate mt-0.5">
            {displayTeamAbbrevOrFa(player.team, player.position, player.name)} · ADP {displayAdp}
            {player.bye_week != null ? ` · Bye ${player.bye_week}` : ''}
          </p>
          {/* Phone: Comm / Mine / tier under the name so long names are not truncated. */}
          <RankingsPosRankCompare
            position={player.position}
            communityPosRank={communityPosRank}
            myPosRank={myPosRank}
            tier={tier}
            className="mt-1.5 border-0 border-t border-border/40 px-0 pt-1.5 justify-start sm:hidden"
          />
        </div>
        <RankingsPosRankCompare
          position={player.position}
          communityPosRank={communityPosRank}
          myPosRank={myPosRank}
          tier={tier}
          className="hidden sm:flex"
        />
        <Rankings2025PpgCell stats2025={stats2025} />
      </div>
      {canEditTierBreak && onToggleTierBreak && !isOverlay ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={
                hasTierCutAfter
                  ? `Remove tier break after ${player.name}`
                  : `Start a new tier after ${player.name}`
              }
              aria-pressed={hasTierCutAfter}
              onClick={(e) => {
                e.stopPropagation();
                onToggleTierBreak();
              }}
              className={cn(
                'shrink-0 w-10 h-full min-h-[44px] flex items-center justify-center touch-manipulation',
                hasTierCutAfter
                  ? 'text-accent hover:text-accent'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Scissors className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs text-xs">
            {hasTierCutAfter
              ? 'Remove tier break below this player'
              : 'Start a new tier below this player'}
          </TooltipContent>
        </Tooltip>
      ) : null}
      {!isOverlay ? (
        <button
          type="button"
          ref={dragHandleRef}
          aria-label={`Drag to reorder ${player.name}`}
          className="shrink-0 w-10 h-full min-h-[44px] flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          {...(onHandlePointerDown
            ? { onPointerDown: onHandlePointerDown }
            : { ...dragHandleAttributes, ...dragHandleListeners })}
        >
          <GripVertical className="w-4 h-4" />
        </button>
      ) : (
        <div
          aria-hidden
          className="shrink-0 w-10 h-full min-h-[44px] flex items-center justify-center text-muted-foreground pointer-events-none"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      )}
      {breakTone != null && (
        <div
          className="pointer-events-none absolute -top-2.5 left-3 right-3 flex items-center gap-2 z-[1]"
          aria-hidden
        >
          <span className="h-0.5 flex-1 rounded-full" style={{ backgroundColor: breakTone.color }} />
          <span
            className="text-[10px] uppercase tracking-[0.14em] font-semibold whitespace-nowrap bg-card/90 px-1"
            style={{ color: breakTone.color }}
          >
            Tier {breakTone.tier}
          </span>
          <span className="h-0.5 flex-1 rounded-full" style={{ backgroundColor: breakTone.color }} />
        </div>
      )}
    </div>
  );
});
