import { useMemo, useState } from 'react';
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
import { displayTeamAbbrevOrFa } from '@/utils/teamMapping';
import { playerSearchMatches } from '@/utils/playerNameMatch';
import { cn } from '@/lib/utils';
import { ChevronsUpDown } from 'lucide-react';

export type CoachSearchOption = {
  id: string;
  name: string;
  team: string | null;
};

type Props = {
  value: CoachSearchOption | null;
  options: CoachSearchOption[];
  onChange: (coach: CoachSearchOption | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Show full selected name without truncating (awards UI). */
  wrapSelectedName?: boolean;
  /** When false, selected trigger shows name only (meta rendered elsewhere). */
  showSelectedMeta?: boolean;
};

export function CoachSearchCombobox({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = 'Search head coaches…',
  className,
  wrapSelectedName = false,
  showSelectedMeta = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return options.slice(0, 40);
    return options
      .filter(
        (c) =>
          playerSearchMatches(c.name, q) || playerSearchMatches(c.team || '', q)
      )
      .slice(0, 40);
  }, [options, search]);

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
                    <PositionBadge position="HC" className="shrink-0 text-[10px]" />
                    {value.team && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        ({displayTeamAbbrevOrFa(value.team, 'COACH', value.name)})
                      </span>
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
      <PopoverContent className="w-[min(100vw-2rem,22rem)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search coaches…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="scrollbar-thin max-h-64">
            <CommandEmpty>No coaches found</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  Clear selection
                </CommandItem>
              )}
              {filtered.map((coach) => (
                <CommandItem
                  key={coach.id}
                  value={coach.id}
                  onSelect={() => {
                    onChange(coach);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="min-w-0 flex-1 whitespace-normal break-words font-medium">
                      {coach.name}
                    </span>
                    <PositionBadge position="HC" className="shrink-0 text-[10px]" />
                    {coach.team && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {displayTeamAbbrevOrFa(coach.team, 'COACH', coach.name)}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
