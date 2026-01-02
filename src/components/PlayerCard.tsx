import { PositionBadge } from './PositionBadge';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';
import type { RankedPlayer } from '@/types/database';

interface PlayerCardProps {
  player: RankedPlayer;
  rank: number;
  isDragging?: boolean;
  onClick?: () => void;
  showGrabHandle?: boolean;
  positionColoredRank?: boolean;
}

const getPositionRankClass = (position: string) => {
  switch (position.toUpperCase()) {
    case 'QB':
      return 'bg-[hsl(280,70%,55%)] text-white';
    case 'RB':
      return 'bg-[hsl(145,70%,45%)] text-white';
    case 'WR':
      return 'bg-[hsl(190,95%,50%)] text-[hsl(222,47%,8%)]';
    case 'TE':
      return 'bg-[hsl(35,100%,50%)] text-[hsl(222,47%,8%)]';
    case 'K':
      return 'bg-[hsl(320,70%,55%)] text-white';
    case 'DEF':
      return 'bg-[hsl(0,70%,55%)] text-white';
    default:
      return 'bg-gradient-primary text-primary-foreground';
  }
};

export const PlayerCard = ({ 
  player, 
  rank, 
  isDragging, 
  onClick,
  showGrabHandle = false,
  positionColoredRank = false
}: PlayerCardProps) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'glass-card p-3 flex items-center gap-3 transition-all duration-200 hover:bg-secondary/60',
        isDragging && 'dragging border-primary'
      )}
    >
      <div className={cn(
        'w-7 h-7 rounded-md flex items-center justify-center font-display text-sm',
        positionColoredRank 
          ? getPositionRankClass(player.position)
          : 'bg-gradient-primary text-primary-foreground'
      )}>
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

      {showGrabHandle && (
        <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors p-1">
          <GripVertical className="w-4 h-4" />
        </div>
      )}
    </div>
  );
};
