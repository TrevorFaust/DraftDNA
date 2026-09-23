import { useMemo } from 'react';
import { PICK_SIX_LIVE_SCORING_ACTIVE } from '@/constants/contest';
import { DEFAULT_PLAYER_STATS_SEASON } from '@/constants/playerStatsSeason';
import { usePlayer2025Stats } from '@/hooks/usePlayer2025Stats';
import type { Player2025Stats } from '@/hooks/usePlayer2025Stats';

const EMPTY_STATS = new Map<string, Player2025Stats>();

/**
 * Half-PPR totals for Pick Six live scoring (top 6, slot points, rankings).
 * Uses games played in the contest season so far (`DEFAULT_PLAYER_STATS_SEASON`).
 */
export function usePickSixLiveStats(): Map<string, Player2025Stats> {
  const statsMap = usePlayer2025Stats('half_ppr', {
    enabled: PICK_SIX_LIVE_SCORING_ACTIVE,
    season: DEFAULT_PLAYER_STATS_SEASON,
  });

  return useMemo(
    () => (PICK_SIX_LIVE_SCORING_ACTIVE ? statsMap : EMPTY_STATS),
    [statsMap]
  );
}
