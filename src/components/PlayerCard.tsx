import { PositionBadge } from './PositionBadge';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';
import type { RankedPlayer } from '@/types/database';
import type { Player2025Stats } from '@/hooks/usePlayer2025Stats';
import { PlayerJerseyWithNumber } from '@/components/PlayerJerseyWithNumber';
import { lookupJerseyNumberFill, useNflTeamJerseyColors } from '@/hooks/useNflTeamJerseyColors';
import { displayTeamAbbrevOrFa, resolveTeamAbbrForDisplay } from '@/utils/teamMapping';

interface PlayerCardProps {
  player: RankedPlayer;
  rank: number;
  isDragging?: boolean;
  onClick?: () => void;
  showGrabHandle?: boolean;
  positionColoredRank?: boolean;
  /** 2025 stats - only used on draggable cards to show avg PPG */
  stats2025?: Player2025Stats | null;
}

const getPositionRankClass = (position: string) => {
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
};

export const PlayerCard = ({ 
  player, 
  rank, 
  isDragging, 
  onClick,
  showGrabHandle = false,
  positionColoredRank = false,
  stats2025
}: PlayerCardProps) => {
  const { data: jerseyColorsByAbbr } = useNflTeamJerseyColors();
  const jerseyTeamAbbr = resolveTeamAbbrForDisplay(player.team, player.position, player.name);
  const numberFill = lookupJerseyNumberFill(jerseyColorsByAbbr, jerseyTeamAbbr);

  return (
    <div
      onClick={onClick}
      className={cn(
        'glass-card p-4 flex items-center gap-4 transition-all duration-200 hover:bg-secondary/60',
        isDragging && 'dragging border-primary'
      )}
      style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none' }}
    >
      <div className={cn(
        'w-7 h-7 rounded-md flex items-center justify-center font-display text-sm',
        positionColoredRank 
          ? getPositionRankClass(player.position)
          : 'bg-gradient-primary text-primary-foreground'
      )}>
        {rank}
      </div>

      <PlayerJerseyWithNumber
        team={jerseyTeamAbbr}
        jerseyNumber={player.jersey_number ?? 0}
        numberFillColor={numberFill}
        size="card"
        position={player.position}
      />
      
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold truncate">{player.name}</span>
          <PositionBadge position={player.position} />
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
          <span>{displayTeamAbbrevOrFa(player.team, player.position, player.name)}</span>
          <span>ADP: {player.adp}</span>
          {player.bye_week && <span>BYE: {player.bye_week}</span>}
        </div>
      </div>

      {showGrabHandle && (() => {
        const ppg = stats2025?.avgPointsPerGame ?? (stats2025 && stats2025.gamesPlayed > 0 ? stats2025.totalFantasyPoints / stats2025.gamesPlayed : null);
        return ppg != null && (
          <div className="shrink-0 px-3 py-1 border-l border-border/50 flex flex-col justify-center items-center">
            <span className="text-xs text-muted-foreground">2025 PPG</span>
            <span className="font-semibold text-sm text-primary">{ppg.toFixed(1)}</span>
          </div>
        );
      })()}

      {showGrabHandle && (
        <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors p-1">
          <GripVertical className="w-4 h-4" />
        </div>
      )}
    </div>
  );
};
