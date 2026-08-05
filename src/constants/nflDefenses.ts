/**
 * All 32 NFL team names used for D/ST (defense/special teams).
 * Centralized so Rankings, DraftRoom, and other modules share one source.
 * The players table should have one row per team with position='D/ST'.
 * Alphabetical — use for membership / display lists, not fantasy rank order.
 */
export const NFL_DEFENSE_TEAM_NAMES: readonly string[] = [
  'Arizona Cardinals',
  'Atlanta Falcons',
  'Baltimore Ravens',
  'Buffalo Bills',
  'Carolina Panthers',
  'Chicago Bears',
  'Cincinnati Bengals',
  'Cleveland Browns',
  'Dallas Cowboys',
  'Denver Broncos',
  'Detroit Lions',
  'Green Bay Packers',
  'Houston Texans',
  'Indianapolis Colts',
  'Jacksonville Jaguars',
  'Kansas City Chiefs',
  'Las Vegas Raiders',
  'Los Angeles Chargers',
  'Los Angeles Rams',
  'Miami Dolphins',
  'Minnesota Vikings',
  'New England Patriots',
  'New Orleans Saints',
  'New York Giants',
  'New York Jets',
  'Philadelphia Eagles',
  'Pittsburgh Steelers',
  'San Francisco 49ers',
  'Seattle Seahawks',
  'Tampa Bay Buccaneers',
  'Tennessee Titans',
  'Washington Commanders',
];

/**
 * Fantasy D/ST rank order for baseline / ADP seeding (1 = best).
 * Keep `NFL_DEFENSE_TEAM_NAMES` alphabetical for set membership.
 */
export const NFL_DEFENSE_FANTASY_RANK_ORDER: readonly string[] = [
  'Houston Texans',
  'Denver Broncos',
  'Seattle Seahawks',
  'Los Angeles Rams',
  'Philadelphia Eagles',
  'Minnesota Vikings',
  'New England Patriots',
  'Jacksonville Jaguars',
  'Pittsburgh Steelers',
  'Los Angeles Chargers',
  'Baltimore Ravens',
  'Green Bay Packers',
  'Kansas City Chiefs',
  'Detroit Lions',
  'Buffalo Bills',
  'Cleveland Browns',
  'San Francisco 49ers',
  'Atlanta Falcons',
  'New Orleans Saints',
  'Indianapolis Colts',
  'Chicago Bears',
  'New York Giants',
  'Carolina Panthers',
  'Dallas Cowboys',
  'Tampa Bay Buccaneers',
  'Tennessee Titans',
  'Cincinnati Bengals',
  'Miami Dolphins',
  'Washington Commanders',
  'Las Vegas Raiders',
  'New York Jets',
  'Arizona Cardinals',
];

const DEFENSE_FANTASY_RANK_INDEX = new Map(
  NFL_DEFENSE_FANTASY_RANK_ORDER.map((name, index) => [name, index])
);

/** Sort comparator: lower fantasy rank first; unknown names last, then A–Z. */
export function compareDefensesByFantasyRank(
  aName: string | null | undefined,
  bName: string | null | undefined
): number {
  const ai = DEFENSE_FANTASY_RANK_INDEX.get(aName ?? '');
  const bi = DEFENSE_FANTASY_RANK_INDEX.get(bName ?? '');
  if (ai !== undefined && bi !== undefined) return ai - bi;
  if (ai !== undefined) return -1;
  if (bi !== undefined) return 1;
  return (aName ?? '').localeCompare(bName ?? '');
}
