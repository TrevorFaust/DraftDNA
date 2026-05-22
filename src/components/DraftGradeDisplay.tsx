import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { DraftGradeResult } from '@/utils/draftGrade';
import { getDraftGradeStyles } from '@/utils/draftGrade';

interface DraftGradeDisplayProps {
  result: DraftGradeResult;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
}

const SIZE_CLASSES = {
  xs: { box: 'h-11 w-12 px-0.5', grade: 'text-xl', label: 'text-[8px]' },
  sm: { box: 'h-14 w-16 px-1', grade: 'text-2xl', label: 'text-[9px]' },
  md: { box: 'h-[4.75rem] w-[5.25rem] px-1.5', grade: 'text-3xl', label: 'text-[10px]' },
  lg: { box: 'h-[5.5rem] w-24 px-2', grade: 'text-4xl', label: 'text-[10px]' },
} as const;

export function DraftGradeDisplay({
  result,
  size = 'md',
  className,
  showLabel = true,
}: DraftGradeDisplayProps) {
  const styles = getDraftGradeStyles(result.grade);
  const { breakdown } = result;
  const sz = SIZE_CLASSES[size];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex flex-col items-center justify-center rounded-xl border shrink-0 cursor-help transition-colors hover:opacity-90',
            styles.border,
            styles.bg,
            sz.box,
            className
          )}
        >
          <span className={cn('font-display font-bold leading-none tracking-tight', styles.text, sz.grade)}>
            {result.grade}
          </span>
          {showLabel && (
            <span className={cn('uppercase tracking-wider text-muted-foreground mt-0.5', sz.label)}>Grade</span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-md text-left space-y-2 p-3">
        <p className="font-medium text-sm">Draft grade ({result.numericScore}/100)</p>
        <p className="text-xs leading-relaxed">{result.tagline}</p>
        <ul className="text-xs text-muted-foreground space-y-0.5 list-none">
          <li>
            Value {breakdown.valueScore}, roster {breakdown.rosterQualityScore}, synergy{' '}
            {breakdown.synergyScore}
          </li>
          <li>
            Steals {breakdown.realStealCount}, reaches {breakdown.reachCount}
            {breakdown.fakeValuePickCount > 0
              ? `, late flyers ${breakdown.fakeValuePickCount}`
              : ''}
          </li>
          {breakdown.eliteTierCount > 0 && (
            <li>Star-level picks: {breakdown.eliteTierCount}</li>
          )}
          {breakdown.backupSkillCount > 0 && (
            <li>Backup-role skill players: {breakdown.backupSkillCount}</li>
          )}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

interface DraftGradeBannerProps {
  result: DraftGradeResult;
  children?: ReactNode;
  className?: string;
  /** Draft-complete: Grade label + full explanation stacked; badges beside grade row */
  compact?: boolean;
}

/** Grade + explanation (+ optional badges). */
export function DraftGradeBanner({ result, children, className, compact = false }: DraftGradeBannerProps) {
  const styles = getDraftGradeStyles(result.grade);

  if (compact) {
    return (
      <div
        className={cn(
          'w-full rounded-xl border border-border/50 bg-secondary/25 px-3 py-3 sm:px-4',
          className
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-stretch gap-3 sm:gap-4">
          <div className="flex-1 min-w-0 flex flex-col items-center justify-center text-center px-1 sm:px-2">
            <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold text-muted-foreground">Grade:</span>
              <span className={cn('font-display text-3xl sm:text-4xl font-bold leading-none', styles.text)}>
                {result.grade}
              </span>
            </div>
            <p className="mt-2.5 text-sm sm:text-[0.9375rem] text-foreground/90 leading-relaxed whitespace-normal max-w-prose">
              {result.tagline}
            </p>
          </div>
          {children ? (
            <div className="flex items-center justify-center sm:justify-end gap-3 shrink-0 sm:pt-0.5">
              {children}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'w-full flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 rounded-xl border border-border/50 bg-secondary/25 px-3 sm:px-4 py-3',
        className
      )}
    >
      <DraftGradeDisplay result={result} size="lg" className="shrink-0" />
      <p className="flex-1 min-w-0 text-sm sm:text-[0.9375rem] text-foreground/90 leading-relaxed sm:pr-2">
        {result.tagline}
      </p>
      {children ? (
        <div className="flex items-center justify-center sm:justify-end gap-4 sm:gap-5 shrink-0 sm:pl-5 sm:ml-1 sm:border-l sm:border-border/40">
          {children}
        </div>
      ) : null}
    </div>
  );
}
