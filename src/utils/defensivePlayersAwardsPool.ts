import { supabase } from '@/integrations/supabase/client';

export type DefensiveAwardPlayer = {
  id: string;
  name: string;
  position: string;
  team: string | null;
};

function normalizeDisplayPosition(pos: string): string {
  const p = (pos || '').toUpperCase();
  if (p === 'DE' || p === 'EDGE') return 'EDGE';
  if (p === 'DT' || p === 'NT' || p === 'DL') return 'DL';
  if (p === 'OLB' || p === 'ILB' || p === 'MLB' || p === 'LB') return 'LB';
  if (p === 'CB') return 'CB';
  if (p === 'FS' || p === 'SS' || p === 'S') return 'S';
  if (p === 'DB') return 'DB';
  return p || 'DEF';
}

/**
 * All defensive players for Season Predictions DPOY.
 * Defaults to `rosters_2026` (current teams, trades, and rookies).
 */
export async function fetchDefensivePlayersForAwards(
  season: number = 2026
): Promise<DefensiveAwardPlayer[]> {
  const { data, error } = (await supabase.rpc('get_defensive_players_for_awards' as any, {
    p_season: season,
  })) as {
    data: { player_id: string; name: string; position: string; team: string | null }[] | null;
    error: unknown;
  };

  if (error || !data) {
    console.error('Error loading defensive players for awards:', error);
    return [];
  }

  const seen = new Set<string>();
  const out: DefensiveAwardPlayer[] = [];
  for (const row of data) {
    const name = row.name?.trim();
    if (!name) continue;
    const id = row.player_id?.trim() || `dpoy:${name.toLowerCase()}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name,
      position: normalizeDisplayPosition(row.position || 'DEF'),
      team: row.team?.trim().toUpperCase() || null,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
