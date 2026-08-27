import { NFL_2026_KICKOFFS } from '@/constants/nfl2026Kickoffs.generated';
import { getFullTeamName } from '@/utils/teamMapping';
import {
  canonScheduleAbbr,
  gamesForWeek,
  scheduleGameKey,
  type ScheduleGame,
} from '@/constants/nfl2026ScheduleGrid';
import type { PickemGame } from '@/types/leagueSocial';

export function teamNickname(abbr: string, fallbackName?: string | null): string {
  const full = fallbackName || getFullTeamName(abbr) || abbr;
  const twoWordCities = [
    'Los Angeles',
    'New York',
    'New England',
    'Tampa Bay',
    'Green Bay',
    'San Francisco',
    'Kansas City',
    'Las Vegas',
    'New Orleans',
  ];
  for (const city of twoWordCities) {
    if (full.startsWith(`${city} `)) return full.slice(city.length + 1);
  }
  const parts = full.split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : full;
}

export type WeekMatchup = {
  key: string;
  week: number;
  home: string;
  away: string;
  game: PickemGame | null;
  kickoffAt: string | null;
};

function isEspnLiveRow(game: PickemGame | null): boolean {
  return Boolean(game?.espn_event_id && !game.espn_event_id.startsWith('static-'));
}

export function officialKickoff(week: number, away: string, home: string): string | null {
  return NFL_2026_KICKOFFS[scheduleGameKey(week, away, home)] ?? null;
}

export function matchupsForWeek(week: number, boardGames: PickemGame[]): WeekMatchup[] {
  const byPair = new Map<string, PickemGame>();
  for (const game of boardGames) {
    const away = canonScheduleAbbr(game.away_abbr);
    const home = canonScheduleAbbr(game.home_abbr);
    byPair.set(`${away}@${home}`, game);
  }

  return gamesForWeek(week)
    .map((slot) => {
      const game = byPair.get(`${slot.away}@${slot.home}`) ?? null;
      const kickoffAt = isEspnLiveRow(game)
        ? game?.kickoff_at ?? officialKickoff(week, slot.away, slot.home)
        : officialKickoff(week, slot.away, slot.home) ?? game?.kickoff_at ?? null;
      return {
        key: scheduleGameKey(week, slot.away, slot.home),
        week,
        home: slot.home,
        away: slot.away,
        game,
        kickoffAt,
      };
    })
    .sort((a, b) => {
      // NFL week is Tuesday through Monday. CSS grid fills left-to-right, top-to-bottom.
      const timeA = a.kickoffAt ? Date.parse(a.kickoffAt) : Number.POSITIVE_INFINITY;
      const timeB = b.kickoffAt ? Date.parse(b.kickoffAt) : Number.POSITIVE_INFINITY;
      if (timeA !== timeB) return timeA - timeB;
      return a.away.localeCompare(b.away) || a.home.localeCompare(b.home);
    });
}

export function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });
}

export function isMatchupLocked(matchup: WeekMatchup): boolean {
  if (matchup.game && matchup.game.status !== 'scheduled') return true;
  if (isEspnLiveRow(matchup.game)) return Boolean(matchup.game?.locked);
  if (matchup.kickoffAt) return Date.parse(matchup.kickoffAt) <= Date.now();
  return Boolean(matchup.game?.locked);
}

export function savedPickFor(matchup: WeekMatchup): string | null {
  return matchup.game?.my_pick ?? null;
}

export function pickemSlotFromSchedule(slot: ScheduleGame): { away_abbr: string; home_abbr: string } {
  return { away_abbr: slot.away, home_abbr: slot.home };
}
