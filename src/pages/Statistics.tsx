import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLeagues } from '@/hooks/useLeagues';
import { useCommunityRankingsBucket } from '@/hooks/useCommunityRankingsBucket';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { PlayerDetailDialog } from '@/components/PlayerDetailDialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { BarChart3, Loader2, Lock, HelpCircle } from 'lucide-react';
import type { RankedPlayer, Player, MockDraft, DraftPick } from '@/types/database';
import { tempDraftStorage, tempRankingsStorage } from '@/utils/temporaryStorage';
import { deduplicatePlayersByIdentity } from '@/utils/playerDeduplication';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePlayer2025Stats } from '@/hooks/usePlayer2025Stats';

/** Build community RankedPlayer list from RPC results. Uses RPC order as source of truth. */
/** ADP = bucket-specific community rank (rank_position) for this scoring/league type. */
function buildCommunityFromRpc(
  allPlayersData: any[],
  communityData: { player_id: string; rank_position: number }[]
): RankedPlayer[] {
  const playerById = new Map(allPlayersData.map((p) => [p.id, p]));
  const seenIds = new Set<string>();
  const result: RankedPlayer[] = [];
  for (const r of communityData) {
    const player = playerById.get(r.player_id);
    if (player && !seenIds.has(r.player_id)) {
      seenIds.add(r.player_id);
      result.push({ ...player, adp: Number(r.rank_position), rank: result.length + 1 } as RankedPlayer);
    }
  }
  const maxRank = result.length;
  for (let i = 0; i < allPlayersData.length; i++) {
    const p = allPlayersData[i];
    if (!seenIds.has(p.id)) {
      seenIds.add(p.id);
      result.push({ ...p, adp: maxRank + i + 1, rank: maxRank + i + 1 } as RankedPlayer);
    }
  }
  return result.map((p, index) => ({ ...p, rank: index + 1 }));
}

