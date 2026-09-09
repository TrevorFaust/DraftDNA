import type { Conference, PlayoffSeed } from '@/utils/seasonPredictionRecords';

export type BracketMatchup = {
  id: string;
  round: 'wildCard' | 'divisional' | 'conference';
  home: PlayoffSeed;
  away: PlayoffSeed;
};

export type ConferenceBracketPicks = {
  wildCard: [string | null, string | null, string | null];
  divisional: [string | null, string | null];
  conference: string | null;
};

export type PlayoffBracketPicks = {
  afc: ConferenceBracketPicks;
  nfc: ConferenceBracketPicks;
  superBowl: string | null;
};

export function emptyConferenceBracketPicks(): ConferenceBracketPicks {
  return {
    wildCard: [null, null, null],
    divisional: [null, null],
    conference: null,
  };
}

export function emptyPlayoffBracketPicks(): PlayoffBracketPicks {
  return {
    afc: emptyConferenceBracketPicks(),
    nfc: emptyConferenceBracketPicks(),
    superBowl: null,
  };
}

function seedByNumber(seeds: PlayoffSeed[], n: number): PlayoffSeed | null {
  return seeds.find((s) => s.seed === n) ?? null;
}

function seedByAbbr(seeds: PlayoffSeed[], abbr: string): PlayoffSeed | null {
  return seeds.find((s) => s.abbr === abbr) ?? null;
}

/** Wild-card round: 7 @ 2, 6 @ 3, 5 @ 4 (lower seed hosts). */
export function wildCardMatchups(seeds: PlayoffSeed[]): BracketMatchup[] {
  const pairs: [number, number][] = [
    [7, 2],
    [6, 3],
    [5, 4],
  ];

  return pairs.flatMap(([awaySeed, homeSeed], index) => {
    const away = seedByNumber(seeds, awaySeed);
    const home = seedByNumber(seeds, homeSeed);
    if (!away || !home) return [];
    return [
      {
        id: `wc-${index}`,
        round: 'wildCard' as const,
        home,
        away,
      },
    ];
  });
}

function resolveWildCardWinners(
  seeds: PlayoffSeed[],
  wcPicks: ConferenceBracketPicks['wildCard']
): PlayoffSeed[] {
  const matchups = wildCardMatchups(seeds);
  return matchups.flatMap((m, i) => {
    const winnerAbbr = wcPicks[i];
    if (!winnerAbbr) return [];
    const winner = seedByAbbr(seeds, winnerAbbr);
    return winner ? [winner] : [];
  });
}

/** Divisional round with NFL reseeding after wild card. */
export function divisionalMatchups(
  seeds: PlayoffSeed[],
  wcPicks: ConferenceBracketPicks['wildCard']
): BracketMatchup[] {
  const seed1 = seedByNumber(seeds, 1);
  if (!seed1) return [];

  const wcWinners = resolveWildCardWinners(seeds, wcPicks);
  if (wcWinners.length !== 3) return [];

  const remaining = [seed1, ...wcWinners];
  const nonOne = remaining.filter((t) => t.seed !== 1);
  const lowestRemaining = nonOne.reduce((lowest, team) =>
    team.seed > lowest.seed ? team : lowest
  );
  const forMatch2 = remaining.filter(
    (t) => t.abbr !== seed1.abbr && t.abbr !== lowestRemaining.abbr
  );
  if (forMatch2.length !== 2) return [];

  const [higherSeed, lowerSeed] = [...forMatch2].sort((a, b) => a.seed - b.seed);

  return [
    {
      id: 'div-0',
      round: 'divisional',
      home: seed1,
      away: lowestRemaining,
    },
    {
      id: 'div-1',
      round: 'divisional',
      home: higherSeed,
      away: lowerSeed,
    },
  ];
}

