import { useState } from 'react';
import { espnTeamLogoUrl } from '@/utils/seasonPredictionRecords';
import { cn } from '@/lib/utils';

type Conference = 'AFC' | 'NFC';

type Club = { abbr: string; nick: string };

type Division = { conference: Conference; label: string; teams: Club[] };

type Row = Club & { wins: number; losses: number; seed: number | null; champion: boolean };

const DIVISIONS: Division[] = [
  {
    conference: 'AFC',
    label: 'AFC East',
    teams: [
      { abbr: 'BUF', nick: 'Bills' },
      { abbr: 'MIA', nick: 'Dolphins' },
      { abbr: 'NE', nick: 'Patriots' },
      { abbr: 'NYJ', nick: 'Jets' },
    ],
  },
  {
    conference: 'AFC',
    label: 'AFC North',
    teams: [
      { abbr: 'BAL', nick: 'Ravens' },
      { abbr: 'CIN', nick: 'Bengals' },
      { abbr: 'CLE', nick: 'Browns' },
      { abbr: 'PIT', nick: 'Steelers' },
    ],
  },
  {
    conference: 'AFC',
    label: 'AFC South',
    teams: [
      { abbr: 'HOU', nick: 'Texans' },
      { abbr: 'IND', nick: 'Colts' },
      { abbr: 'JAX', nick: 'Jaguars' },
      { abbr: 'TEN', nick: 'Titans' },
    ],
  },
  {
    conference: 'AFC',
    label: 'AFC West',
    teams: [
      { abbr: 'DEN', nick: 'Broncos' },
      { abbr: 'KC', nick: 'Chiefs' },
      { abbr: 'LV', nick: 'Raiders' },
      { abbr: 'LAC', nick: 'Chargers' },
    ],
  },
  {
    conference: 'NFC',
    label: 'NFC East',
    teams: [
      { abbr: 'DAL', nick: 'Cowboys' },
      { abbr: 'NYG', nick: 'Giants' },
      { abbr: 'PHI', nick: 'Eagles' },
      { abbr: 'WAS', nick: 'Commanders' },
    ],
  },
  {
    conference: 'NFC',
    label: 'NFC North',
    teams: [
      { abbr: 'CHI', nick: 'Bears' },
      { abbr: 'DET', nick: 'Lions' },
      { abbr: 'GB', nick: 'Packers' },
      { abbr: 'MIN', nick: 'Vikings' },
    ],
  },
  {
    conference: 'NFC',
    label: 'NFC South',
    teams: [
      { abbr: 'ATL', nick: 'Falcons' },
      { abbr: 'CAR', nick: 'Panthers' },
      { abbr: 'NO', nick: 'Saints' },
      { abbr: 'TB', nick: 'Buccaneers' },
    ],
  },
  {
    conference: 'NFC',
    label: 'NFC West',
    teams: [
      { abbr: 'ARI', nick: 'Cardinals' },
      { abbr: 'LAR', nick: 'Rams' },
      { abbr: 'SF', nick: '49ers' },
      { abbr: 'SEA', nick: 'Seahawks' },
    ],
  },
];

const WINNER_RECORDS: [number, number][] = [
  [15, 2],
  [14, 3],
  [13, 4],
  [13, 3],
  [12, 5],
  [11, 6],
  [10, 7],
  [9, 8],
];

type Scenario = {
  champion: { nick: string; abbr: string; wins: number; losses: number };
  afc: { label: string; teams: Row[] }[];
  nfc: { label: string; teams: Row[] }[];
};

function pick<T>(items: T[], rng: () => number) {
  return items[Math.floor(rng() * items.length)];
}

function worseRecord(maxWins: number, rng: () => number): [number, number] {
  const wins = Math.max(2, maxWins - 1 - Math.floor(rng() * 5));
  const losses = wins >= 13 && maxWins > 13 ? Math.max(2, 16 - wins) : Math.max(wins + 1, 17 - wins);
  return [Math.min(wins, maxWins - 1), losses];
}

function rowsFor(
  division: Division,
  featured: { abbr: string; wins: number; losses: number; wild: boolean } | null,
  rng: () => number
): Row[] {
  const featuredClub = featured ? division.teams.find((team) => team.abbr === featured.abbr) : undefined;
  const rest = division.teams.filter((team) => team.abbr !== featured?.abbr);

  if (!featured || !featuredClub) {
    const top = 9 + Math.floor(rng() * 5);
    let ceiling = top;
    return division.teams
      .map((team) => {
        const wins = ceiling;
        ceiling = Math.max(3, ceiling - 1 - Math.floor(rng() * 2));
        const losses = Math.max(2, 17 - wins);
        return { ...team, wins, losses, seed: null, champion: false };
      })
      .sort((a, b) => b.wins - a.wins);
  }

  const others: Row[] = [];
  if (featured.wild) {
    const champWins = Math.min(14, featured.wins + 2 + Math.floor(rng() * 2));
    const [champ] = rest;
    others.push({
      ...champ,
      wins: champWins,
      losses: Math.max(2, 17 - champWins),
      seed: null,
      champion: false,
    });
    rest.slice(1).forEach((team) => {
      const [wins, losses] = worseRecord(featured.wins, rng);
      others.push({ ...team, wins, losses, seed: null, champion: false });
    });
  } else {
    rest.forEach((team) => {
      const [wins, losses] = worseRecord(featured.wins, rng);
      others.push({ ...team, wins, losses, seed: null, champion: false });
    });
  }

  const featuredRow: Row = {
    ...featuredClub,
    wins: featured.wins,
    losses: featured.losses,
    seed: null,
    champion: true,
  };

  return [...others, featuredRow].sort((a, b) => b.wins - a.wins || (a.champion ? -1 : 1));
}

