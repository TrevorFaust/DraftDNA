import { Award, Check, Shield, Table2, Trophy } from 'lucide-react';
import { PICKEM_WEEKS } from '@/constants/pickem';
import { cn } from '@/lib/utils';

export type SeasonPredictionView = 'picks' | 'byTeam' | 'records' | 'playoffs' | 'awards';

type Props = {
  selectedWeek: number | null;
  activeView: SeasonPredictionView;
  completedWeeks: ReadonlySet<number>;
  recordsReady: boolean;
  onSelectWeek: (week: number) => void;
  onSelectByTeam: () => void;
  onSelectRecords: () => void;
  onSelectPlayoffs: () => void;
  onSelectAwards: () => void;
};

const bubbleClass = (selected: boolean) =>
  cn(
    'relative flex h-11 items-center justify-center rounded-full text-sm font-semibold transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    selected
      ? 'bg-primary text-primary-foreground'
      : 'border border-border/70 bg-secondary/40 text-muted-foreground hover:border-primary/50 hover:text-foreground'
  );

export function SeasonPredictionWeekBubbles({
  selectedWeek,
  activeView,
  completedWeeks,
  recordsReady,
  onSelectWeek,
  onSelectByTeam,
  onSelectRecords,
  onSelectPlayoffs,
  onSelectAwards,
}: Props) {
  const weeks = Array.from({ length: PICKEM_WEEKS }, (_, i) => i + 1);

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Season prediction views">
      {weeks.map((week) => {
        const selected = activeView === 'picks' && selectedWeek === week;
        const done = completedWeeks.has(week);
        return (
          <button
            key={week}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={done ? `Week ${week}, complete` : `Week ${week}`}
            onClick={() => onSelectWeek(week)}
            className={cn(bubbleClass(selected), 'w-11 tabular-nums')}
          >
            {week}
            {done && !selected && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check className="h-2.5 w-2.5" aria-hidden />
              </span>
            )}
          </button>
        );
      })}
      <button
        type="button"
        role="tab"
        aria-selected={activeView === 'byTeam'}
        aria-label="Edit by team"
        onClick={onSelectByTeam}
        className={cn(bubbleClass(activeView === 'byTeam'), 'gap-1.5 px-3.5')}
      >
        <Shield className="h-3.5 w-3.5" aria-hidden />
        By team
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeView === 'records'}
        aria-label={recordsReady ? 'Projected records' : 'Projected records (finish all weeks first)'}
        aria-disabled={!recordsReady}
        disabled={!recordsReady}
        onClick={onSelectRecords}
        className={cn(
          bubbleClass(activeView === 'records'),
          'gap-1.5 px-3.5',
          !recordsReady && 'cursor-not-allowed opacity-45 hover:border-border/70 hover:text-muted-foreground'
        )}
      >
        <Table2 className="h-3.5 w-3.5" aria-hidden />
        Records
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeView === 'playoffs'}
        aria-label={recordsReady ? 'Playoff bracket' : 'Playoff bracket (finish all weeks first)'}
        aria-disabled={!recordsReady}
        disabled={!recordsReady}
        onClick={onSelectPlayoffs}
        className={cn(
          bubbleClass(activeView === 'playoffs'),
          'gap-1.5 px-3.5',
          !recordsReady && 'cursor-not-allowed opacity-45 hover:border-border/70 hover:text-muted-foreground'
        )}
      >
        <Trophy className="h-3.5 w-3.5" aria-hidden />
        Playoffs
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeView === 'awards'}
        aria-label={recordsReady ? 'Awards' : 'Awards (finish all weeks first)'}
        aria-disabled={!recordsReady}
        disabled={!recordsReady}
        onClick={onSelectAwards}
        className={cn(
          bubbleClass(activeView === 'awards'),
          'gap-1.5 px-3.5',
          !recordsReady && 'cursor-not-allowed opacity-45 hover:border-border/70 hover:text-muted-foreground'
        )}
      >
        <Award className="h-3.5 w-3.5" aria-hidden />
        Awards
      </button>
    </div>
  );
}
