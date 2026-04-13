/**
 * NFL team abbreviation → basename of PNG under `jerseys/` (Teams/ or root).
 * File names match asset basenames (e.g. packers.png, bucs.png, 49ers.png).
 */
const TEAM_ABBREV_TO_JERSEY_BASENAME: Record<string, string> = {
  ARI: 'cardinals',
  ATL: 'falcons',
  BAL: 'ravens',
  BUF: 'bills',
  CAR: 'panthers',
  CHI: 'bears',
  CIN: 'bengals',
  CLE: 'browns',
  DAL: 'cowboys',
  DEN: 'broncos',
  DET: 'lions',
  GB: 'packers',
  HOU: 'texans',
  IND: 'colts',
  JAX: 'jaguares',
  JAC: 'jaguares',
  KC: 'chiefs',
  LA: 'rams',
  LAR: 'rams',
  LAC: 'chargers',
  LV: 'raiders',
  MIA: 'dolphins',
  MIN: 'vikings',
  NE: 'patriots',
  NO: 'saints',
  NYG: 'giants',
  NYJ: 'jets',
  PHI: 'eagles',
  PIT: 'steelers',
  SEA: 'seahawks',
  SF: '49ers',
  TB: 'bucs',
  TEN: 'titans',
  WAS: 'commanders',
  WSH: 'commanders',
};

const jerseyModules = import.meta.glob<{ default: string }>('../../jerseys/**/*.png', {
  eager: true,
});

const jerseyUrlByBasename: Record<string, string> = {};

for (const [path, mod] of Object.entries(jerseyModules)) {
  const file = path.replace(/^.*\//, '').replace(/\.png$/i, '');
  jerseyUrlByBasename[file.toLowerCase()] = mod.default;
}

const PLAIN = jerseyUrlByBasename['plain_jersey'];

export function getTeamJerseyImageUrl(teamAbbrev: string | null | undefined): string {
  const fallback = PLAIN ?? '';
  const raw = teamAbbrev?.trim();
  if (!raw || raw.toUpperCase() === 'FA') return fallback;
  const key = TEAM_ABBREV_TO_JERSEY_BASENAME[raw.toUpperCase()];
  if (!key) return fallback;
  return jerseyUrlByBasename[key.toLowerCase()] ?? fallback;
}
