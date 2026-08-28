import type { RankedPlayer } from '@/types/database';
import type { PlayerPoolRow } from '@/utils/playerPoolFetch';
import { matchImportRows } from '@/utils/rankingsSpreadsheet/matchPlayers';
import { playerNameMatchKeys } from '@/utils/playerNameMatch';
import { roomFromNflPosition } from './parser';
import type { Player, Team } from './types';

const POOL_MAPPING = {
  hasHeaderRow: false,
  nameCol: 0,
  positionCol: 1,
  teamCol: 2,
  rankCol: null,
} as const;

export function toRankedPool(pool: PlayerPoolRow[]): RankedPlayer[] {
  return pool.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function attachPoolPlayer(parsed: Player, poolPlayer: RankedPlayer): Player {
  const position = poolPlayer.position;
  return {
    ...parsed,
    id: poolPlayer.id,
    name: poolPlayer.name,
    position,
    nflTeam: poolPlayer.team ?? parsed.nflTeam,
    room: parsed.ir ? 'BENCH' : roomFromNflPosition(position),
  };
}

export function playerFromPoolRow(
  poolPlayer: { id: string; name: string; position: string; team?: string | null },
  ir = false,
): Player {
  return {
    id: poolPlayer.id,
    name: poolPlayer.name,
    position: poolPlayer.position,
    nflTeam: poolPlayer.team ?? undefined,
    room: ir ? 'BENCH' : roomFromNflPosition(poolPlayer.position),
    ir: ir || undefined,
  };
}

export function isOnRoster(players: Player[], candidate: { id: string; name: string }): boolean {
  if (players.some((player) => player.id === candidate.id)) return true;
  const keys = new Set(playerNameMatchKeys(candidate.name));
  return players.some((player) => playerNameMatchKeys(player.name).some((key) => keys.has(key)));
}

/** The team that already has this player, if any. Pass exceptTeamId to ignore that roster (replace / same-team edits). */
export function findRosterOwner(
  teams: Team[],
  candidate: { id: string; name: string },
  exceptTeamId?: string,
): Team | undefined {
  return teams.find((team) => team.id !== exceptTeamId && isOnRoster(team.players, candidate));
}

export function describeTakenPlayers(owned: { name: string; teamName: string }[]): string | null {
  if (!owned.length) return null;
  if (owned.length === 1) {
    return `You can't add ${owned[0].name}. Already on ${owned[0].teamName}`;
  }
  return `You can't add these players: ${owned.map((row) => `${row.name} (${row.teamName})`).join(', ')}`;
}

export function describeTakenPlayer(name: string, owner: Team, currentTeamId: string): string {
  if (owner.id === currentTeamId) {
    return `You can't add ${name}. Already on this roster.`;
  }
  return `You can't add ${name}. Already on ${owner.name}.`;
}

export function resolveAgainstPool(
  parsed: Player[],
  pool: RankedPlayer[],
): {
  matched: Player[];
  rejected: string[];
  ambiguous: { raw: string; suggestions: RankedPlayer[] }[];
  duplicates: string[];
} {
  const rows = matchImportRows(
    parsed.map((player) => [player.name, player.position ?? '', player.nflTeam ?? '']),
    POOL_MAPPING,
    pool,
  ).rows;

  const matched: Player[] = [];
  const rejected: string[] = [];
  const ambiguous: { raw: string; suggestions: RankedPlayer[] }[] = [];
  const duplicates: string[] = [];
  const seenIds = new Set<string>();

  rows.forEach((row, index) => {
    const parsedPlayer = parsed[index];
    if (!parsedPlayer) return;
    if (row.status === 'matched' && row.player) {
      if (seenIds.has(row.player.id)) {
        duplicates.push(row.player.name);
        return;
      }
      seenIds.add(row.player.id);
      matched.push(attachPoolPlayer(parsedPlayer, row.player));
      return;
    }
    if (row.status === 'duplicate' && row.player) {
      duplicates.push(row.player.name);
      return;
    }
    if (row.status === 'needs_review') {
      ambiguous.push({ raw: parsedPlayer.name, suggestions: row.suggestions });
      return;
    }
    rejected.push(parsedPlayer.name);
  });

  return { matched, rejected, ambiguous, duplicates };
}

export function describeUnresolved(resolved: {
  rejected: string[];
  ambiguous: { raw: string }[];
  duplicates: string[];
}): string | null {
  const parts: string[] = [];
  if (resolved.rejected.length) {
    parts.push(`Not in the NFL player list: ${resolved.rejected.join(', ')}`);
  }
  if (resolved.ambiguous.length) {
    parts.push(
      `Need a team or position to tell these apart: ${resolved.ambiguous.map((row) => row.raw).join(', ')}`,
    );
  }
  if (resolved.duplicates.length) {
    parts.push(`Already listed: ${resolved.duplicates.join(', ')}`);
  }
  return parts.length ? parts.join('. ') : null;
}
