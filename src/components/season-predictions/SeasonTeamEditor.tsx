import {
  buildSeasonStandings,
  espnTeamLogoUrl,
  formatSeasonRecord,
  formatWinningPct,
  gamesForTeam,
} from '@/utils/seasonPredictionRecords';
import type { SeasonPredictionPicks } from '@/utils/seasonPredictionsStorage';
import { scheduleGameKey } from '@/constants/nfl2026ScheduleGrid';
import { PickemMatchupRow } from '@/components/pickem/PickemMatchupRow';
import { officialKickoff, type WeekMatchup } from '@/utils/nfl2026Schedule';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Props = {
  picks: SeasonPredictionPicks;
  selectedAbbr: string | null;
  onSelectTeam: (abbr: string) => void;
  onPick: (key: string, abbr: string) => void;
  locked?: boolean;
};

function teamMatchups(teamAbbr: string): WeekMatchup[] {
  return gamesForTeam(teamAbbr).map((slot) => ({
    key: scheduleGameKey(slot.week, slot.away, slot.home),
    week: slot.week,
    home: slot.home,
    away: slot.away,
    game: null,
    kickoffAt: officialKickoff(slot.week, slot.away, slot.home),
  }));
}

export function SeasonTeamEditor({
  picks,
  selectedAbbr,
  onSelectTeam,
  onPick,
  locked = false,
}: Props) {
  const boards = buildSeasonStandings(picks);
  const selected = selectedAbbr
    ? boards.flatMap((b) => b.teams).find((t) => t.abbr === selectedAbbr) ?? null
    : null;
  const matchups = selectedAbbr ? teamMatchups(selectedAbbr) : [];

  return (
    <div className="space-y-5">
      <div className="max-w-md">
        <label htmlFor="season-team-select" className="mb-1.5 block text-sm text-muted-foreground">
          Team
        </label>
        <Select
          value={selectedAbbr ?? undefined}
          onValueChange={(value) => onSelectTeam(value)}
        >
          <SelectTrigger id="season-team-select" className="min-h-11 w-full">
            <SelectValue placeholder="Choose a team" />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {boards.map((standing) => (
              <SelectGroup key={standing.label}>
                <SelectLabel>{standing.label}</SelectLabel>
                {standing.teams.map((team) => (
                  <SelectItem key={team.abbr} value={team.abbr}>
                    <span className="flex items-center gap-2">
                      <img
                        src={espnTeamLogoUrl(team.abbr)}
                        alt=""
                        width={18}
                        height={18}
                        className="h-[18px] w-[18px] object-contain"
                      />
                      <span>
                        {team.nick}{' '}
                        <span className="text-muted-foreground">
                          ({formatSeasonRecord(team.wins, team.losses)})
                        </span>
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selected ? (
        <p className="text-sm text-muted-foreground">
          Choose a team to see every game on their schedule and change your prediction.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex items-center gap-3">
              <img
                src={espnTeamLogoUrl(selected.abbr)}
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
              />
              <div>
                <h3 className="font-display text-xl tracking-wide">{selected.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {formatSeasonRecord(selected.wins, selected.losses)} overall ·{' '}
                  {formatSeasonRecord(selected.divWins, selected.divLosses)} division ·{' '}
                  {formatWinningPct(selected.pct)} pct
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{matchups.length} games</p>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {matchups.map((matchup) => (
              <div key={matchup.key} className="space-y-1">
                <p className="px-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Week {matchup.week}
                </p>
                <PickemMatchupRow
                  matchup={matchup}
                  picked={picks[matchup.key] ?? null}
                  onPick={(abbr) => onPick(matchup.key, abbr)}
                  alwaysUnlocked={!locked}
                  forceLocked={locked}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
