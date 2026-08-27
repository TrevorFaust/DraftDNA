import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ROOMS, ROOM_LABELS, ROOM_SHORT, type League, type Room } from '../types';
import { clampRoomWeight, sumWeights } from '../scoring';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

type Props = {
  league: League;
  canEdit?: boolean;
  onSave: (weights: League['weights']) => boolean;
};

function savedKey(weights: League['weights']): string {
  return ROOMS.map((room) => weights[room]).join(',');
}

function WeightPercentField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={cn(
        'flex h-8 w-[6.25rem] shrink-0 items-stretch overflow-hidden rounded-md border border-border bg-background',
        'focus-within:ring-2 focus-within:ring-ring',
        disabled && 'opacity-60',
      )}
    >
      <div
        className="flex min-w-0 flex-1 cursor-text items-center gap-0.5 px-1.5"
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          disabled={disabled}
          value={value}
          aria-label={`${label} weight percent`}
          className="h-full w-7 bg-transparent text-center font-display text-base leading-none tabular-nums text-primary focus-visible:outline-none disabled:cursor-not-allowed"
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            const raw = event.target.value.replace(/\D/g, '');
            onChange(raw === '' ? 0 : Number(raw));
          }}
        />
        <span className="font-display text-xs text-primary/80" aria-hidden="true">
          %
        </span>
      </div>
      <div className="flex w-6 flex-col border-l border-border">
        <button
          type="button"
          disabled={disabled || value >= 100}
          aria-label={`Increase ${label} weight`}
          className="flex min-h-0 flex-1 appearance-none items-center justify-center rounded-none border-0 bg-transparent p-0 text-muted-foreground shadow-none hover:bg-secondary/80 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          onClick={() => onChange(value + 1)}
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          disabled={disabled || value <= 0}
          aria-label={`Decrease ${label} weight`}
          className="flex min-h-0 flex-1 appearance-none items-center justify-center rounded-none border-0 border-t border-solid border-border bg-transparent p-0 text-muted-foreground shadow-none hover:bg-secondary/80 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          onClick={() => onChange(value - 1)}
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export function WeightsPanel({ league, canEdit = true, onSave }: Props) {
  const [draft, setDraft] = useState<League['weights']>(league.weights);
  const saved = savedKey(league.weights);

  useEffect(() => {
    setDraft(league.weights);
  }, [saved]);

  const total = sumWeights(draft);
  const delta = 100 - total;
  const dirty = savedKey(draft) !== saved;
  const canSave = canEdit && dirty && total === 100;

  const status = useMemo(() => {
    if (total === 100) {
      return dirty ? '100%. Save to put these weights on the board.' : '100%. These weights are on the board.';
    }
    if (delta > 0) return `${total}% total. You need ${delta}% more.`;
    return `${total}% total. You need ${Math.abs(delta)}% less.`;
  }, [delta, dirty, total]);

  function setRoom(room: Room, value: number) {
    setDraft((prev) => ({ ...prev, [room]: clampRoomWeight(value) }));
  }

  return (
    <section className="space-y-2.5" aria-label="Weights">
      <div>
        <h2 className="font-display text-lg tracking-wide">Weights</h2>
        <p className="text-xs text-muted-foreground">
          Save when the six rooms add up to 100%.
        </p>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {ROOMS.map((room) => (
          <div
            key={room}
            className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-2 py-1.5"
          >
            <span className="w-12 shrink-0 text-xs font-semibold uppercase tracking-wide">
              {ROOM_SHORT[room]}
            </span>
            <Slider
              min={0}
              max={100}
              step={1}
              disabled={!canEdit}
              value={[draft[room]]}
              aria-label={`${ROOM_LABELS[room]} weight slider`}
              onValueChange={(value) => setRoom(room, value[0] ?? 0)}
            />
            <WeightPercentField
              label={ROOM_LABELS[room]}
              value={draft[room]}
              disabled={!canEdit}
              onChange={(value) => setRoom(room, value)}
            />
          </div>
        ))}
      </div>
      {canEdit ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-card px-2.5 py-1.5">
          <p
            className={cn(
              'min-w-0 text-xs',
              total === 100 ? 'text-muted-foreground' : 'text-destructive',
            )}
            aria-live="polite"
          >
            {status}
          </p>
          <Button type="button" size="sm" className="h-8 shrink-0" disabled={!canSave} onClick={() => onSave(draft)}>
            Save weights
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {status}
        </p>
      )}
    </section>
  );
}
