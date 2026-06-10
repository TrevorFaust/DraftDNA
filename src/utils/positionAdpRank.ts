import { getFullTeamName } from '@/utils/teamMapping';
import { isDefenseLikePosition } from '@/utils/pickSixScoring';

const SKILL_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);

export function normalizePositionForAdpLabel(position: string): string {
  const p = position.trim().toUpperCase();
  if (p === 'DEF' || p === 'DST') return 'D/ST';
  return p;
}

/** Whether this position shows a Pos ADP / positional rank label on player UI. */
export function showsPositionalAdpRank(position: string): boolean {
  const pos = normalizePositionForAdpLabel(position);
  return SKILL_POSITIONS.has(pos) || isDefenseLikePosition(pos);
}

/** Overall ADP order within position (1 = earliest ADP at that position). */
export function buildPositionAdpRankMap(
  players: { id: string; position: string; adp?: number | null }[]
): Map<string, number> {
  const byPos = new Map<string, { id: string; adp: number }[]>();
  for (const p of players) {
    const pos = p.position?.trim().toUpperCase() ?? '';
    if (!SKILL_POSITIONS.has(pos)) continue;
    const list = byPos.get(pos) ?? [];
    list.push({ id: p.id, adp: Number(p.adp) || 9999 });
    byPos.set(pos, list);
  }
  const out = new Map<string, number>();
  for (const list of byPos.values()) {
    list.sort((a, b) => a.adp - b.adp);
    list.forEach((p, i) => out.set(p.id, i + 1));
  }
  return out;
}

/**
 * Defense rank by order in a rankings list (`rank` 1 = top of list).
 */
export function buildDefenseRankFromList(
  players: { id: string; position: string; rank: number }[]
): Map<string, number> {
  const sorted = [...players].sort((a, b) => a.rank - b.rank);
  let defCount = 0;
  const out = new Map<string, number>();
  for (const p of sorted) {
    if (!isDefenseLikePosition(p.position)) continue;
    defCount += 1;
    out.set(p.id, defCount);
  }
  return out;
}

/** Pos ADP from ADP sort (skill) or rankings-list order (defense). */
export function resolvePositionAdpRankForDisplay(
  player: { id: string; position: string },
  adpRankMap: Map<string, number>,
  defenseListRankMap: Map<string, number>
): number | null {
  if (isDefenseLikePosition(player.position)) {
    return defenseListRankMap.get(player.id) ?? null;
  }
  if (SKILL_POSITIONS.has(normalizePositionForAdpLabel(player.position))) {
    return adpRankMap.get(player.id) ?? null;
  }
  return null;
}

/** Role only, e.g. `RB1`. */
export function formatTeamDepthRoleLabel(position: string, depthRank: number): string {
  const pos = position.trim().toUpperCase();
  return `${pos}${depthRank}`;
}

/** Inline depth tag with team, e.g. `DET: RB1`. */
export function formatTeamDepthSlotLabel(
  teamAbbr: string,
  position: string,
  depthRank: number
): string {
  const team = teamAbbr.trim().toUpperCase();
  return `${team}: ${formatTeamDepthRoleLabel(position, depthRank)}`;
}

/** Tooltip for team depth role on the 2026 chart, e.g. `RB1 on 2026 Lions depth chart`. */
export function teamDepthChartTooltip(
  position: string,
  depthRank: number,
  teamNickname: string
): string {
  const role = formatTeamDepthRoleLabel(position, depthRank);
  return `${role} on 2026 ${teamNickname} depth chart`;
}

/** Positional ADP rank value, e.g. `WR12`. */
export function formatPositionalAdpRankLabel(position: string, rank: number): string {
  return formatTeamDepthRoleLabel(normalizePositionForAdpLabel(position), rank);
}

/** Tooltip for positional ADP rank (skill positions). */
export function positionalAdpTooltip(position: string, rank: number): string {
  return `${formatPositionalAdpRankLabel(position, rank)} by overall ADP at this position`;
}

/** Tooltip for positional rank from community rankings (e.g. defenses). */
export function positionalListRankTooltip(position: string, rank: number): string {
  return `${formatPositionalAdpRankLabel(position, rank)} in community rankings at this position`;
}

/** Last word of full team name for tooltip copy, e.g. Lions. */
export function nflTeamNicknameFromAbbr(teamAbbr: string): string {
  const full = getFullTeamName(teamAbbr.trim().toUpperCase());
  if (!full) return teamAbbr;
  const parts = full.split(/\s+/);
  return parts[parts.length - 1] ?? full;
}
