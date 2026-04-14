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

/** Prefer `jerseys/Teams/*.png` over same basename at `jerseys/*.png` when both exist. */
const jerseyUrlByBasename: Record<string, string> = {};

function isUnderTeamsFolder(path: string): boolean {
  return /[/\\]Teams[/\\]/.test(path);
}

for (const [path, mod] of Object.entries(jerseyModules)) {
  if (!isUnderTeamsFolder(path)) continue;
  const file = path.replace(/^.*[/\\]/, '').replace(/\.png$/i, '');
  jerseyUrlByBasename[file.toLowerCase()] = mod.default;
}

for (const [path, mod] of Object.entries(jerseyModules)) {
  if (isUnderTeamsFolder(path)) continue;
  const file = path.replace(/^.*[/\\]/, '').replace(/\.png$/i, '');
  const key = file.toLowerCase();
  if (!jerseyUrlByBasename[key]) {
    jerseyUrlByBasename[key] = mod.default;
  }
}

const FREE_AGENT = jerseyUrlByBasename['free_agent'];
const PLAIN = jerseyUrlByBasename['plain_jersey'];

/**
 * Jersey image for a team abbreviation, or the free-agent jersey for FA / empty team.
 * Unknown abbrev falls back to plain jersey if present, else free-agent asset.
 */
export function getTeamJerseyImageUrl(teamAbbrev: string | null | undefined): string {
  const raw = teamAbbrev?.trim();
  if (!raw || raw.toUpperCase() === 'FA') {
    return FREE_AGENT ?? PLAIN ?? '';
  }
  const key = TEAM_ABBREV_TO_JERSEY_BASENAME[raw.toUpperCase()];
  const fallbackUnknown = PLAIN ?? FREE_AGENT ?? '';
  if (!key) return fallbackUnknown;
  return jerseyUrlByBasename[key.toLowerCase()] ?? fallbackUnknown;
}
