import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SEASON, PICK_SIX_LIVE_SCORING_ACTIVE } from '@/constants/contest';
import {
  PLAYER_POOL_CURRENT_SEASON,
  PLAYER_POOL_PRIOR_SEASON,
  PLAYER_POOL_SEASONS,
} from '@/constants/playerPoolSeason';
import { usePickSixLiveStats } from '@/hooks/usePickSixLiveStats';
import { mergePlayerPoolAcrossSeasons } from '@/utils/playerDeduplication';
import { fetchAllPlayersBySeasons } from '@/utils/fetchAllPlayers';
import {
  actualTop6IdentityKeys,
  buildPickSixActualTop6,
  buildPickSixPositionRankLookup,
  type PickSixPositionRankLookup,
  type PickSixTopPlayer,
} from '@/utils/pickSixActualTop6';
import {
  formatPickSixScore,
  PICK_SIX_POSITIONS,
  scorePickSixPicks,
  type PickSixPosition,
} from '@/utils/pickSixScoring';

export type PickSixLeaderboardPick = {
  rank: number;
  playerId: string;
  playerName: string;
  playerTeam: string | null;
};

export type PickSixLeaderboardEntry = {
  userId: string;
  username: string | null;
  rank: number;
  score: number;
  scoreLabel: string;
  exactMatches: number;
  picks: PickSixLeaderboardPick[];
};

type PositionEntryRow = {
  user_id: string;
  username: string | null;
  rank: number;
  player_id: string;
  player_name: string | null;
  player_team: string | null;
};

type PoolPlayer = {
  id: string;
  name: string;
  position: string | null;
  team: string | null;
  espn_id: string | null;
  season: number | null;
};

