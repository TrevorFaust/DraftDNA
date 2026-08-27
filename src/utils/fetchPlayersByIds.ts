import { supabase } from '@/integrations/supabase/client';
import type { Player, RankedPlayer } from '@/types/database';

/** PostgREST URL length blows up with huge `in=(...)` lists — fetch in chunks. */
const CHUNK = 80;

export async function fetchPlayersByIds(ids: string[]): Promise<Player[]> {
  if (!ids.length) return [];
  const unique = [...new Set(ids)];
  const rows: Player[] = [];

  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    const { data, error } = await supabase.from('players').select('*').in('id', slice);
    if (error) throw error;
    if (data?.length) rows.push(...(data as Player[]));
  }

  return rows;
}

/** Append drafted/keeper rows missing from the loaded board so roster slots aren't empty. */
export async function mergeMissingRankedPlayers(
  existing: RankedPlayer[],
  ids: string[]
): Promise<RankedPlayer[]> {
  const have = new Set(existing.map((p) => p.id));
  const missing = [...new Set(ids)].filter((id) => id && !have.has(id));
  if (missing.length === 0) return existing;
  const extra = await fetchPlayersByIds(missing);
  if (extra.length === 0) return existing;
  const appended: RankedPlayer[] = extra.map((p, i) => ({
    ...p,
    rank: 10_000 + i,
    adp: Number(p.adp) || 9999,
  }));
  return [...existing, ...appended];
}
