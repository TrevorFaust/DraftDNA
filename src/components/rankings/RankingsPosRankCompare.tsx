import { TrendingDown, TrendingUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  formatPositionalAdpRankLabel,
  showsPositionalListRank,
} from '@/utils/positionAdpRank';
import type { CommunityRankTrend } from '@/utils/communityRankTrend';
import { cn } from '@/lib/utils';

function positionLabelClass(position: string): string {
  switch (position.trim().toUpperCase()) {
    case 'QB':
      return 'text-qb';
    case 'RB':
      return 'text-rb';
    case 'WR':
      return 'text-wr';
    case 'TE':
      return 'text-te';
    case 'K':
      return 'text-k';
    case 'DEF':
    case 'D/ST':
    case 'DST':
      return 'text-def';
    default:
      return 'text-primary';
  }
}

type RankCellProps = {
  label: string;
  position: string;
  rank: number;
  tipPrefix: string;
};

function RankCell({ label, position, rank, tipPrefix }: RankCellProps) {
  const pos = position.trim().toUpperCase();
  const labelText = formatPositionalAdpRankLabel(pos, rank);
  const rankParts = labelText.match(/^(.+?)(\d+)$/);

  return (
    <div className="flex flex-col items-center min-w-[4.5rem] gap-1">
      <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground leading-none whitespace-nowrap">
        {label}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-baseline gap-0.5 font-display text-lg font-bold leading-none cursor-default',
              positionLabelClass(pos)
            )}
          >
            <span className="tracking-[0.12em]">{rankParts?.[1] ?? labelText}</span>
            {rankParts?.[2] != null && (
              <span className="tabular-nums">{rankParts[2]}</span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          {tipPrefix}: {labelText} in rankings at this position
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export type RankingsPosRankCompareProps = {
  position: string;
  communityPosRank?: number | null;
  myPosRank?: number | null;
  communityTrend?: CommunityRankTrend | null;
  className?: string;
};

/** Side-by-side community vs personal positional rank, with optional community trend. */
export function RankingsPosRankCompare({
  position,
  communityPosRank,
  myPosRank,
  communityTrend,
  className,
}: RankingsPosRankCompareProps) {
  if (!showsPositionalListRank(position)) return null;
  if (communityPosRank == null && myPosRank == null) return null;

  const showTrend = communityTrend != null && communityTrend.delta !== 0;
  const trendUp = showTrend && communityTrend.delta < 0;
  const trendDown = showTrend && communityTrend.delta > 0;

  return (
    <div
      className={cn(
        'shrink-0 px-5 border-x border-border/50 flex flex-col items-center justify-center gap-1.5',
        className
      )}
    >
      <div className="flex items-center gap-6">
        {communityPosRank != null && (
          <RankCell label="Comm RK" position={position} rank={communityPosRank} tipPrefix="Community" />
        )}
        {communityPosRank != null && myPosRank != null && (
          <span className="text-border/80 select-none text-base px-0.5" aria-hidden>
            |
          </span>
        )}
        {myPosRank != null && (
          <RankCell label="My RK" position={position} rank={myPosRank} tipPrefix="Your ranking" />
        )}
      </div>
      {showTrend && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'flex items-center gap-1 text-xs font-semibold tabular-nums leading-none cursor-default',
                trendUp && 'text-green-500',
                trendDown && 'text-red-400'
              )}
            >
              {trendUp ? (
                <TrendingUp className="w-3.5 h-3.5 shrink-0" aria-hidden />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 shrink-0" aria-hidden />
              )}
              <span>{Math.abs(communityTrend.delta)}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            Community overall rank moved from #{communityTrend.previousRank} to #
            {communityTrend.previousRank + communityTrend.delta} over the past{' '}
            {communityTrend.daysAgo} day{communityTrend.daysAgo === 1 ? '' : 's'}
            {trendDown ? ' (stock dropping)' : ' (stock rising)'}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
