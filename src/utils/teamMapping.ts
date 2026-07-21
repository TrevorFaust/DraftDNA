// Map team abbreviations to full team names for lookup in teams table
export const TEAM_ABBREV_TO_FULL_NAME: Record<string, string> = {
  'ARI': 'Arizona Cardinals',
  'ATL': 'Atlanta Falcons',
  'BAL': 'Baltimore Ravens',
  'BUF': 'Buffalo Bills',
  'CAR': 'Carolina Panthers',
  'CHI': 'Chicago Bears',
  'CIN': 'Cincinnati Bengals',
  'CLE': 'Cleveland Browns',
  'DAL': 'Dallas Cowboys',
  'DEN': 'Denver Broncos',
  'DET': 'Detroit Lions',
  'GB': 'Green Bay Packers',
  'HOU': 'Houston Texans',
  'IND': 'Indianapolis Colts',
  'JAX': 'Jacksonville Jaguars',
  'KC': 'Kansas City Chiefs',
  'LA': 'Los Angeles Rams',
  'LAR': 'Los Angeles Rams',
  'LAC': 'Los Angeles Chargers',
  'LV': 'Las Vegas Raiders',
  'MIA': 'Miami Dolphins',
  'MIN': 'Minnesota Vikings',
  'NE': 'New England Patriots',
  'NO': 'New Orleans Saints',
  'NYG': 'New York Giants',
  'NYJ': 'New York Jets',
  'PHI': 'Philadelphia Eagles',
  'PIT': 'Pittsburgh Steelers',
  'SEA': 'Seattle Seahawks',
  'SF': 'San Francisco 49ers',
  'TB': 'Tampa Bay Buccaneers',
  'TEN': 'Tennessee Titans',
  'WAS': 'Washington Commanders',
};

export const getFullTeamName = (teamAbbrev: string | null | undefined): string | null => {
  if (!teamAbbrev) return null;
  return TEAM_ABBREV_TO_FULL_NAME[teamAbbrev] || teamAbbrev;
};

/** Lowercase full name → abbreviation (for D/ST rows that store full team names). */
const FULL_NAME_TO_ABBREV: Record<string, string> = (() => {
  const o: Record<string, string> = {};
  for (const [abbr, full] of Object.entries(TEAM_ABBREV_TO_FULL_NAME)) {
    o[full.toLowerCase()] = abbr;
  }
  return o;
})();

/**
 * Non-standard/legacy team abbreviations people actually type or paste from other sites
 * (ESPN/Yahoo/Sleeper exports, relocated-franchise history, etc.) → our canonical abbreviation.
 */
const ALT_ABBR_TO_CANONICAL: Record<string, string> = {
  PHL: 'PHI',
  AZ: 'ARI',
  ARZ: 'ARI',
  JAC: 'JAX',
  TAM: 'TB',
  GNB: 'GB',
  KAN: 'KC',
  SFO: 'SF',
  NWE: 'NE',
  NOR: 'NO',
  NOLA: 'NO',
  SD: 'LAC',
  SDG: 'LAC',
  OAK: 'LV',
  STL: 'LAR',
  WSH: 'WAS',
  LA: 'LAR',
};

/**
 * Normalize `players.team` to an abbreviation for lookups in `teams` / color maps.
 * Accepts abbreviations (DAL, LAR, JAC…) or full names (e.g. Dallas Cowboys for D/ST).
 */
export function teamFieldToAbbr(team: string | null | undefined): string | null {
  if (!team?.trim()) return null;
  const t = team.trim();
  const upper = t.toUpperCase();
  if (/^[A-Z]{2,4}$/.test(upper)) return canonicalTeamAbbr(upper);
  return FULL_NAME_TO_ABBREV[t.toLowerCase()] ?? null;
}

/** Normalize alternate abbreviations so stats rows and player rows match (e.g. `JAC` → `JAX`, `WSH` → `WAS`). */
export function canonicalTeamAbbr(abbr: string | null | undefined): string | null {
  if (!abbr?.trim()) return null;
  const u = abbr.trim().toUpperCase();
  return ALT_ABBR_TO_CANONICAL[u] ?? u;
}

/** Team nickname alone (no city) — unique across all 32 teams, so no ambiguity to worry about. */
const NICKNAME_TO_ABBR: Record<string, string> = {
  cardinals: 'ARI',
  falcons: 'ATL',
  ravens: 'BAL',
  bills: 'BUF',
  panthers: 'CAR',
  bears: 'CHI',
  bengals: 'CIN',
  browns: 'CLE',
  cowboys: 'DAL',
  broncos: 'DEN',
  lions: 'DET',
  packers: 'GB',
  texans: 'HOU',
  colts: 'IND',
  jaguars: 'JAX',
  jags: 'JAX',
  chiefs: 'KC',
  rams: 'LAR',
  chargers: 'LAC',
  raiders: 'LV',
  dolphins: 'MIA',
  vikings: 'MIN',
  patriots: 'NE',
  saints: 'NO',
  giants: 'NYG',
  jets: 'NYJ',
  eagles: 'PHI',
  steelers: 'PIT',
  seahawks: 'SEA',
  '49ers': 'SF',
  niners: 'SF',
  buccaneers: 'TB',
  bucs: 'TB',
  titans: 'TEN',
  commanders: 'WAS',
};

