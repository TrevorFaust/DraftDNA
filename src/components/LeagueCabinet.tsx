import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ClipboardList, Hash, Repeat, Rows3, Sprout, Target, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PositionBadge } from '@/components/PositionBadge';
import { cn } from '@/lib/utils';
import {
  getBenchCount,
  getFlexCount,
  getRosterRounds,
  parseStarters,
  type PositionLimitsLike,
} from '@/utils/rosterSlots';

export type LeagueFile = {
  id: string;
  name: string;
  scoring_format?: string | null;
  league_type?: string | null;
  is_superflex?: boolean | null;
  user_id?: string | null;
  num_teams?: number | null;
  draft_order?: string | null;
  position_limits?: PositionLimitsLike | null;
  rookies_only?: boolean | null;
};

function scoringLabel(value: string | null | undefined): string {
  if (value === 'half_ppr') return 'Half PPR';
  if (value === 'standard') return 'Standard';
  return 'PPR';
}

function draftLabel(value: string | null | undefined): string {
  return value === 'dynasty' ? 'Dynasty' : 'Redraft';
}

function rosterLabel(superflex: boolean | null | undefined): string {
  return superflex ? 'Superflex' : '1QB';
}

function orderLabel(value: string | null | undefined): string {
  return value === 'linear' ? 'Linear' : 'Snake';
}

function lineupSlots(limits: PositionLimitsLike | null | undefined, superflex: boolean) {
  const starters = parseStarters(limits);
  const flex = getFlexCount(limits, superflex);
  return [
    { pos: 'QB', count: starters.QB },
    { pos: 'RB', count: starters.RB },
    { pos: 'WR', count: starters.WR },
    { pos: 'TE', count: starters.TE },
    { pos: 'FLEX', count: flex },
    { pos: 'DEF', count: starters.DEF },
    { pos: 'K', count: starters.K },
  ].filter((slot) => slot.count > 0);
}

function LeagueSettings({ league }: { league: LeagueFile }) {
  const limits = league.position_limits ?? null;
  const superflex = !!league.is_superflex;
  const facts = [
    { label: 'Teams', value: league.num_teams != null ? String(league.num_teams) : '—', icon: Users },
    { label: 'Scoring', value: scoringLabel(league.scoring_format), icon: Target },
    { label: 'Format', value: draftLabel(league.league_type), icon: ClipboardList },
    { label: 'QBs', value: rosterLabel(league.is_superflex), icon: User },
    { label: 'Draft order', value: orderLabel(league.draft_order), icon: Repeat },
    { label: 'Rounds', value: String(getRosterRounds(limits, superflex)), icon: Hash },
    { label: 'Bench', value: String(getBenchCount(limits)), icon: Rows3 },
  ];
  if (league.rookies_only && league.league_type === 'dynasty') {
    facts.push({ label: 'Players', value: 'Rookies only', icon: Sprout });
  }
  const slots = lineupSlots(limits, superflex);

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col justify-between gap-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {facts.map((fact) => {
          const Icon = fact.icon;
          return (
            <div
              key={fact.label}
              className="flex min-w-0 items-center gap-2 rounded-md border border-border/60 bg-secondary/35 px-2.5 py-2"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">{fact.label}</span>
                <span className="block text-sm font-semibold leading-tight text-foreground">{fact.value}</span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="rounded-md border border-border/60 bg-secondary/25 px-3 py-2.5">
        <p className="mb-2 text-xs text-muted-foreground">Lineup</p>
        <div className="flex flex-wrap gap-1.5">
          {slots.map((slot) => (
            <span
              key={slot.pos}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-background/40 px-2 py-1"
            >
              <span className="font-display text-base leading-none text-foreground">{slot.count}</span>
              <PositionBadge position={slot.pos} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * One league file at a time. The drawer tabs scroll inside a fixed cabinet
 * so a long list stays in one place.
 */
export function LeagueCabinet({
  leagues,
  userId,
  initialLeagueId,
  onOpen,
  onInvite,
}: {
  leagues: LeagueFile[];
  userId?: string;
  initialLeagueId?: string | null;
  onOpen: (league: LeagueFile) => void;
  onInvite: (league: LeagueFile) => void;
}) {
  const start = Math.max(
    0,
    leagues.findIndex((league) => league.id === initialLeagueId)
  );
  const [index, setIndex] = useState(start === -1 ? 0 : start);
  const safeIndex = leagues.length === 0 ? 0 : Math.min(index, leagues.length - 1);
  const league = leagues[safeIndex];

  useEffect(() => {
    const tab = document.getElementById(`league-file-${league?.id}`);
    tab?.scrollIntoView({ block: 'nearest' });
  }, [league?.id]);

  function move(next: number, focusTab = false) {
    if (leagues.length === 0) return;
    const wrapped = (next + leagues.length) % leagues.length;
    setIndex(wrapped);
    if (!focusTab) return;
    const id = leagues[wrapped]?.id;
    if (!id) return;
    requestAnimationFrame(() => {
      document.getElementById(`league-file-${id}`)?.focus();
    });
  }

  if (!league) return null;

  const owned = !!userId && league.user_id === userId;

  return (
    <div className="grid h-[22rem] overflow-hidden rounded-md border border-border bg-card md:grid-cols-[16rem_minmax(0,1fr)]">
      <div
        role="tablist"
        aria-label="Your leagues"
        aria-orientation="vertical"
        className="flex gap-1 overflow-x-auto border-b border-border p-2 md:flex-col md:gap-1 md:overflow-y-auto md:overflow-x-hidden md:border-b-0 md:border-r md:p-3"
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
            event.preventDefault();
            move(safeIndex + 1, true);
          } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
            event.preventDefault();
            move(safeIndex - 1, true);
          } else if (event.key === 'Home') {
            event.preventDefault();
            setIndex(0);
          } else if (event.key === 'End') {
            event.preventDefault();
            setIndex(leagues.length - 1);
          }
        }}
      >
        {leagues.map((item, itemIndex) => {
          const selected = itemIndex === safeIndex;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`league-file-${item.id}`}
              aria-selected={selected}
              aria-controls="league-file-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setIndex(itemIndex)}
              className={cn(
                'flex h-11 shrink-0 items-center rounded-md border px-3 text-left text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'md:w-full',
                selected
                  ? 'border-primary bg-secondary font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
              )}
            >
              <span className="min-w-0 truncate">{item.name}</span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="league-file-panel"
        aria-labelledby={`league-file-${league.id}`}
        className="flex min-h-0 min-w-0 flex-col p-4 sm:p-6"
      >
        <div key={league.id} className="cabinet-sheet flex min-h-0 min-w-0 flex-1 flex-col">
          <h3 className="truncate font-display text-3xl tracking-wide text-foreground">{league.name}</h3>
          <LeagueSettings league={league} />
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="hero" size="sm" className="h-11" onClick={() => onOpen(league)}>
              Open this league
            </Button>
            {owned ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11"
                onClick={() => onInvite(league)}
              >
                Invite friends
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11"
              aria-label="Previous league"
              onClick={() => move(safeIndex - 1)}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <p className="min-w-[4.5rem] text-center text-xs tabular-nums text-muted-foreground">
              {safeIndex + 1} of {leagues.length}
            </p>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11"
              aria-label="Next league"
              onClick={() => move(safeIndex + 1)}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
