import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { isDefenseLikePosition } from '@/utils/pickSixScoring';
import {
  formatPositionalAdpRankLabel,
  positionalAdpTooltip,
  positionalListRankTooltip,
  showsPositionalAdpRank,
} from '@/utils/positionAdpRank';

interface PlayerDepthMetaProps {
  position: string;
  positionAdpRank?: number | null;
  priorSeasonPosRank?: string | null;
  className?: string;
  variant?: 'inline' | 'pills';
  includePriorSeason?: boolean;
}

function depthPillClass(position: string): string {
  const p = position.trim().toUpperCase();
  switch (p) {
    case 'QB':
      return 'border-qb/40 bg-qb/10 text-qb';
    case 'RB':
      return 'border-rb/40 bg-rb/10 text-rb';
    case 'WR':
      return 'border-wr/40 bg-wr/10 text-wr';
    case 'TE':
      return 'border-te/40 bg-te/10 text-te';
    default:
      return 'border-border bg-muted/50 text-muted-foreground';
  }
}

/** Positional ADP standing (inline with ADP / age on player header). */
export function PlayerDepthMeta({
  position,
  positionAdpRank,
  priorSeasonPosRank,
  className,
  variant = 'inline',
  includePriorSeason = true,
}: PlayerDepthMetaProps) {
  const pos = position.trim().toUpperCase();
  const priorNum = priorSeasonPosRank?.match(/\d+$/)?.[0] ?? null;
  const priorLabel =
    priorSeasonPosRank && priorNum
      ? `'25 ${pos}${priorNum}`
      : priorSeasonPosRank
        ? `'25 ${priorSeasonPosRank}`
        : null;

  const items: { key: string; label: string; tip: string }[] = [];

  if (positionAdpRank != null && showsPositionalAdpRank(pos)) {
    const rankLabel = formatPositionalAdpRankLabel(pos, positionAdpRank);
    items.push({
      key: 'posAdp',
      label: `Pos ADP: ${rankLabel}`,
      tip: isDefenseLikePosition(pos)
        ? positionalListRankTooltip(pos, positionAdpRank)
        : positionalAdpTooltip(pos, positionAdpRank),
    });
  }
  if (includePriorSeason && priorLabel) {
    items.push({
      key: 'prior',
      label: priorLabel,
      tip: '2025 fantasy finish rank at position',
    });
  }

  if (items.length === 0) return null;

  if (variant === 'pills') {
    return (
      <div className={cn('flex flex-wrap gap-1.5', className)}>
        {items.map((item) => (
          <Tooltip key={item.key}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  depthPillClass(pos)
                )}
              >
                {item.label}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              {item.tip}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    );
  }

  return (
    <span className={cn('text-sm text-muted-foreground', className)}>
      {items.map((item, i) => (
        <Tooltip key={item.key}>
          <TooltipTrigger asChild>
            <span className="cursor-default">
              {i > 0 && <span className="mx-1 text-border">·</span>}
              {item.label}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            {item.tip}
          </TooltipContent>
        </Tooltip>
      ))}
    </span>
  );
}
