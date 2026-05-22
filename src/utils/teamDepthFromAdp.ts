/**
 * Infer NFL-team depth roles from ADP gaps (until explicit depth charts are loaded).
 * Early ADP gaps matter more than late — ADP 5 vs 25 is a tier break; 170 vs 190 is not.
 */

export type DepthRole = 'alpha' | 'starter' | 'competing' | 'depth' | 'dart';

export interface PlayerAdpOnTeam {
  pos: string;
  adp: number;
  nflTeam: string;
}

/** Scale raw ADP gap by where on the board the players sit. */
export function effectiveAdpGap(adpEarlier: number, adpLater: number): number {
  const mid = (adpEarlier + adpLater) / 2;
  const raw = adpLater - adpEarlier;
  if (mid < 50) return raw;
  if (mid < 100) return raw * 0.75;
  if (mid < 150) return raw * 0.5;
  return raw * 0.3;
}

const COMPETING_GAP = 14;
const DEPTH_GAP = 22;

function classifyReceiverGroup(sortedByAdp: PlayerAdpOnTeam[]): DepthRole[] {
  if (sortedByAdp.length === 0) return [];
  const roles: DepthRole[] = [];
  for (let i = 0; i < sortedByAdp.length; i++) {
    if (i === 0) {
      roles.push(sortedByAdp[0].adp <= 90 ? 'alpha' : 'starter');
      continue;
    }
    const gap = effectiveAdpGap(sortedByAdp[i - 1].adp, sortedByAdp[i].adp);
    const prev = roles[i - 1];
    if (gap >= DEPTH_GAP || sortedByAdp[i].adp > 155) {
      roles.push(sortedByAdp[i].adp > 200 ? 'dart' : 'depth');
    } else if (gap < COMPETING_GAP || prev === 'competing') {
      roles.push('competing');
    } else {
      roles.push('starter');
    }
  }
  return roles;
}

export interface TeamDepthAnalysis {
  byPlayerKey: Map<string, DepthRole>;
  notes: string[];
}

function playerKey(team: string, pos: string, adp: number): string {
  return `${team}|${pos}|${Math.round(adp)}`;
}

/**
 * Classify each skill player on a roster using team-grouped ADP (needs full player pool for team ranks).
 */
export function analyzeTeamDepthFromAdp(
  teamPlayers: PlayerAdpOnTeam[]
): TeamDepthAnalysis {
  const byPlayerKey = new Map<string, DepthRole>();
  const notes: string[] = [];
  const byTeam = new Map<string, PlayerAdpOnTeam[]>();

  for (const p of teamPlayers) {
    if (!p.nflTeam || p.nflTeam === 'FA') continue;
    const list = byTeam.get(p.nflTeam) ?? [];
    list.push(p);
    byTeam.set(p.nflTeam, list);
  }

  for (const [team, players] of byTeam) {
    const wrs = players.filter((p) => p.pos === 'WR').sort((a, b) => a.adp - b.adp);
    const rbs = players.filter((p) => p.pos === 'RB').sort((a, b) => a.adp - b.adp);
    const tes = players.filter((p) => p.pos === 'TE').sort((a, b) => a.adp - b.adp);

    const wrRoles = classifyReceiverGroup(wrs);
    wrs.forEach((p, i) => byPlayerKey.set(playerKey(team, 'WR', p.adp), wrRoles[i]));

    const rbRoles = classifyReceiverGroup(rbs);
    rbs.forEach((p, i) => byPlayerKey.set(playerKey(team, 'RB', p.adp), rbRoles[i]));

    const teRoles = classifyReceiverGroup(tes);
    tes.forEach((p, i) => byPlayerKey.set(playerKey(team, 'TE', p.adp), teRoles[i]));

    // Depth-chart notes are generated from the user's drafted players only (see draftGradeRosterQuality).
  }

  return { byPlayerKey, notes };
}

export function getDepthRole(
  analysis: TeamDepthAnalysis,
  nflTeam: string | null,
  pos: string,
  adp: number
): DepthRole | null {
  if (!nflTeam) return null;
  return analysis.byPlayerKey.get(playerKey(nflTeam, pos, adp)) ?? null;
}

/** Problematic: back-to-back picks that are both depth/dart pass-catchers on same team. */
export function isShallowSameTeamStack(
  a: { pos: string; adp: number; nflTeam: string | null },
  b: { pos: string; adp: number; nflTeam: string | null },
  analysis: TeamDepthAnalysis
): boolean {
  if (!a.nflTeam || a.nflTeam !== b.nflTeam) return false;
  if (!['WR', 'RB'].includes(a.pos) || a.pos !== b.pos) return false;
  const roleA = getDepthRole(analysis, a.nflTeam, a.pos, a.adp);
  const roleB = getDepthRole(analysis, b.nflTeam, b.pos, b.adp);
  if (!roleA || !roleB) return false;
  const shallow = new Set<DepthRole>(['depth', 'dart', 'competing']);
  return shallow.has(roleA) && shallow.has(roleB);
}

/** Fine: alpha + depth stack, or single depth piece late. */
export function isHealthySameTeamStack(
  players: { pos: string; adp: number; nflTeam: string | null }[],
  analysis: TeamDepthAnalysis
): boolean {
  if (players.length < 2) return false;
  const roles = players
    .map((p) => getDepthRole(analysis, p.nflTeam, p.pos, p.adp))
    .filter((r): r is DepthRole => r != null);
  return roles.includes('alpha') && roles.some((r) => r === 'depth' || r === 'dart');
}
