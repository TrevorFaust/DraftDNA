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

/** Compact prefix in the rank cell (D/ST → DEF) so long names keep horizontal room. */
function compactPosPrefix(position: string): string {
  const pos = position.trim().toUpperCase();
  if (pos === 'D/ST' || pos === 'DST' || pos === 'DEF') return 'DEF';
  return pos;
}

function RankCell({ label, position, rank, tipPrefix }: RankCellProps) {
  const pos = position.trim().toUpperCase();
  const labelText = formatPositionalAdpRankLabel(pos, rank);
  const compactPrefix = compactPosPrefix(pos);
  const displayLabel = `${compactPrefix}${rank}`;

  return (
    <div className="flex flex-col items-center gap-0">
      <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.06em] sm:tracking-[0.08em] text-muted-foreground leading-none whitespace-nowrap">
        {label}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-baseline gap-0.5 font-display text-sm sm:text-base font-bold leading-none cursor-default',
              positionLabelClass(pos)
            )}
          >
            <span className="tracking-[0.04em] sm:tracking-[0.06em]">{compactPrefix}</span>
            <span className="tabular-nums">{rank}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          {tipPrefix}: {labelText} in rankings at this position
        </TooltipContent>
      </Tooltip>
      <span className="sr-only">{displayLabel}</span>
    </div>
  );
}

export type RankingsPosRankCompareProps = {
  position: string;
  communityPosRank?: number | null;
  myPosRank?: number | null;
  /** 1-based tier from the board this badge is on (personal or community) */
  tier?: number | null;
  /** Whose cuts the tier badge reflects */
  tierSource?: 'personal' | 'community';
  className?: string;
};

/** Side-by-side community vs personal positional rank, plus a tier badge. */
export function RankingsPosRankCompare({
  position,
  communityPosRank,
  myPosRank,
  tier,
  tierSource = 'personal',
  className,
}: RankingsPosRankCompareProps) {
  if (!showsPositionalListRank(position)) return null;
  if (communityPosRank == null && myPosRank == null) return null;

  const tone = tier != null && tier >= 1 ? getTierTone(tier) : null;

  return (
    <div
      className={cn(
        'shrink-0 px-1.5 sm:px-3 border-x border-border/50 flex items-center justify-center gap-1 sm:gap-2',
        className
      )}
    >
      <div className="flex items-center gap-1.5 sm:gap-3">
        {communityPosRank != null && (
          <RankCell label="Comm" position={position} rank={communityPosRank} tipPrefix="Community" />
        )}
        {communityPosRank != null && myPosRank != null && (
          <span className="text-border/80 select-none text-xs sm:text-sm" aria-hidden>
            |
          </span>
        )}
        {myPosRank != null && (
          <RankCell label="Mine" position={position} rank={myPosRank} tipPrefix="Your ranking" />
        )}
      </div>
      {tone != null && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="inline-flex items-center justify-center min-w-[1.5rem] sm:min-w-[1.75rem] h-5 sm:h-6 px-1 sm:px-1.5 rounded-md border border-border/60 text-[10px] sm:text-[11px] font-display font-bold tracking-wide cursor-default"
              style={{ color: tone.color, backgroundColor: tone.bgColor }}
            >
              {tone.label}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            {tierSource === 'community' ? 'Community' : 'Your'} tier {tone.tier} at{' '}
            {position.trim().toUpperCase()}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
