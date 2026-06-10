import { canonicalTeamAbbr, resolveTeamAbbrForDisplay } from '@/utils/teamMapping';

export const PICK_SIX_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'D/ST'] as const;
export type PickSixPosition = (typeof PICK_SIX_POSITIONS)[number];

export function isPickSixPosition(value: string): value is PickSixPosition {
  return (PICK_SIX_POSITIONS as readonly string[]).includes(value);
}

/** e.g. "QBs", "defenses" — for "Current top 6 …" column headers */
export function pickSixPositionGroupLabel(position: PickSixPosition): string {
  switch (position) {
    case 'QB':
      return 'QBs';
    case 'RB':
      return 'RBs';
    case 'WR':
      return 'WRs';
    case 'TE':
      return 'TEs';
    case 'K':
      return 'kickers';
    case 'D/ST':
      return 'defenses';
    default:
      return position;
  }
}

export function pickSixCurrentTop6Heading(position: PickSixPosition): string {
  return `Current top 6 ${pickSixPositionGroupLabel(position)}`;
}

export function pickSixYourTop6Heading(position: PickSixPosition): string {
  return `Your top 6 ${pickSixPositionGroupLabel(position)}`;
}

export function pickSixTheirTop6Heading(position: PickSixPosition): string {
  return `Their top 6 ${pickSixPositionGroupLabel(position)}`;
}

/** e.g. "QB leaderboard", "D/ST leaderboard" */
export function pickSixLeaderboardHeading(position: PickSixPosition): string {
  return `${position} leaderboard`;
}

/** e.g. "8th overall" */
export function formatPickSixOverallRank(rank: number): string {
  const mod100 = rank % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? 'th'
      : rank % 10 === 1
        ? 'st'
        : rank % 10 === 2
          ? 'nd'
          : rank % 10 === 3
            ? 'rd'
            : 'th';
  return `${rank}${suffix} overall`;
}

export function isDefenseLikePosition(position: string | null | undefined): boolean {
  if (!position?.trim()) return false;
  const u = position.trim().toUpperCase();
  return u === 'D/ST' || u === 'DEF' || u === 'DST';
}

export function positionMatchesPickSix(
  playerPosition: string | null | undefined,
  pickSixPosition: PickSixPosition
): boolean {
  if (!playerPosition?.trim()) return false;
  const u = playerPosition.trim().toUpperCase();
  if (pickSixPosition === 'D/ST') return isDefenseLikePosition(u);
  return u === pickSixPosition;
}

type PlayerIdentityRow = {
  id: string;
  espn_id?: string | null;
  team?: string | null;
  position?: string | null;
  name?: string | null;
};

/** Stable key for matching picks across 2025/2026 player rows. */
export function pickSixPlayerIdentityKey(
  playerId: string,
  playersById: Map<string, PlayerIdentityRow>
): string {
  const row = playersById.get(playerId);
  if (row && isDefenseLikePosition(row.position)) {
    const abbr = resolveTeamAbbrForDisplay(row.team, row.position, row.name);
    if (abbr) return `dst:${canonicalTeamAbbr(abbr) ?? abbr}`;
  }
  const espn = row?.espn_id;
  return espn ? `espn:${String(espn)}` : `id:${playerId}`;
}

/** Partial-credit scoring from Pick Six rules (exact = 1, 1 off = ½, …). */
export function pickSixPointsForSlot(
  actualTop6Keys: string[],
  predictedPlayerId: string,
  predictedRank: number,
  playersById: Map<string, PlayerIdentityRow>
): number {
  const predictedKey = pickSixPlayerIdentityKey(predictedPlayerId, playersById);
  const idx = actualTop6Keys.indexOf(predictedKey);
  if (idx === -1) return 0;
  const actualRank = idx + 1;
  const offBy = Math.abs(actualRank - predictedRank);
  if (offBy === 0) return 1;
  if (offBy === 1) return 0.5;
  if (offBy === 2) return 1 / 3;
  if (offBy === 3) return 0.25;
  if (offBy === 4) return 0.2;
  if (offBy === 5) return 1 / 6;
  return 0;
}

export function scorePickSixPicks(
  actualTop6Keys: string[],
  picks: { rank: number; playerId: string }[],
  playersById: Map<string, PlayerIdentityRow>
): { score: number; exactMatches: number } {
  let score = 0;
  let exactMatches = 0;
  for (const pick of picks) {
    const pts = pickSixPointsForSlot(
      actualTop6Keys,
      pick.playerId,
      pick.rank,
      playersById
    );
    score += pts;
    const predictedKey = pickSixPlayerIdentityKey(pick.playerId, playersById);
    const idx = actualTop6Keys.indexOf(predictedKey);
    if (idx !== -1 && idx + 1 === pick.rank) exactMatches += 1;
  }
  return { score, exactMatches };
}

export function formatPickSixScore(score: number): string {
  const rounded = Math.round(score * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

export type PickSixSlotStatus =
  | { kind: 'exact'; actualRank: number; points: 1 }
  | { kind: 'in_top6'; actualRank: number; points: number }
  | { kind: 'miss'; points: 0 };

export function evaluatePickSixSlot(
  actualTop6Keys: string[],
  predictedPlayerId: string,
  predictedRank: number,
  playersById: Map<string, PlayerIdentityRow>
): PickSixSlotStatus {
  const points = pickSixPointsForSlot(
    actualTop6Keys,
    predictedPlayerId,
    predictedRank,
    playersById
  );
  const predictedKey = pickSixPlayerIdentityKey(predictedPlayerId, playersById);
  const idx = actualTop6Keys.indexOf(predictedKey);
  if (idx === -1) return { kind: 'miss', points: 0 };
  const actualRank = idx + 1;
  if (actualRank === predictedRank) return { kind: 'exact', actualRank, points: 1 };
  return { kind: 'in_top6', actualRank, points };
}

/** Human-readable partial credit for one slot (decimal). */
export function formatPickSixSlotPoints(points: number): string {
  return formatPickSixScore(points);
}
