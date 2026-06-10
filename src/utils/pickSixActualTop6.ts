import type { Player2025Stats } from '@/hooks/usePlayer2025Stats';
import {
  pickSixPlayerIdentityKey,
  positionMatchesPickSix,
  type PickSixPosition,
} from '@/utils/pickSixScoring';
import { canonicalTeamAbbr, resolveTeamAbbrForDisplay } from '@/utils/teamMapping';

export type PickSixTopPlayer = {
  id: string;
  name: string;
  team: string | null;
  fantasyPoints: number;
  identityKey: string;
  /** Rank by half-PPR fantasy points at this position (1 = most points). */
  positionRank: number;
};

type PoolPlayer = {
  id: string;
  name: string;
  position?: string | null;
  team?: string | null;
  espn_id?: string | null;
  season?: number | null;
};

/** Loose name match (DK Metcalf vs punctuation / McCaffery vs McCaffrey). */
export function normalizePickSixPlayerName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function positionLabelMatchesPickSix(
  positionRankLabel: string | undefined,
  position: PickSixPosition
): boolean {
  if (!positionRankLabel?.trim()) return false;
  const u = positionRankLabel.trim().toUpperCase();
  if (position === 'D/ST') {
    return u.startsWith('D/ST') || u.startsWith('DST') || u.startsWith('DEF');
  }
  return u.startsWith(position);
}

function statsPositionMatches(
  stats: Player2025Stats,
  position: PickSixPosition
): boolean {
  if (stats.position?.trim()) {
    return positionMatchesPickSix(stats.position, position);
  }
  return positionLabelMatchesPickSix(stats.positionRank, position);
}

function fantasyPointsFromStats(stats: Player2025Stats | undefined): number | null {
  const fp = stats?.totalFantasyPoints;
  if (fp == null || !Number.isFinite(fp) || fp < 0) return null;
  return fp;
}

function isSyntheticDefenseStatsId(statsId: string): boolean {
  return statsId.startsWith('defense-');
}

/**
 * Map any pool player id → stats row id. Uses direct id match, then espn_id across
 * **all** loaded player rows (2025 + 2026). Stats RPC keys rows by 2025 player ids.
 */
export function resolveStatsPlayerId(
  playerId: string,
  allPlayersById: Map<string, PoolPlayer>,
  statsPlayerIds: Set<string>
): string | null {
  if (statsPlayerIds.has(playerId)) return playerId;

  const espn = allPlayersById.get(playerId)?.espn_id;
  if (!espn) return null;

  for (const [id, row] of allPlayersById) {
    if (row.espn_id && String(row.espn_id) === String(espn) && statsPlayerIds.has(id)) {
      return id;
    }
  }
  return null;
}

