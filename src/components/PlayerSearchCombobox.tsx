import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { ChevronsUpDown } from 'lucide-react';
import type { Player } from '@/types/database';
import { PositionBadge } from '@/components/PositionBadge';
import { Button } from '@/components/ui/button';

const VALID_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'D/ST']);

function isDefense(position: string): boolean {
  const p = (position || '').toUpperCase();
  return p === 'D/ST' || p === 'DST' || p === 'DEF';
}

/** Deduplicate defense rows: keep one per defense name (e.g. "Atlanta Falcons"), preferring lowest ADP. */
function dedupeDefenses(players: Player[]): Player[] {
  const defenses = players.filter((p) => isDefense(p.position));
  const others = players.filter((p) => !isDefense(p.position));
  defenses.sort((a, b) => (a.adp ?? 999) - (b.adp ?? 999));
  const seen = new Set<string>();
  const onePerDefense = defenses.filter((p) => {
    const key = (p.name || '').trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...others, ...onePerDefense].sort((a, b) => (a.adp ?? 999) - (b.adp ?? 999));
}

interface PlayerSearchComboboxProps {
  value: Player | null;
  onChange: (player: Player | null) => void;
  excludePlayerIds?: Set<string>;
  /** When set, only players with this position are shown (e.g. 'QB', 'WR', 'D/ST'). */
  positionFilter?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function PlayerSearchCombobox({
  value,
  onChange,
  excludePlayerIds = new Set(),
  positionFilter,
  disabled = false,
  placeholder = 'Search player...',
  className,
}: PlayerSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPlayers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setPlayers([]);
      return;
    }
    setLoading(true);
    const searchLower = query.toLowerCase().trim();
    let queryBuilder = supabase
      .from('players')
      .select('*')
      .or(`name.ilike.%${searchLower}%,team.ilike.%${searchLower}%`)
      .order('adp', { ascending: true })
      .limit(25);
    if (positionFilter) {
      queryBuilder = queryBuilder.eq('position', positionFilter);
    } else {
      queryBuilder = queryBuilder.in('position', Array.from(VALID_POSITIONS));
    }
    const { data, error } = await queryBuilder;

    if (error) {
      console.error('Error searching players:', error);
      setPlayers([]);
    } else {
      setPlayers(dedupeDefenses(data || []));
    }
    setLoading(false);
  }, [positionFilter]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchPlayers(search);
    }, 200);
    return () => clearTimeout(debounce);
  }, [search, fetchPlayers]);

  const filteredPlayers = players.filter(
    (p) => !excludePlayerIds.has(p.id)
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal min-h-11 py-2 h-auto px-2 sm:px-2.5',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
            {value ? (
              <>
                <span className="min-w-0 flex-1 truncate text-base font-semibold leading-tight">
                  {value.name}
                </span>
                <PositionBadge position={value.position} className="shrink-0 text-[10px]" />
                {!isDefense(value.position) && value.team && (
                  <span className="shrink-0 text-xs text-muted-foreground">({value.team})</span>
                )}
              </>
            ) : (
              <span className="text-sm">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type to search..."
            value={search}
            onValueChange={setSearch}
          />
          {search.trim() ? (
            <CommandList className="scrollbar-thin">
              <CommandEmpty>
                {loading ? 'Searching...' : filteredPlayers.length === 0 ? 'No players found' : ''}
              </CommandEmpty>
              <CommandGroup>
                {filteredPlayers.map((player) => (
                  <CommandItem
                    key={player.id}
                    value={player.id}
                    onSelect={() => {
                      onChange(player);
                      setOpen(false);
                      setSearch('');
                    }}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="truncate font-medium">{player.name}</span>
                      <PositionBadge position={player.position} className="text-[10px] shrink-0" />
                      {!isDefense(player.position) && (
                        <span className="text-xs text-muted-foreground shrink-0">{player.team || 'FA'}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
