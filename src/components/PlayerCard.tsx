import { PositionBadge } from './PositionBadge';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';
import type { RankedPlayer } from '@/types/database';
import type { Player2025Stats } from '@/hooks/usePlayer2025Stats';
import { PlayerJerseyWithNumber } from '@/components/PlayerJerseyWithNumber';
import { lookupJerseyNumberFill, useNflTeamJerseyColors } from '@/hooks/useNflTeamJerseyColors';
import { resolveTeamAbbrForDisplay } from '@/utils/teamMapping';
import { PlayerHeaderStatsLine } from '@/components/PlayerHeaderStatsLine';
import { RankingsPosRankCompare } from '@/components/rankings/RankingsPosRankCompare';
import { Rankings2025PpgCell } from '@/components/rankings/Rankings2025PpgCell';
import { RankingsCommunityTrendBadge } from '@/components/rankings/RankingsCommunityTrendBadge';
import type { CommunityRankTrend } from '@/utils/communityRankTrend';
import { getTierTone } from '@/utils/positionTiers';

interface PlayerCardProps {
  player: RankedPlayer;
  rank: number;
  isDragging?: boolean;
  onClick?: () => void;
  showGrabHandle?: boolean;
  positionColoredRank?: boolean;
  /** 2025 stats - only used on draggable cards to show avg PPG */
  stats2025?: Player2025Stats | null;
  /** Overall ADP rank at position (e.g. 8 = WR8) */
  positionAdpRank?: number | null;
  /** Community positional rank from rankings list order */
  communityPosRank?: number | null;
  /** User positional rank from rankings list order */
  myPosRank?: number | null;
  /** Community overall rank trend vs prior snapshot */
  communityTrend?: CommunityRankTrend | null;
  /** Position tier (1-based) for this board */
  tier?: number | null;
  /** Whose cuts the tier badge reflects */
  tierSource?: 'personal' | 'community';
  /** Tier-start bar above this card (first player of Tier 2, 3, …). */
  hasTierBreakBefore?: boolean;
  /** One-line ADP + bye only (rankings lists). Default follows showGrabHandle. */
  compactStats?: boolean;
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
  stats2025,
  positionAdpRank,
  communityPosRank,
  myPosRank,
  communityTrend,
  tier,
  tierSource = 'community',
  hasTierBreakBefore = false,
  compactStats,
}: PlayerCardProps) => {
  const useCompactStats = compactStats ?? showGrabHandle;
  const { data: jerseyColorsByAbbr } = useNflTeamJerseyColors();
  const jerseyTeamAbbr = resolveTeamAbbrForDisplay(player.team, player.position, player.name);
  const numberFill = lookupJerseyNumberFill(jerseyColorsByAbbr, jerseyTeamAbbr);
  const tone = tier != null && tier >= 1 ? getTierTone(tier) : null;
  // Label the tier that just ended (first Tier 2 player → "Tier 1" break, etc.).
  const breakTone =
    hasTierBreakBefore && tone != null && tone.tier >= 2
      ? getTierTone(tone.tier - 1)
      : null;

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative glass-card p-4 flex items-center gap-4 transition-all duration-200 hover:bg-secondary/60 border-l-4',
        !tone && 'border-l-transparent',
        breakTone != null && 'mt-3',
        isDragging && 'dragging border-primary'
      )}
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        ...(tone ? { borderLeftColor: tone.color } : undefined),
      }}
    >
      <div className="flex flex-col items-center gap-1 shrink-0 w-7">
        <div className={cn(
          'w-7 h-7 rounded-md flex items-center justify-center font-display text-sm',
          positionColoredRank 
            ? getPositionRankClass(player.position)
            : 'bg-gradient-primary text-primary-foreground'
        )}>
          {rank}
        </div>
        <RankingsCommunityTrendBadge communityTrend={communityTrend} />
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
        <PlayerHeaderStatsLine
          position={player.position}
          team={player.team}
          playerName={player.name}
          adp={player.adp}
          byeWeek={player.bye_week}
          positionAdpRank={useCompactStats ? undefined : positionAdpRank}
          layout={useCompactStats ? 'compact' : 'stacked'}
          className="mt-0"
        />
      </div>

      <RankingsPosRankCompare
        position={player.position}
        communityPosRank={communityPosRank}
        myPosRank={myPosRank}
        tier={tier}
        tierSource={tierSource}
      />

      {useCompactStats && <Rankings2025PpgCell stats2025={stats2025} className="px-3 py-1" />}

      {showGrabHandle && (
        <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors p-1">
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
};
