import { useEffect, useMemo, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { PositionBadge } from '@/components/PositionBadge';
import {
  fetchDefensivePlayersForAwards,
  type DefensiveAwardPlayer,
} from '@/utils/defensivePlayersAwardsPool';
import { displayTeamAbbrevOrFa } from '@/utils/teamMapping';
import { playerSearchMatches } from '@/utils/playerNameMatch';
import { cn } from '@/lib/utils';
import { ChevronsUpDown } from 'lucide-react';

type Props = {
  value: DefensiveAwardPlayer | null;
  onChange: (player: DefensiveAwardPlayer | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Show full selected name without truncating (awards UI). */
  wrapSelectedName?: boolean;
  /** When false, selected trigger shows name only (meta rendered elsewhere). */
  showSelectedMeta?: boolean;
};

export function DefensivePlayerSearchCombobox({
  value,
  onChange,
  disabled = false,
  placeholder = 'Search defensive players…',
  className,
  wrapSelectedName = false,
  showSelectedMeta = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pool, setPool] = useState<DefensiveAwardPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const rows = await fetchDefensivePlayersForAwards(2026);
      if (!cancelled) {
        setPool(rows);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return [];
    return pool
      .filter((p) => {
        return (
          playerSearchMatches(p.name, q) ||
          playerSearchMatches(p.team || '', q) ||
          playerSearchMatches(p.position, q)
        );
      })
      .slice(0, 25);
  }, [pool, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'h-auto min-h-11 w-full px-2 py-2 font-normal sm:px-2.5',
            wrapSelectedName ? 'justify-start gap-2' : 'justify-between',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-2 text-left">
            {value ? (
              <>
                <span
                  className={cn(
                    'text-base font-semibold leading-tight',
                    wrapSelectedName
                      ? 'max-w-full whitespace-normal break-words'
                      : 'min-w-0 flex-1 truncate'
                  )}
                >
                  {value.name}
                </span>
                {showSelectedMeta && (
                  <>
                    <PositionBadge position={value.position} className="shrink-0 text-[10px]" />
                    {value.team && (
                      <span className="shrink-0 text-xs text-muted-foreground">({value.team})</span>
                    )}
                  </>
                )}
              </>
            ) : (
              <span className="text-sm">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search name, team, or position…"
            value={search}
            onValueChange={setSearch}
          />
          {search.trim() ? (
            <CommandList className="scrollbar-thin">
              <CommandEmpty>
                {loading ? 'Loading…' : filtered.length === 0 ? 'No defensive players found' : ''}
              </CommandEmpty>
              <CommandGroup>
                {filtered.map((player) => (
                  <CommandItem
                    key={player.id}
                    value={player.id}
                    onSelect={() => {
                      onChange(player);
                      setOpen(false);
                      setSearch('');
                    }}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate font-medium">{player.name}</span>
                      <PositionBadge position={player.position} className="shrink-0 text-[10px]" />
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {displayTeamAbbrevOrFa(player.team, player.position, player.name)}
                      </span>
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
