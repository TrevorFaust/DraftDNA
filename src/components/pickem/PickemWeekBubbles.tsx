import { Trophy } from 'lucide-react';
import { PICKEM_WEEKS } from '@/constants/pickem';
import { cn } from '@/lib/utils';

type Props = {
  selectedWeek: number | null;
  standingsSelected: boolean;
  onSelectWeek: (week: number) => void;
  onSelectStandings: () => void;
};

const bubbleClass = (selected: boolean) =>
  cn(
    'flex h-11 items-center justify-center rounded-full text-sm font-semibold transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    selected
      ? 'bg-primary text-primary-foreground'
      : 'border border-border/70 bg-secondary/40 text-muted-foreground hover:border-primary/50 hover:text-foreground'
  );

export function PickemWeekBubbles({
  selectedWeek,
  standingsSelected,
  onSelectWeek,
  onSelectStandings,
}: Props) {
  const weeks = Array.from({ length: PICKEM_WEEKS }, (_, i) => i + 1);

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Pick'em views">
      {weeks.map((week) => {
        const selected = !standingsSelected && selectedWeek === week;
        return (
          <button
            key={week}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={`Week ${week}`}
            onClick={() => onSelectWeek(week)}
            className={cn(bubbleClass(selected), 'w-11 tabular-nums')}
          >
            {week}
          </button>
        );
      })}
      <button
        type="button"
        role="tab"
        aria-selected={standingsSelected}
        aria-label="League standings"
        onClick={onSelectStandings}
        className={cn(bubbleClass(standingsSelected), 'gap-1.5 px-3.5')}
      >
        <Trophy className="h-3.5 w-3.5" aria-hidden />
        Standings
      </button>
    </div>
  );
}
