import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  formatPositionalAdpRankLabel,
  showsPositionalListRank,
} from '@/utils/positionAdpRank';
import { getTierTone } from '@/utils/positionTiers';
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
  /** Personal position tier (1-based) derived from My RK cuts */
  tier?: number | null;
  className?: string;
};

/** Side-by-side community vs personal positional rank, plus personal tier badge. */
export function RankingsPosRankCompare({
  position,
  communityPosRank,
  myPosRank,
  tier,
  className,
}: RankingsPosRankCompareProps) {
  if (!showsPositionalListRank(position)) return null;
  if (communityPosRank == null && myPosRank == null) return null;

  const tone = tier != null && tier >= 1 ? getTierTone(tier) : null;

  return (
    <div
      className={cn(
        'shrink-0 px-5 border-x border-border/50 flex items-center justify-center gap-4',
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
      {tone != null && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="inline-flex items-center justify-center min-w-[2rem] h-7 px-2 rounded-md border border-border/60 text-xs font-display font-bold tracking-wide cursor-default"
              style={{ color: tone.color, backgroundColor: tone.bgColor }}
            >
              {tone.label}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            Your tier {tone.tier} at {position.trim().toUpperCase()}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
