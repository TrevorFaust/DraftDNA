import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FANTASY_DEPTH_SEASON } from '@/constants/fantasyDepthSeason';
import { playerNameMatchKeys } from '@/utils/playerNameMatch';
import { canonicalTeamAbbr, teamFieldToAbbr } from '@/utils/teamMapping';

export type FantasyDepthSlot = {
  team_abbr: string;
  position: string;
  depth_rank: number;
  player_name: string;
  player_id: string | null;
};

export type FantasyDepthLookup = {
  byPlayerId: Map<string, FantasyDepthSlot>;
  byTeamPosName: Map<string, FantasyDepthSlot>;
  loading: boolean;
  error: string | null;
  getForPlayer: (
    playerId: string | null | undefined,
    name: string,
    team: string | null | undefined,
    position: string
  ) => FantasyDepthSlot | null;
};

async function fetchDepthRows(season: number) {
  const pageSize = 1000;
  const rows: Array<{
    team_abbr: string;
    position: string;
    depth_rank: number;
    player_name: string;
    player_id: string | null;
  }> = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('fantasy_team_depth')
      .select('team_abbr, position, depth_rank, player_name, player_id')
      .eq('season', season)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

export function useFantasyTeamDepth(season: number = FANTASY_DEPTH_SEASON): FantasyDepthLookup {
  const [byPlayerId, setByPlayerId] = useState<Map<string, FantasyDepthSlot>>(new Map());
  const [byTeamPosName, setByTeamPosName] = useState<Map<string, FantasyDepthSlot>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchDepthRows(season);
        if (cancelled) return;
        const idMap = new Map<string, FantasyDepthSlot>();
        const nameMap = new Map<string, FantasyDepthSlot>();
        for (const row of data) {
          const slot: FantasyDepthSlot = {
            team_abbr: row.team_abbr,
            position: row.position,
            depth_rank: row.depth_rank,
            player_name: row.player_name,
            player_id: row.player_id,
          };
          if (row.player_id) idMap.set(row.player_id, slot);
          const team = row.team_abbr.trim().toUpperCase();
          const pos = row.position.trim().toUpperCase();
          for (const nk of playerNameMatchKeys(row.player_name)) {
            nameMap.set(`${team}|${pos}|${nk}`, slot);
          }
        }
        setByPlayerId(idMap);
        setByTeamPosName(nameMap);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Failed to load fantasy depth chart';
        console.error('fantasy_team_depth fetch failed:', e);
        setError(msg);
        setByPlayerId(new Map());
        setByTeamPosName(new Map());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [season]);

  const getForPlayer = (
    playerId: string | null | undefined,
    name: string,
    team: string | null | undefined,
    position: string
  ): FantasyDepthSlot | null => {
    if (playerId) {
      const hit = byPlayerId.get(playerId);
      if (hit) return hit;
    }
    const pos = position.trim().toUpperCase();
    if (!['QB', 'RB', 'WR', 'TE'].includes(pos)) return null;
    const abbr = canonicalTeamAbbr(teamFieldToAbbr(team)) ?? teamFieldToAbbr(team);
    if (!abbr) return null;
    for (const nk of playerNameMatchKeys(name)) {
      const hit = byTeamPosName.get(`${abbr}|${pos}|${nk}`);
      if (hit) return hit;
    }
    return null;
  };

  return { byPlayerId, byTeamPosName, loading, error, getForPlayer };
}
