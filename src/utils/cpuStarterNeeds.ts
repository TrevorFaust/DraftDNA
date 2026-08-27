/**
 * Scale CPU pick scores to the league's starting lineup.
 * Missing starter holes pull value up; filled / unused positions drop off.
 */

import type { RankedPlayer } from '@/types/database';
import {
  DEFAULT_STARTERS,
  STARTER_POSITION_ORDER,
  normalizeRosterPos,
  starterNeedsFromCounts,
  type StarterCounts,
  type StarterPosition,
} from '@/utils/rosterSlots';

export type ScoredPlayer = { player: RankedPlayer; adjustedScore: number };

function normalizePos(pos: string | null | undefined): string {
  return normalizeRosterPos(pos);
}

export function countTeamPositions(players: RankedPlayer[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of players) {
    const pos = normalizePos(p.position);
    counts[pos] = (counts[pos] ?? 0) + 1;
  }
  return counts;
}

function isStarterPos(pos: string): pos is StarterPosition {
  return (STARTER_POSITION_ORDER as string[]).includes(pos);
}

/**
 * Soft position-group value vs a standard 1QB/2RB/2WR/1TE league.
 * Not PPG tables — relative scarcity of fantasy-relevant starters.
 */
function groupBaseline(pos: StarterPosition, starters: StarterCounts): number {
  switch (pos) {
    case 'WR':
      return starters.WR >= 3 ? 1.12 : 1.06;
    case 'RB':
      return starters.RB >= 3 ? 1.1 : starters.RB <= 1 ? 0.96 : 1.0;
    case 'QB':
      if (starters.QB >= 2) return 1.28;
      if (starters.QB === 0) return 0.12;
      return 0.92;
    case 'TE':
      if (starters.TE >= 2) return 1.15;
      if (starters.TE === 0) return 0.1;
      return 0.82;
    case 'DEF':
      return starters.DEF > 0 ? 0.55 : 0.08;
    case 'K':
      return starters.K > 0 ? 0.5 : 0.08;
    default:
      return 1;
  }
}

export type StarterNeedScoreOpts = {
  starters?: StarterCounts | null;
  teamCounts: Record<string, number>;
  flexSlots: number;
  roundNumber: number;
  numRounds: number;
  numTeams: number;
  rosterSize: number;
  isSuperflex?: boolean;
};

/**
 * Multiply CPU scores so bots chase unfilled starter holes and ignore dead positions.
 * Flex is not a forced second RB — leftover flex is filled by best remaining skill ADP.
 */
