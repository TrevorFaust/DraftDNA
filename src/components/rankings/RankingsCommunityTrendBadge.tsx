import { TrendingDown, TrendingUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CommunityRankTrend } from '@/utils/communityRankTrend';
import { cn } from '@/lib/utils';

export type RankingsCommunityTrendBadgeProps = {
  communityTrend?: CommunityRankTrend | null;
  className?: string;
};

/** Compact community stock move — kept away from Comm RK / My RK so it doesn't look like a rank split. */
export function RankingsCommunityTrendBadge({
  communityTrend,
  className,
}: RankingsCommunityTrendBadgeProps) {
  if (communityTrend == null || communityTrend.delta === 0) return null;

  const trendUp = communityTrend.delta < 0;
  const trendDown = communityTrend.delta > 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'flex items-center gap-0.5 text-[11px] font-semibold tabular-nums leading-none cursor-default',
            trendUp && 'text-green-500',
            trendDown && 'text-red-400',
            className
          )}
        >
          {trendUp ? (
            <TrendingUp className="w-3 h-3 shrink-0" aria-hidden />
          ) : (
            <TrendingDown className="w-3 h-3 shrink-0" aria-hidden />
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
  );
}
