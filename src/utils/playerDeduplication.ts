function isDefenseLikePosition(position: string | null | undefined): boolean {
  if (position == null || position === '') return false;
  const u = position.trim().toUpperCase();
  return u === 'D/ST' || u === 'DEF' || u === 'DST';
}

type SeasonMergeRow = {
  id: string;
  name: string;
  position?: string | null;
  espn_id?: string | null;
  season?: number | null;
  adp?: number | null;
};

/**
 * Merge `players` rows from two seasons: keep prior-season vets, add current-season-only rows,
 * and prefer current season when the same `espn_id` exists in both (rookies / updated teams).
 * D/ST: if both seasons have the same team name, keep the **prior** row so ids stay aligned
 * with `get_player_2025_season_stats` until a 2026 defense stat pipeline exists.
 */
export function mergePlayerPoolAcrossSeasons<T extends SeasonMergeRow>(
  rows: T[],
  priorSeason: number,
  currentSeason: number
): T[] {
  const current = rows.filter((r) => Number(r.season) === currentSeason);
  const prior = rows.filter((r) => Number(r.season) === priorSeason);

  const currentEspn = new Set(
    current.map((p) => p.espn_id).filter((id): id is string => !!id).map(String)
  );

  const priorKept = prior.filter((p) => {
    if (isDefenseLikePosition(p.position)) return true;
    const eid = p.espn_id ? String(p.espn_id) : null;
    if (eid && currentEspn.has(eid)) return false;
    return true;
  });

  const priorDefenseNames = new Set(
    priorKept
      .filter((p) => isDefenseLikePosition(p.position))
      .map((p) => String(p.name).trim().toLowerCase())
  );

  const currentFiltered = current.filter((p) => {
    if (!isDefenseLikePosition(p.position)) return true;
    return !priorDefenseNames.has(String(p.name).trim().toLowerCase());
  });

  return deduplicatePlayersByIdentity([...priorKept, ...currentFiltered]);
}

/**
 * Deduplicates players who appear multiple times due to multi-position roles
 * (e.g. Taysom Hill as QB/TE/RB, Connor Heyward as RB/TE).
 * Keeps one player per identity (same name + espn_id), preferring the one with lowest ADP.
 */
export function deduplicatePlayersByIdentity<T extends { id: string; name: string; position?: string | null; espn_id?: string | null; adp?: number | null }>(
  players: T[]
): T[] {
  const byEspnId = new Map<string, T[]>();
  const byName = new Map<string, T[]>();

  for (const p of players) {
    // D/ST and K: keep as-is, identified by name (already deduped earlier in the pipeline)
    if (p.position === 'D/ST' || p.position === 'K') {
      const key = `def:${p.name}`;
      const list = byName.get(key) ?? [];
      list.push(p);
      byName.set(key, list);
      continue;
    }

    const nameKey = String(p.name).trim().toLowerCase();
    if (p.espn_id) {
      const key = String(p.espn_id);
      const list = byEspnId.get(key) ?? [];
      list.push(p);
      byEspnId.set(key, list);
    } else {
      const list = byName.get(nameKey) ?? [];
      list.push(p);
      byName.set(nameKey, list);
    }
  }

  const result: T[] = [];
  const keepLowestAdp = (list: T[]) =>
    list.reduce((best, curr) => {
      const bestAdp = Number(best.adp) ?? 9999;
      const currAdp = Number(curr.adp) ?? 9999;
      return currAdp < bestAdp ? curr : best;
    });

  for (const [, list] of byEspnId) {
    result.push(list.length === 1 ? list[0] : keepLowestAdp(list));
  }

  // For name-only groups, merge with espn_id groups if same name exists there
  const namesInEspnIdGroups = new Set(
    Array.from(byEspnId.values()).flat().map((p) => String(p.name).trim().toLowerCase())
  );
  for (const [nameKey, list] of byName) {
    if (nameKey.startsWith('def:')) {
      result.push(list[0]); // D/ST and K - single entry each
      continue;
    }
    if (namesInEspnIdGroups.has(nameKey)) {
      // This name already appears in an espn_id group - skip to avoid duplicate
      continue;
    }
    result.push(list.length === 1 ? list[0] : keepLowestAdp(list));
  }

  // Restore ADP order for display
  return result.sort((a, b) => {
    const adpA = Number(a.adp) ?? 9999;
    const adpB = Number(b.adp) ?? 9999;
    return adpA - adpB;
  });
}