export function applyStarterLineupNeedToScores(
  scored: ScoredPlayer[],
  opts: StarterNeedScoreOpts
): ScoredPlayer[] {
  if (scored.length === 0) return scored;

  const starters = opts.starters ?? DEFAULT_STARTERS;
  const remaining = Math.max(0, opts.numRounds - opts.rosterSize);
  const needed = starterNeedsFromCounts(opts.teamCounts, starters);
  const lateForce = needed.length > 0 && remaining <= needed.length;
  const lateish = remaining <= needed.length + 2 && needed.length > 0;
  const draftPct = opts.numRounds > 0 ? opts.roundNumber / opts.numRounds : 0;

  const dedicatedFilledSkill =
    (opts.teamCounts.RB ?? 0) >= starters.RB &&
    (opts.teamCounts.WR ?? 0) >= starters.WR &&
    (opts.teamCounts.TE ?? 0) >= starters.TE;
  const flexEligibleHave =
    Math.max(0, (opts.teamCounts.RB ?? 0) - starters.RB) +
    Math.max(0, (opts.teamCounts.WR ?? 0) - starters.WR) +
    Math.max(0, (opts.teamCounts.TE ?? 0) - starters.TE) +
    (opts.isSuperflex ? Math.max(0, (opts.teamCounts.QB ?? 0) - starters.QB) : 0);
  const flexHoles = Math.max(0, opts.flexSlots - flexEligibleHave);

  return scored.map((row) => {
    const pos = normalizePos(row.player.position);
    if (!isStarterPos(pos)) return row;

    const need = starters[pos];
    const have = opts.teamCounts[pos] ?? 0;
    const deficit = Math.max(0, need - have);
    const surplus = Math.max(0, have - need);
    let mult = groupBaseline(pos, starters);

    // Unused starter slot: stay out of the way until deep bench filler.
    if (need === 0) {
      if (draftPct < 0.75) mult *= 0.08;
      else mult *= 0.28;
      return { ...row, adjustedScore: row.adjustedScore * mult };
    }

    // Late rounds: only chase true starter holes.
    if (lateForce) {
      if (needed.includes(pos)) mult *= 1.4;
      else mult *= 0.06;
      return { ...row, adjustedScore: row.adjustedScore * mult };
    }
    if (lateish && needed.includes(pos)) {
      mult *= 1.22;
    }

    if (deficit > 0) {
      const urgency = Math.min(1.35, 1.05 + deficit * 0.12);
      mult *= urgency;

      // Multi-QB / multi-TE leagues: pull those positions into earlier windows.
      if (pos === 'QB' && need >= 2 && opts.roundNumber <= Math.ceil(opts.numRounds * 0.55)) {
        mult *= 1.18 + Math.min(0.2, (need - 1) * 0.1);
      }
      if (pos === 'TE' && need >= 2 && opts.roundNumber <= Math.ceil(opts.numRounds * 0.5)) {
        mult *= 1.12;
      }
      if (pos === 'WR' && need >= 3 && deficit >= 1 && opts.roundNumber <= Math.ceil(opts.numRounds * 0.55)) {
        mult *= 1.08;
      }

      // Empty required hole mid-draft: stronger pull for starter-tier ADP.
      const starterTier = row.player.rank <= opts.numTeams * (need >= 2 && pos === 'QB' ? 5 : 7);
      if (have === 0 && opts.roundNumber >= 3 && starterTier) {
        mult *= pos === 'QB' && need >= 2 ? 1.2 : 1.12;
      }
    } else if (surplus >= 1) {
      // Starter filled — do not chase a second RB in a 1-RB league, etc.
      if (opts.roundNumber <= Math.ceil(opts.numRounds * 0.55)) {
        mult *= pos === 'WR' ? 0.78 : 0.58;
      } else {
        mult *= pos === 'WR' ? 0.9 : 0.72;
      }

      // Mild flex interest only after dedicated skill starters are filled.
      const flexEligible =
        pos === 'RB' ||
        pos === 'WR' ||
        pos === 'TE' ||
        (opts.isSuperflex && pos === 'QB');
      if (flexHoles > 0 && dedicatedFilledSkill && flexEligible) {
        mult *= 1.08;
      }
    }

    // DEF/K: keep late unless still missing a required starter and rounds are short.
    if ((pos === 'DEF' || pos === 'K') && deficit > 0 && remaining > 3) {
      mult *= 0.45;
    }

    return { ...row, adjustedScore: row.adjustedScore * mult };
  });
}

/** Filter / gate early TE-QB based on whether the league starts them. */
export function applyStarterAwarePoolFilter(
  available: RankedPlayer[],
  opts: {
    starters?: StarterCounts | null;
    roundNumber: number;
    numRounds: number;
    teamCounts: Record<string, number>;
    rosterSize?: number;
  }
): RankedPlayer[] {
  if (available.length === 0) return available;
  const starters = opts.starters ?? DEFAULT_STARTERS;
  const draftPct = opts.numRounds > 0 ? opts.roundNumber / opts.numRounds : 0;
  const rosterSize =
    opts.rosterSize ??
    Object.values(opts.teamCounts).reduce((sum, n) => sum + n, 0);
  const remaining = Math.max(0, opts.numRounds - rosterSize);
  const needed = starterNeedsFromCounts(opts.teamCounts, starters);
  const lateForce = needed.length > 0 && remaining <= needed.length;

  return available.filter((p) => {
    const pos = normalizePos(p.position);
    if (lateForce) {
      return needed.includes(pos);
    }
    if (!isStarterPos(pos)) return true;
    const need = starters[pos];

    if (need === 0) {
      // Allow unused positions only as deep bench fluff.
      return draftPct >= 0.8;
    }

    // Don't stack a position once starters are filled until the back half.
    const have = opts.teamCounts[pos] ?? 0;
    if (have >= need && draftPct < 0.45 && (pos === 'TE' || pos === 'QB')) {
      return false;
    }

    return true;
  });
}
