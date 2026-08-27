import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { PositionBadge } from '@/components/PositionBadge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { displayTeamAbbrevOrFa } from '@/utils/teamMapping';
import type { PositionLimitsLike } from '@/utils/rosterSlots';
import {
  fillRankerLineup,
  lineupSwapTargets,
  type LineupSlotKey,
} from '../lineupRooms';
import type { Player } from '../types';

type Props = {
  players: Player[];
  lineupLimits?: PositionLimitsLike | null;
  isSuperflex?: boolean;
  canSwap?: boolean;
  onRemove?: (playerId: string) => void;
  onSwap?: (from: LineupSlotKey, to: LineupSlotKey) => void;
};

function displaySlotLabel(label: string): string {
  if (label === 'BN' || label === 'IR' || label === 'FLEX') return label;
  if (label === 'DEF' || label.startsWith('DEF')) return 'D/ST';
  return label.replace(/\d+$/, '');
}

function SlotRow({
  slot,
  label,
  player,
  targets,
  canSwap,
  onRemove,
  onSwap,
}: {
  slot: LineupSlotKey;
  label: string;
  player: Player | null;
  targets: ReturnType<typeof lineupSwapTargets>;
  canSwap?: boolean;
  onRemove?: (playerId: string) => void;
  onSwap?: (from: LineupSlotKey, to: LineupSlotKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const showSwap = Boolean(canSwap && onSwap && targets.length);

  useEffect(() => {
    setOpen(false);
  }, [player?.id]);

  return (
    <div
      className={cn(
        'flex min-h-11 items-center gap-2 rounded-lg border p-2 text-sm',
        player ? 'border-border/30 bg-secondary/50' : 'border-border/30 bg-secondary/30',
      )}
    >
      <div className="w-12 shrink-0 text-xs font-semibold text-muted-foreground">
        {displaySlotLabel(label)}
      </div>
      {player ? (
        <>
          <div className="min-w-0 flex-1 truncate font-medium">{player.name}</div>
          <PositionBadge position={player.position ?? label} className="text-[10px]" />
          <div className="shrink-0 text-xs text-muted-foreground">
            {displayTeamAbbrevOrFa(player.nflTeam, player.position, player.name)}
          </div>
        </>
      ) : (
        <div className="min-w-0 flex-1 italic text-muted-foreground/50">Empty</div>
      )}
      {showSwap ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-11 shrink-0 gap-1.5 px-3"
              aria-label={player ? `Swap ${player.name}` : `Start a player at ${displaySlotLabel(label)}`}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
              {player ? 'Swap' : 'Start'}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-2">
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {player ? `Replace ${player.name}` : `Start at ${displaySlotLabel(label)}`}
            </p>
            <ul className="mt-1 max-h-64 space-y-1 overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin">
              {targets.map((target) => (
                <li key={target.player.id}>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-full justify-start gap-2 px-2"
                    onClick={() => {
                      onSwap?.(slot, target.slot);
                      setOpen(false);
                    }}
                  >
                    <span className="w-10 shrink-0 text-xs font-semibold text-muted-foreground">
                      {displaySlotLabel(target.label)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-left">{target.player.name}</span>
                    <PositionBadge
                      position={target.player.position ?? target.label}
                      className="text-[10px]"
                    />
                  </Button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      ) : null}
      {player && onRemove ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-11 shrink-0 px-3"
          onClick={() => onRemove(player.id)}
        >
          Remove
        </Button>
      ) : null}
    </div>
  );
}

export function LineupRosterView({
  players,
  lineupLimits,
  isSuperflex = false,
  canSwap = false,
  onRemove,
  onSwap,
}: Props) {
  const lineup = useMemo(
    () => fillRankerLineup(players, lineupLimits, isSuperflex),
    [isSuperflex, lineupLimits, players],
  );

  function targetsFor(slot: LineupSlotKey) {
    if (!canSwap || !onSwap) return [];
    return lineupSwapTargets(players, slot, lineupLimits, isSuperflex);
  }

  return (
    <div className="space-y-3">
      {canSwap ? (
        <p className="text-sm text-muted-foreground">
          Swap a starter with someone already on this roster. Rooms update for everyone in the league.
        </p>
      ) : null}
      <div className="space-y-1">
        <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Starters</p>
        {lineup.starters.map((row, index) => {
          const slot: LineupSlotKey = { kind: 'starter', index };
          return (
            <SlotRow
              key={`${row.label}-${index}`}
              slot={slot}
              label={row.label}
              player={row.player}
              targets={targetsFor(slot)}
              canSwap={canSwap}
              onRemove={onRemove}
              onSwap={onSwap}
            />
          );
        })}
      </div>
      {lineup.bench.length ? (
        <div className="space-y-1 border-t border-border/30 pt-2">
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Bench</p>
          {lineup.bench.map((row, index) => {
            const slot: LineupSlotKey = { kind: 'bench', index };
            return (
              <SlotRow
                key={`bench-${index}`}
                slot={slot}
                label={row.label}
                player={row.player}
                targets={targetsFor(slot)}
                canSwap={canSwap}
                onRemove={onRemove}
                onSwap={onSwap}
              />
            );
          })}
        </div>
      ) : null}
      {lineup.ir.length ? (
        <div className="space-y-1 border-t border-border/30 pt-2">
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">IR</p>
          {lineup.ir.map((row, index) => {
            const slot: LineupSlotKey = { kind: 'ir', index };
            return (
              <SlotRow
                key={`ir-${index}`}
                slot={slot}
                label={row.label}
                player={row.player}
                targets={targetsFor(slot)}
                canSwap={canSwap}
                onRemove={onRemove}
                onSwap={onSwap}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