function assignSeeds(groups: { teams: Row[] }[]) {
  const leaders = groups
    .map((group) => group.teams[0])
    .filter(Boolean)
    .sort((a, b) => b.wins - a.wins);
  leaders.forEach((leader, index) => {
    leader.seed = index + 1;
  });

  const wildCards = groups
    .flatMap((group) => group.teams.slice(1))
    .filter((team) => team.wins > team.losses)
    .sort((a, b) => b.wins - a.wins || (a.champion ? -1 : 1));
  wildCards.slice(0, 3).forEach((team, index) => {
    team.seed = 5 + index;
  });

  const champion = groups.flatMap((group) => group.teams).find((team) => team.champion);
  if (champion && champion.seed == null && champion.wins > champion.losses) {
    const lastWild = wildCards[2];
    if (lastWild && lastWild !== champion) lastWild.seed = null;
    champion.seed = 7;
  }
}

function buildScenario(rng: () => number): Scenario {
  const division = pick(DIVISIONS, rng);
  const club = pick(division.teams, rng);
  const [wins, losses] = pick(WINNER_RECORDS, rng);
  const wild = wins <= 10 && rng() < 0.45;
  const featured = { abbr: club.abbr, wins, losses, wild };

  const shown = DIVISIONS.map((item) => ({
    conference: item.conference,
    label: item.label,
    teams: rowsFor(item, item === division ? featured : null, rng),
  }));

  const afc = shown.filter((item) => item.conference === 'AFC');
  const nfc = shown.filter((item) => item.conference === 'NFC');
  assignSeeds(afc);
  assignSeeds(nfc);

  return {
    champion: { nick: club.nick, abbr: club.abbr, wins, losses },
    afc,
    nfc,
  };
}

function TeamLogo({ abbr, large }: { abbr: string; large?: boolean }) {
  return (
    <img
      src={espnTeamLogoUrl(abbr)}
      alt=""
      width={large ? 44 : 16}
      height={large ? 44 : 16}
      className={large ? 'h-7 w-7 shrink-0 object-contain' : 'h-3.5 w-3.5 max-h-full shrink-0 object-contain'}
    />
  );
}

function DivisionBlock({ label, teams }: { label: string; teams: Row[] }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <h5 className="shrink-0 border-b border-border/70 pb-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </h5>
      <ul className="grid min-h-0 flex-1 grid-rows-4">
        {teams.map((team) => (
          <li
            key={team.abbr}
            className={cn(
              'grid min-h-0 grid-cols-[1.1rem_minmax(0,1fr)_2.4rem] items-center gap-1 overflow-hidden rounded-sm px-0.5',
              team.seed != null && 'bg-primary/10',
              team.champion && 'bg-primary/25'
            )}
          >
            <span className="text-center font-mono text-xs font-semibold tabular-nums leading-none text-primary">
              {team.seed ?? ''}
            </span>
            <span className="flex min-h-0 min-w-0 items-center gap-1 overflow-hidden">
              <TeamLogo abbr={team.abbr} />
              <span className={cn('truncate text-xs leading-none', team.champion ? 'font-semibold text-foreground' : 'font-medium')}>
                {team.nick}
              </span>
            </span>
            <span className="text-right font-mono text-xs tabular-nums leading-none">
              {team.wins}-{team.losses}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ConferenceColumn({
  conference,
  divisions,
}: {
  conference: Conference;
  divisions: { label: string; teams: Row[] }[];
}) {
  const isAfc = conference === 'AFC';
  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-border/60 bg-secondary/20 px-2 py-1">
      <div className="mb-0.5 flex shrink-0 items-center justify-center gap-1.5">
        <div
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-full font-display text-xs text-white',
            isAfc ? 'bg-[#d50a0a]' : 'bg-[#013369]'
          )}
        >
          {isAfc ? 'A' : 'N'}
        </div>
        <h4 className="font-display text-sm leading-none tracking-wide">{conference}</h4>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1">
        {divisions.map((division) => (
          <DivisionBlock key={division.label} label={division.label} teams={division.teams} />
        ))}
      </div>
    </div>
  );
}

/** A fresh fictional finish each time this sheet opens. All eight divisions, no scrollbar. */
export function SeasonStage() {
  const [scenario] = useState(() => buildScenario(Math.random));
  const { champion } = scenario;

  return (
    <div className="flex h-full flex-col overflow-hidden p-2 sm:p-2.5" aria-hidden>
      <div className="mb-1.5 flex shrink-0 items-center justify-center gap-2 rounded-md border border-primary/55 bg-primary/15 px-3 py-1 text-center">
        <TeamLogo abbr={champion.abbr} large />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Super Bowl</p>
          <p className="font-display text-xl leading-none tracking-wide text-foreground">
            {champion.nick}{' '}
            <span className="text-primary">
              {champion.wins}-{champion.losses}
            </span>
          </p>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
        <ConferenceColumn conference="AFC" divisions={scenario.afc} />
        <ConferenceColumn conference="NFC" divisions={scenario.nfc} />
      </div>
    </div>
  );
}
