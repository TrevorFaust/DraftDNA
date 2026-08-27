import { useQuery } from '@tanstack/react-query';
import {
  fetchMergedPlayerPool,
  getPlayerPoolCacheTtl,
  PLAYER_POOL_QUERY_KEY,
} from '@/utils/playerPoolFetch';

export function useMergedPlayerPool() {
  return useQuery({
    queryKey: [...PLAYER_POOL_QUERY_KEY],
    queryFn: fetchMergedPlayerPool,
    ...getPlayerPoolCacheTtl(),
  });
}