function defenseStatsKeyCandidates(pool: PoolPlayer): string[] {
  const keys: string[] = [];
  const abbr = resolveTeamAbbrForDisplay(pool.team, pool.position, pool.name);
  if (abbr) {
    const teamKey = (canonicalTeamAbbr(abbr) ?? abbr).toLowerCase();
    keys.push(`defense-${teamKey}`);
  }
  keys.push(`defense-${pool.name.replace(/\s/g, '-').toLowerCase()}`);
  keys.push(`defense-${pool.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
  return keys;
}

function resolvePoolStatsId(
  pool: PoolPlayer,
  position: PickSixPosition,
  allPlayersById: Map<string, PoolPlayer>,
  statsPlayerIds: Set<string>,
  statsMap: Map<string, Player2025Stats>
): string | null {
  const direct = resolveStatsPlayerId(pool.id, allPlayersById, statsPlayerIds);
  if (direct) return direct;

  if (position !== 'D/ST') return null;

  for (const key of defenseStatsKeyCandidates(pool)) {
    if (statsMap.has(key)) return key;
  }

  return null;
}

/** Prefer merged/current-season row for display + pick identity when espn matches. */
function resolveDisplayPlayer(
  statsId: string,
  allPlayersById: Map<string, PoolPlayer>,
  mergedPlayersById: Map<string, PoolPlayer>
): PoolPlayer | null {
  const statsRow = allPlayersById.get(statsId);
  if (!statsRow) return null;

  if (statsRow.espn_id) {
    for (const p of mergedPlayersById.values()) {
      if (p.espn_id && String(p.espn_id) === String(statsRow.espn_id)) return p;
    }
  }

  if (mergedPlayersById.has(statsId)) return mergedPlayersById.get(statsId)!;

  if (statsRow.position?.trim().toUpperCase() === 'D/ST' || statsRow.position?.trim().toUpperCase() === 'DEF') {
    const abbr = resolveTeamAbbrForDisplay(statsRow.team, statsRow.position, statsRow.name);
    if (abbr) {
      const canon = canonicalTeamAbbr(abbr) ?? abbr;
      for (const p of mergedPlayersById.values()) {
        if (!positionMatchesPickSix(p.position, 'D/ST')) continue;
        const pAbbr = resolveTeamAbbrForDisplay(p.team, p.position, p.name);
        if (pAbbr && (canonicalTeamAbbr(pAbbr) ?? pAbbr) === canon) return p;
      }
    }
  }

  return statsRow;
}

function dedupeKeyForEntry(
  pool: PoolPlayer,
  mergedPlayersById: Map<string, PoolPlayer>
): string {
  return pickSixPlayerIdentityKey(pool.id, mergedPlayersById);
}

/**
 * Rank everyone with 2025 half-PPR stats at this position. Source of truth is `statsMap`
 * (not the merged pick pool), so vets like McCaffrey are not dropped when only their
 * 2025 row has stats.
 */
function collectPlayersByFantasyPoints(
  position: PickSixPosition,
  allPlayers: PoolPlayer[],
  mergedPlayers: PoolPlayer[],
  statsMap: Map<string, Player2025Stats>
): PickSixTopPlayer[] {
  const allPlayersById = new Map(allPlayers.map((p) => [p.id, p]));
  const mergedPlayersById = new Map(mergedPlayers.map((p) => [p.id, p]));
  const byIdentity = new Map<string, PickSixTopPlayer>();

  const tryAddFromStats = (statsId: string, stats: Player2025Stats) => {
    if (!statsPositionMatches(stats, position)) return;
    if (position === 'D/ST' && isSyntheticDefenseStatsId(statsId)) return;

    const fp = fantasyPointsFromStats(stats);
    if (fp == null) return;

    const statsRow = allPlayersById.get(statsId);
    const pool =
      resolveDisplayPlayer(statsId, allPlayersById, mergedPlayersById) ?? statsRow;
    if (!pool) return;

    const identityKey = dedupeKeyForEntry(pool, mergedPlayersById);
    const entry: PickSixTopPlayer = {
      id: pool.id,
      name: pool.name,
      team: pool.team ?? null,
      fantasyPoints: fp,
      identityKey,
      positionRank: 0,
    };

    const existing = byIdentity.get(identityKey);
    if (!existing || fp > existing.fantasyPoints) {
      byIdentity.set(identityKey, entry);
    }
  };

  for (const [statsId, stats] of statsMap) {
    tryAddFromStats(statsId, stats);
  }

  const sorted = Array.from(byIdentity.values()).sort((a, b) => {
    if (b.fantasyPoints !== a.fantasyPoints) return b.fantasyPoints - a.fantasyPoints;
    return a.name.localeCompare(b.name);
  });

  return sorted.map((p, i) => ({ ...p, positionRank: i + 1 }));
}

/** Live top 6 = highest 2025 half-PPR fantasy point totals at the position. */
export function buildPickSixActualTop6(
  position: PickSixPosition,
  allPlayers: PoolPlayer[],
  mergedPlayers: PoolPlayer[],
  statsMap: Map<string, Player2025Stats>
): PickSixTopPlayer[] {
  return collectPlayersByFantasyPoints(position, allPlayers, mergedPlayers, statsMap).slice(0, 6);
}

export type PickSixPositionRankLookup = {
  getOverallRank: (playerId: string, playerName: string) => number | null;
};

export function buildPickSixPositionRankLookup(
  position: PickSixPosition,
  allPlayers: PoolPlayer[],
  mergedPlayers: PoolPlayer[],
  statsMap: Map<string, Player2025Stats>
): PickSixPositionRankLookup {
  const allPlayersById = new Map(allPlayers.map((p) => [p.id, p]));
  const mergedPlayersById = new Map(mergedPlayers.map((p) => [p.id, p]));
  const statsPlayerIds = new Set(statsMap.keys());

  const ranked = collectPlayersByFantasyPoints(position, allPlayers, mergedPlayers, statsMap);

  const byIdentityKey = new Map<string, number>();
  const byPlayerId = new Map<string, number>();
  const byNameKey = new Map<string, number>();

  const indexRank = (poolId: string, name: string, rank: number) => {
    byPlayerId.set(poolId, rank);
    byIdentityKey.set(pickSixPlayerIdentityKey(poolId, mergedPlayersById), rank);
    const loose = normalizePickSixPlayerName(name);
    if (loose) byNameKey.set(loose, rank);
    const tight = name.trim().toLowerCase();
    if (tight) byNameKey.set(tight, rank);
  };

  for (const p of ranked) {
    indexRank(p.id, p.name, p.positionRank);

    const merged = mergedPlayersById.get(p.id);
    const espn = merged?.espn_id;
    if (espn) {
      for (const row of allPlayers) {
        if (row.espn_id && String(row.espn_id) === String(espn)) {
          indexRank(row.id, row.name, p.positionRank);
        }
      }
    }

    if (position === 'D/ST') {
      const abbr = resolveTeamAbbrForDisplay(merged?.team, merged?.position ?? 'D/ST', p.name);
      if (abbr) {
        const canon = canonicalTeamAbbr(abbr) ?? abbr;
        for (const row of allPlayers) {
          if (!positionMatchesPickSix(row.position, 'D/ST')) continue;
          const rowAbbr = resolveTeamAbbrForDisplay(row.team, row.position, row.name);
          if (rowAbbr && (canonicalTeamAbbr(rowAbbr) ?? rowAbbr) === canon) {
            indexRank(row.id, row.name, p.positionRank);
          }
        }
      }
    }

    const loose = normalizePickSixPlayerName(p.name);
    for (const row of allPlayers) {
      if (!positionMatchesPickSix(row.position, position)) continue;
      if (normalizePickSixPlayerName(row.name) === loose) {
        indexRank(row.id, row.name, p.positionRank);
      }
    }
  }

  return {
    getOverallRank(playerId: string, playerName: string) {
      const fromId = byPlayerId.get(playerId);
      if (fromId != null) return fromId;

      const fromKey = byIdentityKey.get(
        pickSixPlayerIdentityKey(playerId, mergedPlayersById)
      );
      if (fromKey != null) return fromKey;

      const loose = normalizePickSixPlayerName(playerName);
      if (loose) {
        const fromLoose = byNameKey.get(loose);
        if (fromLoose != null) return fromLoose;
      }

      const tight = playerName.trim().toLowerCase();
      if (tight) {
        const fromTight = byNameKey.get(tight);
        if (fromTight != null) return fromTight;
      }

      const pool =
        mergedPlayersById.get(playerId) ?? allPlayersById.get(playerId);
      const statsId = pool
        ? resolvePoolStatsId(pool, position, allPlayersById, statsPlayerIds, statsMap)
        : resolveStatsPlayerId(playerId, allPlayersById, statsPlayerIds);

      if (statsId == null) return null;

      const display = resolveDisplayPlayer(statsId, allPlayersById, mergedPlayersById);
      if (display) {
        const key = pickSixPlayerIdentityKey(display.id, mergedPlayersById);
        const fromDisplay = byIdentityKey.get(key);
        if (fromDisplay != null) return fromDisplay;
      }

      const idx = ranked.findIndex((r) => {
        const rStatsId = resolvePoolStatsId(
          { id: r.id, name: r.name, team: r.team, position },
          position,
          allPlayersById,
          statsPlayerIds,
          statsMap
        );
        return rStatsId === statsId;
      });
      if (idx >= 0) return idx + 1;

      return null;
    },
  };
}

export function formatPickSixFantasyPoints(points: number): string {
  if (!Number.isFinite(points)) return '—';
  const rounded = Math.round(points * 100) / 100;
  if (Number.isInteger(rounded)) {
    return rounded.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

export function actualTop6IdentityKeys(top6: PickSixTopPlayer[]): string[] {
  return top6.map((p) => p.identityKey);
}