function resolveDivisionalWinners(
  seeds: PlayoffSeed[],
  wcPicks: ConferenceBracketPicks['wildCard'],
  divPicks: ConferenceBracketPicks['divisional']
): PlayoffSeed[] {
  const matchups = divisionalMatchups(seeds, wcPicks);
  return matchups.flatMap((m, i) => {
    const winnerAbbr = divPicks[i];
    if (!winnerAbbr) return [];
    const winner = seedByAbbr(seeds, winnerAbbr);
    return winner ? [winner] : [];
  });
}

export function conferenceMatchup(
  seeds: PlayoffSeed[],
  picks: ConferenceBracketPicks
): BracketMatchup | null {
  const winners = resolveDivisionalWinners(seeds, picks.wildCard, picks.divisional);
  if (winners.length !== 2) return null;

  const [higherSeed, lowerSeed] = [...winners].sort((a, b) => a.seed - b.seed);
  return {
    id: 'conf-0',
    round: 'conference',
    home: higherSeed,
    away: lowerSeed,
  };
}

export function conferenceChampion(
  seeds: PlayoffSeed[],
  picks: ConferenceBracketPicks
): PlayoffSeed | null {
  if (!picks.conference) return null;
  return seedByAbbr(seeds, picks.conference);
}

export function superBowlMatchup(
  afcSeeds: PlayoffSeed[],
  nfcSeeds: PlayoffSeed[],
  bracket: PlayoffBracketPicks
): { afc: PlayoffSeed; nfc: PlayoffSeed } | null {
  const afc = conferenceChampion(afcSeeds, bracket.afc);
  const nfc = conferenceChampion(nfcSeeds, bracket.nfc);
  if (!afc || !nfc) return null;
  return { afc, nfc };
}

export function wildCardComplete(picks: ConferenceBracketPicks): boolean {
  return picks.wildCard.every(Boolean);
}

export function divisionalComplete(
  seeds: PlayoffSeed[],
  picks: ConferenceBracketPicks
): boolean {
  if (!wildCardComplete(picks)) return false;
  const matchups = divisionalMatchups(seeds, picks.wildCard);
  return matchups.length === 2 && picks.divisional.every(Boolean);
}

export function conferenceComplete(
  seeds: PlayoffSeed[],
  picks: ConferenceBracketPicks
): boolean {
  return divisionalComplete(seeds, picks) && Boolean(picks.conference);
}

export function bracketComplete(
  afcSeeds: PlayoffSeed[],
  nfcSeeds: PlayoffSeed[],
  bracket: PlayoffBracketPicks
): boolean {
  return (
    conferenceComplete(afcSeeds, bracket.afc) &&
    conferenceComplete(nfcSeeds, bracket.nfc) &&
    Boolean(bracket.superBowl)
  );
}

/** Clear downstream picks when an earlier round changes. */
export function applyConferencePick(
  picks: ConferenceBracketPicks,
  round: 'wildCard' | 'divisional' | 'conference',
  index: number | null,
  winnerAbbr: string
): ConferenceBracketPicks {
  const next: ConferenceBracketPicks = {
    wildCard: [...picks.wildCard] as ConferenceBracketPicks['wildCard'],
    divisional: [...picks.divisional] as ConferenceBracketPicks['divisional'],
    conference: picks.conference,
  };

  if (round === 'wildCard' && index != null) {
    if (next.wildCard[index] === winnerAbbr) return picks;
    next.wildCard[index] = winnerAbbr;
    next.divisional = [null, null];
    next.conference = null;
    return next;
  }

  if (round === 'divisional' && index != null) {
    if (next.divisional[index] === winnerAbbr) return picks;
    next.divisional[index] = winnerAbbr;
    next.conference = null;
    return next;
  }

  if (round === 'conference') {
    if (next.conference === winnerAbbr) return picks;
    next.conference = winnerAbbr;
    return next;
  }

  return picks;
}

export function applySuperBowlPick(
  bracket: PlayoffBracketPicks,
  winnerAbbr: string
): PlayoffBracketPicks {
  if (bracket.superBowl === winnerAbbr) return bracket;
  return { ...bracket, superBowl: winnerAbbr };
}

export type ConferenceKey = Conference;
