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
import { displayTeamAbbrevOrFa } from '@/utils/teamMapping';
import { PositionBadge } from '@/components/PositionBadge';
import {
  PLAYER_POOL_PRIOR_SEASON,
  PLAYER_POOL_CURRENT_SEASON,
} from '@/constants/playerPoolSeason';
import { mergePlayerPoolAcrossSeasons } from '@/utils/playerDeduplication';
import { fetchRookiesRankings } from '@/utils/rookiesFilter';
import { playerSearchIlikeVariants, playerSearchMatches } from '@/utils/playerNameMatch';
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
  /** Positions to exclude from results (supports DEF/DST aliases). */
  excludePositions?: string[];
  /** When set, only players with this position are shown (e.g. 'QB', 'WR', 'D/ST'). */
  positionFilter?: string;
  /**
   * Limit results to the same rookies-only pool as dynasty drafts
   * (`get_rookies_rankings` / baseline rookies).
   */
  rookiesOnly?: boolean;
  /** Use modal popover when rendered inside a dialog/focus trap. */
  popoverModal?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Show full selected name without truncating (awards UI). */
  wrapSelectedName?: boolean;
  /** When false, selected trigger shows name only (meta rendered elsewhere). */
  showSelectedMeta?: boolean;
}

export function PlayerSearchCombobox({
  value,
  onChange,
  excludePlayerIds = new Set(),
  excludePositions = [],
  positionFilter,
  rookiesOnly = false,
  popoverModal = false,
  disabled = false,
  placeholder = 'Search player...',
  className,
  wrapSelectedName = false,
  showSelectedMeta = true,
}: PlayerSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [rookiePool, setRookiePool] = useState<Player[] | null>(null);
  const [rookiesLoading, setRookiesLoading] = useState(false);

  useEffect(() => {
    if (!rookiesOnly) {
      setRookiePool(null);
      setRookiesLoading(false);
      return;
    }
    let cancelled = false;
    setRookiesLoading(true);
    (async () => {
      const rows = await fetchRookiesRankings({
        scoringFormat: 'ppr',
        leagueType: 'dynasty',
        isSuperflex: false,
      });
      if (cancelled) return;
      if (rows.length === 0) {
        setRookiePool([]);
        setRookiesLoading(false);
        return;
      }
      const rankMap = new Map(rows.map((r) => [r.player_id, Number(r.rank)]));
      const ids = rows.map((r) => r.player_id);
      const { data, error } = await supabase.from('players').select('*').in('id', ids);
      if (cancelled) return;
      if (error || !data) {
        setRookiePool([]);
      } else {
        const sorted = (data as Player[])
          .map((p) => ({ ...p, adp: rankMap.get(p.id) ?? p.adp ?? 999 }))
          .sort((a, b) => (rankMap.get(a.id) ?? 999) - (rankMap.get(b.id) ?? 999));
        setRookiePool(sorted);
      }
      setRookiesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [rookiesOnly]);

  const fetchPlayers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setPlayers([]);
      return;
    }
    setLoading(true);
    const searchLower = query.toLowerCase().trim();

    if (rookiesOnly) {
      const pool = rookiePool ?? [];
      const matched = pool
        .filter((p) => {
          return (
            playerSearchMatches(p.name || '', searchLower) ||
            playerSearchMatches(p.team || '', searchLower)
          );
        })
        .filter((p) => !positionFilter || p.position === positionFilter)
        .slice(0, 25);
      setPlayers(matched);
      setLoading(false);
      return;
    }

    const variants = playerSearchIlikeVariants(searchLower);
    const nameClauses = variants.map((v) => `name.ilike.%${v}%`).join(',');
    const orFilter = nameClauses
      ? `${nameClauses},team.ilike.%${searchLower}%`
      : `name.ilike.%${searchLower}%,team.ilike.%${searchLower}%`;

    let queryBuilder = supabase
      .from('players')
      .select('*')
      .in('season', [PLAYER_POOL_PRIOR_SEASON, PLAYER_POOL_CURRENT_SEASON])
      .or(orFilter)
      .order('adp', { ascending: true })
      .limit(80);
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
      const merged = mergePlayerPoolAcrossSeasons(
        data || [],
        PLAYER_POOL_PRIOR_SEASON,
        PLAYER_POOL_CURRENT_SEASON
      );
      const punctFiltered = dedupeDefenses(merged)
        .filter(
          (p) =>
            playerSearchMatches(p.name || '', searchLower) ||
            playerSearchMatches(p.team || '', searchLower)
        )
        .slice(0, 25);
      setPlayers(punctFiltered);
    }
    setLoading(false);
  }, [positionFilter, rookiesOnly, rookiePool]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchPlayers(search);
    }, 200);
    return () => clearTimeout(debounce);
  }, [search, fetchPlayers]);

  const normalizePosition = (position: string) => {
    const p = (position || '').toUpperCase();
    if (p === 'DEF' || p === 'DST') return 'D/ST';
    return p;
  };

  const excludedPositionsSet = new Set(excludePositions.map(normalizePosition));
  const filteredPlayers = players.filter((p) => {
    if (excludePlayerIds.has(p.id)) return false;
    if (excludedPositionsSet.size === 0) return true;
    return !excludedPositionsSet.has(normalizePosition(p.position));
  });

  const emptyMessage = (() => {
    if (loading || (rookiesOnly && rookiesLoading)) return 'Searching...';
    if (rookiesOnly && rookiePool && rookiePool.length === 0) return 'No rookies available';
    if (filteredPlayers.length === 0) return rookiesOnly ? 'No rookies found' : 'No players found';
    return '';
  })();

  return (
    <Popover open={open} onOpenChange={setOpen} modal={popoverModal}>
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
                    {!isDefense(value.position) && value.team && (
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
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={rookiesOnly ? 'Search rookies...' : 'Type to search...'}
            value={search}
            onValueChange={setSearch}
          />
          {search.trim() ? (
            <CommandList className="scrollbar-thin">
              <CommandEmpty>{emptyMessage}</CommandEmpty>
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
                        <span className="text-xs text-muted-foreground shrink-0">{displayTeamAbbrevOrFa(player.team, player.position, player.name)}</span>
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
