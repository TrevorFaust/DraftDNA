import { Check, X, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WeekMatchup } from '@/utils/nfl2026Schedule';
import type { PickemStanding } from '@/types/leagueSocial';

type Props = {
  week: number;
  matchups: WeekMatchup[];
  standings: PickemStanding[];
};

function cellResult(
  picked: string | null,
  winner: string | null,
  isPush: boolean
): 'correct' | 'missed' | 'push' | 'empty' {
  if (!picked) return 'empty';
  if (isPush) return 'push';
  if (!winner) return 'empty';
  return picked === winner ? 'correct' : 'missed';
}

export function PickemResultsGrid({ week, matchups, standings }: Props) {
  const columns = matchups.filter((m) => m.game);

  if (columns.length === 0 || standings.length === 0) return null;

  return (
    <section className="mb-6" aria-labelledby="results-grid-heading">
      <h3 id="results-grid-heading" className="font-display mb-2 text-lg tracking-wide">
        Who picked what
      </h3>
      <p className="mb-3 text-sm text-muted-foreground">
        Rows are league members. Columns are games. Scroll sideways to see the full slate.
      </p>
      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="min-w-full border-collapse text-sm">
          <caption className="sr-only">
            Week {week} pick results for each league member and each game
          </caption>
          <thead>
            <tr className="border-b border-border/50 bg-secondary/40">
              <th
                scope="col"
                className="sticky left-0 z-10 min-w-[7.5rem] bg-secondary/95 px-3 py-2 text-left font-medium"
              >
                Player
              </th>
              {columns.map((matchup) => (
                <th
                  key={matchup.key}
                  scope="col"
                  className="min-w-[4.25rem] px-1.5 py-2 text-center font-medium"
                >
                  <span className="block font-display text-xs tracking-wide">{matchup.away}</span>
                  <span className="block text-[10px] font-normal text-muted-foreground">@</span>
                  <span className="block font-display text-xs tracking-wide">{matchup.home}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr
                key={row.user_id}
                className={cn(
                  'border-b border-border/40 last:border-b-0',
                  row.is_you ? 'bg-primary/10' : 'odd:bg-background even:bg-secondary/20'
                )}
              >
                <th
                  scope="row"
                  className={cn(
                    'sticky left-0 z-10 min-w-[7.5rem] px-3 py-2 text-left font-medium',
                    row.is_you ? 'bg-primary/15' : 'bg-background'
                  )}
                >
                  <span className="block truncate">
                    {row.username}
                    {row.is_you ? ' (you)' : ''}
                  </span>
                </th>
                {columns.map((matchup) => {
                  const game = matchup.game;
                  const picked =
                    game?.member_picks.find((p) => p.user_id === row.user_id)?.picked_abbr ?? null;
                  const isPush =
                    game?.status === 'final' &&
                    game.home_score != null &&
                    game.away_score != null &&
                    game.home_score === game.away_score;
                  const result = cellResult(picked, game?.winner_abbr ?? null, isPush);
                  const label =
                    result === 'empty'
                      ? `${row.username} did not pick ${matchup.away} at ${matchup.home}`
                      : result === 'push'
                        ? `${row.username} picked ${picked}, push`
                        : `${row.username} picked ${picked}, ${result}`;

                  return (
                    <td key={matchup.key} className="px-1 py-1.5 text-center">
                      <span
                        className={cn(
                          'inline-flex min-h-11 min-w-[3.5rem] flex-col items-center justify-center rounded-md px-1 py-1',
                          result === 'correct' && 'bg-emerald-500/15 text-emerald-300',
                          result === 'missed' && 'bg-destructive/15 text-destructive',
                          result === 'push' && 'bg-secondary text-muted-foreground',
                          result === 'empty' && 'text-muted-foreground/70'
                        )}
                        aria-label={label}
                      >
                        {result === 'empty' ? (
                          <Minus className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <>
                            <span className="font-display text-xs tracking-wide">{picked}</span>
                            {result === 'correct' ? (
                              <Check className="h-3.5 w-3.5" aria-hidden />
                            ) : result === 'missed' ? (
                              <X className="h-3.5 w-3.5" aria-hidden />
                            ) : null}
                          </>
                        )}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