/** City/region alone. Cities shared by two franchises (LA, NY) are only included combined with a nickname. */
const CITY_TO_ABBR: Record<string, string> = {
  arizona: 'ARI',
  atlanta: 'ATL',
  baltimore: 'BAL',
  buffalo: 'BUF',
  carolina: 'CAR',
  chicago: 'CHI',
  cincinnati: 'CIN',
  cleveland: 'CLE',
  dallas: 'DAL',
  denver: 'DEN',
  detroit: 'DET',
  'green bay': 'GB',
  houston: 'HOU',
  indianapolis: 'IND',
  indy: 'IND',
  jacksonville: 'JAX',
  'kansas city': 'KC',
  miami: 'MIA',
  minnesota: 'MIN',
  'new england': 'NE',
  'new orleans': 'NO',
  philadelphia: 'PHI',
  philly: 'PHI',
  pittsburgh: 'PIT',
  seattle: 'SEA',
  'san francisco': 'SF',
  'tampa bay': 'TB',
  tampa: 'TB',
  tennessee: 'TEN',
  washington: 'WAS',
  'las vegas': 'LV',
  vegas: 'LV',
  oakland: 'LV',
  'los angeles rams': 'LAR',
  'la rams': 'LAR',
  'los angeles chargers': 'LAC',
  'la chargers': 'LAC',
  'new york giants': 'NYG',
  'ny giants': 'NYG',
  'new york jets': 'NYJ',
  'ny jets': 'NYJ',
  'st louis': 'LAR',
};

/** Every alt/nickname/city alias, longest phrase first so multi-word aliases win over shorter overlaps. */
const NAME_ALIAS_ENTRIES = Object.entries({ ...CITY_TO_ABBR, ...NICKNAME_TO_ABBR }).sort(
  (a, b) => b[0].length - a[0].length
);

/** Every team-ish token this resolver recognizes — used to teach flat-text parsers what counts as a "team" field. */
export const KNOWN_TEAM_TEXT_TOKENS: readonly string[] = [
  ...Object.keys(TEAM_ABBREV_TO_FULL_NAME),
  ...Object.keys(ALT_ABBR_TO_CANONICAL),
  'FA',
];

