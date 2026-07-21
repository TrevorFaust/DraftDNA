import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { PositionBadge } from '@/components/PositionBadge';
import { displayTeamAbbrevOrFa, resolveDefenseTeamAbbr, isDefensePosition } from '@/utils/teamMapping';
import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';
import type { RankedPlayer } from '@/types/database';

interface RankingsLocalPlayerPickerProps {
  /** Only players from this pool can be selected, keeping manual picks valid for the current rankings bucket. */
  pool: RankedPlayer[];
  value: RankedPlayer | null;
  onChange: (player: RankedPlayer | null) => void;
  /** Shown as quick picks before the user types (e.g. fuzzy-match guesses). */
  suggestions?: RankedPlayer[];
  placeholder?: string;
  className?: string;
}

/**
 * Inline player search (not a popover). Portal popovers inside the import Dialog kept losing
 * clicks and keystrokes to Radix's focus trap, so this stays in normal document flow.
 */
export function RankingsLocalPlayerPicker({
  pool,
  value,
  onChange,
  suggestions = [],
  placeholder = 'Type a player or defense name',
  className,
}: RankingsLocalPlayerPickerProps) {
  const [search, setSearch] = useState('');

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return suggestions.slice(0, 5);

    const defenseAbbr = resolveDefenseTeamAbbr(term);

    return pool
      .filter((p) => {
        if (p.name.toLowerCase().includes(term)) return true;
        if ((p.team ?? '').toLowerCase().includes(term)) return true;
        if (p.position.toLowerCase().includes(term)) return true;
        // "jaguars", "jax d/st", "phi def" → match the pool's D/ST for that team
        if (defenseAbbr && isDefensePosition(p.position)) {
          const playerTeam = (p.team ?? '').toUpperCase();
          if (playerTeam === defenseAbbr) return true;
          if (resolveDefenseTeamAbbr(p.name) === defenseAbbr) return true;
        }
        return false;
      })
      .slice(0, 8);
  }, [pool, search, suggestions]);

  if (value) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border border-input bg-background px-2.5 py-2',
          className
        )}
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{value.name}</span>
        <PositionBadge position={value.position} className="shrink-0 text-[10px]" />
        {value.team && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {displayTeamAbbrevOrFa(value.team, value.position, value.name)}
          </span>
        )}
        <button
          type="button"
          aria-label="Clear selection"
          onClick={() => onChange(null)}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder={placeholder}
          className="h-9 pl-8 text-sm"
        />
      </div>
      {results.length > 0 ? (
        <ul className="max-h-44 overflow-y-auto rounded-md border border-border/70 bg-background py-1 scrollbar-thin">
          {results.map((player) => (
            <li key={player.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  // mousedown (not click) so selection wins before any blur/focus reshuffle from the dialog
                  e.preventDefault();
                  onChange(player);
                  setSearch('');
                }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{player.name}</span>
                <PositionBadge position={player.position} className="shrink-0 text-[10px]" />
                <span className="shrink-0 text-xs text-muted-foreground">
                  {displayTeamAbbrevOrFa(player.team, player.position, player.name)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : search.trim() ? (
        <p className="px-1 text-xs text-muted-foreground">No players found</p>
      ) : (
        <p className="px-1 text-xs text-muted-foreground">Start typing a name, team, or defense</p>
      )}
    </div>
  );
}
