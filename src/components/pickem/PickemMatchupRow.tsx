import { Check, Lock } from 'lucide-react';
import { PlayerJerseyWithNumber } from '@/components/PlayerJerseyWithNumber';
import { pickemJerseyNumber } from '@/constants/pickem';
import { lookupJerseyNumberFill, useNflTeamJerseyColors } from '@/hooks/useNflTeamJerseyColors';
import { cn } from '@/lib/utils';
import { formatKickoff, isMatchupLocked, type WeekMatchup } from '@/utils/nfl2026Schedule';
import { getFullTeamName } from '@/utils/teamMapping';

type Props = {
  matchup: WeekMatchup;
  picked: string | null;
  onPick: (abbr: string) => void;
};

function pickCount(matchup: WeekMatchup, abbr: string): number {
  return matchup.game?.member_picks.filter((p) => p.picked_abbr === abbr).length ?? 0;
}

function teamLabel(abbr: string, fallbackName: string | null): string {
  return fallbackName?.trim() || getFullTeamName(abbr) || abbr;
}

function TeamPick({
  abbr,
  name,
  selected,
  locked,
  score,
  winner,
  showCounts,
  count,
  fill,
  onPick,
}: {
  abbr: string;
  name: string | null;
  selected: boolean;
  locked: boolean;
  score: number | null;
  winner: string | null;
  showCounts: boolean;
  count: number;
  fill: string;
  onPick: () => void;
}) {
  const isWinner = winner === abbr;
  const isLoser = Boolean(winner) && winner !== abbr;
  const fullName = teamLabel(abbr, name);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={locked}
      onClick={onPick}
      aria-label={`Pick ${fullName}`}
      className={cn(
        'flex min-h-[44px] min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1.5 py-2 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        locked ? 'cursor-default' : 'cursor-pointer hover:bg-secondary/70',
        selected && !winner && 'bg-primary/20 ring-2 ring-inset ring-primary',
        selected && isWinner && 'bg-emerald-500/15 ring-2 ring-inset ring-emerald-400',
        selected && isLoser && 'bg-destructive/10 ring-2 ring-inset ring-destructive/70',
        !selected && isWinner && 'ring-1 ring-inset ring-emerald-400/50'
      )}
    >
      <PlayerJerseyWithNumber
        team={abbr}
        jerseyNumber={pickemJerseyNumber(abbr)}
        numberFillColor={fill}
        size="dialog"
        numberNudgeY={7}
        className="h-36 w-24"
      />
      <span className="font-display text-lg leading-none tracking-wide">{abbr}</span>
      <span className="max-w-[9.5rem] text-center text-xs leading-snug text-muted-foreground">
        {fullName}
      </span>
      {score != null && <span className="font-mono text-sm tabular-nums">{score}</span>}
      {showCounts && (
        <span className="text-[10px] leading-none text-muted-foreground">
          {count} pick{count === 1 ? '' : 's'}
        </span>
      )}
    </button>
  );
}

export function PickemMatchupRow({ matchup, picked, onPick }: Props) {
  const locked = isMatchupLocked(matchup);
  const game = matchup.game;
  const showCounts = Boolean(locked && game && game.member_picks.length > 0);
  const { data: jerseyColors } = useNflTeamJerseyColors();

  return (
    <div
      role="radiogroup"
      aria-label={`${matchup.away} at ${matchup.home}`}
      className="glass-card flex flex-col px-2 py-2"
    >
      <div className="flex w-full items-center">
        <TeamPick
          abbr={matchup.away}
          name={game?.away_name ?? null}
          selected={picked === matchup.away}
          locked={locked}
          score={game?.away_score ?? null}
          winner={game?.winner_abbr ?? null}
          showCounts={showCounts}
          count={pickCount(matchup, matchup.away)}
          fill={lookupJerseyNumberFill(jerseyColors, matchup.away)}
          onPick={() => onPick(matchup.away)}
        />

        <div className="flex w-7 shrink-0 flex-col items-center justify-center gap-0.5 text-muted-foreground">
          {locked ? <Lock className="h-4 w-4" /> : <span className="text-sm font-semibold">@</span>}
          {picked && !locked && <Check className="h-3.5 w-3.5 text-primary" aria-hidden />}
        </div>

        <TeamPick
          abbr={matchup.home}
          name={game?.home_name ?? null}
          selected={picked === matchup.home}
          locked={locked}
          score={game?.home_score ?? null}
          winner={game?.winner_abbr ?? null}
          showCounts={showCounts}
          count={pickCount(matchup, matchup.home)}
          fill={lookupJerseyNumberFill(jerseyColors, matchup.home)}
          onPick={() => onPick(matchup.home)}
        />
      </div>
      {matchup.kickoffAt ? (
        <p className="pt-1 text-center text-[10px] leading-tight text-muted-foreground">
          {formatKickoff(matchup.kickoffAt)}
        </p>
      ) : (
        <p className="pt-1 text-center text-[10px] leading-tight text-muted-foreground">Time TBD</p>
      )}
    </div>
  );
}
