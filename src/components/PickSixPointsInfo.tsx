import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';

const SCORING_ROWS = [
  { label: 'Exact rank', points: '1' },
  { label: '1 rank off', points: '0.5' },
  { label: '2 ranks off', points: '0.33' },
  { label: '3 ranks off', points: '0.25' },
  { label: '4 ranks off', points: '0.2' },
  { label: '5 ranks off', points: '0.17' },
  { label: 'Not in live top 6', points: '0' },
] as const;

function ScoringExplanation({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-sm font-medium text-foreground">How points work</p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Each of your six slots earns points based on how close your pick is to the
        current live top 6 (Half-PPR, 2025 season to date). Your total is the sum of
        all six slots.
      </p>
      <ul className="text-sm space-y-1.5">
        {SCORING_ROWS.map((row) => (
          <li key={row.label} className="flex justify-between gap-4">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-mono font-semibold tabular-nums shrink-0">
              {row.points}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type PickSixPointsInfoProps = {
  scoreLabel: string;
  suffix?: string;
  className?: string;
};

/** Hover hint + click popover explaining Pick Six partial-credit scoring. */
export function PickSixPointsInfo({
  scoreLabel,
  suffix = 'pts total',
  className,
}: PickSixPointsInfoProps) {
  const label = `${scoreLabel} ${suffix}`.trim();

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-1 rounded-sm text-muted-foreground tabular-nums',
                'underline decoration-dotted decoration-muted-foreground/50 underline-offset-2',
                'hover:text-foreground hover:decoration-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                className
              )}
              aria-label={`${label}. How points work`}
            >
              <span className="font-medium">{label}</span>
              <Info className="w-3.5 h-3.5 shrink-0 opacity-60" aria-hidden />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          How points work
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-72 p-4" align="end" sideOffset={6}>
        <ScoringExplanation />
      </PopoverContent>
    </Popover>
  );
}