export function usePickSixPositionLeaderboard(currentUserId: string | undefined) {
  const [position, setPosition] = useState<PickSixPosition>('QB');
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [rawEntries, setRawEntries] = useState<PositionEntryRow[]>([]);
  const [players, setPlayers] = useState<PoolPlayer[]>([]);
  const [playersLoading, setPlayersLoading] = useState(PICK_SIX_LIVE_SCORING_ACTIVE);

  const statsMap = usePickSixLiveStats();

  useEffect(() => {
    if (!PICK_SIX_LIVE_SCORING_ACTIVE) {
      setPlayers([]);
      setPlayersLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setPlayersLoading(true);
      try {
        const data = await fetchAllPlayersBySeasons<PoolPlayer>(
          PLAYER_POOL_SEASONS,
          'id, name, position, team, espn_id, season'
        );
        if (!cancelled) {
          setPlayers(data);
        }
      } catch (err) {
        console.error('Failed to load player pool for Pick Six leaderboard:', err);
        if (!cancelled) setPlayers([]);
      } finally {
        if (!cancelled) setPlayersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const mergedPlayers = useMemo(() => {
    if (!PICK_SIX_LIVE_SCORING_ACTIVE) return [];
    return mergePlayerPoolAcrossSeasons(
      players,
      PLAYER_POOL_PRIOR_SEASON,
      PLAYER_POOL_CURRENT_SEASON
    );
  }, [players]);

  const playersById = useMemo(
    () => new Map(mergedPlayers.map((p) => [p.id, p])),
    [mergedPlayers]
  );

  const actualTop6 = useMemo(() => {
    if (!PICK_SIX_LIVE_SCORING_ACTIVE) return [];
    return buildPickSixActualTop6(position, players, mergedPlayers, statsMap);
  }, [position, players, mergedPlayers, statsMap]);

  const actualTop6Keys = useMemo(
    () => (PICK_SIX_LIVE_SCORING_ACTIVE ? actualTop6IdentityKeys(actualTop6) : []),
    [actualTop6]
  );

  const positionRankLookup = useMemo(() => {
    if (!PICK_SIX_LIVE_SCORING_ACTIVE) {
      return { getOverallRank: () => null };
    }
    return buildPickSixPositionRankLookup(position, players, mergedPlayers, statsMap);
  }, [position, players, mergedPlayers, statsMap]);

  const fetchEntries = useCallback(async (pos: PickSixPosition) => {
    if (!PICK_SIX_LIVE_SCORING_ACTIVE && !currentUserId) {
      setRawEntries([]);
      setEntriesLoading(false);
      return;
    }
    setEntriesLoading(true);
    setEntriesError(null);
    try {
      const { data, error } = await (supabase.rpc as any)('get_pick_six_position_entries', {
        p_season: SEASON,
        p_position: pos,
      });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      setRawEntries(
        rows.map((r: PositionEntryRow) => ({
          user_id: r.user_id,
          username: r.username ?? null,
          rank: Number(r.rank),
          player_id: r.player_id,
          player_name: r.player_name ?? null,
          player_team: r.player_team ?? null,
        }))
      );
    } catch (err) {
      console.error('Failed to fetch Pick Six position entries:', err);
      setEntriesError('Could not load leaderboard.');
      setRawEntries([]);
    } finally {
      setEntriesLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    void fetchEntries(position);
  }, [position, fetchEntries]);

  const currentUserPicks = useMemo((): PickSixLeaderboardPick[] => {
    if (!currentUserId) return [];
    return rawEntries
      .filter((r) => r.user_id === currentUserId)
      .map((r) => ({
        rank: r.rank,
        playerId: r.player_id,
        playerName: r.player_name?.trim() || '—',
        playerTeam: r.player_team,
      }))
      .sort((a, b) => a.rank - b.rank);
  }, [rawEntries, currentUserId]);

  const leaderboard = useMemo((): PickSixLeaderboardEntry[] => {
    if (!PICK_SIX_LIVE_SCORING_ACTIVE) return [];
    const byUser = new Map<string, PickSixLeaderboardEntry>();

    for (const row of rawEntries) {
      let entry = byUser.get(row.user_id);
      if (!entry) {
        entry = {
          userId: row.user_id,
          username: row.username,
          rank: 0,
          score: 0,
          scoreLabel: '0',
          exactMatches: 0,
          picks: [],
        };
        byUser.set(row.user_id, entry);
      }
      entry.picks.push({
        rank: row.rank,
        playerId: row.player_id,
        playerName: row.player_name?.trim() || '—',
        playerTeam: row.player_team,
      });
    }

    const scored: PickSixLeaderboardEntry[] = [];
    for (const entry of byUser.values()) {
      entry.picks.sort((a, b) => a.rank - b.rank);
      const { score, exactMatches } = scorePickSixPicks(
        actualTop6Keys,
        entry.picks.map((p) => ({ rank: p.rank, playerId: p.playerId })),
        playersById
      );
      entry.score = score;
      entry.scoreLabel = formatPickSixScore(score);
      entry.exactMatches = exactMatches;
      scored.push(entry);
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.exactMatches !== a.exactMatches) return b.exactMatches - a.exactMatches;
      return a.userId.localeCompare(b.userId);
    });

    let displayRank = 1;
    for (let i = 0; i < scored.length; i++) {
      if (i > 0 && scored[i].score !== scored[i - 1].score) {
        displayRank = i + 1;
      }
      scored[i].rank = displayRank;
    }

    return scored;
  }, [rawEntries, actualTop6Keys, playersById]);

  const currentUserEntry = useMemo(
    () => (currentUserId ? leaderboard.find((e) => e.userId === currentUserId) : undefined),
    [leaderboard, currentUserId]
  );

  return {
    position,
    setPosition,
    positions: PICK_SIX_POSITIONS,
    liveScoringActive: PICK_SIX_LIVE_SCORING_ACTIVE,
    actualTop6,
    actualTop6Keys,
    positionRankLookup,
    playersById,
    leaderboard,
    currentUserEntry,
    currentUserPicks,
    loading: entriesLoading || (PICK_SIX_LIVE_SCORING_ACTIVE && playersLoading),
    entriesError,
    statsReady: statsMap.size > 0,
    refetch: () => fetchEntries(position),
  };
}

export type { PickSixTopPlayer, PickSixPositionRankLookup };
