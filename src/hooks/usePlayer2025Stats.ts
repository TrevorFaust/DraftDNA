import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useScoringFormat } from '@/hooks/useScoringFormat';
import { getFantasyPointsForFormat } from '@/utils/fantasyPoints';
import type { ScoringFormat } from '@/utils/fantasyPoints';

export interface Player2025Stats {
  totalFantasyPoints: number;
  positionRank: string; // e.g. "QB1", "RB9", "WR12"
  totalPassYards: number;
  totalRushYards: number;
  totalRecYards: number;
  totalPassTds: number;
  totalRushTds: number;
  totalRecTds: number;
  totalInterceptions: number;
  totalTargets: number;
  totalReceptions: number;
  gamesPlayed: number;
  avgPointsPerGame: number | null; // null if no games played
}

type RawRow = {
  player_id: string;
  total_fp_standard: number | null;
  total_fp_ppr: number | null;
  total_receptions: number | null;
  total_pass_yards: number | null;
  total_rush_yards: number | null;
  total_rec_yards: number | null;
  total_pass_tds: number | null;
  total_rush_tds: number | null;
  total_rec_tds: number | null;
  total_interceptions: number | null;
  total_targets: number | null;
  games_played: number | null;
  position: string | null;
  position_rank: number | null;
};

/** Fetch 2025 season fantasy totals and position rank for all players. Returns a map of playerId -> stats.
 * @param scoringFormatOverride - When provided (e.g. from Rankings bucket), use this instead of the selected league's format.
 *  Ensures PPG/total points reflect the current bucket (standard, half_ppr, ppr) when switching leagues.
 */
export function usePlayer2025Stats(scoringFormatOverride?: ScoringFormat | null): Map<string, Player2025Stats> {
  const leagueFormat = useScoringFormat();
  const scoringFormat = (scoringFormatOverride ?? leagueFormat) as ScoringFormat;
  const [rawRows, setRawRows] = useState<RawRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase.rpc as any)('get_player_2025_season_stats');
      if (error) {
        console.warn('Failed to fetch player 2025 season stats:', error);
        return;
      }
      setRawRows(Array.isArray(data) ? data : []);
    })();
  }, []);

  return useMemo(() => {
    const map = new Map<string, Player2025Stats>();
    for (const row of rawRows) {
      const playerId = row.player_id != null ? String(row.player_id) : null;
      if (!playerId) continue;

      const totalFp = getFantasyPointsForFormat(
        scoringFormat,
        row.total_fp_standard ?? null,
        row.total_fp_ppr ?? null,
        Number(row.total_receptions) ?? null
      );
      if (totalFp == null) continue;

      const pos = (row.position || '').replace(/[^A-Z0-9/]/gi, '') || '?';
      const posRank = row.position_rank != null ? row.position_rank : 0;
      const positionRank = `${pos}${posRank}`;

      map.set(playerId, {
        totalFantasyPoints: totalFp,
        positionRank,
        totalPassYards: Number(row.total_pass_yards) || 0,
        totalRushYards: Number(row.total_rush_yards) || 0,
        totalRecYards: Number(row.total_rec_yards) || 0,
        totalPassTds: Number(row.total_pass_tds) || 0,
        totalRushTds: Number(row.total_rush_tds) || 0,
        totalRecTds: Number(row.total_rec_tds) || 0,
        totalInterceptions: Number(row.total_interceptions) || 0,
        totalTargets: Number(row.total_targets) || 0,
        totalReceptions: Number(row.total_receptions) || 0,
        gamesPlayed: Number(row.games_played) || 0,
        avgPointsPerGame: (() => {
          const gp = Number(row.games_played) || 0;
          return gp > 0 ? totalFp / gp : null;
        })(),
      });
    }
    return map;
  }, [rawRows, scoringFormat]);
}
