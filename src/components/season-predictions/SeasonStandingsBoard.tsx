import { SeasonAwardsPanel } from '@/components/season-predictions/SeasonAwardsPanel';
import {
  buildAllPlayoffSeeds,
  buildSeasonStandings,
  espnTeamLogoUrl,
  formatSeasonRecord,
  formatWinningPct,
  type DivisionStanding,
  type PlayoffSeed,
} from '@/utils/seasonPredictionRecords';
import type { SeasonAwardId, SeasonAwardPick, SeasonAwardsPicks } from '@/constants/seasonAwards';
import type { SeasonPredictionPicks } from '@/utils/seasonPredictionsStorage';
import { cn } from '@/lib/utils';

type Props = {
  picks: SeasonPredictionPicks;
  awards: SeasonAwardsPicks;
  awardsLocked?: boolean;
  onAwardChange: (awardId: SeasonAwardId, pick: SeasonAwardPick | null) => void;
  onSelectTeam?: (abbr: string) => void;
};

function ConferenceMark({ conference }: { conference: 'AFC' | 'NFC' }) {
  const isAfc = conference === 'AFC';
  return (
    <div className="mb-4 flex items-center gap-3">
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full font-display text-3xl tracking-wide text-white shadow-inner',
          isAfc ? 'bg-[#d50a0a]' : 'bg-[#013369]'
        )}
        aria-hidden
      >
        {isAfc ? 'A' : 'N'}
      </div>
      <div>
        <h2 className="font-display text-2xl tracking-wide">{conference}</h2>
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          {isAfc ? 'American Football Conference' : 'National Football Conference'}
        </p>
      </div>
    </div>
  );
}

function DivisionTable({
  standing,
  onSelectTeam,
  playoffAbbrs,
}: {
  standing: DivisionStanding;
  onSelectTeam?: (abbr: string) => void;
  playoffAbbrs: ReadonlySet<string>;
}) {
  return (
    <section className="mb-5 last:mb-0">
      <h3 className="mb-1.5 border-b border-border/70 pb-1 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {standing.label}
      </h3>
      <div className="text-sm">
        <div className="grid grid-cols-[minmax(0,1fr)_2rem_2rem_2.75rem_2.75rem] gap-1 pb-1.5 text-left text-[0.65rem] uppercase tracking-wider text-muted-foreground">
          <span className="font-medium">Team</span>
          <span className="text-right font-medium">W</span>
          <span className="text-right font-medium">L</span>
          <span className="text-right font-medium">DIV</span>
          <span className="text-right font-medium">PCT</span>
        </div>
        {standing.teams.map((team) => {
          const inPlayoffs = playoffAbbrs.has(team.abbr);
          const className = cn(
            'grid w-full grid-cols-[minmax(0,1fr)_2rem_2rem_2.75rem_2.75rem] items-center gap-1 border-t border-border/40 py-1.5 text-left',
            inPlayoffs && 'bg-primary/5',
            onSelectTeam &&
              'rounded-md transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          );

          const cells = (
            <>
              <span className="flex min-w-0 items-center gap-2">
                <img
                  src={espnTeamLogoUrl(team.abbr)}
                  alt=""
                  width={22}
                  height={22}
                  className="h-[22px] w-[22px] shrink-0 object-contain"
                  loading="lazy"
                />
                <span className="truncate font-medium">{team.nick}</span>
              </span>
              <span className="text-right font-mono tabular-nums">{team.wins}</span>
              <span className="text-right font-mono tabular-nums">{team.losses}</span>
              <span className="text-right font-mono tabular-nums text-muted-foreground">
                {formatSeasonRecord(team.divWins, team.divLosses)}
              </span>
              <span className="text-right font-mono tabular-nums">{formatWinningPct(team.pct)}</span>
            </>
          );

          if (onSelectTeam) {
            return (
              <button
                key={team.abbr}
                type="button"
                className={className}
                onClick={() => onSelectTeam(team.abbr)}
                aria-label={`Edit ${team.nick} predictions`}
              >
                {cells}
              </button>
            );
          }

          return (
            <div key={team.abbr} className={className}>
              {cells}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PlayoffSeedList({ seeds }: { seeds: PlayoffSeed[] }) {
  return (
    <ol className="space-y-1.5">
      {seeds.map((team) => (
        <li
          key={team.abbr}
          className={cn(
            'flex items-center justify-between gap-3 rounded-lg border px-3 py-2',
            'border-primary/30 bg-primary/5'
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="w-5 font-mono text-sm tabular-nums text-muted-foreground">{team.seed}</span>
            <img
              src={espnTeamLogoUrl(team.abbr)}
              alt=""
              width={24}
              height={24}
              className="h-6 w-6 shrink-0 object-contain"
              loading="lazy"
            />
            <div className="min-w-0">
              <p className="truncate font-medium">{team.nick}</p>
              <p className="text-[11px] text-muted-foreground">
                {team.seed <= 4 ? 'Division winner' : 'Wild card'} ·{' '}
                {formatSeasonRecord(team.divWins, team.divLosses)} div
              </p>
            </div>
          </div>
          <span className="font-mono text-sm tabular-nums">
            {formatSeasonRecord(team.wins, team.losses)}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function SeasonStandingsBoard({
  picks,
  awards,
  awardsLocked = false,
  onAwardChange,
  onSelectTeam,
}: Props) {
  const boards = buildSeasonStandings(picks);
  const playoffSeeds = buildAllPlayoffSeeds(picks);
  const playoffAbbrs = new Set([
    ...playoffSeeds.afc.map((t) => t.abbr),
    ...playoffSeeds.nfc.map((t) => t.abbr),
  ]);
  const afc = boards.filter((b) => b.conference === 'AFC');
  const nfc = boards.filter((b) => b.conference === 'NFC');

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="glass-card px-4 py-4 sm:px-5">
          <ConferenceMark conference="AFC" />
          {afc.map((standing) => (
            <DivisionTable
              key={standing.label}
              standing={standing}
              onSelectTeam={onSelectTeam}
              playoffAbbrs={playoffAbbrs}
            />
          ))}
        </div>
        <div className="glass-card px-4 py-4 sm:px-5">
          <ConferenceMark conference="NFC" />
          {nfc.map((standing) => (
            <DivisionTable
              key={standing.label}
              standing={standing}
              onSelectTeam={onSelectTeam}
              playoffAbbrs={playoffAbbrs}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-display mb-3 text-xl tracking-wide">Playoff seeding</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Seeds use NFL tiebreakers where possible (head-to-head, division, conference, SOV/SOS).
          Point differentials are skipped because picks do not include scores.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-card px-4 py-4">
            <h4 className="mb-3 font-sans text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              AFC seeds
            </h4>
            <PlayoffSeedList seeds={playoffSeeds.afc} />
          </div>
          <div className="glass-card px-4 py-4">
            <h4 className="mb-3 font-sans text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              NFC seeds
            </h4>
            <PlayoffSeedList seeds={playoffSeeds.nfc} />
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center">
        <h3 className="font-display mb-1 text-center text-xl tracking-wide">Awards</h3>
        <p className="mb-4 max-w-md text-center text-sm text-muted-foreground">
          Pick your winners below, or open the Awards tab for the same list.
        </p>
        <SeasonAwardsPanel
          awards={awards}
          locked={awardsLocked}
          onChange={onAwardChange}
          embedded
        />
      </div>
    </div>
  );
}
