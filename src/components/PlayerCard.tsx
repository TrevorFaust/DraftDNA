import { PositionBadge } from './PositionBadge';
import { cn } from '@/lib/utils';
import type { RankedPlayer } from '@/types/database';

interface PlayerCardProps {
  player: RankedPlayer;
  rank: number;
  isDragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export const PlayerCard = ({ player, rank, isDragging, dragHandleProps }: PlayerCardProps) => {
  return (
    <div
      {...dragHandleProps}
      className={cn(
        'glass-card p-3 flex items-center gap-3 transition-all duration-200 cursor-grab active:cursor-grabbing',
        isDragging && 'dragging border-primary'
      )}
    >
      <div className="w-7 h-7 rounded-md bg-gradient-primary flex items-center justify-center font-display text-sm text-primary-foreground">
        {rank}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold truncate">{player.name}</span>
          <PositionBadge position={player.position} />
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{player.team || 'FA'}</span>
          <span>ADP: {player.adp}</span>
          {player.bye_week && <span>BYE: {player.bye_week}</span>}
        </div>
      </div>
    </div>
  );
};
