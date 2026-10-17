import { NFL_2026_KICKOFFS } from '@/constants/nfl2026Kickoffs.generated';
import { NFL_2026_RESULTS, type Nfl2026Result } from '@/constants/nfl2026Results.generated';
import { gamesForWeek, scheduleGameKey } from '@/constants/nfl2026ScheduleGrid';
import type { PickemGame } from '@/types/leagueSocial';

export function officialResult(week: number, away: string, home: string): Nfl2026Result | null {
  return NFL_2026_RESULTS[scheduleGameKey(week, away, home)] ?? null;
}

/** Every game that week has a final score, including ties. */
export function weekIsFinal(week: number): boolean {
  const games = gamesForWeek(week);
  return games.length > 0 && games.every((game) => officialResult(game.week, game.away, game.home) != null);
}

/** Keep the user's pick. Fill in the final score when we have one. */
export function applyOfficialScore(
  game: PickemGame | null,
  week: number,
  away: string,
  home: string
): PickemGame | null {
  const official = officialPickemGame(week, away, home);
  if (!official) return game;
  if (!game) return { ...official, my_pick: null };
  return {
    ...game,
    status: 'final',
    home_score: official.home_score,
    away_score: official.away_score,
    winner_abbr: official.winner_abbr,
    locked: true,
  };
}

export function officialPickemGame(week: number, away: string, home: string): PickemGame | null {
  const result = officialResult(week, away, home);
  if (!result) return null;
  const key = scheduleGameKey(week, away, home);
  return {
    id: key,
    espn_event_id: key,
    kickoff_at: NFL_2026_KICKOFFS[scheduleGameKey(week, away, home)] ?? '',
    status: 'final',
    home_abbr: result.home,
    away_abbr: result.away,
    home_name: null,
    away_name: null,
    home_score: result.homeScore,
    away_score: result.awayScore,
    winner_abbr: result.winner,
    locked: true,
    my_pick: result.winner,
    seed_pick: null,
    member_picks: [],
  };
}
