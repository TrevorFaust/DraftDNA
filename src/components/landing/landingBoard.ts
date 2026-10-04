export type LandingPos = 'QB' | 'RB' | 'WR' | 'TE';

export type LandingPlayer = { rank: number; name: string; pos: LandingPos; team: string };

/** Top-of-board consensus order used by the landing page animations. */
export const LANDING_BOARD: LandingPlayer[] = [
  { rank: 1, name: 'Jahmyr Gibbs', pos: 'RB', team: 'DET' },
  { rank: 2, name: 'Bijan Robinson', pos: 'RB', team: 'ATL' },
  { rank: 3, name: "Ja'Marr Chase", pos: 'WR', team: 'CIN' },
  { rank: 4, name: 'Puka Nacua', pos: 'WR', team: 'LAR' },
  { rank: 5, name: 'Jaxon Smith-Njigba', pos: 'WR', team: 'SEA' },
  { rank: 7, name: 'Jonathan Taylor', pos: 'RB', team: 'IND' },
  { rank: 8, name: 'James Cook III', pos: 'RB', team: 'BUF' },
  { rank: 9, name: 'Christian McCaffrey', pos: 'RB', team: 'SF' },
  { rank: 10, name: 'CeeDee Lamb', pos: 'WR', team: 'DAL' },
  { rank: 11, name: 'A.J. Brown', pos: 'WR', team: 'NE' },
  { rank: 12, name: 'Justin Jefferson', pos: 'WR', team: 'MIN' },
  { rank: 13, name: 'Nico Collins', pos: 'WR', team: 'HOU' },
  { rank: 14, name: 'Saquon Barkley', pos: 'RB', team: 'PHI' },
  { rank: 15, name: 'Derrick Henry', pos: 'RB', team: 'BAL' },
  { rank: 16, name: 'Drake London', pos: 'WR', team: 'ATL' },
  { rank: 17, name: 'Chase Brown', pos: 'RB', team: 'CIN' },
  { rank: 18, name: 'George Pickens', pos: 'WR', team: 'DAL' },
  { rank: 19, name: 'Kenneth Walker III', pos: 'RB', team: 'KC' },
  { rank: 20, name: 'Trey McBride', pos: 'TE', team: 'ARI' },
  { rank: 21, name: 'Omarion Hampton', pos: 'RB', team: 'LAC' },
  { rank: 22, name: "De'Von Achane", pos: 'RB', team: 'MIA' },
  { rank: 23, name: 'Chris Olave', pos: 'WR', team: 'NO' },
  { rank: 24, name: 'Josh Allen', pos: 'QB', team: 'BUF' },
  { rank: 25, name: 'Malik Nabers', pos: 'WR', team: 'NYG' },
  { rank: 26, name: 'Ashton Jeanty', pos: 'RB', team: 'LV' },
  { rank: 27, name: 'DeVonta Smith', pos: 'WR', team: 'PHI' },
  { rank: 28, name: 'Zay Flowers', pos: 'WR', team: 'BAL' },
  { rank: 29, name: 'Lamar Jackson', pos: 'QB', team: 'BAL' },
  { rank: 30, name: 'Colston Loveland', pos: 'TE', team: 'CHI' },
  { rank: 31, name: 'Javonte Williams', pos: 'RB', team: 'DAL' },
  { rank: 32, name: 'Kyren Williams', pos: 'RB', team: 'LAR' },
  { rank: 33, name: 'Brock Bowers', pos: 'TE', team: 'LV' },
  { rank: 34, name: 'Tee Higgins', pos: 'WR', team: 'CIN' },
  { rank: 35, name: 'Drake Maye', pos: 'QB', team: 'NE' },
  { rank: 36, name: 'Rashee Rice', pos: 'WR', team: 'KC' },
  { rank: 37, name: 'Emeka Egbuka', pos: 'WR', team: 'TB' },
  { rank: 38, name: 'Breece Hall', pos: 'RB', team: 'NYJ' },
  { rank: 39, name: 'Tetairoa McMillan', pos: 'WR', team: 'CAR' },
  { rank: 40, name: 'Jaylen Waddle', pos: 'WR', team: 'DEN' },
  { rank: 41, name: 'Ladd McConkey', pos: 'WR', team: 'LAC' },
  { rank: 42, name: 'Joe Burrow', pos: 'QB', team: 'CIN' },
  { rank: 43, name: 'Travis Etienne Jr.', pos: 'RB', team: 'NO' },
  { rank: 44, name: 'Jeremiyah Love', pos: 'RB', team: 'ARI' },
  { rank: 45, name: "D'Andre Swift", pos: 'RB', team: 'CHI' },
  { rank: 46, name: 'Jameson Williams', pos: 'WR', team: 'DET' },
  { rank: 47, name: 'Davante Adams', pos: 'WR', team: 'LAR' },
  { rank: 48, name: 'Garrett Wilson', pos: 'WR', team: 'NYJ' },
  { rank: 49, name: 'Christian Watson', pos: 'WR', team: 'GB' },
  { rank: 50, name: 'Bucky Irving', pos: 'RB', team: 'TB' },
  { rank: 51, name: 'Terry McLaurin', pos: 'WR', team: 'WAS' },
  { rank: 52, name: 'Jalen Hurts', pos: 'QB', team: 'PHI' },
  { rank: 53, name: 'David Montgomery', pos: 'RB', team: 'HOU' },
  { rank: 54, name: 'Luther Burden III', pos: 'WR', team: 'CHI' },
  { rank: 55, name: 'Quinshon Judkins', pos: 'RB', team: 'CLE' },
  { rank: 56, name: 'Cam Skattebo', pos: 'RB', team: 'NYG' },
  { rank: 57, name: 'DJ Moore', pos: 'WR', team: 'BUF' },
  { rank: 58, name: 'Tyler Warren', pos: 'TE', team: 'IND' },
  { rank: 59, name: 'Jayden Daniels', pos: 'QB', team: 'WAS' },
];

/** Consecutive ranks from the top of the board, used by the rankings shuffle. */
export function landingBoardSlice(firstRank: number, count: number): LandingPlayer[] {
  const start = LANDING_BOARD.findIndex((player) => player.rank >= firstRank);
  return LANDING_BOARD.slice(start, start + count);
}

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Zero-based overall pick → "1.01" style label for a given league size. */
export function pickLabel(overall: number, teams: number) {
  const round = Math.floor(overall / teams) + 1;
  const slot = (overall % teams) + 1;
  return `${round}.${String(slot).padStart(2, '0')}`;
}
