/** Seasons the player popup and Player Stats table can show. */
export const PLAYER_STATS_SEASONS = [2026, 2025] as const;

export type PlayerStatsSeason = (typeof PLAYER_STATS_SEASONS)[number];

/** In-progress season. 2025 stays available as the prior year. */
export const DEFAULT_PLAYER_STATS_SEASON: PlayerStatsSeason = 2026;

export function weeklyStatsTableForSeason(season: PlayerStatsSeason): string {
  return season === 2026 ? 'weekly_stats_2026' : 'weekly_stats_2025';
}

export function teamStatsTableForSeason(season: PlayerStatsSeason): string {
  return season === 2026 ? 'team_stats_2026' : 'team_stats_2025';
}

export function gamesTableForSeason(season: PlayerStatsSeason): string {
  return season === 2026 ? 'games_2026' : 'games_2025';
}