const Statistics = () => {
  const { user, loading: authLoading } = useAuth();
  const { selectedLeague, leagues } = useLeagues();
  const bucket = useCommunityRankingsBucket();
  const player2025Stats = usePlayer2025Stats();
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [communityPlayers, setCommunityPlayers] = useState<RankedPlayer[]>([]);
  const [draftStats, setDraftStats] = useState<{
    mostDrafted: { player: Player; count: number } | null;
    allPlayersSorted: Array<{ player: Player; count: number }>;
    mostDraftedByRound: Map<number, Array<{ player: Player; count: number }>>;
    leastDrafted: Array<{ player: Player; count: number }>;
    leastDraftedByRound: Map<number, Array<{ player: Player; count: number }>>;
    avoidedPlayers: Array<{ player: Player; fadeScore: number; opportunityCount: number; selectionCount: number; intensitySum: number }>;
    avoidedPlayersByRound: Map<number, Array<{ player: Player; fadeScore: number; opportunityCount: number; selectionCount: number; intensitySum: number }>>;
    avoidedPlayersRaw: Array<{ player: Player; fadeScore: number; opportunityCount: number; selectionCount: number; intensitySum: number }>;
    avoidedPlayersByRoundRaw: Map<number, Array<{ player: Player; fadeScore: number; opportunityCount: number; selectionCount: number; intensitySum: number }>>;
    studs: Array<{ player: RankedPlayer; myRank: number; communityRank: number; diff: number }>;
    duds: Array<{ player: RankedPlayer; myRank: number; communityRank: number; diff: number }>;
    maxRound: number;
    numDrafts: number;
  }>({
    mostDrafted: null,
    allPlayersSorted: [],
    mostDraftedByRound: new Map(),
    leastDrafted: [],
    leastDraftedByRound: new Map(),
    avoidedPlayers: [],
    avoidedPlayersByRound: new Map(),
    avoidedPlayersRaw: [],
    avoidedPlayersByRoundRaw: new Map(),
    studs: [],
    duds: [],
    maxRound: 0,
    numDrafts: 0,
  });
  const [selectedRound, setSelectedRound] = useState<string>('all');
  const [selectedAvoidedRound, setSelectedAvoidedRound] = useState<string>('all');
  const [selectedFavesPosition, setSelectedFavesPosition] = useState<string>('all');
  const [selectedFadesPosition, setSelectedFadesPosition] = useState<string>('all');

  const POSITION_OPTIONS = [
    { value: 'all', label: 'All Positions' },
    { value: 'QB', label: 'QB' },
    { value: 'RB', label: 'RB' },
    { value: 'WR', label: 'WR' },
    { value: 'TE', label: 'TE' },
    { value: 'K', label: 'K' },
    { value: 'D/ST', label: 'D/ST' },
  ];

  const matchesPosition = (playerPosition: string | undefined, selectedPos: string) => {
    if (selectedPos === 'all') return true;
    if (!playerPosition) return false;
    const p = (playerPosition || '').toUpperCase();
    if (selectedPos === 'D/ST') return p === 'D/ST' || p === 'DEF';
    return p === selectedPos.toUpperCase();
  };
  const [statsLoading, setStatsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<RankedPlayer | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [roundBreakdownData, setRoundBreakdownData] = useState<{
    playerName: string;
    roundCounts: Array<{ round: number; count: number }>;
  } | null>(null);

  const handlePlayerClick = (player: RankedPlayer) => {
    setSelectedPlayer(player);
    setDetailDialogOpen(true);
  };

  const isAllLeagues = !selectedLeague;

  // Fetch players and rankings (same logic as Rankings page)
  const fetchPlayers = useCallback(async () => {
    try {
      // Single pass: non-D/ST by ADP then D/ST (avoids duplicate full table scan)
      let nonDefensePlayers: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error: nonDefenseError } = await supabase
          .from('players')
          .select('*')
          .neq('position', 'D/ST')
          .order('adp', { ascending: true })
          .range(from, from + pageSize - 1);

        if (nonDefenseError) throw nonDefenseError;
        
        if (data && data.length > 0) {
          nonDefensePlayers = [...nonDefensePlayers, ...data];
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      
      const { data: allDefensePlayers, error: defenseError } = await supabase
        .from('players')
        .select('*')
        .eq('position', 'D/ST')
        .order('created_at', { ascending: false });
      
      if (defenseError) throw defenseError;

      // Deduplicate defenses by name
      const uniqueDefenseMap = new Map<string, (typeof allDefensePlayers)[number]>();
      if (allDefensePlayers) {
        for (const defense of allDefensePlayers) {
          if (!uniqueDefenseMap.has(defense.name)) {
            uniqueDefenseMap.set(defense.name, defense);
          }
        }
      }
      let defensePlayers = Array.from(uniqueDefenseMap.values());
      defensePlayers = defensePlayers.sort((a, b) => a.name.localeCompare(b.name));

      const merged = [
        ...(nonDefensePlayers || []),
        ...defensePlayers
      ].sort((a, b) => {
        const adpA = Number(a.adp) || 999;
        const adpB = Number(b.adp) || 999;
        return adpA - adpB;
      });
      const updatedPlayersData = deduplicatePlayersByIdentity(merged);

      // Fetch community rankings for current bucket (skip dynasty - Coming Soon)
      const isDynastyBucket = bucket.leagueType === 'dynasty';
      let communityData: { player_id: string; rank_position: number }[] = [];
      if (!isDynastyBucket) {
        const { data } = (await supabase.rpc('get_community_rankings' as any, {
          p_scoring_format: bucket.scoringFormat,
          p_league_type: bucket.leagueType,
          p_is_superflex: bucket.isSuperflex,
        })) as { data: { player_id: string; rank_position: number }[] | null };
        if (Array.isArray(data) && data.length > 0) {
          communityData = data;
        }
      }

      const bucketAdpMap = new Map(communityData.map((r) => [r.player_id, Number(r.rank_position)]));

      if (!user) {
        const adpPlayers: RankedPlayer[] = updatedPlayersData.map((p, index) => ({
          ...p,
          adp: bucketAdpMap.get(p.id) ?? Number(p.adp),
          rank: index + 1,
        }));
        const guestCommunity = communityData.length > 0
          ? buildCommunityFromRpc(updatedPlayersData, communityData)
          : adpPlayers;
        setCommunityPlayers(guestCommunity);
        
        // Check for existing temporary rankings for this bucket only
        const statsBucketKey = `${bucket.scoringFormat}/${bucket.leagueType}/${bucket.isSuperflex}/${(bucket as any).rookiesOnly || false}`;
        const tempRankings = tempRankingsStorage.get(statsBucketKey);
        if (tempRankings && tempRankings.length > 0) {
          // User has finalized rankings, use them for comparison
          // Create a map of player IDs to ranks from temp rankings
          const rankingsMap = new Map<string, number>();
          tempRankings.forEach((player) => {
            rankingsMap.set(player.id, player.rank);
          });
          
          // Map players with their custom ranks, fallback to ADP if not ranked
          const rankedPlayers: RankedPlayer[] = updatedPlayersData.map((p, index) => {
            const customRank = rankingsMap.get(p.id);
            const adpRank = bucketAdpMap.get(p.id) ?? index + 1;
            return {
              ...p,
              adp: bucketAdpMap.get(p.id) ?? Number(p.adp),
              rank: customRank !== undefined ? customRank : adpRank,
            };
          });
          
          // Sort by custom rank
          rankedPlayers.sort((a, b) => a.rank - b.rank);
          const sortedPlayers = rankedPlayers.map((p, index) => ({
            ...p,
            rank: index + 1,
          }));
          
          setPlayers(sortedPlayers);
        } else {
          // No rankings yet, use ADP for both
          setPlayers(adpPlayers);
        }
        return;
      }

      if (isAllLeagues) {
        const leagueIds = leagues.map(l => l.id);
        let allLeagueRankingsData: any[] = [];
        
        if (leagueIds.length > 0) {
          const { data, error: allLeagueRankingsError } = await supabase
            .from('user_rankings')
            .select('*')
            .eq('user_id', user.id)
            .not('league_id', 'is', null)
            .in('league_id', leagueIds);

          if (allLeagueRankingsError) throw allLeagueRankingsError;
          allLeagueRankingsData = data || [];
        }

        const playerRankingsMap = new Map<string, number[]>();
        allLeagueRankingsData.forEach((ranking) => {
          if (!playerRankingsMap.has(ranking.player_id)) {
            playerRankingsMap.set(ranking.player_id, []);
          }
          playerRankingsMap.get(ranking.player_id)!.push(ranking.rank);
        });

        const averageRankingsMap = new Map<string, number>();
        playerRankingsMap.forEach((ranks, playerId) => {
          const average = ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
          averageRankingsMap.set(playerId, average);
        });

        const personalPlayers: RankedPlayer[] = updatedPlayersData.map((p, index) => {
          const avgRank = averageRankingsMap.get(p.id);
          const fallbackRank = bucketAdpMap.get(p.id) ?? (Number(p.adp) || index + 1);
          return {
            ...p,
            adp: bucketAdpMap.get(p.id) ?? Number(p.adp),
            rank: avgRank !== undefined ? avgRank : fallbackRank,
          };
        });

        personalPlayers.sort((a, b) => a.rank - b.rank);
        const sortedPersonal = personalPlayers.map((p, index) => ({
          ...p,
          rank: index + 1,
        }));
        setPlayers(sortedPersonal);

        const allLeaguesCommunity = communityData.length > 0
          ? buildCommunityFromRpc(updatedPlayersData, communityData)
          : updatedPlayersData.map((p, index) => ({ ...p, adp: bucketAdpMap.get(p.id) ?? Number(p.adp), rank: index + 1 }));
        setCommunityPlayers(allLeaguesCommunity);
      } else {
        const { data: rankingsData, error: rankingsError } = await supabase
          .from('user_rankings')
          .select('*')
          .eq('user_id', user.id)
          .eq('league_id', selectedLeague.id);

        if (rankingsError) throw rankingsError;

        const hasRankings = rankingsData && rankingsData.length > 0;

        let rankedPlayers: RankedPlayer[];

        if (hasRankings) {
          const rankingsMap = new Map(
            rankingsData.map((r) => [r.player_id, r.rank])
          );

          rankedPlayers = updatedPlayersData.map((p, index) => ({
            ...p,
            adp: bucketAdpMap.get(p.id) ?? Number(p.adp),
            rank: rankingsMap.get(p.id) ?? bucketAdpMap.get(p.id) ?? Number(p.adp) ?? index + 1,
          }));
        } else {
          const { data: allLeaguesRankings, error: allLeaguesError } = await supabase
            .from('user_rankings')
            .select('*')
            .eq('user_id', user.id)
            .is('league_id', null);

          if (allLeaguesError) throw allLeaguesError;

          const allLeaguesMap = new Map(
            allLeaguesRankings?.map((r) => [r.player_id, r.rank]) || []
          );

          rankedPlayers = updatedPlayersData.map((p, index) => ({
            ...p,
            adp: bucketAdpMap.get(p.id) ?? Number(p.adp),
            rank: allLeaguesMap.get(p.id) ?? bucketAdpMap.get(p.id) ?? Number(p.adp) ?? index + 1,
          }));
        }

        rankedPlayers.sort((a, b) => a.rank - b.rank);
        const sortedPlayers = rankedPlayers.map((p, index) => ({
          ...p,
          rank: index + 1,
        }));

        setPlayers(sortedPlayers);

        const leagueCommunity = communityData.length > 0
          ? buildCommunityFromRpc(updatedPlayersData, communityData)
          : updatedPlayersData.map((p, index) => ({ ...p, adp: bucketAdpMap.get(p.id) ?? Number(p.adp), rank: index + 1 }));
        setCommunityPlayers(leagueCommunity);
      }
    } catch (error: any) {
      console.error('Failed to load players:', error);
      
      // Check if it's a rate limit error
      if (error?.message?.includes('rate limit') || error?.code === 'PGRST116' || error?.status === 429) {
        toast.error('Rate limit exceeded. Please wait a moment and refresh the page. Your data is safe.');
      } else {
        toast.error(`Failed to load players: ${error instanceof Error ? error.message : 'Unknown error'}. Your data is safe - try refreshing.`);
      }
      
      // DON'T clear existing data on error - keep what we have
      if (players.length === 0 && communityPlayers.length === 0) {
        setPlayers([]);
        setCommunityPlayers([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user, selectedLeague, isAllLeagues, leagues, bucket]);

  useEffect(() => {
    setLoading(true);
    fetchPlayers();
  }, [fetchPlayers]);

  // Fetch draft statistics
  const fetchDraftStats = useCallback(async () => {
    // CRITICAL: Don't proceed with fade detection if communityPlayers is not loaded
    // Fade detection requires community ADP, not personal rankings
    if (communityPlayers.length === 0) {
      return;
    }
    
    setStatsLoading(true);

    try {
      let drafts: Array<{
        id: string;
        user_pick_position: number;
        num_teams: number;
        league_id?: string | null;
        is_superflex?: boolean | null;
      }> = [];
      let picksData: any[] = [];
      let playersMap = new Map<string, Player>();

      if (!user) {
        // For guests, fetch temporary drafts from localStorage
        const tempDraftIds = tempDraftStorage.getDraftList();
        
        if (tempDraftIds.length === 0) {
          setDraftStats({ 
            mostDrafted: null,
            allPlayersSorted: [],
            mostDraftedByRound: new Map(),
            leastDrafted: [],
            leastDraftedByRound: new Map(),
            avoidedPlayers: [],
            avoidedPlayersByRound: new Map(),
            avoidedPlayersRaw: [],
            avoidedPlayersByRoundRaw: new Map(),
            studs: [], 
            duds: [],
            maxRound: 0,
            numDrafts: 0,
          });
          setStatsLoading(false);
          return;
        }

        // Collect all unique player IDs from all temporary drafts
        const allPlayerIds = new Set<string>();
        for (const draftId of tempDraftIds) {
          const tempData = tempDraftStorage.getDraft(draftId);
          if (tempData) {
            drafts.push({
              id: tempData.draft.id,
              user_pick_position: tempData.draft.user_pick_position,
              num_teams: tempData.draft.num_teams,
              league_id: (tempData.draft as any).league_id ?? null,
              is_superflex: (tempData.draft as any).is_superflex ?? null,
            });
            if (tempData.picks) {
              tempData.picks.forEach((pick: DraftPick) => {
                if (pick.player_id) {
                  allPlayerIds.add(pick.player_id);
                }
              });
            }
          }
        }

        // Fetch only the players we need (more efficient than fetching all)
        if (allPlayerIds.size > 0) {
          const playerIdArray = Array.from(allPlayerIds);
          const batchSize = 100; // Supabase 'in' filter limit
          
          for (let i = 0; i < playerIdArray.length; i += batchSize) {
            const batch = playerIdArray.slice(i, i + batchSize);
            const { data, error } = await supabase
              .from('players')
              .select('*')
              .in('id', batch);
            
            if (error) {
              console.error('Error fetching players batch:', error);
              continue;
            }
            
            if (data) {
              data.forEach((player) => {
                playersMap.set(player.id, player);
              });
            }
          }
        }

        // Convert temporary drafts to picksData format
        for (const draftId of tempDraftIds) {
          const tempData = tempDraftStorage.getDraft(draftId);
          if (tempData && tempData.picks) {
            tempData.picks.forEach((pick: DraftPick) => {
              const player = playersMap.get(pick.player_id);
              picksData.push({
                ...pick,
                mock_draft_id: tempData.draft.id,
                players: player || null,
              });
            });
          }
        }
      } else {
        // For logged-in users, fetch from database
        // Filter drafts by league if a specific league is selected
        let draftsQuery = supabase
          .from('mock_drafts')
          .select('id, user_pick_position, league_id, num_teams')
          .eq('user_id', user.id);

        // Only add a league filter when a specific league is selected
        // When "All Leagues" is selected (selectedLeague is null), we want ALL drafts
        if (!isAllLeagues && selectedLeague) {
          draftsQuery = draftsQuery.eq('league_id', selectedLeague.id);
        }

        const { data: draftsData, error: draftsError } = await draftsQuery;

        if (draftsError) throw draftsError;

        drafts = (draftsData || []).map(d => ({
          id: d.id,
          user_pick_position: d.user_pick_position,
          num_teams: d.num_teams,
          league_id: d.league_id ?? null,
          is_superflex: null,
        }));

        // Enrich drafts with league superflex settings so QB fade capping is accurate.
        const leagueIds = Array.from(
          new Set(
            drafts
              .map((d) => d.league_id)
              .filter((id): id is string => !!id)
          )
        );
        if (leagueIds.length > 0) {
          const { data: leagueMeta } = await supabase
            .from('leagues')
            .select('id, is_superflex')
            .in('id', leagueIds);
          const superflexByLeagueId = new Map<string, boolean>(
            (leagueMeta || []).map((l) => [l.id, !!l.is_superflex])
          );
          drafts = drafts.map((d) => ({
            ...d,
            is_superflex: d.league_id ? (superflexByLeagueId.get(d.league_id) ?? false) : false,
          }));
        }

        if (drafts.length === 0) {
          setDraftStats({ 
            mostDrafted: null,
            allPlayersSorted: [],
            mostDraftedByRound: new Map(),
            leastDrafted: [],
            leastDraftedByRound: new Map(),
            avoidedPlayers: [],
            avoidedPlayersByRound: new Map(),
            avoidedPlayersRaw: [],
            avoidedPlayersByRoundRaw: new Map(),
            studs: [], 
            duds: [],
            maxRound: 0,
            numDrafts: 0,
          });
          setStatsLoading(false);
          return;
        }

        const draftIds = drafts.map(d => d.id);

        // Fetch draft picks with pagination to handle Supabase's 1000 row limit
        // When fetching picks for many drafts, we need to paginate through results
        let allPicksData: any[] = [];
        const picksPageSize = 1000; // Supabase default limit
        let picksFrom = 0;
        let picksHasMore = true;
        
        while (picksHasMore) {
          const { data: picksData, error: picksError } = await supabase
            .from('draft_picks')
            .select(`
              *,
              players (*)
            `)
            .in('mock_draft_id', draftIds)
            .range(picksFrom, picksFrom + picksPageSize - 1);
          
          if (picksError) {
            console.error('Error fetching draft picks:', picksError);
            throw picksError;
          }
          
          if (picksData && picksData.length > 0) {
            allPicksData = allPicksData.concat(picksData);
            picksFrom += picksPageSize;
            // If we got fewer results than picksPageSize, we've reached the end
            picksHasMore = picksData.length === picksPageSize;
          } else {
            picksHasMore = false;
          }
        }
        
        picksData = allPicksData;
        // Build players map from joined data (avoids full players table fetch)
        (allPicksData || []).forEach((pick: any) => {
          const p = pick.players;
          if (p && p.id) playersMap.set(p.id, p);
        });
        const missingIds = [...new Set((allPicksData || []).map((p: any) => p.player_id).filter(Boolean))].filter((id) => !playersMap.has(id));
        if (missingIds.length > 0) {
          const batchSize = 100;
          for (let i = 0; i < missingIds.length; i += batchSize) {
            const batch = missingIds.slice(i, i + batchSize);
            const { data } = await supabase.from('players').select('*').in('id', batch);
            (data || []).forEach((p) => playersMap.set(p.id, p));
          }
        }
      }

      const draftMap = new Map(drafts.map(d => [d.id, d.user_pick_position]));
      const draftMetaMap = new Map(drafts.map(d => [d.id, d]));


      const userPicks = (picksData || []).filter((pick: any) => {
        const userPickPosition = draftMap.get(pick.mock_draft_id);
        return userPickPosition && pick.team_number === userPickPosition;
      });

      // DEBUG: log picks info
      

      // Overall most drafted player (exclude auto-drafted picks)
      const playerCounts = new Map<string, { player: Player; count: number }>();
      userPicks.forEach((pick: any) => {
        if (pick.is_autodraft === true) return;
        // Try to get player from join first, fallback to playersMap
        let player = pick.players;
        if (!player && pick.player_id) {
          player = playersMap.get(pick.player_id);
        }
        
        if (player && player.id) {
          const existing = playerCounts.get(player.id);
          if (existing) {
            existing.count++;
          } else {
            playerCounts.set(player.id, { player, count: 1 });
          }
        }
      });

      const allPlayersSorted = Array.from(playerCounts.values())
        .sort((a, b) => b.count - a.count);

      
      const mostDrafted = allPlayersSorted[0] || null;

      // Most drafted by round (exclude auto-drafted picks)
      const roundPlayerCounts = new Map<number, Map<string, { player: Player; count: number }>>();
      let maxRound = 0;

      userPicks.forEach((pick: any) => {
        if (pick.is_autodraft === true) return;
        const round = pick.round_number;
        if (round > maxRound) maxRound = round;

        if (!roundPlayerCounts.has(round)) {
          roundPlayerCounts.set(round, new Map());
        }

        const roundCounts = roundPlayerCounts.get(round)!;
        // Try to get player from join first, fallback to playersMap
        let player = pick.players;
        if (!player && pick.player_id) {
          player = playersMap.get(pick.player_id);
        }
        
        if (player && player.id) {
          const existing = roundCounts.get(player.id);
          if (existing) {
            existing.count++;
          } else {
            roundCounts.set(player.id, { player, count: 1 });
          }
        }
      });

      // Convert to sorted arrays by round
      const mostDraftedByRound = new Map<number, Array<{ player: Player; count: number }>>();
      const leastDraftedByRound = new Map<number, Array<{ player: Player; count: number }>>();
      roundPlayerCounts.forEach((roundCounts, round) => {
        const sortedMost = Array.from(roundCounts.values())
          .sort((a, b) => b.count - a.count);
        mostDraftedByRound.set(round, sortedMost);
        
        const sortedLeast = Array.from(roundCounts.values())
          .sort((a, b) => a.count - b.count);
        leastDraftedByRound.set(round, sortedLeast);
      });

      // Calculate least drafted (inverse of most drafted)
      const leastDrafted = Array.from(playerCounts.values())
        .sort((a, b) => a.count - b.count);

      // Calculate Avoided Players using "Leapfrog & Value Analysis" logic
      // IMPORTANT: Use COMMUNITY ADP, not personal rankings, for fade detection
      // Create a map of player ID -> community ADP
      // Note: communityPlayers is guaranteed to be loaded (checked at start of function)
      const communityAdpMap = new Map<string, number>();
      communityPlayers.forEach((player) => {
        communityAdpMap.set(player.id, Number(player.adp) || 999);
      });
      
      // Track opportunities and intensity by round
      const opportunityCountsByRound = new Map<number, Map<string, number>>(); // Round -> Player ID -> Count
      const opportunityCounts = new Map<string, number>(); // Total opportunities across all rounds
      const rawOpportunityCountsByRound = new Map<number, Map<string, number>>(); // Round -> Player ID -> Count (no slot caps)
      const rawOpportunityCounts = new Map<string, number>(); // Total opportunities across all rounds (no slot caps)
      const selectionCounts = new Map<string, number>(); // How many times player was actually drafted
      const selectionCountsByRound = new Map<number, Map<string, number>>(); // Round -> Player ID -> Count
      
      // Track intensity sum (weighted by fade type)
      const intensitySumsByRound = new Map<number, Map<string, number>>(); // Round -> Player ID -> Intensity Sum
      const intensitySums = new Map<string, number>(); // Player ID -> Total Intensity Sum
      const rawIntensitySumsByRound = new Map<number, Map<string, number>>(); // Round -> Player ID -> Intensity Sum (no slot caps)
      const rawIntensitySums = new Map<string, number>(); // Player ID -> Total Intensity Sum (no slot caps)
      
      // Process each draft separately to track availability at each pick
      // Wrap fade calculation in try-catch so errors don't break entire stats
      try {
        for (const draft of drafts) {
          const numTeams = draft.num_teams || 12;
          
          // Get all picks for this draft, sorted by pick_number
          const draftPicks = (picksData || []).filter((pick: any) => pick.mock_draft_id === draft.id);
          const sortedDraftPicks = draftPicks.sort((a: any, b: any) => a.pick_number - b.pick_number);
          
          // Get user picks for this draft, sorted by pick_number
          const userPickPosition = draft.user_pick_position;
          const userDraftPicks = sortedDraftPicks
            .filter((pick: any) => pick.team_number === userPickPosition)
            .sort((a: any, b: any) => a.pick_number - b.pick_number);
          
          // Process each user pick to identify faded players
          let pickCount = 0;
          for (const userPick of userDraftPicks) {
            const pickNumber = userPick.pick_number;
            const roundNumber = userPick.round_number;
            pickCount++;
            
            // Skip autodrafted picks - exclude this instance from fade calculations
            // Check for various possible field names for autodraft tracking
            const isAutodrafted = userPick.is_autodraft === true || 
                                  userPick.autodraft === true || 
                                  userPick.auto_draft === true ||
                                  userPick.is_autodrafted === true;
            
            if (isAutodrafted) {
              continue; // Skip this pick entirely - don't count it for fade opportunities
            }
            
            // Get the player that was actually selected
            // Try to get player from join first (like mostDrafted logic), fallback to playersMap
            let selectedPlayer = userPick.players;
            if (!selectedPlayer && userPick.player_id) {
              selectedPlayer = playersMap.get(userPick.player_id);
            }
            
            if (!selectedPlayer || !selectedPlayer.id) {
              continue;
            }
            
            const normalizePosition = (position?: string): string => {
              const p = (position || '').toUpperCase().trim();
              if (p === 'D/ST' || p === 'DST') return 'DEF';
              return p;
            };

            // Use COMMUNITY ADP for selected player (what the community thinks)
            const selectedPlayerCommunityADP = communityAdpMap.get(selectedPlayer.id) || Number(selectedPlayer.adp) || 999;
            const selectedPlayerPosition = normalizePosition(selectedPlayer.position);
            
            // Find all players drafted BEFORE this pick
            const draftedBeforeThisPick = new Set<string>();
            for (const pick of sortedDraftPicks) {
              if (pick.pick_number < pickNumber) {
                draftedBeforeThisPick.add(pick.player_id);
              }
            }

            // Track the user's prior non-autodraft picks by position so we can stop
            // counting fades for positions that are already filled.
            const positionCaps = (() => {
              const draftMeta = draftMetaMap.get(draft.id);
              const qbCap = draftMeta?.is_superflex ? 2 : 1;
              return {
                QB: qbCap,
                TE: 1,
                K: 1,
                DEF: 1,
              } as Record<string, number>;
            })();
            const userPositionCounts = new Map<string, number>();
            for (const priorPick of userDraftPicks) {
              if (priorPick.pick_number >= pickNumber) continue;
              const priorIsAutodrafted = priorPick.is_autodraft === true ||
                priorPick.autodraft === true ||
                priorPick.auto_draft === true ||
                priorPick.is_autodrafted === true;
              if (priorIsAutodrafted) continue;
              let priorPlayer = priorPick.players;
              if (!priorPlayer && priorPick.player_id) {
                priorPlayer = playersMap.get(priorPick.player_id);
              }
              if (!priorPlayer?.id) continue;
              const pos = normalizePosition(priorPlayer.position);
              if (!pos) continue;
              userPositionCounts.set(pos, (userPositionCounts.get(pos) || 0) + 1);
            }
            
            // Identify faded players: available players that meet fade criteria
            // Use COMMUNITY ADP for comparison (what the community thinks vs what you did)
            playersMap.forEach((player) => {
              // Skip if already drafted
              if (draftedBeforeThisPick.has(player.id)) {
                return;
              }

              // Use COMMUNITY ADP for fade detection (community consensus)
              const playerCommunityADP = communityAdpMap.get(player.id) || Number(player.adp) || 999;
              const candidatePosition = normalizePosition(player.position);
              let intensity = 0;
              let isFaded = false;
              
              // Value Fade: Community ADP < CurrentPick (High Intensity 1.5x)
              // You passed on a "Value Steal" according to community consensus
              if (playerCommunityADP < pickNumber) {
                intensity = 1.5;
                isFaded = true;
              }
              // Preference Fade: CurrentPick < Community ADP < SelectedPlayerCommunityADP (Medium Intensity 1.0x)
              // You "Leapfrogged" a same-position player to reach for your guy.
              else if (
                candidatePosition === selectedPlayerPosition &&
                pickNumber < playerCommunityADP &&
                playerCommunityADP < selectedPlayerCommunityADP
              ) {
                intensity = 1.0;
                isFaded = true;
              }
              
              // Track opportunities and intensity if player was faded
              if (isFaded) {
                // Track raw opportunities (no slot cap) for position-filtered fades.
                if (!rawOpportunityCountsByRound.has(roundNumber)) {
                  rawOpportunityCountsByRound.set(roundNumber, new Map());
                  rawIntensitySumsByRound.set(roundNumber, new Map());
                }
                const rawRoundCounts = rawOpportunityCountsByRound.get(roundNumber)!;
                const rawRoundIntensities = rawIntensitySumsByRound.get(roundNumber)!;
                rawRoundCounts.set(player.id, (rawRoundCounts.get(player.id) || 0) + 1);
                rawRoundIntensities.set(player.id, (rawRoundIntensities.get(player.id) || 0) + intensity);
                rawOpportunityCounts.set(player.id, (rawOpportunityCounts.get(player.id) || 0) + 1);
                rawIntensitySums.set(player.id, (rawIntensitySums.get(player.id) || 0) + intensity);

                // Exclude positions already filled on your roster for the slot-aware
                // "all positions" view so extra QB/K/DEF/TE do not dominate it.
                const capForPosition = positionCaps[candidatePosition];
                if (capForPosition !== undefined && (userPositionCounts.get(candidatePosition) || 0) >= capForPosition) {
                  return;
                }
                
                // Track by round
                if (!opportunityCountsByRound.has(roundNumber)) {
                  opportunityCountsByRound.set(roundNumber, new Map());
                  intensitySumsByRound.set(roundNumber, new Map());
                }
                const roundCounts = opportunityCountsByRound.get(roundNumber)!;
                const roundIntensities = intensitySumsByRound.get(roundNumber)!;
                
                const currentRound = roundCounts.get(player.id) || 0;
                roundCounts.set(player.id, currentRound + 1);
                
                const currentRoundIntensity = roundIntensities.get(player.id) || 0;
                roundIntensities.set(player.id, currentRoundIntensity + intensity);
                
                // Track total
                const current = opportunityCounts.get(player.id) || 0;
                opportunityCounts.set(player.id, current + 1);
                
                const currentIntensity = intensitySums.get(player.id) || 0;
                intensitySums.set(player.id, currentIntensity + intensity);
              }
            });
            
          }
        
        // Count selections (how many times user actually drafted each player)
        // No round constraint - count all selections
        // Exclude autodrafted picks from selection counts
        userDraftPicks.forEach((pick: any) => {
          // Skip autodrafted picks when counting selections
          const isAutodrafted = pick.is_autodraft === true || 
                                pick.autodraft === true || 
                                pick.auto_draft === true ||
                                pick.is_autodrafted === true;
          
          if (isAutodrafted) {
            return; // Don't count autodrafted picks as selections
          }
          
          const roundNumber = pick.round_number;
          const playerId = pick.player_id;
          
          if (playerId) {
            // Track total selections
            const current = selectionCounts.get(playerId) || 0;
            selectionCounts.set(playerId, current + 1);
            
            // Track selections by round for round-specific view
            if (!selectionCountsByRound.has(roundNumber)) {
              selectionCountsByRound.set(roundNumber, new Map());
            }
            const roundSelections = selectionCountsByRound.get(roundNumber)!;
            const currentRound = roundSelections.get(playerId) || 0;
            roundSelections.set(playerId, currentRound + 1);
          }
        });
        }
      } catch (fadeError) {
        console.error('[Fade Score] Error calculating fade opportunities:', fadeError);
        // Continue with empty fade data rather than breaking entire stats
      }
      
      // Calculate fade scores using a non-percentage model:
      // Score = IntensitySum * log2(1 + missedCount), where missedCount = opportunities - selections.
      // This rewards repeated fades while avoiding a pure percentage-based metric.
      const fadeCandidates: Array<{ 
        player: Player; 
        fadeScore: number; 
        opportunityCount: number; 
        selectionCount: number;
        intensitySum: number;
      }> = [];
      const rawFadeCandidates: Array<{ 
        player: Player; 
        fadeScore: number; 
        opportunityCount: number; 
        selectionCount: number;
        intensitySum: number;
      }> = [];
      
      opportunityCounts.forEach((opportunityCount, playerId) => {
        const selectionCount = selectionCounts.get(playerId) || 0;
        const intensitySum = intensitySums.get(playerId) || 0;
        const missedCount = Math.max(0, opportunityCount - selectionCount);
        const fadeScore = intensitySum * Math.log2(1 + missedCount);
        
        const player = playersMap.get(playerId);
        if (player) {
          fadeCandidates.push({
            player,
            fadeScore,
            opportunityCount,
            selectionCount,
            intensitySum,
          });
        }
      });
      rawOpportunityCounts.forEach((opportunityCount, playerId) => {
        const selectionCount = selectionCounts.get(playerId) || 0;
        const intensitySum = rawIntensitySums.get(playerId) || 0;
        const missedCount = Math.max(0, opportunityCount - selectionCount);
        const fadeScore = intensitySum * Math.log2(1 + missedCount);
        const player = playersMap.get(playerId);
        if (player) {
          rawFadeCandidates.push({
            player,
            fadeScore,
            opportunityCount,
            selectionCount,
            intensitySum,
          });
        }
      });
      
      // Global List: Show top 10 players who have at least 2 "Opportunities" across all drafts
      // IMPORTANT: Only show players with positive fade scores (you fade them more than you pick them)
      const avoidedPlayers = fadeCandidates
        .filter((c) => {
          // Must have at least 2 opportunities
          if (c.opportunityCount < 2) {
            return false;
          }
          const missedCount = c.opportunityCount - c.selectionCount;
          return missedCount >= 1 && c.fadeScore > 0;
        })
        .sort((a, b) => b.fadeScore - a.fadeScore)
        .slice(0, 10);

      const avoidedPlayersRaw = rawFadeCandidates
        .filter((c) => {
          if (c.opportunityCount < 2) {
            return false;
          }
          const missedCount = c.opportunityCount - c.selectionCount;
          return missedCount >= 1 && c.fadeScore > 0;
        })
        .sort((a, b) => b.fadeScore - a.fadeScore)
        .slice(0, 25);
      
      // Calculate avoided players by round
      // Round Specific: Show players who have at least 1 "Opportunity" in that specific round
      const avoidedPlayersByRound = new Map<number, Array<{
        player: Player;
        fadeScore: number;
        opportunityCount: number;
        selectionCount: number;
        intensitySum: number;
      }>>();
      const avoidedPlayersByRoundRaw = new Map<number, Array<{
        player: Player;
        fadeScore: number;
        opportunityCount: number;
        selectionCount: number;
        intensitySum: number;
      }>>();
      
      opportunityCountsByRound.forEach((roundOpportunities, round) => {
        const roundAvoided: Array<{
          player: Player;
          fadeScore: number;
          opportunityCount: number;
          selectionCount: number;
          intensitySum: number;
        }> = [];
        
        roundOpportunities.forEach((opportunityCount, playerId) => {
          // Require at least 1 opportunity in this round
          if (opportunityCount < 1) return;
          
          const roundSelections = selectionCountsByRound.get(round) || new Map();
          const roundSelectionCount = roundSelections.get(playerId) || 0;
          const roundIntensitySum = intensitySumsByRound.get(round)?.get(playerId) || 0;
          
          // Calculate fade score for this round
          const missedCount = Math.max(0, opportunityCount - roundSelectionCount);
          const fadeScore = roundIntensitySum * Math.log2(1 + missedCount);
          if (missedCount <= 0 || fadeScore <= 0) return;
          
          const player = playersMap.get(playerId);
          if (player) {
            roundAvoided.push({
              player,
              fadeScore,
              opportunityCount,
              selectionCount: roundSelectionCount,
              intensitySum: roundIntensitySum,
            });
          }
        });
        
        // Sort by fade score (higher = more significant fade)
        roundAvoided.sort((a, b) => b.fadeScore - a.fadeScore);
        if (roundAvoided.length > 0) {
          avoidedPlayersByRound.set(round, roundAvoided);
        }
      });
      rawOpportunityCountsByRound.forEach((roundOpportunities, round) => {
        const roundAvoided: Array<{
          player: Player;
          fadeScore: number;
          opportunityCount: number;
          selectionCount: number;
          intensitySum: number;
        }> = [];

        roundOpportunities.forEach((opportunityCount, playerId) => {
          if (opportunityCount < 1) return;
          const roundSelections = selectionCountsByRound.get(round) || new Map();
          const roundSelectionCount = roundSelections.get(playerId) || 0;
          const roundIntensitySum = rawIntensitySumsByRound.get(round)?.get(playerId) || 0;
          const missedCount = Math.max(0, opportunityCount - roundSelectionCount);
          const fadeScore = roundIntensitySum * Math.log2(1 + missedCount);
          if (missedCount <= 0 || fadeScore <= 0) return;
          const player = playersMap.get(playerId);
          if (player) {
            roundAvoided.push({
              player,
              fadeScore,
              opportunityCount,
              selectionCount: roundSelectionCount,
              intensitySum: roundIntensitySum,
            });
          }
        });

        roundAvoided.sort((a, b) => b.fadeScore - a.fadeScore);
        if (roundAvoided.length > 0) {
          avoidedPlayersByRoundRaw.set(round, roundAvoided);
        }
      });

      // Calculate studs and duds (only if players and communityPlayers are loaded)
      let studs: Array<{ player: RankedPlayer; myRank: number; communityRank: number; diff: number }> = [];
      let duds: Array<{ player: RankedPlayer; myRank: number; communityRank: number; diff: number }> = [];

      if (players.length > 0 && communityPlayers.length > 0) {
        const diffs = players.slice(0, 150).map((myPlayer) => {
          const myRank = players.findIndex((p) => p.id === myPlayer.id) + 1;
          const communityRank = communityPlayers.findIndex((p) => p.id === myPlayer.id) + 1;
          return { player: myPlayer, myRank, communityRank, diff: communityRank - myRank };
        });

        studs = diffs
          .filter((d) => d.diff > 0 && d.myRank <= 150 && d.communityRank <= 150)
          .sort((a, b) => b.diff - a.diff);

        duds = diffs
          .filter((d) => d.diff < 0 && d.myRank <= 150 && d.communityRank <= 150)
          .sort((a, b) => a.diff - b.diff);
      }

      const numDrafts = drafts.length;

      setDraftStats({
        mostDrafted,
        allPlayersSorted,
        mostDraftedByRound,
        leastDrafted,
        leastDraftedByRound,
        avoidedPlayers,
        avoidedPlayersByRound,
        avoidedPlayersRaw,
        avoidedPlayersByRoundRaw,
        studs,
        duds,
        maxRound,
        numDrafts,
      });
    } catch (error) {
      console.error('Error fetching draft stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }, [user, players, communityPlayers, isAllLeagues, selectedLeague]);

  useEffect(() => {
    // Fetch draft stats when communityPlayers is loaded (for both guests and logged-in users)
    // This ensures fade detection uses community ADP, not personal rankings
    if (communityPlayers.length > 0) {
      fetchDraftStats();
    }
  }, [communityPlayers.length, fetchDraftStats]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="font-display text-4xl tracking-wide">DRAFT STATS</h1>
          <p className="text-muted-foreground">
            Your drafting and rankings statistics
          </p>
        </div>

        <div className="space-y-6">
          {/* Most Drafted Player */}
          <div className="bg-secondary/30 rounded-lg border border-border/50 p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                <div>
                  <h2 className="font-display text-xl tracking-wide">Draft Faves</h2>
                  <p className="text-xs text-muted-foreground">(most drafted players)</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={selectedRound} onValueChange={setSelectedRound}>
                  <SelectTrigger className="w-[140px] bg-secondary/50 border-border/50">
                    <SelectValue placeholder="All Rounds" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Rounds</SelectItem>
                    {Array.from({ length: draftStats.maxRound }, (_, i) => i + 1).map((round) => (
                      <SelectItem key={round} value={round.toString()}>
                        Round {round}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedFavesPosition} onValueChange={setSelectedFavesPosition}>
                  <SelectTrigger className="w-[140px] bg-secondary/50 border-border/50">
                    <SelectValue placeholder="All Positions" />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {statsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (() => {
              if (selectedRound === 'all') {
                // Use the pre-calculated allPlayersSorted, filtered by position
                const allPlayers = draftStats.allPlayersSorted.filter(
                  (item) => matchesPosition(item.player.position, selectedFavesPosition)
                );

                if (allPlayers.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      No draft data available. Start a mock draft to see your statistics!
                    </div>
                  );
                }

                const maxCount = allPlayers.length > 0 ? allPlayers[0].count : 1;
                const topPlayers = allPlayers.slice(0, 10); // Show top 10 for better visualization

                return (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground mb-4">
                      Most drafted players across all rounds
                      {isAllLeagues ? ' (all leagues)' : ` (${selectedLeague?.name || 'league'})`}
                    </p>
                    <div className={`flex items-end gap-3 sm:gap-4 h-[500px] overflow-x-auto ${topPlayers.length === 1 ? 'justify-center' : 'justify-around px-4'}`}>
                      {topPlayers.map((item, index) => {
                        // Get round breakdown for this player
                        const roundBreakdown: number[] = [];
                        draftStats.mostDraftedByRound.forEach((roundPlayers, round) => {
                          const playerInRound = roundPlayers.find(p => p.player.id === item.player.id);
                          if (playerInRound) {
                            for (let i = 0; i < playerInRound.count; i++) {
                              roundBreakdown.push(round);
                            }
                          }
                        });
                        const roundCounts = roundBreakdown.reduce((acc, round) => {
                          acc[round] = (acc[round] || 0) + 1;
                          return acc;
                        }, {} as Record<number, number>);
                        const roundSummary = Object.entries(roundCounts)
                          .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                          .map(([round, count]) => `${count}x R${round}`)
                          .join(', ');

                        // Linear scaling: most drafted = 100%, others scale proportionally
                        const barHeight = (item.count / maxCount) * 100;

                        return (
                          <div
                            key={item.player.id}
                            className="group relative flex flex-col items-center cursor-pointer w-[80px] sm:w-[100px] h-[500px] flex-shrink-0"
                            onClick={() => {
                              const rankedPlayer: RankedPlayer = {
                                ...item.player,
                                adp: Number(item.player.adp) || 999,
                                rank: 0,
                              };
                              handlePlayerClick(rankedPlayer);
                            }}
                          >
                            {/* Top section: Card, Name, Count (fixed height ~25% of total) */}
                            <div className="w-full flex flex-col items-center mb-2 flex-shrink-0">
                              {/* Card placeholder */}
                              <div className="w-16 h-20 sm:w-20 sm:h-24 bg-secondary/40 border border-border/50 rounded-md flex items-center justify-center mb-2 group-hover:bg-secondary/60 transition-colors">
                                <span className="text-xs text-muted-foreground">Card</span>
                              </div>
                              {/* Player name */}
                              <p className="font-medium text-xs text-center truncate w-full px-1 mb-1">{item.player.name}</p>
                              {/* Count number */}
                              <p className="text-lg font-bold text-foreground">{item.count}</p>
                            </div>

                            {/* Bottom section: Bar area - fixed height to ensure all bars align */}
                            <div className="relative w-full flex-1 flex flex-col justify-end min-h-0 mb-8">
                              <div 
                                className="relative w-full bg-secondary/30 rounded-t overflow-hidden"
                                style={{ height: `${barHeight}%`, minHeight: '20px' }}
                              >
                                <div
                                  className="absolute bottom-0 left-0 right-0 bg-primary/60 group-hover:bg-primary transition-all duration-300 rounded-t"
                                  style={{ height: '100%' }}
                                />
                              </div>
                            </div>

                            {/* Round summary below bar - click to see round breakdown chart */}
                            {roundSummary && (
                              <div
                                className="absolute bottom-0 left-0 right-0 text-center px-1 h-8 flex items-start justify-center cursor-pointer hover:bg-primary/10 rounded transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rounds: Array<{ round: number; count: number }> = Object.entries(roundCounts)
                                    .map(([r, c]) => ({ round: parseInt(r, 10), count: c }))
                                    .sort((a, b) => a.round - b.round);
                                  setRoundBreakdownData({ playerName: item.player.name, roundCounts: rounds });
                                }}
                              >
                                <p className="text-[10px] text-muted-foreground/70 line-clamp-2 hover:text-foreground/80">
                                  {roundSummary}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              } else {
                // Show most drafted for specific round, filtered by position
                const round = parseInt(selectedRound);
                const roundPlayers = (draftStats.mostDraftedByRound.get(round) || []).filter(
                  (item) => matchesPosition(item.player.position, selectedFavesPosition)
                );
                if (roundPlayers.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      No {selectedFavesPosition === 'all' ? '' : selectedFavesPosition + ' '}players drafted in Round {round}
                    </div>
                  );
                }
                const maxCount = roundPlayers.length > 0 ? roundPlayers[0].count : 1;
                const topPlayers = roundPlayers.slice(0, 10);

                return (
                  <div className="space-y-3 relative">
                    {/* Blur overlay for guests when viewing specific rounds */}
                    {!user && (
                      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-20 rounded-lg flex items-center justify-center">
                        <div className="text-center p-6 bg-card/90 rounded-lg shadow-xl border border-primary/30 max-w-sm mx-auto">
                          <Lock className="w-12 h-12 mx-auto mb-4 text-primary" />
                          <h3 className="font-display text-xl mb-2">Sign In to View Round-by-Round Stats</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Round-by-round breakdowns are available for signed-in users. Sign in to unlock detailed statistics for each round.
                          </p>
                          <Button variant="hero" onClick={() => navigate('/auth')} className="w-full">
                            Sign In to Unlock
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className={cn("space-y-3", !user && "opacity-50 pointer-events-none")}>
                      <p className="text-sm text-muted-foreground mb-4">
                        Most drafted players in Round {round}
                        {isAllLeagues ? ' (all leagues)' : ` (${selectedLeague?.name || 'league'})`}
                      </p>
                      <div className={`flex items-end gap-3 sm:gap-4 h-[500px] overflow-x-auto ${topPlayers.length === 1 ? 'justify-center' : 'justify-around px-4'}`}>
                        {topPlayers.map((item, index) => {
                          // Linear scaling: most drafted = 100%, others scale proportionally
                          const barHeight = (item.count / maxCount) * 100;

                          return (
                            <div
                              key={item.player.id}
                              className="group flex flex-col items-center cursor-pointer w-[80px] sm:w-[100px] h-full flex-shrink-0"
                              onClick={() => {
                                const rankedPlayer: RankedPlayer = {
                                  ...item.player,
                                  adp: Number(item.player.adp) || 999,
                                  rank: 0,
                                };
                                handlePlayerClick(rankedPlayer);
                              }}
                            >
                              {/* Top section: Card, Name, Count (fixed height ~25% of total) */}
                              <div className="w-full flex flex-col items-center mb-2 flex-shrink-0">
                                {/* Card placeholder */}
                                <div className="w-16 h-20 sm:w-20 sm:h-24 bg-secondary/40 border border-border/50 rounded-md flex items-center justify-center mb-2 group-hover:bg-secondary/60 transition-colors">
                                  <span className="text-xs text-muted-foreground">Card</span>
                                </div>
                                {/* Player name */}
                                <p className="font-medium text-xs text-center truncate w-full px-1 mb-1">{item.player.name}</p>
                                {/* Count number */}
                                <p className="text-lg font-bold text-foreground">{item.count}</p>
                              </div>

                              {/* Bottom section: Bar (takes remaining ~75% of space) */}
                              <div className="relative w-full flex-1 flex flex-col justify-end min-h-0">
                                <div 
                                  className="relative w-full bg-secondary/30 rounded-t overflow-hidden"
                                  style={{ height: `${barHeight}%`, minHeight: '20px' }}
                                >
                                  <div
                                    className="absolute bottom-0 left-0 right-0 bg-primary/60 group-hover:bg-primary transition-all duration-300 rounded-t"
                                    style={{ height: '100%' }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                          })}
                        </div>
                    </div>
                  </div>
                );
              }
            })()}
          </div>

          {/* Avoided Players (Fade Score) */}
          <div className="bg-secondary/30 rounded-lg border border-border/50 p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-red-400" />
                <div className="flex items-center gap-2">
                  <div>
                    <h2 className="font-display text-xl tracking-wide">Draft Fades</h2>
                    <p className="text-xs text-muted-foreground">(least drafted players)</p>
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground transition-colors">
                        <HelpCircle className="w-4 h-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="right" className="max-w-xs">
                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="font-semibold mb-1">Value Fade:</p>
                          <p className="text-muted-foreground">
                            You passed on a player whose community ADP is better (lower) than your current pick number.
                          </p>
                          <p className="text-muted-foreground mt-1">
                            Ex. Picking at #25 and passing on a player with ADP #10.
                          </p>
                        </div>
                        <div>
                          <p className="font-semibold mb-1">Preference Fade:</p>
                          <p className="text-muted-foreground">
                            You "leapfrogged" a player to reach for your preferred pick.
                          </p>
                          <p className="text-muted-foreground mt-1">
                            Ex. Picking at #25, passing on ADP #27, and selecting ADP #30.
                          </p>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={selectedAvoidedRound} onValueChange={setSelectedAvoidedRound}>
                  <SelectTrigger className="w-[140px] bg-secondary/50 border-border/50">
                    <SelectValue placeholder="All Rounds" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Rounds</SelectItem>
                    {Array.from({ length: Math.min(10, draftStats.maxRound) }, (_, i) => i + 1).map((round) => (
                      <SelectItem key={round} value={round.toString()}>
                        Round {round}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedFadesPosition} onValueChange={setSelectedFadesPosition}>
                  <SelectTrigger className="w-[140px] bg-secondary/50 border-border/50">
                    <SelectValue placeholder="All Positions" />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {statsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (() => {
              if (selectedAvoidedRound === 'all') {
                const avoidedPlayersSource =
                  selectedFadesPosition === 'all'
                    ? draftStats.avoidedPlayers
                    : draftStats.avoidedPlayersRaw;
                // Exclude players that are currently in the "faves" set for the same scope.
                const faveIdsForScope = new Set(
                  draftStats.allPlayersSorted
                    .filter((item) => matchesPosition(item.player.position, selectedFadesPosition))
                    .slice(0, 10)
                    .map((item) => item.player.id)
                );
                const avoidedPlayers = avoidedPlayersSource.filter((item) => {
                  if (!matchesPosition(item.player.position, selectedFadesPosition)) return false;
                  // Safety guard: never show players drafted every opportunity.
                  if (!(item.opportunityCount > item.selectionCount && item.fadeScore > 0)) return false;
                  // Never show players that are in faves for this scope.
                  return !faveIdsForScope.has(item.player.id);
                });

                if (avoidedPlayers.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="mb-2 font-medium">Complete more drafts to unlock this feature</p>
                      <p className="text-sm">The Fades list will appear once you've completed enough drafts to identify consistent patterns.</p>
                      <p className="text-xs mt-2 text-muted-foreground/70">
                        Currently tracking: {draftStats.numDrafts} {draftStats.numDrafts === 1 ? 'draft' : 'drafts'} completed. Players are shown if they have at least 2 opportunities across all drafts.
                      </p>
                    </div>
                  );
                }

                // Show top 10 avoided players (highest fade score first)
                const topAvoided = avoidedPlayers.slice(0, 10);

                return (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground mb-4">
                      Players you consistently pass on when available
                      {isAllLeagues ? ' (all leagues)' : ` (${selectedLeague?.name || 'league'})`}
                      <span className="block text-xs mt-1 text-muted-foreground/70">
                        {draftStats.numDrafts <= 3 
                          ? 'Showing players you skip more often than you pick when they are available (very early stage sample)'
                          : draftStats.numDrafts <= 6
                          ? 'Showing players you more often pass on than draft when available (early stage sample)'
                          : draftStats.numDrafts <= 10
                          ? 'Showing players you consistently pass on with multiple opportunities (moderate sample)'
                          : draftStats.numDrafts <= 15
                          ? 'Showing players you frequently pass on with solid opportunity counts (late mid sample)'
                          : 'Showing players you consistently avoid across many drafts (mature sample)'}
                      </span>
                    </p>
                    <TooltipProvider>
                      <div className={`flex items-end gap-3 sm:gap-4 h-[500px] overflow-x-auto ${topAvoided.length === 1 ? 'justify-center' : 'justify-around px-4'}`}>
                        {topAvoided.map((item, index) => {
                        const missedCount = Math.max(0, item.opportunityCount - item.selectionCount);
                        const fadeScore = item.fadeScore;
                        
                        // Color scale based on fade score intensity.
                        const getFadeScoreColor = (scorePct: number): string => {
                          const clamped = Math.max(0, Math.min(100, scorePct));
                          // Normalize to 0-1 range
                          const normalized = clamped / 100;
                          
                          // Interpolate between light yellow (#fef08a) and dark red (#dc2626)
                          // Orange (#f59e0b) is at 50%
                          const yellow = { r: 254, g: 240, b: 138 }; // #fef08a (light yellow)
                          const orange = { r: 245, g: 158, b: 11 };  // #f59e0b (orange)
                          const red = { r: 220, g: 38, b: 38 };      // #dc2626 (dark red)
                          
                          let r, g, b;
                          if (normalized <= 0.5) {
                            // Interpolate between yellow and orange (0% to 50%)
                            const t = normalized * 2; // Scale to 0-1 for yellow-orange range
                            r = Math.round(yellow.r + (orange.r - yellow.r) * t);
                            g = Math.round(yellow.g + (orange.g - yellow.g) * t);
                            b = Math.round(yellow.b + (orange.b - yellow.b) * t);
                          } else {
                            // Interpolate between orange and red (50% to 100%)
                            const t = (normalized - 0.5) * 2; // Scale to 0-1 for orange-red range
                            r = Math.round(orange.r + (red.r - orange.r) * t);
                            g = Math.round(orange.g + (red.g - orange.g) * t);
                            b = Math.round(orange.b + (red.b - orange.b) * t);
                          }
                          
                          return `rgb(${r}, ${g}, ${b})`;
                        };
                        
                        const maxFadeScore = topAvoided.length > 0
                          ? Math.max(...topAvoided.map((i) => i.fadeScore))
                          : 1;
                        const normalizedScorePct = maxFadeScore > 0 ? (fadeScore / maxFadeScore) * 100 : 0;
                        const fadeColor = getFadeScoreColor(normalizedScorePct);
                        
                        // Determine dominant fade type based on average intensity
                        // 1.0 = all Preference Fades, 1.5 = all Value Fades
                        const avgIntensity = item.opportunityCount > 0 
                          ? item.intensitySum / item.opportunityCount 
                          : 0;
                        // If avgIntensity >= 1.25, it's mostly Value Fades, otherwise Preference Fades
                        const fadeType = avgIntensity >= 1.25 ? 'Value Fade' : 'Preference Fade';
                        
                        const barHeight = maxFadeScore > 0 ? (fadeScore / maxFadeScore) * 100 : 0;

                        return (
                          <div
                            key={item.player.id}
                            className="group flex flex-col items-center cursor-pointer w-[80px] sm:w-[100px] h-full flex-shrink-0"
                            onClick={() => {
                              const rankedPlayer: RankedPlayer = {
                                ...item.player,
                                adp: Number(item.player.adp) || 999,
                                rank: 0,
                              };
                              handlePlayerClick(rankedPlayer);
                            }}
                          >
                            {/* Top section: Card, Name, Fade Score (fixed height ~25% of total) */}
                            <div className="w-full flex flex-col items-center mb-2 flex-shrink-0">
                              {/* Card placeholder */}
                              <div className="w-16 h-20 sm:w-20 sm:h-24 bg-secondary/40 border border-red-500/50 rounded-md flex items-center justify-center mb-2 group-hover:bg-secondary/60 transition-colors">
                                <span className="text-xs text-muted-foreground">Card</span>
                              </div>
                              {/* Player name */}
                              <p className="font-medium text-xs text-center truncate w-full px-1 mb-1">{item.player.name}</p>
                              {/* Fade score with score-based color */}
                              <p 
                                className="text-lg font-bold" 
                                style={{ color: fadeColor }}
                              >
                                {fadeScore.toFixed(1)}
                              </p>
                              <p className="text-[10px] text-muted-foreground/70">
                                {item.opportunityCount} opp, {item.selectionCount} picked, {missedCount} passed
                              </p>
                              {/* Fade Type */}
                              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                                {fadeType}
                              </p>
                            </div>

                            {/* Bottom section: Bar (takes remaining ~75% of space) */}
                            <div className="relative w-full flex-1 flex flex-col justify-end min-h-0">
                              <div 
                                className="relative w-full bg-secondary/30 rounded-t overflow-hidden"
                                style={{ height: `${barHeight}%`, minHeight: '20px' }}
                              >
                                <div
                                  className="absolute bottom-0 left-0 right-0 transition-all duration-300 rounded-t"
                                  style={{ 
                                    height: '100%',
                                    backgroundColor: fadeColor,
                                    opacity: 0.7,
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.opacity = '1';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.opacity = '0.7';
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    </TooltipProvider>
                  </div>
                );
              } else {
                // Show avoided players for specific round, filtered by position
                const round = parseInt(selectedAvoidedRound);
                const roundAvoidedSource =
                  selectedFadesPosition === 'all'
                    ? (draftStats.avoidedPlayersByRound.get(round) || [])
                    : (draftStats.avoidedPlayersByRoundRaw.get(round) || []);
                // Exclude players that are currently in the round-specific "faves" set.
                const faveIdsForRoundScope = new Set(
                  (draftStats.mostDraftedByRound.get(round) || [])
                    .filter((item) => matchesPosition(item.player.position, selectedFadesPosition))
                    .slice(0, 10)
                    .map((item) => item.player.id)
                );
                const roundAvoided = roundAvoidedSource.filter((item) => {
                  if (!matchesPosition(item.player.position, selectedFadesPosition)) return false;
                  // Safety guard: never show players drafted every opportunity.
                  if (!(item.opportunityCount > item.selectionCount && item.fadeScore > 0)) return false;
                  // Never show players that are in faves for this round scope.
                  return !faveIdsForRoundScope.has(item.player.id);
                });
                
                if (roundAvoided.length === 0) {
                  const numDrafts = draftStats.numDrafts;
                  let criteriaText = '';
                  if (numDrafts <= 3) {
                    criteriaText = 'at least 1 pass and 1+ opportunity';
                  } else if (numDrafts <= 6) {
                    criteriaText = 'at least 1 pass and 1+ opportunity';
                  } else if (numDrafts <= 10) {
                    criteriaText = 'at least 1 pass and 2+ opportunities';
                  } else if (numDrafts <= 15) {
                    criteriaText = 'at least 1 pass and 2+ opportunities';
                  } else {
                    criteriaText = 'at least 1 pass and 2+ opportunities';
                  }
                  
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="mb-2 font-medium">Complete more drafts to unlock this feature</p>
                      <p className="text-sm">No {selectedFadesPosition === 'all' ? '' : selectedFadesPosition + ' '}avoided players found in Round {round} yet. Keep drafting to see patterns emerge.</p>
                      <p className="text-xs mt-2 text-muted-foreground/70">
                        Players are shown if they have a {criteriaText} in this round.
                      </p>
                    </div>
                  );
                }
                
                const topAvoided = roundAvoided.slice(0, 10);

                return (
                  <div className="space-y-3 relative">
                    {/* Blur overlay for guests when viewing specific rounds */}
                    {!user && (
                      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-20 rounded-lg flex items-center justify-center">
                        <div className="text-center p-6 bg-card/90 rounded-lg shadow-xl border border-primary/30 max-w-sm mx-auto">
                          <Lock className="w-12 h-12 mx-auto mb-4 text-primary" />
                          <h3 className="font-display text-xl mb-2">Sign In to View Round-by-Round Stats</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Round-by-round breakdowns are available for signed-in users. Sign in to unlock detailed statistics for each round.
                          </p>
                          <Button variant="hero" onClick={() => navigate('/auth')} className="w-full">
                            Sign In to Unlock
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className={cn("space-y-3", !user && "opacity-50 pointer-events-none")}>
                      <p className="text-sm text-muted-foreground mb-4">
                        Players you consistently pass on in Round {round}
                        {isAllLeagues ? ' (all leagues)' : ` (${selectedLeague?.name || 'league'})`}
                        <span className="block text-xs mt-1 text-muted-foreground/70">
                          {draftStats.numDrafts <= 3 
                            ? 'Showing players you skip more often than you pick in this round (very early stage sample)'
                            : draftStats.numDrafts <= 6
                            ? 'Showing players you more often pass on than draft in this round (early stage sample)'
                            : draftStats.numDrafts <= 10
                            ? 'Showing players you consistently pass on in this round with multiple opportunities (moderate sample)'
                            : draftStats.numDrafts <= 15
                            ? 'Showing players you frequently pass on in this round with solid opportunity counts (late mid sample)'
                            : 'Showing players you consistently avoid in this round across many drafts (mature sample)'}
                        </span>
                      </p>
                      <TooltipProvider>
                        <div className={`flex items-end gap-3 sm:gap-4 h-[500px] overflow-x-auto ${topAvoided.length === 1 ? 'justify-center' : 'justify-around px-4'}`}>
                          {topAvoided.map((item, index) => {
                            const missedCount = Math.max(0, item.opportunityCount - item.selectionCount);
                            const fadeScore = item.fadeScore;
                          
                          const getFadeScoreColor = (scorePct: number): string => {
                            const clamped = Math.max(0, Math.min(100, scorePct));
                            // Normalize to 0-1 range
                            const normalized = clamped / 100;
                            
                            // Interpolate between light yellow (#fef08a) and dark red (#dc2626)
                            // Orange (#f59e0b) is at 50%
                            const yellow = { r: 254, g: 240, b: 138 }; // #fef08a (light yellow)
                            const orange = { r: 245, g: 158, b: 11 };  // #f59e0b (orange)
                            const red = { r: 220, g: 38, b: 38 };      // #dc2626 (dark red)
                            
                            let r, g, b;
                            if (normalized <= 0.5) {
                              // Interpolate between yellow and orange (0% to 50%)
                              const t = normalized * 2; // Scale to 0-1 for yellow-orange range
                              r = Math.round(yellow.r + (orange.r - yellow.r) * t);
                              g = Math.round(yellow.g + (orange.g - yellow.g) * t);
                              b = Math.round(yellow.b + (orange.b - yellow.b) * t);
                            } else {
                              // Interpolate between orange and red (50% to 100%)
                              const t = (normalized - 0.5) * 2; // Scale to 0-1 for orange-red range
                              r = Math.round(orange.r + (red.r - orange.r) * t);
                              g = Math.round(orange.g + (red.g - orange.g) * t);
                              b = Math.round(orange.b + (red.b - orange.b) * t);
                            }
                            
                            return `rgb(${r}, ${g}, ${b})`;
                          };
                          
                          const maxFadeScore = topAvoided.length > 0
                            ? Math.max(...topAvoided.map((i) => i.fadeScore))
                            : 1;
                          const normalizedScorePct = maxFadeScore > 0 ? (fadeScore / maxFadeScore) * 100 : 0;
                          const fadeColor = getFadeScoreColor(normalizedScorePct);
                          
                          // Determine dominant fade type based on average intensity
                          // 1.0 = all Preference Fades, 1.5 = all Value Fades
                          const avgIntensity = item.opportunityCount > 0 
                            ? item.intensitySum / item.opportunityCount 
                            : 0;
                          // If avgIntensity >= 1.25, it's mostly Value Fades, otherwise Preference Fades
                          const fadeType = avgIntensity >= 1.25 ? 'Value Fade' : 'Preference Fade';
                          
                          const barHeight = maxFadeScore > 0 ? (fadeScore / maxFadeScore) * 100 : 0;

                          return (
                            <div
                              key={item.player.id}
                              className="group flex flex-col items-center cursor-pointer w-[80px] sm:w-[100px] h-full flex-shrink-0"
                              onClick={() => {
                                const rankedPlayer: RankedPlayer = {
                                  ...item.player,
                                  adp: Number(item.player.adp) || 999,
                                  rank: 0,
                                };
                                handlePlayerClick(rankedPlayer);
                              }}
                            >
                              {/* Top section: Card, Name, Fade Score (fixed height ~25% of total) */}
                              <div className="w-full flex flex-col items-center mb-2 flex-shrink-0">
                                {/* Card placeholder */}
                                <div className="w-16 h-20 sm:w-20 sm:h-24 bg-secondary/40 border border-red-500/50 rounded-md flex items-center justify-center mb-2 group-hover:bg-secondary/60 transition-colors">
                                  <span className="text-xs text-muted-foreground">Card</span>
                                </div>
                                {/* Player name */}
                                <p className="font-medium text-xs text-center truncate w-full px-1 mb-1">{item.player.name}</p>
                                {/* Fade score with score-based color */}
                                <p 
                                  className="text-lg font-bold" 
                                  style={{ color: fadeColor }}
                                >
                                  {fadeScore.toFixed(1)}
                                </p>
                                <p className="text-[10px] text-muted-foreground/70">
                                  {item.opportunityCount} opp, {item.selectionCount} picked, {missedCount} passed
                                </p>
                                {/* Fade Type */}
                                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                                  {fadeType}
                                </p>
                              </div>

                              {/* Bottom section: Bar (takes remaining ~75% of space) */}
                              <div className="relative w-full flex-1 flex flex-col justify-end min-h-0">
                                <div 
                                  className="relative w-full bg-secondary/30 rounded-t overflow-hidden"
                                  style={{ height: `${barHeight}%`, minHeight: '20px' }}
                                >
                                  <div
                                    className="absolute bottom-0 left-0 right-0 transition-all duration-300 rounded-t"
                                    style={{ 
                                      height: '100%',
                                      backgroundColor: fadeColor,
                                      opacity: 0.7,
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.opacity = '1';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.opacity = '0.7';
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </TooltipProvider>
                    </div>
                  </div>
                );
              }
            })()}
          </div>

          {/* Studs and Duds Breakdown */}
          {players.length > 0 && communityPlayers.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Your Studs */}
              <div className="bg-green-500/10 rounded-lg border border-green-500/30 p-4">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-green-500/30">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <h2 className="font-display text-xl tracking-wide text-green-400">YOUR STUDS</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  View all players you rank higher than the community
                </p>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2 scrollbar-thin">
                  {statsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-green-400" />
                    </div>
                  ) : draftStats.studs.length > 0 ? (
                    draftStats.studs.map(({ player, myRank, communityRank, diff }) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between bg-background/50 rounded-md p-3 cursor-pointer hover:bg-background/70 transition-colors"
                        onClick={() => handlePlayerClick(player)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-green-400">+{diff}</span>
                          <div>
                            <p className="font-medium">{player.name}</p>
                            <p className="text-xs text-muted-foreground">{player.team} • {player.position}</p>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <p className="text-green-400">#{myRank} <span className="text-muted-foreground">vs</span> #{communityRank}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No studs found
                    </div>
                  )}
                </div>
              </div>

              {/* Your Duds */}
              <div className="bg-red-500/10 rounded-lg border border-red-500/30 p-4">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-red-500/30">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <h2 className="font-display text-xl tracking-wide text-red-400">YOUR DUDS</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  View all players you rank lower than the community
                </p>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2 scrollbar-thin">
                  {statsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-red-400" />
                    </div>
                  ) : draftStats.duds.length > 0 ? (
                    draftStats.duds.map(({ player, myRank, communityRank, diff }) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between bg-background/50 rounded-md p-3 cursor-pointer hover:bg-background/70 transition-colors"
                        onClick={() => handlePlayerClick(player)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-red-400">{diff}</span>
                          <div>
                            <p className="font-medium">{player.name}</p>
                            <p className="text-xs text-muted-foreground">{player.team} • {player.position}</p>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <p className="text-red-400">#{myRank} <span className="text-muted-foreground">vs</span> #{communityRank}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No duds found
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Dialog open={!!roundBreakdownData} onOpenChange={(open) => !open && setRoundBreakdownData(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {roundBreakdownData?.playerName} — Round Breakdown
            </DialogTitle>
          </DialogHeader>
          {roundBreakdownData && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Drafts by round for this player
              </p>
              <div className="flex gap-2 sm:gap-3 justify-around px-2">
                {(() => {
                  const countByRound = new Map(roundBreakdownData.roundCounts.map((r) => [r.round, r.count]));
                  const minR = Math.min(...roundBreakdownData.roundCounts.map((r) => r.round));
                  const maxR = Math.max(...roundBreakdownData.roundCounts.map((r) => r.round));
                  const displaySpan = Math.max(3, maxR - minR + 1);
                  const startRound = Math.max(1, maxR - displaySpan + 1);
                  const endRound = Math.min(draftStats.maxRound || 15, startRound + displaySpan - 1);
                  const displayRounds = Array.from({ length: endRound - startRound + 1 }, (_, i) => startRound + i);
                  const maxCount = Math.max(...roundBreakdownData.roundCounts.map((r) => r.count), 1);
                  return displayRounds.map((round) => {
                    const count = countByRound.get(round) ?? 0;
                    const barHeightPct = (count / maxCount) * 100;
                    return (
                    <div
                      key={round}
                      className="flex flex-col items-center flex-1 min-w-0"
                    >
                      <span className="text-xs font-medium mb-1">{count}</span>
                      <div className="w-full max-w-[48px] h-[150px] flex flex-col justify-end">
                        <div
                          className="w-full bg-primary/60 rounded-t transition-all hover:bg-primary"
                          style={{ height: `${barHeightPct}%`, minHeight: count > 0 ? '8px' : '0' }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-2">R{round}</span>
                    </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PlayerDetailDialog
        player={selectedPlayer}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        stats2025={selectedPlayer ? player2025Stats.get(selectedPlayer.id) : undefined}
      />
    </div>
  );
};

export default Statistics;
