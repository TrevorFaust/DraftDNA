/**
 * Chaos archetype detection from draft picks.
 * Age-based (Old Boys Club, Time Traveler, Retirement Watch) and Hometown Hero use optional age/team.
 */

import { CHAOS_ARCHETYPES } from '@/constants/chaosArchetypes';
import { getDivisionForTeam } from '@/constants/nflDivisions';

export interface ChaosPick {
  round_number: number;
  pick_number: number;
  position: string;
  rank: number;
  adp: number;
  team?: string | null;
  name?: string | null;
  /** Age from birth_date (players_info / nfl_players_historical); required for Old Boys Club, Time Traveler, Retirement Watch. */
  age?: number | null;
}

export interface ChaosDetectionConfig {
  totalRounds: number;
  leagueSize: number;
  isSuperflex: boolean;
}

function pos(p: ChaosPick): string {
  return (p.position || '').toUpperCase();
}

function isK(p: ChaosPick): boolean {
  return pos(p) === 'K';
}

function isDst(p: ChaosPick): boolean {
  return pos(p) === 'D/ST' || pos(p) === 'DST';
}

function isQb(p: ChaosPick): boolean {
  return pos(p) === 'QB';
}

function isRb(p: ChaosPick): boolean {
  return pos(p) === 'RB';
}

function isWr(p: ChaosPick): boolean {
  return pos(p) === 'WR';
}

function isTe(p: ChaosPick): boolean {
  return pos(p) === 'TE';
}

/** Expected round from ADP: ceil(adp / num_teams). */
function expectedRound(adp: number, numTeams: number): number {
  return Math.min(Math.max(1, Math.ceil(adp / numTeams)), 20);
}

/** Last name for alphabetical: last token of name. */
function lastName(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return '';
  const t = name.trim().split(/\s+/);
  return t.length > 0 ? t[t.length - 1].toLowerCase() : '';
}

/** Team tag for team-based chaos rules; ignores free agents/empty tags. */
function teamTag(p: ChaosPick): string | null {
  const raw = (p.team || '').trim();
  if (!raw) return null;
  if (raw.toUpperCase() === 'FA') return null;
  return raw;
}

