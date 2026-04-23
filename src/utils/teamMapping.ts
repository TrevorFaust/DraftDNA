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
 * Normalize `players.team` to an abbreviation for lookups in `teams` / color maps.
 * Accepts abbreviations (DAL, LAR, …) or full names (e.g. Dallas Cowboys for D/ST).
 */
export function teamFieldToAbbr(team: string | null | undefined): string | null {
  if (!team?.trim()) return null;
  const t = team.trim();
  const upper = t.toUpperCase();
  if (/^[A-Z]{2,4}$/.test(upper)) return upper;
  return FULL_NAME_TO_ABBREV[t.toLowerCase()] ?? null;
}

/** Normalize alternate abbreviations so stats rows and player rows match (e.g. `WSH` → `WAS`). */
export function canonicalTeamAbbr(abbr: string | null | undefined): string | null {
  if (!abbr?.trim()) return null;
  const u = abbr.trim().toUpperCase();
  if (u === 'WSH') return 'WAS';
  if (u === 'LA') return 'LAR';
  return u;
}

function isDefensePosition(position: string | null | undefined): boolean {
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