function escapeForWordBoundary(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolves free-text team naming to a canonical abbreviation: standard/legacy abbreviations,
 * full names, nicknames alone ("Eagles"), or cities alone ("Philadelphia"). Only matches when the
 * *entire* cleaned string is the team reference — deliberately strict, so a real player's name that
 * happens to have a team tacked onto the end (e.g. "Aaron Rodgers Pittsburgh Steelers") does NOT get
 * misread as that team's defense. Returns null for anything else, including genuinely ambiguous team-only
 * text (bare "Los Angeles" or "New York").
 */
export function resolveTeamAbbrFromText(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const cleaned = text.trim().replace(/\./g, '').replace(/\s+/g, ' ');

  const upper = cleaned.toUpperCase();
  if (/^[A-Z]{2,4}$/.test(upper)) {
    if (ALT_ABBR_TO_CANONICAL[upper]) return ALT_ABBR_TO_CANONICAL[upper];
    const canon = canonicalTeamAbbr(upper);
    if (canon && TEAM_ABBREV_TO_FULL_NAME[canon]) return canon;
  }

  const lower = cleaned.toLowerCase();
  if (FULL_NAME_TO_ABBREV[lower]) return FULL_NAME_TO_ABBREV[lower];
  if (NICKNAME_TO_ABBR[lower]) return NICKNAME_TO_ABBR[lower];
  if (CITY_TO_ABBR[lower]) return CITY_TO_ABBR[lower];

  return null;
}

/**
 * A looser pass used only once we already know a string is *supposed* to describe a defense (it carried
 * an explicit "D/ST"/"DEF"/"Defense" tag) — finds a whole-word nickname/city/abbreviation anywhere in the
 * text (e.g. "PHL Eagles Defense"). Never called on text without that signal, since matching a team name
 * as a mere substring is exactly what would misfire on something like "Aaron Rodgers Pittsburgh Steelers".
 */
function resolveTeamAbbrLoosely(text: string): string | null {
  const exact = resolveTeamAbbrFromText(text);
  if (exact) return exact;

  const lower = text.trim().replace(/\./g, '').toLowerCase();
  for (const [phrase, abbr] of NAME_ALIAS_ENTRIES) {
    const re = new RegExp(`\\b${escapeForWordBoundary(phrase)}\\b`, 'i');
    if (re.test(lower)) return abbr;
  }
  return null;
}

/** Strips D/ST-style suffixes ("Eagles D/ST", "Cardinals Defense", "Broncos Special Teams") before team resolution. */
function stripDefenseWording(text: string): string {
  let s = text.trim();
  const re = /\s*[-/]?\s*\b(?:d\s*\/?\s*s\s*t|dst|def(?:ense)?|special\s*teams)\b\s*$/i;
  for (;;) {
    const next = s.replace(re, '').trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

/**
 * Resolves defense/special-teams free text to a canonical team abbreviation — this is the wide net for
 * all the ways people write a D/ST: full names, bare nicknames, bare cities, standard or legacy
 * abbreviations, with or without a trailing "D/ST"/"DEF"/"Defense" tag.
 *
 * The looser "team name anywhere in the text" matching only kicks in once an explicit defense tag was
 * actually found and stripped — plain text with no such tag (a real player's name, say) only ever gets
 * the strict, whole-string match, so it correctly resolves to nothing here instead of a false team hit.
 */
export function resolveDefenseTeamAbbr(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const stripped = stripDefenseWording(text);
  const hadDefenseTag = stripped !== text.trim();

  if (hadDefenseTag) return resolveTeamAbbrLoosely(stripped || text);
  return resolveTeamAbbrFromText(stripped);
}

/** Every recognized team phrase (full names, nicknames, cities), longest first. */
const ALL_TEAM_PHRASES = Object.entries({ ...FULL_NAME_TO_ABBREV, ...NICKNAME_TO_ABBR, ...CITY_TO_ABBR }).sort(
  (a, b) => b[0].length - a[0].length
);

/**
 * Strips a trailing team reference from free text, e.g. "Aaron Rodgers Pittsburgh Steelers" →
 * "Aaron Rodgers". For when someone's raw name field has their team tacked on with no separator or
 * position marker to signal where the name ends. Returns the original text unchanged if nothing at the
 * end matches a known team, or if the whole string *is* the team reference (that's a defense, not a
 * name+team combo — leave it for the defense resolver to handle instead).
 */
export function stripTrailingTeamReference(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (resolveTeamAbbrFromText(trimmed)) return trimmed; // the whole string already IS a team reference

  for (const [phrase] of ALL_TEAM_PHRASES) {
    const re = new RegExp(`\\s+${escapeForWordBoundary(phrase)}$`, 'i');
    const match = trimmed.match(re);
    if (match) {
      const stripped = trimmed.slice(0, trimmed.length - match[0].length).trim();
      if (stripped) return stripped;
    }
  }
  return trimmed;
}

export function isDefensePosition(position: string | null | undefined): boolean {
  if (!position?.trim()) return false;
  const p = position.trim().toUpperCase();
  return p === 'D/ST' || p === 'DEF' || p === 'DST';
}

/**
 * Resolve best team abbreviation for jersey/colors.
 * Defense rows can carry team='FA'; in that case derive team from defense name.
 */
export function resolveTeamAbbrForDisplay(
  team: string | null | undefined,
  position: string | null | undefined,
  playerName: string | null | undefined
): string | null {
  const fromTeamField = teamFieldToAbbr(team);
  if (fromTeamField && fromTeamField !== 'FA') return canonicalTeamAbbr(fromTeamField);

  if (isDefensePosition(position)) {
    const fromDefenseName = teamFieldToAbbr(playerName);
    if (fromDefenseName) return canonicalTeamAbbr(fromDefenseName);
  }

  return canonicalTeamAbbr(fromTeamField);
}

/**
 * Team label for UI (cards, rankings): abbreviation when known (e.g. D/ST → ARI from name),
 * otherwise `FA` or `Free Agent`.
 */
export function displayTeamAbbrevOrFa(
  team: string | null | undefined,
  position: string | null | undefined,
  playerName: string | null | undefined,
  opts?: { faLabel?: 'FA' | 'Free Agent' }
): string {
  const abbr = resolveTeamAbbrForDisplay(team, position, playerName);
  const faLabel = opts?.faLabel ?? 'FA';
  if (!abbr || abbr === 'FA') return faLabel;
  return abbr;
}

/** Full club name for player cards; `null` for defenses; `Free Agent` when no team. */
export function displayPlayerCardTeamName(
  team: string | null | undefined,
  position: string | null | undefined,
  playerName: string | null | undefined
): string | null {
  if (isDefensePosition(position)) return null;
  const abbr = resolveTeamAbbrForDisplay(team, position, playerName);
  if (!abbr || abbr === 'FA') return 'Free Agent';
  return getFullTeamName(abbr) ?? abbr;
}
