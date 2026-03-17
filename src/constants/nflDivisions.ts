/**
 * NFL division mapping for chaos archetype detection (e.g. Hometown Hero).
 * Team key: use players.team (abbreviation or full name) — normalize when looking up.
 */

export const NFL_DIVISIONS: Record<string, string> = {
  // AFC East
  BUF: 'AFC East',
  'Buffalo Bills': 'AFC East',
  MIA: 'AFC East',
  'Miami Dolphins': 'AFC East',
  NE: 'AFC East',
  'New England Patriots': 'AFC East',
  NYJ: 'AFC East',
  'New York Jets': 'AFC East',
  // AFC North
  BAL: 'AFC North',
  'Baltimore Ravens': 'AFC North',
  CIN: 'AFC North',
  'Cincinnati Bengals': 'AFC North',
  CLE: 'AFC North',
  'Cleveland Browns': 'AFC North',
  PIT: 'AFC North',
  'Pittsburgh Steelers': 'AFC North',
  // AFC South
  HOU: 'AFC South',
  'Houston Texans': 'AFC South',
  IND: 'AFC South',
  'Indianapolis Colts': 'AFC South',
  JAX: 'AFC South',
  'Jacksonville Jaguars': 'AFC South',
  TEN: 'AFC South',
  'Tennessee Titans': 'AFC South',
  // AFC West
  DEN: 'AFC West',
  'Denver Broncos': 'AFC West',
  KC: 'AFC West',
  'Kansas City Chiefs': 'AFC West',
  LV: 'AFC West',
  'Las Vegas Raiders': 'AFC West',
  LAC: 'AFC West',
  'Los Angeles Chargers': 'AFC West',
  // NFC East
  DAL: 'NFC East',
  'Dallas Cowboys': 'NFC East',
  NYG: 'NFC East',
  'New York Giants': 'NFC East',
  PHI: 'NFC East',
  'Philadelphia Eagles': 'NFC East',
  WAS: 'NFC East',
  'Washington Commanders': 'NFC East',
  // NFC North
  CHI: 'NFC North',
  'Chicago Bears': 'NFC North',
  DET: 'NFC North',
  'Detroit Lions': 'NFC North',
  GB: 'NFC North',
  'Green Bay Packers': 'NFC North',
  MIN: 'NFC North',
  'Minnesota Vikings': 'NFC North',
  // NFC South
  ATL: 'NFC South',
  'Atlanta Falcons': 'NFC South',
  CAR: 'NFC South',
  'Carolina Panthers': 'NFC South',
  NO: 'NFC South',
  'New Orleans Saints': 'NFC South',
  TB: 'NFC South',
  'Tampa Bay Buccaneers': 'NFC South',
  // NFC West
  ARI: 'NFC West',
  'Arizona Cardinals': 'NFC West',
  LAR: 'NFC West',
  'Los Angeles Rams': 'NFC West',
  SF: 'NFC West',
  'San Francisco 49ers': 'NFC West',
  SEA: 'NFC West',
  'Seattle Seahawks': 'NFC West',
};

/** Get division for a team string (abbrev or full name). Returns undefined if unknown. */
export function getDivisionForTeam(team: string | null | undefined): string | undefined {
  if (team == null || team === '') return undefined;
  const key = team.trim();
  return NFL_DIVISIONS[key] ?? NFL_DIVISIONS[key.toUpperCase()];
}
