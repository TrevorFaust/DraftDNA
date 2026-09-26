export const PICKEM_SEASON = 2026;
export const PICKEM_WEEKS = 18;

/**
 * Season Predictions lock: start of Sep 12, 2026 Eastern
 * (end of the Sep 11 grace day after early-season games).
 */
export const SEASON_PREDICTIONS_LOCK_AT = new Date('2026-09-12T00:00:00-04:00');

export function isSeasonPredictionsLocked(now: Date = new Date()): boolean {
  return now.getTime() >= SEASON_PREDICTIONS_LOCK_AT.getTime();
}

/** Real team numbers when you have them. Missing teams use a stable 0–99 placeholder. */
export const PICKEM_TEAM_JERSEY_NUMBERS: Partial<Record<string, number>> = {};

export function formatPickemRecord(wins: number, losses: number, pushes: number): string {
  if (pushes > 0) return `${wins}-${losses}-${pushes}`;
  return `${wins}-${losses}`;
}

export function pickemRecordFromGames(
  games: Array<{
    my_pick: string | null;
    winner_abbr: string | null;
    status: string;
    home_score: number | null;
    away_score: number | null;
  }>
): { wins: number; losses: number; pushes: number } {
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  for (const game of games) {
    if (!game.my_pick || game.status !== 'final') continue;
    if (game.winner_abbr) {
      if (game.my_pick === game.winner_abbr) wins += 1;
      else losses += 1;
      continue;
    }
    if (game.home_score != null && game.away_score != null && game.home_score === game.away_score) {
      pushes += 1;
    }
  }
  return { wins, losses, pushes };
}

export function pickemJerseyNumber(abbr: string): number {
  const key = abbr.trim().toUpperCase();
  const assigned = PICKEM_TEAM_JERSEY_NUMBERS[key];
  if (assigned != null && assigned >= 0 && assigned <= 99) return assigned;

  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 100;
}

