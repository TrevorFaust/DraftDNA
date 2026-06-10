import { useMemo } from 'react';
import { PICK_SIX_LIVE_SCORING_ACTIVE } from '@/constants/contest';
import { usePlayer2025Stats } from '@/hooks/usePlayer2025Stats';
import type { Player2025Stats } from '@/hooks/usePlayer2025Stats';

const EMPTY_STATS = new Map<string, Player2025Stats>();

/**
 * Half-PPR season totals for Pick Six live scoring (top 6, slot points, rankings).
 *
 * Today this reads 2025 weekly aggregates via `get_player_2025_season_stats`. When
 * 2026 in-season data is available, point this hook at the new RPC or table here.
 */
export function usePickSixLiveStats(): Map<string, Player2025Stats> {
  const statsMap = usePlayer2025Stats('half_ppr', {
    enabled: PICK_SIX_LIVE_SCORING_ACTIVE,
  });

  return useMemo(
    () => (PICK_SIX_LIVE_SCORING_ACTIVE ? statsMap : EMPTY_STATS),
    [statsMap]
  );
}
