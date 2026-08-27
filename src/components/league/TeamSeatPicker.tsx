import { cn } from '@/lib/utils';
import type { LeagueSeat } from '@/types/leagueSocial';

type Props = {
  seats: LeagueSeat[];
  value: number | null;
  onChange: (teamNumber: number) => void;
  disabled?: boolean;
  currentUserId?: string | null;
};

export function TeamSeatPicker({ seats, value, onChange, disabled, currentUserId }: Props) {
  return (
    <div>
      <p id="team-seat-picker-label" className="mb-2 text-sm font-medium">
        Your team
      </p>
      <div
        role="radiogroup"
        aria-labelledby="team-seat-picker-label"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {seats.map((seat) => {
          const taken = Boolean(seat.user_id && seat.user_id !== currentUserId);
          const selected = value === seat.team_number;
          const label = `${String(seat.team_number).padStart(2, '0')} ${seat.team_name}`;
          return (
            <button
              key={seat.team_number}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={taken ? `${label}, taken by ${seat.username ?? 'someone'}` : label}
              disabled={disabled || taken}
              onClick={() => onChange(seat.team_number)}
              className={cn(
                'flex min-h-11 flex-col items-start justify-center rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                selected
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border/60 bg-secondary/30 hover:border-primary/40',
                taken && 'cursor-not-allowed opacity-50 hover:border-border/60',
              )}
            >
              <span className="font-medium leading-tight">{label}</span>
              {taken ? (
                <span className="mt-0.5 text-xs text-muted-foreground">
                  {seat.username ?? 'Taken'}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
