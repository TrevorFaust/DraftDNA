import { supabase } from '@/integrations/supabase/client';
import type { Player } from '@/types/database';

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