/** Check if a single chaos trigger fires. Returns chaos name or null. */
function checkTrigger(chaosName: string, picks: ChaosPick[], config: ChaosDetectionConfig, sorted: ChaosPick[]): boolean {
  const { totalRounds, leagueSize, isSuperflex } = config;
  const numTeams = leagueSize || 12;

  switch (chaosName) {
    case 'The Special Teams Stan':
      return sorted.some((p) => isDst(p) && p.round_number <= 5);
    case 'The Kicker Truther':
      return sorted.some((p) => isK(p) && p.round_number < 8);
    case 'The Double Dipper':
      return sorted.filter(isK).length >= 2;
    case 'The DST Hoarder':
      return sorted.filter(isDst).length >= 4;
    case 'The Ostrich':
      const qbPicks = sorted.filter(isQb);
      return qbPicks.length === 1 && qbPicks[0].round_number >= totalRounds;
    case 'The Opening Kickoff': {
      const specialIn15 = sorted.filter((p) => (isDst(p) || isK(p)) && p.round_number <= 5);
      const earlyDst = specialIn15.some((s) => isDst(s));
      const earlyK = specialIn15.some((s) => isK(s));
      const laterSame = sorted.filter((p) => {
        if (!isDst(p) && !isK(p)) return false;
        if (p.round_number <= 5) return false;
        return (isDst(p) && earlyDst) || (isK(p) && earlyK);
      });
      return specialIn15.length >= 1 && laterSame.length >= 1;
    }
    case 'The Special Teams First Ballot':
      return sorted.some((p) => isK(p) && p.round_number <= 6) && sorted.some((p) => isDst(p) && p.round_number <= 6);
    case 'The One Trick Pony': {
      const teamCounts = new Map<string, number>();
      for (const p of sorted) {
        const t = teamTag(p);
        if (!t) continue;
        teamCounts.set(t, (teamCounts.get(t) ?? 0) + 1);
      }
      return Math.max(...teamCounts.values(), 0) >= 7;
    }
    case 'The Homer': {
      const teamCounts = new Map<string, number>();
      for (const p of sorted) {
        const t = teamTag(p);
        if (!t) continue;
        teamCounts.set(t, (teamCounts.get(t) ?? 0) + 1);
      }
      const maxSame = Math.max(...teamCounts.values(), 0);
      return maxSame >= 5 && maxSame <= 6;
    }
    case 'The Fantasy Hipster':
      return !sorted.some((p) => p.adp <= 30);
    case 'The Anti-ADP':
      return sorted.every((p) => p.round_number >= expectedRound(p.adp, numTeams) + 2);
    case 'The RB Apocalypse':
      return sorted.filter(isRb).length >= 8;
    case 'The Air Show':
      return sorted.filter(isWr).length >= 8;
    case 'The Quarterback Factory':
      const qbCount = sorted.filter(isQb).length;
      return isSuperflex ? qbCount >= 6 : qbCount >= 3;
    case 'The TE Convention':
      return sorted.filter(isTe).length >= 3;
    case 'The Zero Position':
      return (['QB', 'RB', 'WR', 'TE'] as const).some((posKey) => {
        const first = sorted.find((p) => pos(p) === posKey);
        return first != null && first.round_number >= 13;
      });
    case 'The Panic Button':
      return sorted.filter((p) => (expectedRound(p.adp, numTeams) - p.round_number) >= 2.5).length >= 5;
    case 'The Alphabetical': {
      const names = sorted.map((p) => lastName(p.name));
      if (names.length <= 1) return true;
      let inOrder = 0;
      for (let i = 1; i < names.length; i++) {
        if (names[i] >= names[i - 1]) inOrder++;
      }
      return inOrder / (names.length - 1) >= 0.8;
    }
    case 'The Old Boys Club': {
      const withAge = sorted.filter((p) => typeof p.age === 'number' && p.age >= 0);
      return withAge.filter((p) => p.age! >= 30).length >= 5;
    }
    case 'The Time Traveler': {
      const withAge = sorted.filter((p) => typeof p.age === 'number' && p.age >= 0);
      if (withAge.length === 0) return false;
      const aged31Plus = withAge.filter((p) => p.age! >= 31).length;
      return aged31Plus / withAge.length >= 0.45;
    }
    case 'The Retirement Watch': {
      const withAge = sorted.filter((p) => typeof p.age === 'number' && p.age >= 0);
      return withAge.filter((p) => p.age! >= 34).length >= 3;
    }
    case 'The Hometown Hero': {
      const byDivision = new Map<string, number>();
      let picksWithTeam = 0;
      for (const p of sorted) {
        const t = teamTag(p);
        if (!t) continue;
        picksWithTeam += 1;
        const div = getDivisionForTeam(t);
        if (div) byDivision.set(div, (byDivision.get(div) ?? 0) + 1);
      }
      if (picksWithTeam === 0) return false;
      const maxInOneDivision = Math.max(...byDivision.values(), 0);
      return maxInOneDivision / picksWithTeam >= 0.75;
    }
    default:
      return false;
  }
}

/**
 * Detect which chaos archetype (if any) fires for this team's picks.
 * Trigger order is fixed (One Trick Pony before Homer). Among those that fire, prefer unearned.
 */
export function detectChaosArchetype(
  picks: ChaosPick[],
  config: ChaosDetectionConfig,
  earnedChaosNames?: Set<string>
): string | null {
  if (picks.length === 0) return null;
  const sorted = [...picks].sort((a, b) => a.pick_number - b.pick_number);

  const fired: string[] = [];
  for (const chaos of CHAOS_ARCHETYPES) {
    if (checkTrigger(chaos.name, picks, config, sorted)) fired.push(chaos.name);
  }
  if (fired.length === 0) return null;
  if (earnedChaosNames?.size) {
    const unearned = fired.filter((n) => !earnedChaosNames.has(n));
    if (unearned.length > 0) return unearned[0];
  }
  return fired[0];
}

/**
 * For Special Teams First Ballot: flavor uses "before round R+1" where R = max(round of first K, round of first DST).
 */
export function getSpecialTeamsFirstBallotRound(picks: ChaosPick[]): number | null {
  const sorted = [...picks].sort((a, b) => a.pick_number - b.pick_number);
  let rK: number | null = null;
  let rDst: number | null = null;
  for (const p of sorted) {
    if (isK(p) && rK == null) rK = p.round_number;
    if (isDst(p) && rDst == null) rDst = p.round_number;
  }
  if (rK == null || rDst == null) return null;
  return Math.max(rK, rDst);
}
