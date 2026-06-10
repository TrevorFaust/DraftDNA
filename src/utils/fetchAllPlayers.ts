import { supabase } from '@/integrations/supabase/client';

const PAGE_SIZE = 1000;

/** Paginate past Supabase PostgREST default 1000-row cap. */
export async function fetchAllPlayersBySeasons<T extends Record<string, unknown>>(
  seasons: readonly number[],
  select: string
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('players')
      .select(select)
      .in('season', [...seasons])
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data?.length) break;

    all.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}
