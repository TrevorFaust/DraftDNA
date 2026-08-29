import { ROOMS, ROOM_SHORT, type League, type Room, type ScoredTeam } from '../types';
import { formatPlace } from '../scoring';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { LineupRosterView } from './LineupRosterView';
import type { PositionLimitsLike } from '@/utils/rosterSlots';
import type { LineupSlotKey } from '../lineupRooms';

type Props = {
  board: ScoredTeam[];
  weights: League['weights'];
  expandedId: string | null;
  canEdit?: boolean;
  canSwapTeam?: (teamId: string) => boolean;
  yourTeamId?: string | null;
  lineupLimits?: PositionLimitsLike | null;
  isSuperflex?: boolean;
  boardTitle?: string;
  boardCaption?: string;
  /** When true, show the numeric avg (e.g. crowd overall place). */
  showAverage?: boolean;
  averageLabel?: string;
  onToggle: (teamId: string) => void;
  onGutBump: (teamId: string, value: number) => void;
  onSwapLineup?: (teamId: string, from: LineupSlotKey, to: LineupSlotKey) => void;
};

const ROOM_BADGE: Record<Room, string> = {
  QB: 'border-sky-500/40 text-sky-400',
  RB: 'border-emerald-500/40 text-emerald-400',
  WR: 'border-amber-500/40 text-amber-400',
  TE: 'border-orange-500/40 text-orange-400',
  DST: 'border-violet-500/40 text-violet-400',
  BENCH: 'border-muted-foreground/40 text-muted-foreground',
};

function rankColor(rank: number): string {
  if (rank === 1) return 'text-primary';
  if (rank <= 3) return 'text-accent';
  return 'text-muted-foreground';
}

export function Board({
  board,
  weights,
  expandedId,
  canEdit = true,
  canSwapTeam,
  yourTeamId,
  lineupLimits,
  isSuperflex = false,
  boardTitle = 'The board',
  boardCaption,
  showAverage = true,
  averageLabel = 'Avg rank',
  onToggle,
  onGutBump,
  onSwapLineup,
}: Props) {
  const formula = ROOMS.map((room) => `${ROOM_SHORT[room]}×${weights[room]}%`).join(' + ');
  const caption =
    boardCaption ??
    `Room ranks weighted by ${formula}. Lower place wins. RB room is the tiebreaker.`;

  return (
    <section aria-label="Overall board">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="font-display text-3xl tracking-wide">{boardTitle}</h2>
        <p className="max-w-sm text-xs text-muted-foreground">{caption}</p>
      </div>
      <ol className="grid gap-2">
        {board.map((row) => {
          const open = expandedId === row.team.id;
          const allowSwap = Boolean(canSwapTeam?.(row.team.id));
          return (
            <li
              key={row.team.id}
              className={cn(
                'rounded-lg border bg-card/80 shadow-sm',
                open ? 'border-primary' : 'border-border/60 hover:border-primary/40',
              )}
            >
              <button
                type="button"
                className="w-full p-3 text-left"
                onClick={() => onToggle(row.team.id)}
                aria-expanded={open}
              >
                <div
                  className={cn(
                    'grid items-baseline gap-3',
                    showAverage ? 'grid-cols-[3rem_1fr_auto]' : 'grid-cols-[3rem_1fr]',
                  )}
                >
                  <span className={cn('font-display text-3xl leading-none', rankColor(row.rank))}>
                    {String(row.rank).padStart(2, '0')}
                  </span>
                  <span className="font-display text-lg tracking-wide uppercase">
                    {row.team.name}
                    {row.team.id === yourTeamId ? (
                      <span className="ml-2 text-xs font-semibold normal-case tracking-wide text-muted-foreground">
                        You
                      </span>
                    ) : null}
                  </span>
                  {showAverage ? (
                    <span className="text-right">
                      <span className="font-display text-2xl leading-none tabular-nums">
                        {row.total.toFixed(2)}
                      </span>
                      <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {averageLabel}
                      </span>
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 sm:pl-[3.75rem]">
                  {ROOMS.map((room) => (
                    <span
                      key={room}
                      className={cn(
                        'inline-flex rounded border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                        ROOM_BADGE[room],
                      )}
                    >
                      {ROOM_SHORT[room]} {formatPlace(row.roomPlace[room])}
                    </span>
                  ))}
                </div>
              </button>
              {open ? (
                <div className="space-y-3 border-t border-dashed border-border px-3 pb-4 pt-3 sm:pl-[4.5rem]">
                  <LineupRosterView
                    players={row.team.players}
                    lineupLimits={lineupLimits}
                    isSuperflex={isSuperflex}
                    canSwap={allowSwap}
                    onSwap={
                      allowSwap && onSwapLineup
                        ? (from, to) => onSwapLineup(row.team.id, from, to)
                        : undefined
                    }
                  />
                  <div className="max-w-xs space-y-2">
                    <label htmlFor={`bump-${row.team.id}`} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Gut bump
                    </label>
                    <div className="flex items-center gap-3">
                      <Slider
                        id={`bump-${row.team.id}`}
                        min={-5}
                        max={5}
                        step={0.5}
                        disabled={!canEdit}
                        value={[row.team.gutBump]}
                        onValueChange={(value) => onGutBump(row.team.id, value[0] ?? 0)}
                      />
                      <span className="font-display w-10 text-xl leading-none">
                        {row.team.gutBump > 0 ? '+' : ''}
                        {row.team.gutBump}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
