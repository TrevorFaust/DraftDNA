import { memo, type CSSProperties } from 'react';
import { GripVertical } from 'lucide-react';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { RankedPlayer } from '@/types/database';
import { PositionBadge } from '@/components/PositionBadge';
import { cn } from '@/lib/utils';
import { displayTeamAbbrevOrFa } from '@/utils/teamMapping';

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
  stats2025?: { avgPointsPerGame: number | null; gamesPlayed?: number; totalFantasyPoints?: number };
  onPlayerClick?: (player: RankedPlayer) => void;
  isOverlay?: boolean;
  /** In-list placeholder while DragOverlay follows the pointer. */
  isSourceGhost?: boolean;
  isSourceHidden?: boolean;
  dragHandleAttributes?: DraggableAttributes;
  dragHandleListeners?: SyntheticListenerMap;
  dragHandleRef?: (element: HTMLButtonElement | null) => void;
  style?: CSSProperties;
  className?: string;
};

/** Lightweight rankings row for drag — no jersey hooks or images. */
export const RankingsDragRow = memo(function RankingsDragRow({
  player,
  rank,
  displayAdp,
  stats2025,
  onPlayerClick,
  isOverlay = false,
  isSourceGhost = false,
  isSourceHidden = false,
  dragHandleAttributes,
  dragHandleListeners,
  dragHandleRef,
  style,
  className,
}: RankingsDragRowProps) {
  const ppg =
    stats2025?.avgPointsPerGame ??
    (stats2025 && stats2025.gamesPlayed && stats2025.gamesPlayed > 0
      ? (stats2025.totalFantasyPoints ?? 0) / stats2025.gamesPlayed
      : null);

  return (
    <div
      style={style}
      className={cn(
        'glass-card p-3 flex items-center gap-3 select-none touch-none',
        isOverlay && 'border-primary shadow-lg ring-1 ring-primary/40 cursor-grabbing',
        isSourceGhost && 'opacity-40 border-dashed border-2 border-primary/60 bg-primary/5 min-h-[84px]',
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
        className="flex flex-1 min-w-0 items-center gap-3"
      >
        <div
          className={cn(
            'w-7 h-7 shrink-0 rounded-md flex items-center justify-center font-display text-sm',
            getPositionRankClass(player.position)
          )}
        >
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold truncate">{player.name}</span>
            <PositionBadge position={player.position} />
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {displayTeamAbbrevOrFa(player.team, player.position, player.name)} · ADP {displayAdp}
            {player.bye_week != null ? ` · Bye ${player.bye_week}` : ''}
          </p>
        </div>
        {ppg != null && (
          <div className="shrink-0 px-2 border-l border-border/50 text-center">
            <span className="block text-[10px] text-muted-foreground leading-tight">2025 PPG</span>
            <span className="font-semibold text-sm text-primary">{ppg.toFixed(1)}</span>
          </div>
        )}
      </div>
      {!isOverlay && (
        <button
          type="button"
          ref={dragHandleRef}
          aria-label={`Drag to reorder ${player.name}`}
          className="shrink-0 w-10 h-full min-h-[44px] flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          {...dragHandleAttributes}
          {...dragHandleListeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}
    </div>
  );
});
