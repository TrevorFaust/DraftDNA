import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { PositionBadge } from '@/components/PositionBadge';
import { MyRoster } from '@/components/MyRoster';
import { PlayerDetailDialog } from '@/components/PlayerDetailDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Search, Check, Loader2, Trophy, LogOut, Timer, Pause, Play } from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Player, MockDraft, DraftPick, RankedPlayer } from '@/types/database';
import { fetchRookiesRankings } from '@/utils/rookiesFilter';
import { useNflTeams } from '@/hooks/useNflTeams';
import { NFL_DEFENSE_TEAM_NAMES } from '@/constants/nflDefenses';
import { cn, capitalizeSentenceStart } from '@/lib/utils';
import { tempDraftStorage, tempSettingsStorage } from '@/utils/temporaryStorage';
import { deduplicatePlayersByIdentity } from '@/utils/playerDeduplication';
import { usePlayer2025Stats } from '@/hooks/usePlayer2025Stats';
import { selectCpuPick, assignRandomNamedArchetypesForDraft } from '@/utils/cpuDraftLogic';
import {
  detectArchetypeName,
  detectArchetypeIndex,
  detectStrategiesFromPicks,
  getArchetypeBucketFromStrategies,
  chooseArchetypeIndexFromBucket,
  hashPicksForTieBreak,
} from '@/utils/archetypeDetection';
import { getArchetypeByNameOrImproviser, FULL_ARCHETYPE_LIST } from '@/constants/archetypeListWithImproviser';
import { getChaosArchetypeByName, isChaosReplace } from '@/constants/chaosArchetypes';
import { ArchetypeBadge } from '@/components/ArchetypeBadge';
import { buildDraftConfig, type DraftConfig } from '@/constants/buildDraftConfig';
import { detectChaosArchetype, type ChaosPick } from '@/utils/chaosDetection';
import { getAgeFromBirthDate } from '@/utils/playerAge';
import { displayTeamAbbrevOrFa } from '@/utils/teamMapping';

const DraftRoom = () => {
  const { draftId } = useParams<{ draftId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const player2025Stats = usePlayer2025Stats();
  
  const [draft, setDraft] = useState<MockDraft | null>(null);
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [isDraftPaused, setIsDraftPaused] = useState(false);
  const [currentPick, setCurrentPick] = useState(1);
  const [isDrafting, setIsDrafting] = useState(false);
  const [selectedPlayerForStats, setSelectedPlayerForStats] = useState<Player | null>(null);
  const [isStatsDialogOpen, setIsStatsDialogOpen] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [positionLimits, setPositionLimits] = useState<{
    QB?: number;
    RB?: number;
    WR?: number;
    TE?: number;
    FLEX?: number;
    K?: number;
    DEF?: number;
    BENCH?: number;
  }>({ BENCH: 6 });
  const [isSuperflex, setIsSuperflex] = useState(false);
  const { teamNames: defenseTeamNames, teams: nflTeams } = useNflTeams();
  const defenseTeamAbbrByName = useMemo(
    () =>
      new Map(
        (nflTeams || [])
          .filter((t) => t.team_name && t.team_abbr)
          .map((t) => [t.team_name as string, t.team_abbr as string])
      ),
    [nflTeams]
  );
  const [teamNames, setTeamNames] = useState<Map<number, string>>(new Map());
  const [keepers, setKeepers] = useState<Array<{ team_number: number; player_id: string; round_number: number }>>([]);
  const [isRookiesOnlyDraft, setIsRookiesOnlyDraft] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const cpuDraftTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const draftBoardRef = useRef<HTMLDivElement | null>(null);
  const lastPickRef = useRef<number>(0);
  const isDraftPausedRef = useRef<boolean>(false);
  const [draftBoardScrolledUp, setDraftBoardScrolledUp] = useState(false);

  // Keep ref in sync with state for async functions
  useEffect(() => {
    console.log('🔄 Syncing ref with state:', { state: isDraftPaused, refBefore: isDraftPausedRef.current });
    isDraftPausedRef.current = isDraftPaused;
    console.log('🔄 Ref synced:', { refAfter: isDraftPausedRef.current });
  }, [isDraftPaused]);

  // Don't redirect - allow non-logged-in users to access temporary drafts
  const isTempDraft = draftId?.startsWith('temp_');

  const fetchDraftData = useCallback(async () => {
    if (!draftId) return;
    setIsRookiesOnlyDraft(false);

    try {
      let draftData: MockDraft;
      let existingPicks: DraftPick[] = [];

      // Check if this is a temporary draft
      if (isTempDraft) {
        const tempData = tempDraftStorage.getDraft(draftId);
        if (!tempData) {
          toast.error('Temporary draft not found');
          navigate('/mock-draft');
          return;
        }
        draftData = tempData.draft;
        existingPicks = tempData.picks || [];

        // Load settings from localStorage
        const tempSettings = tempSettingsStorage.get();
        if (tempSettings) {
          if (tempSettings.positionLimits) {
            setPositionLimits(tempSettings.positionLimits);
          }
          if (tempSettings.isSuperflex !== undefined) {
            setIsSuperflex(tempSettings.isSuperflex);
          }
        }
      } else {
        // Fetch draft from database (requires user)
        if (!user) {
          toast.error('Please sign in to access this draft');
          navigate('/auth');
          return;
        }

        const { data, error: draftError } = await supabase
          .from('mock_drafts')
          .select('*')
          .eq('id', draftId)
          .eq('user_id', user.id)
          .single();

        if (draftError) throw draftError;
        draftData = data;
      }

      // Ensure cpu_speed has a default value if not set; assign CPU archetypes if missing
      const draftWithDefaults: MockDraft = {
        ...draftData,
        cpu_speed: (draftData as any).cpu_speed || 'normal',
        cpu_archetypes: (draftData as any).cpu_archetypes ?? assignRandomNamedArchetypesForDraft(draftData.num_teams, draftData.user_pick_position),
      };
      console.log('Fetched draft data:', draftData);
      console.log('CPU speed in fetched data:', (draftData as any).cpu_speed);
      console.log('Draft with defaults:', draftWithDefaults);
      console.log('CPU speed value:', draftWithDefaults.cpu_speed);

      // Fetch league data (position limits, bucket settings) if draft is tied to a league
      let leagueData: { position_limits?: any; is_superflex?: boolean; scoring_format?: string; league_type?: string } | null = null;
      if (!isTempDraft && draftData.league_id) {
        const { data: ld } = await supabase
          .from('leagues')
          .select('position_limits, is_superflex, scoring_format, league_type')
          .eq('id', draftData.league_id)
          .single();
        leagueData = ld;
        
        if (leagueData?.position_limits) {
          const limits = leagueData.position_limits as {
            QB?: number;
            RB?: number;
            WR?: number;
            TE?: number;
            K?: number;
            DEF?: number;
            BENCH?: number;
          };
          setPositionLimits(limits);
        }
        
        if (leagueData?.is_superflex !== undefined) {
          setIsSuperflex(leagueData.is_superflex as boolean);
        }

        // Fetch team names
        const { data: teamNamesData } = await supabase
          .from('league_teams')
          .select('team_number, team_name')
          .eq('league_id', draftData.league_id)
          .order('team_number');
        
        if (teamNamesData) {
          const namesMap = new Map<number, string>();
          teamNamesData.forEach((team) => {
            if (team.team_name) {
              namesMap.set(team.team_number, team.team_name);
            }
          });
          setTeamNames(namesMap);
        }

        // Fetch keepers (only for logged-in, league drafts)
        const { data: keepersData } = await supabase
          .from('league_keepers')
          .select('team_number, player_id, round_number')
          .eq('league_id', draftData.league_id)
          .order('team_number')
          .order('round_number');
        if (keepersData && keepersData.length > 0) {
          setKeepers(keepersData);
        } else {
          setKeepers([]);
        }
      } else {
        setKeepers([]);
      }

      // Determine if rookies-only draft
      const isRookiesOnly = (draftData as any)?.player_pool === 'rookies' ||
        (isTempDraft && (tempSettingsStorage.get()?.playerPool === 'rookies' || tempSettingsStorage.get()?.rookiesOnly));
      setIsRookiesOnlyDraft(isRookiesOnly);

      // Determine draft bucket for rookies fetch
      const draftBucketForRookies = (() => {
        if (isTempDraft) {
          const ts = tempSettingsStorage.get();
          return {
            scoringFormat: ((draftData as any).scoring_format as string) || ts?.scoringFormat || 'ppr',
            leagueType: ts?.leagueType || 'dynasty',
            isSuperflex: ts?.isSuperflex ?? false,
          };
        }
        if (leagueData) {
          return {
            scoringFormat: (leagueData.scoring_format as string) || 'ppr',
            leagueType: (leagueData.league_type as string) || 'dynasty',
            isSuperflex: (leagueData.is_superflex as boolean) ?? false,
          };
        }
        return { scoringFormat: 'ppr', leagueType: 'dynasty', isSuperflex: false };
      })();

      let allPlayersData: any[] = [];

      if (isRookiesOnly) {
        // Rookies-only: fetch from get_rookies_rankings, then get full player records
        const rookiesRows = await fetchRookiesRankings(draftBucketForRookies);
        if (rookiesRows.length > 0) {
          const { data: playersData } = await supabase
            .from('players')
            .select('*')
            .in('id', rookiesRows.map((r) => r.player_id));
          const rankMap = new Map(rookiesRows.map((r) => [r.player_id, Number(r.rank)]));
          allPlayersData = (playersData || [])
            .map((p) => ({ ...p, adp: rankMap.get(p.id) ?? 999 }))
            .sort((a, b) => (rankMap.get(a.id) ?? 999) - (rankMap.get(b.id) ?? 999));
        }
      }

      if (allPlayersData.length === 0 && !isRookiesOnly) {
        // Fetch all players (including defenses) - they're just regular players with position 'D/ST'
        const { data } = await supabase
          .from('players')
          .select('*')
          .order('adp', { ascending: true });
        allPlayersData = data || [];
      }

      if (!isRookiesOnly) {
      
      // Use teams table for D/ST list when available; fallback to constant (see useNflTeams)
      const defenseNamesList = defenseTeamNames.length > 0 ? defenseTeamNames : NFL_DEFENSE_TEAM_NAMES;
      // Always filter to the 32 current teams (constant); teams table may have legacy rows
      const canonicalDefenseSet = new Set(NFL_DEFENSE_TEAM_NAMES);
      // Ensure all 32 defenses exist in the database (create missing ones)
      
      // Check which defenses are missing and create them
      // Use name + position to identify defenses (since we can't use custom string IDs with UUID type)
      const existingDefenseNames = new Set(
        (allPlayersData || [])
          .filter(p => p.position === 'D/ST')
          .map(p => p.name)
      );
      
      const missingDefenses = defenseNamesList.filter((teamName: string) => {
        return !existingDefenseNames.has(teamName);
      });
      
      if (missingDefenses.length > 0) {
        console.log(`DraftRoom: Creating ${missingDefenses.length} missing defenses...`);
        // Insert missing defenses - distribute ADPs between 150-200
        const defenseInserts = missingDefenses.map((teamName, index) => {
          // Distribute evenly across ADP 150-200 (50 point range)
          const adp = 150 + Math.floor((index / missingDefenses.length) * 50);
          return {
            name: teamName,
            position: 'D/ST',
            team: defenseTeamAbbrByName.get(teamName) ?? null,
            adp: adp,
            bye_week: null,
          };
        });
        
        const { error: insertError, data: insertData } = await supabase
          .from('players')
          .insert(defenseInserts)
          .select();
        
        if (insertError) {
          console.error('DraftRoom: Error inserting defenses:', insertError);
        } else {
          console.log(`DraftRoom: Successfully inserted ${insertData?.length || 0} defenses`);
          if (insertData && insertData.length > 0) {
            console.log(`DraftRoom: Inserted defense sample:`, insertData[0]);
            // Add the newly inserted defenses to allPlayersData immediately
            allPlayersData = [...(allPlayersData || []), ...insertData];
          }
        }
      }
      
      // Always re-fetch players to ensure we have all defenses (whether they were just inserted or already existed)
      // Add a small delay if we just inserted to ensure database consistency
      if (missingDefenses.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Query all players - Supabase has a default limit of 1000, so we need to handle this with pagination
      // First, get non-defense players with pagination
      let nonDefensePlayers: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      let nonDefenseError: any = null;

      while (hasMore) {
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .neq('position', 'D/ST')
          .order('adp', { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) {
          nonDefenseError = error;
          console.error('DraftRoom: Error re-fetching non-defense players:', error);
          break;
        }

        if (data && data.length > 0) {
          nonDefensePlayers = [...nonDefensePlayers, ...data];
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      
      // Then, separately query all defenses (they should be 32, well under any limit)
      const { data: allDefensePlayersRaw, error: defenseError } = await supabase
        .from('players')
        .select('*')
        .eq('position', 'D/ST')
        .order('created_at', { ascending: false }); // Get most recent first
      
      // Keep only canonical 32 teams (drop legacy rows like Oakland Raiders, San Diego Chargers, St. Louis Rams)
      const allDefensePlayers = (allDefensePlayersRaw || []).filter((d: { name: string }) => canonicalDefenseSet.has(d.name));
      
      if (nonDefenseError) {
        console.error('DraftRoom: Error re-fetching non-defense players:', nonDefenseError);
      }
      if (defenseError) {
        console.error('DraftRoom: Error re-fetching defense players:', defenseError);
      }
      
      // Deduplicate defenses by name - keep only the first (most recent) occurrence of each team
      const uniqueDefenseMap = new Map<string, (typeof allDefensePlayers)[number]>();
      if (allDefensePlayers) {
        for (const defense of allDefensePlayers) {
          if (!uniqueDefenseMap.has(defense.name)) {
            uniqueDefenseMap.set(defense.name, defense);
          }
        }
      }
      let defensePlayers = Array.from(uniqueDefenseMap.values());
      
      // Update ADPs for defenses to be between 150-200 (distribute evenly)
      // Sort by name to ensure consistent ordering
      defensePlayers = defensePlayers.sort((a, b) => a.name.localeCompare(b.name));
      const defensesToUpdate: { id: string; adp: number }[] = [];
      defensePlayers = defensePlayers.map((defense, index) => {
        const adp = 150 + Math.floor((index / defensePlayers.length) * 50);
        const normalizedTeam = defense.team && defense.team !== 'FA'
          ? defense.team
          : (defenseTeamAbbrByName.get(defense.name) ?? defense.team);
        // Only update if ADP is outside the desired range (e.g., still 999 or old range)
        if (Number(defense.adp) >= 200 || Number(defense.adp) < 150) {
          defensesToUpdate.push({ id: defense.id, adp });
          return { ...defense, adp, team: normalizedTeam };
        }
        return { ...defense, team: normalizedTeam };
      });
      
      // Update defenses in database if needed
      if (defensesToUpdate.length > 0) {
        console.log(`DraftRoom: Updating ADPs for ${defensesToUpdate.length} defenses to range 150-200`);
        // Update each defense's ADP in the database
        for (const defenseUpdate of defensesToUpdate) {
          await supabase
            .from('players')
            .update({ adp: defenseUpdate.adp })
            .eq('id', defenseUpdate.id);
        }
      }
      
      console.log(`DraftRoom: Found ${allDefensePlayers?.length || 0} total defenses, deduplicated to ${defensePlayers.length} unique defenses`);
      
      // Filter to standard fantasy positions only - exclude IDP (DL, LB, DB, DE, DT, etc.) that aren't in Rankings
      const VALID_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K']);
      const filteredNonDefense = (nonDefensePlayers || []).filter((p) =>
        p.position && VALID_POSITIONS.has(String(p.position).toUpperCase())
      );
      const excludedCount = (nonDefensePlayers || []).length - filteredNonDefense.length;
      if (excludedCount > 0) {
        console.log(`DraftRoom: Excluded ${excludedCount} IDP/non-fantasy players (DL, LB, DB, etc.)`);
      }
      
      // Merge the two queries and deduplicate multi-position players
      // (e.g. Taysom Hill QB/TE/RB, Connor Heyward RB/TE) who appear as separate rows
      const merged = [
        ...filteredNonDefense,
        ...defensePlayers
      ].sort((a, b) => {
        const adpA = Number(a.adp) || 999;
        const adpB = Number(b.adp) || 999;
        return adpA - adpB;
      });
      const updatedPlayersData = deduplicatePlayersByIdentity(merged);
      
      console.log(`DraftRoom: Merged ${nonDefensePlayers?.length || 0} non-defense players with ${defensePlayers.length} unique defenses`);
      
      if (updatedPlayersData && updatedPlayersData.length > 0) {
        // Debug: Check what positions exist in the returned data
        const uniquePositions = [...new Set(updatedPlayersData.map(p => p.position))];
        console.log(`DraftRoom: Unique positions in query result:`, uniquePositions);
        console.log(`DraftRoom: Total players returned: ${updatedPlayersData.length}`);
        
        // Check for D/ST with different casing or variations
        const allDefenseVariations = updatedPlayersData.filter(p => 
          p.position && (
            p.position === 'D/ST' || 
            p.position === 'DST' || 
            p.position === 'DEF' ||
            p.position.toLowerCase() === 'd/st' ||
            p.position.toLowerCase() === 'def'
          )
        );
        console.log(`DraftRoom: Players with defense-like positions:`, allDefenseVariations.length);
        if (allDefenseVariations.length > 0) {
          console.log(`DraftRoom: Defense-like position values:`, [...new Set(allDefenseVariations.map(p => p.position))]);
        }
        
        allPlayersData = updatedPlayersData;
        const defensesAfterRefetch = (allPlayersData || []).filter(p => p.position === 'D/ST');
        console.log(`DraftRoom: After refetch, found ${defensesAfterRefetch.length} defenses in database`);
        console.log(`DraftRoom: Defense names:`, defensesAfterRefetch.map(d => d.name));
        if (defensesAfterRefetch.length !== 32) {
          console.warn(`DraftRoom: Expected 32 defenses but found ${defensesAfterRefetch.length}`);
          // Try to find defenses by name instead
          const defensesByName = (allPlayersData || []).filter(p => 
            defenseNamesList.includes(p.name)
          );
          console.log(`DraftRoom: Found ${defensesByName.length} defenses by name matching`);
          if (defensesByName.length > 0) {
            console.log(`DraftRoom: Defense positions in DB:`, [...new Set(defensesByName.map(d => d.position))]);
          }
        }
      }
      }

      // Determine draft bucket for community rankings (reuse for community fetch)
      const draftBucket = (() => {
        if (isTempDraft) {
          const tempSettings = tempSettingsStorage.get();
          return {
            scoringFormat: ((draftData as any).scoring_format as string) || 'ppr',
            leagueType: (tempSettings?.leagueType as string) || 'season',
            isSuperflex: tempSettings?.isSuperflex ?? false,
          };
        }
        if (leagueData) {
          return {
            scoringFormat: (leagueData.scoring_format as string) || ((draftData as any).scoring_format as string) || 'ppr',
            leagueType: (leagueData.league_type as string) || 'season',
            isSuperflex: (leagueData.is_superflex as boolean) ?? false,
          };
        }
        return {
          scoringFormat: ((draftData as any).scoring_format as string) || 'ppr',
          leagueType: 'season',
          isSuperflex: false,
        };
      })();

      // Fetch community rankings for this bucket (CPU drafts from consensus, not user rankings)
      let communityRankMap = new Map<string, number>();
      if (draftBucket.leagueType !== 'dynasty') {
        const { data: communityData } = (await supabase.rpc('get_community_rankings' as any, {
          p_scoring_format: draftBucket.scoringFormat,
          p_league_type: draftBucket.leagueType,
          p_is_superflex: draftBucket.isSuperflex,
        })) as { data: { player_id: string; rank_position: number }[] | null };
        if (Array.isArray(communityData) && communityData.length > 0) {
          communityData.forEach((r) => communityRankMap.set(r.player_id, r.rank_position));
        }
      }

      // Rank players: use community consensus when available, else ADP
      const useCommunity = communityRankMap.size > 0;
      const maxCommRank = useCommunity ? Math.max(...communityRankMap.values()) : 0;
      const rankedPlayers: RankedPlayer[] = (allPlayersData || []).map((p, index) => {
        const rank = useCommunity
          ? (communityRankMap.get(p.id) ?? maxCommRank + index + 1)
          : index + 1; // ADP order when no community data
        const adp = useCommunity ? (communityRankMap.get(p.id) ?? maxCommRank + index + 1) : Number(p.adp);
        return { ...p, adp, rank };
      });
      rankedPlayers.sort((a, b) => a.rank - b.rank);
      const sortedRankedPlayers = rankedPlayers.map((p, index) => ({ ...p, rank: index + 1 }));
      
      // Debug: Log defenses before setting players
      const defensesInRanked = sortedRankedPlayers.filter(p => p.position === 'D/ST');
      console.log(`DraftRoom: Defenses in rankedPlayers before setPlayers: ${defensesInRanked.length}`);
      if (defensesInRanked.length > 0) {
        console.log(`DraftRoom: Defense names in rankedPlayers:`, defensesInRanked.map(d => d.name));
      }

      // Load picks before capping rounds so we never schedule more full rounds than the loaded pool supports
      let loadedPicks: DraftPick[] = existingPicks;
      if (!isTempDraft) {
        const { data: picksData } = await supabase
          .from('draft_picks')
          .select('*')
          .eq('mock_draft_id', draftId)
          .order('pick_number', { ascending: true });
        loadedPicks = picksData || [];
      }

      const poolSize = sortedRankedPlayers.length;
      const numTeamsCap = draftWithDefaults.num_teams;
      const maxRoundsByLoadedPool = Math.floor(poolSize / numTeamsCap);

      if (poolSize < numTeamsCap) {
        toast.error(
          `Not enough players in the pool (${poolSize}) for ${numTeamsCap} teams. Each team needs at least one pick.`
        );
        setLoading(false);
        navigate('/mock-draft');
        return;
      }

      let finalNumRounds = draftWithDefaults.num_rounds;
      if (finalNumRounds > maxRoundsByLoadedPool) {
        finalNumRounds = maxRoundsByLoadedPool;
        if (isTempDraft) {
          const stored = tempDraftStorage.getDraft(draftId!);
          if (stored) {
            tempDraftStorage.saveDraft({ ...stored.draft, num_rounds: finalNumRounds }, stored.picks);
          }
        } else if (user) {
          await supabase.from('mock_drafts').update({ num_rounds: finalNumRounds }).eq('id', draftId);
        }
      }

      const finalDraft: MockDraft = { ...draftWithDefaults, num_rounds: finalNumRounds };
      const cappedTotalPicks = finalNumRounds * numTeamsCap;
      if (loadedPicks.length > cappedTotalPicks) {
        console.warn(
          'DraftRoom: pick count exceeds capped total; capping may be inconsistent',
          loadedPicks.length,
          cappedTotalPicks
        );
      }

      setDraft(finalDraft);
      setPlayers(sortedRankedPlayers);
      setPicks(loadedPicks);
      setCurrentPick(loadedPicks.length + 1);
    } catch (error: any) {
      console.error('Error loading draft:', error);
      setIsRookiesOnlyDraft(false);
      const errorMessage = error?.message || 'Unknown error occurred';
      toast.error(`Failed to load draft: ${errorMessage}`);
      
      // Show error details in console for debugging
      if (error?.details) {
        console.error('Error details:', error.details);
      }
      if (error?.hint) {
        console.error('Error hint:', error.hint);
      }
      
      // Navigate back after a short delay to allow user to see error
      setTimeout(() => {
        navigate('/mock-draft');
      }, 2000);
    } finally {
      setLoading(false);
    }
  }, [user, draftId, navigate, isTempDraft]);

  useEffect(() => {
    if (draftId) {
      // For temporary drafts, don't require user. For regular drafts, require user.
      if (isTempDraft || user) {
        fetchDraftData();
      }
    }
  }, [user, draftId, fetchDraftData, isTempDraft]);

  const getCurrentTeam = () => {
    if (!draft) return 1;
    const totalTeams = draft.num_teams;
    const round = Math.ceil(currentPick / totalTeams);
    const pickInRound = ((currentPick - 1) % totalTeams) + 1;

    if (draft.draft_order === 'snake' && round % 2 === 0) {
      return totalTeams - pickInRound + 1;
    }
    return pickInRound;
  };

  const getCurrentRound = () => {
    if (!draft) return 1;
    return Math.ceil(currentPick / draft.num_teams);
  };

  const getTeamName = (teamNumber: number): string => {
    const customName = teamNames.get(teamNumber);
    if (customName) return customName;
    return `Team ${teamNumber}`;
  };

  // Build starting roster slots. In superflex every FLEX can accept a QB, but we only allow one QB total across FLEX slots (enforced in slot-filling logic). So 2nd QB can go in any open FLEX; 3rd+ QB → bench.
  const getStartingSlots = (): { label: string; positions: string[] }[] => {
    const flexCount = positionLimits?.FLEX ?? (isSuperflex ? 2 : 1);
    const base = [
      { label: 'QB', positions: ['QB'] },
      { label: 'RB1', positions: ['RB'] },
      { label: 'RB2', positions: ['RB'] },
      { label: 'WR1', positions: ['WR'] },
      { label: 'WR2', positions: ['WR'] },
      { label: 'TE', positions: ['TE'] },
    ];
    const flexPositions = isSuperflex ? ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'D/ST'] : ['RB', 'WR', 'TE'];
    const flexSlots = Array.from({ length: flexCount }, () => ({ label: 'FLEX', positions: flexPositions }));
    return [...base, ...flexSlots, { label: 'DEF', positions: ['DEF', 'D/ST'] }, { label: 'K', positions: ['K'] }];
  };

  // Check if there's an available roster spot for a given position
  // opts: when provided, counts future keepers at this position toward the limit (position limits still apply)
  const hasAvailableSpotForPosition = (
    position: string,
    draftedPlayers: RankedPlayer[],
    opts?: { teamNumber: number; currentRound: number }
  ): boolean => {
    if (isRookiesOnlyDraft && draft && draft.num_rounds > 0) {
      if (draftedPlayers.length >= draft.num_rounds) return false;
      return true;
    }

    let pos = position.toUpperCase();
    // Map D/ST to DEF for position limits
    if (pos === 'D/ST') {
      pos = 'DEF';
    }

    // Check position limit first - this applies to both starters and bench
    const positionLimit = positionLimits[pos as keyof typeof positionLimits];
    let currentCount = draftedPlayers.filter((p) => {
      let pPos = p.position.toUpperCase();
      if (pPos === 'D/ST') pPos = 'DEF';
      return pPos === pos;
    }).length;

    // Add future keepers at this position (round_number > currentRound) toward the limit
    if (opts && keepers.length > 0) {
      const futureKeeperCount = keepers
        .filter((k) => k.team_number === opts.teamNumber && k.round_number > opts.currentRound)
        .filter((k) => {
          const p = players.find((pl) => pl.id === k.player_id);
          if (!p) return false;
          let pPos = p.position.toUpperCase();
          if (pPos === 'D/ST') pPos = 'DEF';
          return pPos === pos;
        }).length;
      currentCount += futureKeeperCount;
    }

    if (positionLimit !== undefined && currentCount >= positionLimit) {
      return false; // Reached position limit (applies to both starters and bench)
    }

    const startingSlots = getStartingSlots();
    const benchCount = positionLimits?.BENCH ?? 6;

    // Simulate roster assignment. In superflex, at most one QB is allowed in FLEX slots (2nd QB can go in any open FLEX).
    const assignedPlayerIds = new Set<string>();
    let qbPlacedInFlex = false;
    const availableSlots: { label: string; positions: string[] }[] = [];

    startingSlots.forEach((slot) => {
      const isFlexSlot = slot.label === 'FLEX';
      // In superflex, only one FLEX slot can hold a QB; once we've placed a QB in a FLEX, treat remaining FLEX as RB/WR/TE only
      const effectivePositions = isFlexSlot && isSuperflex && qbPlacedInFlex
        ? ['RB', 'WR', 'TE']
        : slot.positions.map(p => (p === 'D/ST' ? 'DEF' : p.toUpperCase()));
      const canAcceptPosition = effectivePositions.includes(pos);

      const availablePlayer = draftedPlayers.find((p) => {
        if (assignedPlayerIds.has(p.id)) return false;
        const pPos = p.position === 'D/ST' ? 'DEF' : p.position.toUpperCase();
        return effectivePositions.includes(pPos);
      });

      if (availablePlayer) {
        assignedPlayerIds.add(availablePlayer.id);
        if (isFlexSlot && (availablePlayer.position === 'QB' || availablePlayer.position === 'qb')) {
          qbPlacedInFlex = true;
        }
      } else if (canAcceptPosition) {
        availableSlots.push(slot);
      }
    });

    // Count remaining players (for bench)
    const remainingPlayers = draftedPlayers.filter((p) => !assignedPlayerIds.has(p.id));
    const availableBenchSpots = benchCount - remainingPlayers.length;

    // Check if there's any available spot (starting slot or bench)
    if (availableSlots.length > 0) {
      return true; // At least one starting slot available
    }

    if (availableBenchSpots > 0) {
      return true; // At least one bench spot available (position limit already checked above)
    }

    return false; // No available spots
  };

  // Defense pool rule: only 32 NFL defenses; you may draft a DEF only if enough remain for every other team to fill their DEF slots.
  const canDraftDefense = (teamNumber: number): boolean => {
    const defLimit = positionLimits?.DEF ?? 1;
    const defPicks = picks.filter((p) => {
      const pl = players.find((a) => a.id === p.player_id);
      return pl && (pl.position === 'DEF' || pl.position === 'D/ST');
    });
    const totalDefDrafted = defPicks.length;
    if (totalDefDrafted >= 32) return false;
    const defCountByTeam: Record<number, number> = {};
    for (let t = 1; t <= (draft?.num_teams ?? 0); t++) defCountByTeam[t] = 0;
    defPicks.forEach((p) => { defCountByTeam[p.team_number] = (defCountByTeam[p.team_number] ?? 0) + 1; });
    let otherTeamsRemainingSlots = 0;
    for (let t = 1; t <= (draft?.num_teams ?? 0); t++) {
      if (t === teamNumber) continue;
      otherTeamsRemainingSlots += Math.max(0, defLimit - (defCountByTeam[t] ?? 0));
    }
    const remainingAfterThisPick = 32 - (totalDefDrafted + 1);
    return remainingAfterThisPick >= otherTeamsRemainingSlots;
  };

  useEffect(() => {
    if (isRookiesOnlyDraft) return;
    if (draft && positionFilter === 'DEF' && !canDraftDefense(draft.user_pick_position)) {
      setPositionFilter('ALL');
    }
  }, [draft, positionFilter, picks, positionLimits, isRookiesOnlyDraft]);

  const draftPlayer = async (player: RankedPlayer, pickNumber: number, teamNumber: number, roundNumber: number, isAutodraft = false) => {
    if (!draft || !draftId) {
      throw new Error('Draft or draftId is missing');
    }

    if (!player || !player.id) {
      throw new Error('Invalid player data');
    }

    const totalPicks = draft.num_teams * draft.num_rounds;
    if (pickNumber > totalPicks) {
      throw new Error(`Pick number ${pickNumber} exceeds total picks ${totalPicks}`);
    }

    const newPick: DraftPick = {
      id: isTempDraft ? `temp_pick_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : '',
      mock_draft_id: draftId,
      player_id: player.id,
      team_number: teamNumber,
      round_number: roundNumber,
      pick_number: pickNumber,
      created_at: new Date().toISOString(),
      ...(isAutodraft && { is_autodraft: true }),
    };

    // For temporary drafts, save to localStorage
    if (isTempDraft) {
      const updatedPicks = [...picks, newPick];
      tempDraftStorage.saveDraft(draft, updatedPicks);
      return newPick;
    }

    // For regular drafts, save to database
    if (!user) {
      throw new Error('User must be logged in to save picks');
    }

    const { data, error } = await supabase
      .from('draft_picks')
      .insert({
        mock_draft_id: draftId,
        player_id: player.id,
        team_number: teamNumber,
        round_number: roundNumber,
        pick_number: pickNumber,
        is_autodraft: isAutodraft,
      })
      .select()
      .single();

    if (error) {
      console.error('Database error inserting pick:', error, newPick);
      throw error;
    }

    if (!data) {
      throw new Error('No data returned from insert');
    }

    return data;
  };

  const handleUserDraft = async (player: RankedPlayer, isAutodraft = false) => {
    if (!draft || !draftId || isDrafting) return;
    
    const isUserTurn = getCurrentTeam() === draft.user_pick_position;
    if (!isUserTurn) {
      toast.error("It's not your turn to pick!");
      return;
    }

    const totalPicks = draft.num_teams * draft.num_rounds;
    if (currentPick > totalPicks) {
      toast.info('Draft is complete!');
      return;
    }

    // Check if user has reached position limit
    const userPicks = picks.filter((p) => p.team_number === draft.user_pick_position);
    const userDraftedPlayers = userPicks
      .map((pick) => players.find((p) => p.id === pick.player_id))
      .filter((p): p is RankedPlayer => !!p);
    
    const userPositionCounts: Record<string, number> = {};
    userDraftedPlayers.forEach((p) => {
      let pos = p.position.toUpperCase();
      // Map D/ST to DEF for position limits
      if (pos === 'D/ST') {
        pos = 'DEF';
      }
      userPositionCounts[pos] = (userPositionCounts[pos] || 0) + 1;
    });
    
    // Check if there's an available roster spot for this position (account for future keepers)
    const spotOpts = draft ? { teamNumber: draft.user_pick_position, currentRound: getCurrentRound() } : undefined;
    if (!hasAvailableSpotForPosition(player.position, userDraftedPlayers, spotOpts)) {
      let playerPos = player.position.toUpperCase();
      if (playerPos === 'D/ST') {
        playerPos = 'DEF';
      }
      const limit = positionLimits[playerPos as keyof typeof positionLimits];
      const currentCount = userPositionCounts[playerPos] || 0;
      
      if (limit !== undefined && currentCount >= limit) {
        toast.error(`You have reached the limit for ${playerPos} (${limit} players)`);
      } else {
        toast.error(`You have no more roster spots available for ${playerPos}`);
      }
      return;
    }

    if (!isRookiesOnlyDraft && (player.position === 'DEF' || player.position === 'D/ST')) {
      if (!canDraftDefense(draft.user_pick_position)) {
        toast.error('You cannot take another defense; only 32 exist and other teams need room to fill their DEF slots.');
        return;
      }
    }

    setIsDrafting(true);

    try {
      // Track passed players before making the pick
      const pickNumber = currentPick;
      const roundNumber = getCurrentRound();
      const maxRounds = draft.num_rounds;
      const roundsToTrack = Math.floor(maxRounds * 0.8); // Only track first 80% of rounds
      
      if (roundNumber <= roundsToTrack) {
        // Get available players (not yet drafted) sorted by ADP
        const draftedIds = new Set(picks.map((p) => p.player_id));
        const available = players
          .filter((p) => p && p.id && !draftedIds.has(p.id))
          .filter((p) => {
            // Only consider players available at this pick (ADP <= pick + 5 buffer)
            return p.adp <= pickNumber + 5;
          })
          .sort((a, b) => a.adp - b.adp) // Sort by ADP ascending
          .slice(0, 5) // Top 5 by ADP
          .map((p) => p.id)
          .filter((id) => id !== player.id); // Exclude the player we're about to draft
        
        // Update passed_players in the draft record (if column exists)
        // This is optional tracking data, so we silently fail if the column doesn't exist
        if (available.length > 0 && draftId) {
          try {
            const { data: draftData, error: selectError } = await supabase
              .from('mock_drafts')
              .select('passed_players')
              .eq('id', draftId)
              .single();
            
            // If column doesn't exist, silently skip this feature
            if (selectError) {
              // Check if error is about missing column (400 Bad Request typically means column doesn't exist)
              // Just skip this optional feature, don't exit the function
              // Column doesn't exist, that's fine - this is optional tracking
            } else if (draftData) {
              const existingPassed = ((draftData as any).passed_players as any[]) || [];
              const newEntry = {
                pick_number: pickNumber,
                passed_players: available,
              };
              
              const { error: updateError } = await supabase
                .from('mock_drafts')
                .update({ passed_players: [...existingPassed, newEntry] } as any)
                .eq('id', draftId);
              
              // Silently ignore update errors (column might not exist)
              // This is optional tracking data
            }
          } catch (error) {
            // Silently ignore errors related to passed_players column
            // This is optional tracking data and not critical for draft functionality
          }
        }
      }

      const data = await draftPlayer(player, currentPick, getCurrentTeam(), getCurrentRound(), isAutodraft);
      if (data) {
        setPicks((prev) => [...prev, data]);
        setCurrentPick((prev) => prev + 1);
      }

      // Don't auto-complete - user must click "Finish Draft" button after validating roster
    } catch (error) {
      toast.error('Failed to make pick');
    } finally {
      setIsDrafting(false);
    }
  };

  // CPU auto-draft logic - simplified approach
  useEffect(() => {
    if (!draft || !draftId || loading || players.length === 0) return;
    if (isDrafting) {
      console.log('⏸️ CPU useEffect: Already drafting, skipping');
      return; // Don't run if already drafting
    }
    // Use ref for immediate pause check (no React state delay)
    if (isDraftPausedRef.current) {
      console.log('⏸️ CPU useEffect: Draft is PAUSED (ref check), clearing timeouts and returning');
      // Clear any pending timeouts when paused
      if (cpuDraftTimeoutRef.current) {
        clearTimeout(cpuDraftTimeoutRef.current);
        cpuDraftTimeoutRef.current = null;
      }
      return; // Don't run if draft is paused
    }
    console.log('▶️ CPU useEffect: Draft is NOT paused, continuing...');
    
    const totalPicks = draft.num_teams * draft.num_rounds;
    if (currentPick > totalPicks) return;
    
    const currentTeam = getCurrentTeam();
    const currentRound = getCurrentRound();
    const isUserTurn = currentTeam === draft.user_pick_position;
    
    // Keeper pick: if this team has a keeper in this round, auto-assign (user and CPU)
    const keeperForThisPick = keepers.find(
      (k) => k.team_number === currentTeam && k.round_number === currentRound
    );
    if (keeperForThisPick) {
      const keeperPlayer = players.find((p) => p.id === keeperForThisPick.player_id);
      if (keeperPlayer) {
        const makeKeeperPick = async () => {
          if (isDraftPausedRef.current) return;
          setIsDrafting(true);
          try {
            const data = await draftPlayer(
              keeperPlayer,
              currentPick,
              currentTeam,
              currentRound,
              true // isAutodraft - keeper is forced
            );
            if (data) {
              setPicks((prev) => [...prev, data]);
              setCurrentPick((prev) => prev + 1);
              if (isUserTurn) toast.info(`Keeper: ${keeperPlayer.name}`);
            }
          } catch (e: any) {
            toast.error(`Keeper pick failed: ${e?.message || 'Unknown error'}`);
          } finally {
            setIsDrafting(false);
          }
        };
        makeKeeperPick();
        return;
      }
    }
    
    if (isUserTurn) {
      console.log('User turn, waiting...');
      return; // Wait for user to pick
    }
    
    console.log(`🤖 CPU turn - pick ${currentPick}, team ${currentTeam}`);
    console.log('🤖 CPU useEffect: About to start CPU pick, pause state:', {
      isDraftPaused,
      refValue: isDraftPausedRef.current,
      isDrafting
    });
    
    // It's a CPU turn - make the pick
    const makeCpuPick = async () => {
      console.log('🤖 makeCpuPick: Function started, checking pause state...');
      // Check if draft is paused before starting (use ref for immediate check)
      if (isDraftPausedRef.current) {
        console.log('⏸️ makeCpuPick: ABORTED - draft is paused (ref check)');
        return;
      }
      console.log('▶️ makeCpuPick: Not paused, continuing with pick...');
      
      setIsDrafting(true);
      
      try {
        // Get available players (not yet drafted, not keepers) - sorted by rank
        const draftedIds = new Set(picks.map((p) => p.player_id));
        const keeperIds = new Set(keepers.map((k) => k.player_id));
        let available = players
          .filter((p) => p && p.id && !draftedIds.has(p.id) && !keeperIds.has(p.id))
          .sort((a, b) => a.rank - b.rank);
        
        // Calculate current team's drafted players
        const teamPicks = picks.filter((p) => p.team_number === currentTeam);
        const teamDraftedPlayers = teamPicks
          .map((pick) => players.find((p) => p.id === pick.player_id))
          .filter((p): p is RankedPlayer => !!p);
        
        // Filter out players where this team has no available roster spots (account for future keepers)
        const spotOpts = { teamNumber: currentTeam, currentRound: getCurrentRound() };
        available = available.filter((p) => {
          return hasAvailableSpotForPosition(p.position, teamDraftedPlayers, spotOpts);
        });
        
        // Defense pool rule: only 32 NFL defenses; a team may draft a DEF only if enough remain for every other team to fill their DEF slots.
        const defenses = available.filter((p) => p.position === 'D/ST' || p.position === 'DEF');
        const nonDefenses = available.filter((p) => p.position !== 'D/ST' && p.position !== 'DEF');
        if (defenses.length > 0 && !canDraftDefense(currentTeam)) {
          available = nonDefenses;
        } else if (defenses.length > 0) {
          const teamsWithoutDefense = new Set<number>();
          for (let teamNum = 1; teamNum <= draft.num_teams; teamNum++) {
            const teamDefCount = picks.filter((p) => {
              const pickPlayer = players.find((pl) => pl.id === p.player_id);
              return p.team_number === teamNum && pickPlayer && (pickPlayer.position === 'D/ST' || pickPlayer.position === 'DEF');
            }).length;
            if (teamDefCount === 0) teamsWithoutDefense.add(teamNum);
          }
          const currentTeamHasDefense = teamDraftedPlayers.some((p) => p.position === 'D/ST' || p.position === 'DEF');
          if (!currentTeamHasDefense && teamsWithoutDefense.size === 1) {
            available = [...defenses, ...nonDefenses];
          }
        }
        
        // If no players available after filtering by position limits, allow drafting any available player
        // This prevents the draft from getting stuck in large leagues where position limits might be restrictive
        if (available.length === 0) {
          console.warn('No available players matching position limits, falling back to any available player');
          // Fallback: allow drafting any undrafted player to prevent draft from stalling
          const draftedIds = new Set(picks.map((p) => p.player_id));
          available = players
            .filter((p) => p && p.id && !draftedIds.has(p.id))
            .sort((a, b) => a.rank - b.rank);
          
          // If still no players available, the draft is truly stuck (all players drafted)
          if (available.length === 0) {
            console.error('No players available at all - draft may be complete or stuck');
            setIsDrafting(false);
            return;
          }
        }
        
        // Pick using archetype-aware logic (combo of 2–3 archetypes per CPU; fallback: BPA-style random from top 5)
        const archetypeIdOrIds = draft?.cpu_archetypes?.[currentTeam];
        const flexCount = positionLimits?.FLEX ?? (isSuperflex ? 2 : 1);
        const benchCount = positionLimits?.BENCH ?? 6;
        const context = {
          roundNumber: getCurrentRound(),
          numRounds: draft.num_rounds,
          numTeams: draft.num_teams,
          teamDraftedPlayers,
          positionLimits: positionLimits ?? undefined,
          scoringFormat: (draft as any).scoring_format,
          pickNumber: currentPick,
          draftOrder: draft.draft_order,
          flexSlots: flexCount,
          benchSize: benchCount,
          rookieFlexDraft: isRookiesOnlyDraft,
        };
        const cpuPick = selectCpuPick(available, archetypeIdOrIds, context) ?? available[0];
        
        // Check if draft is paused before proceeding with the pick (use ref for immediate check)
        console.log('🤖 makeCpuPick: Before delay, checking pause:', {
          refValue: isDraftPausedRef.current,
          stateValue: isDraftPaused
        });
        if (isDraftPausedRef.current) {
          console.log('⏸️ makeCpuPick: ABORTED before delay - draft is paused');
          setIsDrafting(false);
          return;
        }
        
        // Delay for UX (so user can see what happened)
        // Calculate delay based on CPU speed: normal = 750ms, slow = 1500ms (2x), fast = 375ms (0.5x), rapid = 100ms (very short pause)
        const cpuSpeed = (draft?.cpu_speed || 'normal') as 'slow' | 'normal' | 'fast' | 'rapid' | 'instant';
        console.log('🤖 CPU Speed setting:', cpuSpeed, 'from draft:', draft?.cpu_speed);
        const baseDelay = 750;
        // Support both 'rapid' and 'instant' for backward compatibility
        // Rapid mode should have a very short pause (100ms) for better UX, not completely instant
        const delay = (cpuSpeed === 'rapid' || cpuSpeed === 'instant') ? 100 : cpuSpeed === 'slow' ? baseDelay * 2 : cpuSpeed === 'fast' ? baseDelay / 2 : baseDelay;
        console.log('🤖 Calculated delay:', delay, 'ms');
        if (delay > 0) {
          console.log('🤖 Waiting', delay, 'ms...');
          await new Promise((resolve) => setTimeout(resolve, delay));
          console.log('🤖 Delay complete');
        }
        
        // Check again after delay - user might have paused during the delay (use ref for immediate check)
        console.log('🤖 makeCpuPick: After delay, checking pause:', {
          refValue: isDraftPausedRef.current,
          stateValue: isDraftPaused
        });
        if (isDraftPausedRef.current) {
          console.log('⏸️ makeCpuPick: ABORTED after delay - draft is paused');
          setIsDrafting(false);
          return;
        }
        
        // Final check right before making the pick (most critical point)
        console.log('🤖 makeCpuPick: Before draftPlayer call, checking pause:', {
          refValue: isDraftPausedRef.current,
          stateValue: isDraftPaused
        });
        if (isDraftPausedRef.current) {
          console.log('⏸️ makeCpuPick: ABORTED right before draftPlayer - draft is paused');
          setIsDrafting(false);
          return;
        }
        
        const roundNumber = getCurrentRound();
        const data = await draftPlayer(cpuPick, currentPick, currentTeam, roundNumber);
        
        // Check one more time after the API call (in case pause was clicked during the call)
        if (isDraftPausedRef.current && data) {
          console.log('CPU pick completed but draft is now paused - this should not happen');
        }
        
        if (data) {
          // Update picks and current pick
          setPicks((prev) => [...prev, data]);
          const nextPick = currentPick + 1;
          setCurrentPick(nextPick);
          
          // Scroll draft board to bottom after a short delay (only if user is at bottom)
          setTimeout(() => {
            if (draftBoardRef.current) {
              const container = draftBoardRef.current;
              const scrollHeight = container.scrollHeight;
              const scrollTop = container.scrollTop;
              const clientHeight = container.clientHeight;
              
              // Check if user is at or near the bottom (within 50px threshold)
              const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
              
              // Only auto-scroll if user is already at the bottom
              if (isNearBottom) {
                container.scrollTop = scrollHeight;
              }
            }
          }, 100);
        }
        
        // Don't auto-complete - user must click "Finish Draft" button after validating roster
        setIsDrafting(false);
      } catch (error: any) {
        console.error('CPU draft error:', error);
        toast.error(`Failed to make CPU pick: ${error?.message || 'Unknown error'}`);
        setIsDrafting(false);
      }
    };
    
    // Clear any existing timeout
    if (cpuDraftTimeoutRef.current) {
      clearTimeout(cpuDraftTimeoutRef.current);
    }
    
    // Check pause state again before starting pick (use ref for immediate check)
    console.log('🤖 About to start CPU pick, final pause check:', {
      refValue: isDraftPausedRef.current,
      stateValue: isDraftPaused,
      currentPick,
      currentTeam
    });
    if (isDraftPausedRef.current) {
      console.log('⏸️ CPU pick cancelled: draft is paused (before starting)');
      return;
    }
    
    // For rapid mode, make picks immediately without delay
    // For other modes, add a small delay before starting
    const cpuSpeed = (draft?.cpu_speed || 'normal') as 'slow' | 'normal' | 'fast' | 'rapid' | 'instant';
    console.log('🤖 CPU Speed:', cpuSpeed, 'about to start pick');
    // Support both 'rapid' and 'instant' for backward compatibility
    if (cpuSpeed === 'rapid' || cpuSpeed === 'instant') {
      // Make pick immediately (but check pause first)
      console.log('🤖 Rapid mode: Checking pause before immediate call...');
      if (!isDraftPausedRef.current) {
        console.log('▶️ Rapid mode: Not paused, calling makeCpuPick immediately');
        makeCpuPick();
      } else {
        console.log('⏸️ Rapid mode: PAUSED, not calling makeCpuPick');
      }
    } else {
      // Start the CPU pick process with a small delay
      console.log('🤖 Normal mode: Setting timeout, will check pause in 100ms');
      cpuDraftTimeoutRef.current = setTimeout(() => {
        console.log('🤖 Timeout fired, checking pause before executing...');
        // Check pause again before executing (user might have paused during delay)
        if (!isDraftPausedRef.current) {
          console.log('▶️ Timeout: Not paused, calling makeCpuPick');
          makeCpuPick();
        } else {
          console.log('⏸️ Timeout: PAUSED, not calling makeCpuPick');
        }
      }, 100);
    }
    
    return () => {
      if (cpuDraftTimeoutRef.current) {
        clearTimeout(cpuDraftTimeoutRef.current);
      }
    };
  }, [currentPick, draft, draftId, isDrafting, loading, picks, players, isDraftPaused, keepers, isRookiesOnlyDraft]);


  // Timer logic for user's turn
  useEffect(() => {
    if (!draft || isDrafting || loading) return;
    
    const totalPicks = draft.num_teams * draft.num_rounds;
    if (currentPick > totalPicks || draft.status === 'completed') return;
    
    const isUserTurn = getCurrentTeam() === draft.user_pick_position;
    
    if (!isUserTurn) {
      // Clear timer when it's not user's turn
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setTimeRemaining(null);
      // Don't reset pause state - user might have paused the entire draft
      return;
    }
    
    // Start or reset timer for user's turn
    const timerDuration = draft.pick_timer ?? 30;
    if (timerDuration === 0) {
      // No timer
      setTimeRemaining(null);
      // Don't reset pause state - user might have paused the entire draft
      return;
    }
    
    // Reset timer when pick changes (new turn)
    if (lastPickRef.current !== currentPick) {
      setTimeRemaining(timerDuration);
      // Only reset pause if it was paused for timer (not for entire draft)
      // Actually, don't auto-reset pause - let user control it
      lastPickRef.current = currentPick;
      // Clear any existing interval
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    
    // Initialize timer if it's null
    if (timeRemaining === null) {
      setTimeRemaining(timerDuration);
    }
    
    // Don't start interval if paused
    if (isDraftPaused) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    
    // Clear any existing interval before starting new one
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [currentPick, draft, isDrafting, loading, isDraftPaused]);

  // Auto-pick when timer hits 0
  useEffect(() => {
    const autoPick = async () => {
      if (timeRemaining !== 0 || isDrafting || !draft) return;
      
      const isUserTurn = getCurrentTeam() === draft.user_pick_position;
      if (!isUserTurn) return;
      
      // Get top available player that can fit in roster
      const draftedIds = new Set(picks.map((p) => p.player_id));
      const userPicksForAuto = picks.filter((p) => p.team_number === draft.user_pick_position);
      const userDraftedPlayersForAuto = userPicksForAuto
        .map((pick) => players.find((p) => p.id === pick.player_id))
        .filter((p): p is RankedPlayer => !!p);
      
      const spotOpts = draft ? { teamNumber: draft.user_pick_position, currentRound: getCurrentRound() } : undefined;
      const available = players
        .filter((p) => !draftedIds.has(p.id))
        .filter((p) => !keeperPlayerIds.has(p.id))
        .filter((p) => hasAvailableSpotForPosition(p.position, userDraftedPlayersForAuto, spotOpts));
      
      if (available.length === 0) {
        toast.error('No available players that fit your roster');
        return;
      }
      
      const topPlayer = available[0];
      toast.info(`Time's up! Auto-drafting ${topPlayer.name}`);
      
      await handleUserDraft(topPlayer, true);
    };
    
    autoPick();
  }, [timeRemaining, picks, players, draft, keepers]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);


  const draftedPlayerIds = new Set(picks.map((p) => p.player_id));
  const keeperPlayerIds = new Set(keepers.map((k) => k.player_id));
  // Deduplicate by id - exclude drafted and keeper players (keepers are auto-assigned in their round)
  const availablePlayers = Array.from(
    new Map(
      players
        .filter((p) => !draftedPlayerIds.has(p.id) && !keeperPlayerIds.has(p.id))
        .map((p) => [p.id, p])
    ).values()
  );

  // Calculate user's current position counts
  const userPicks = picks.filter((p) => p.team_number === (draft?.user_pick_position || 1));
  const userDraftedPlayers = userPicks
    .map((pick) => players.find((p) => p.id === pick.player_id))
    .filter((p): p is RankedPlayer => !!p);
  
  const userPositionCounts: Record<string, number> = {};
  userDraftedPlayers.forEach((player) => {
    let pos = player.position.toUpperCase();
    // Map D/ST to DEF for position limits
    if (pos === 'D/ST') {
      pos = 'DEF';
    }
    userPositionCounts[pos] = (userPositionCounts[pos] || 0) + 1;
  });

  // Check if a team has a complete roster (all starting positions filled)
  const isTeamRosterComplete = (teamNumber: number): boolean => {
    const teamPicks = picks.filter((p) => p.team_number === teamNumber);
    const teamDraftedPlayers = teamPicks
      .map((pick) => players.find((p) => p.id === pick.player_id))
      .filter((p): p is RankedPlayer => !!p);

    const teamStartingSlots = getStartingSlots();
    const teamAssignedPlayerIds = new Set<string>();
    const teamFilledSlots: boolean[] = [];

    teamStartingSlots.forEach((slot) => {
      const availablePlayer = teamDraftedPlayers.find(
        (p) => slot.positions.includes(p.position) && !teamAssignedPlayerIds.has(p.id)
      );
      if (availablePlayer) {
        teamAssignedPlayerIds.add(availablePlayer.id);
        teamFilledSlots.push(true);
      } else {
        teamFilledSlots.push(false);
      }
    });

    return teamFilledSlots.every(filled => filled);
  };

  // Check if all teams have complete rosters
  const areAllTeamsComplete = (): boolean => {
    if (!draft) return false;
    
    for (let teamNum = 1; teamNum <= draft.num_teams; teamNum++) {
      if (!isTeamRosterComplete(teamNum)) {
        return false;
      }
    }
    return true;
  };

  // Calculate user's upcoming pick numbers in the draft order
  const getUserUpcomingPicks = (): number[] => {
    if (!draft) return [];
    
    const userPosition = draft.user_pick_position;
    const numTeams = draft.num_teams;
    const numRounds = draft.num_rounds;
    const upcomingPicks: number[] = [];
    
    for (let round = 1; round <= numRounds; round++) {
      let pickNumber: number;
      if (draft.draft_order === 'snake') {
        // Snake draft: odd rounds go forward, even rounds go backward
        if (round % 2 === 1) {
          // Odd round: normal order
          pickNumber = (round - 1) * numTeams + userPosition;
        } else {
          // Even round: reversed order
          pickNumber = (round - 1) * numTeams + (numTeams - userPosition + 1);
        }
      } else {
        // Linear draft: always same order
        pickNumber = (round - 1) * numTeams + userPosition;
      }
      upcomingPicks.push(pickNumber);
    }
    
    return upcomingPicks;
  };

  // Get the next pick number that hasn't been made yet
  const getNextUserPick = (): number | null => {
    const upcomingPicks = getUserUpcomingPicks();
    const nextPick = upcomingPicks.find(pickNum => pickNum >= currentPick);
    return nextPick || null;
  };

  // Calculate how many picks until user's next pick
  const picksUntilNext = (): number => {
    const nextPick = getNextUserPick();
    if (!nextPick) return 0;
    return nextPick - currentPick;
  };

  // Get all rank positions that correspond to user's upcoming picks
  // Returns an array of rank positions that should be highlighted
  const getHighlightRanks = (): number[] => {
    const upcomingPicks = getUserUpcomingPicks();
    const highlightRanks: number[] = [];
    
    upcomingPicks.forEach((pickNum) => {
      // Skip if this pick has already been made
      if (pickNum < currentPick) return;
      
      // Calculate how many picks until this pick
      const picksUntil = pickNum - currentPick;
      
      // If it's currently the user's turn (picksUntil === 0), don't highlight
      // Otherwise, highlight the player at the position that would be available at this pick
      // If picksUntil = 1, that means 1 person picks before you, so they'll take rank 1, and you'll see rank 2
      // Formula: highlightRank = picksUntil + 1 (because picksUntil people will pick before you)
      if (picksUntil > 0) {
        highlightRanks.push(picksUntil + 1);
      }
    });
    
    return highlightRanks;
  };

  // Filter players based on search term, position filter, position limits, and available roster spots (only for user's view)
  // Uses same search logic as Rankings page: name, team, or name parts (e.g. "Hunter" matches "Travis Hunter")
  const filteredPlayers = availablePlayers.filter((p) => {
    // Position filter
    if (positionFilter !== 'ALL') {
      const playerPos = p.position === 'D/ST' ? 'DEF' : p.position;
      if (playerPos !== positionFilter) return false;
    }
    
    // Search filter - same logic as Rankings page
    const searchLower = searchTerm.toLowerCase().trim();
    const matchesSearch =
      searchLower === '' ||
      p.name.toLowerCase().includes(searchLower) ||
      p.team?.toLowerCase().includes(searchLower) ||
      p.name.toLowerCase().split(' ').some((part) => part.includes(searchLower));
    if (!matchesSearch) return false;
    
    // Check if there's an available roster spot for this position (account for future keepers)
    const spotOpts = draft ? { teamNumber: draft.user_pick_position, currentRound: getCurrentRound() } : undefined;
    if (!hasAvailableSpotForPosition(p.position, userDraftedPlayers, spotOpts)) return false;
    if (!isRookiesOnlyDraft && (p.position === 'DEF' || p.position === 'D/ST')) {
      return draft ? canDraftDefense(draft.user_pick_position) : false;
    }
    return true;
  });

  // Sort filtered players by rank to determine highlight position
  // This shows which player would be available at user's pick if everyone picks in order
  // Use filtered players so highlights work even when position-filtered
  const sortedFilteredPlayers = [...filteredPlayers].sort((a, b) => a.rank - b.rank);
  const highlightRanks = getHighlightRanks();
  
  // Get all players that should be highlighted (based on rank positions in all available players)
  // Calculate from all available players to show which player you'd get if everyone picks in order
  const sortedAvailablePlayers = [...availablePlayers].sort((a, b) => a.rank - b.rank);
  const highlightedPlayerIds = new Set<string>();
  highlightRanks.forEach((rankOffset) => {
    const rankIndex = rankOffset - 1; // Convert to 0-based index
    if (rankIndex >= 0 && rankIndex < sortedAvailablePlayers.length) {
      const highlightedPlayer = sortedAvailablePlayers[rankIndex];
      // Add the highlighted player even if it's not in filteredPlayers
      // This ensures highlights show even when position-filtered or when player doesn't have roster spot
      highlightedPlayerIds.add(highlightedPlayer.id);
    }
  });

  const isUserPick = draft && getCurrentTeam() === draft.user_pick_position;
  const totalPicks = draft ? draft.num_teams * draft.num_rounds : 0;
  // Draft is complete when all picks are made (or manually marked as completed)
  // Note: We don't require all teams to have complete rosters, as this can be impossible
  // in larger leagues where there aren't enough players at certain positions
  const isDraftComplete = (picks.length >= totalPicks && totalPicks > 0) || draft?.status === 'completed';

  // Check if user's roster is complete (all starting positions filled)
  const startingSlotsForRoster = getStartingSlots();
  const assignedPlayerIds = new Set<string>();
  const filledSlots: boolean[] = [];
  
  startingSlotsForRoster.forEach((slot) => {
    const availablePlayer = userDraftedPlayers.find(
      (p) => slot.positions.includes(p.position) && !assignedPlayerIds.has(p.id)
    );
    if (availablePlayer) {
      assignedPlayerIds.add(availablePlayer.id);
      filledSlots.push(true);
    } else {
      filledSlots.push(false);
    }
  });
  
  const isRosterComplete = filledSlots.every(filled => filled);

  // Auto-scroll draft board to bottom when picks change (only if user is already at bottom)
  useEffect(() => {
    if (draftBoardRef.current && picks.length > 0) {
      // Small delay to ensure DOM has updated
      setTimeout(() => {
        if (draftBoardRef.current) {
          const container = draftBoardRef.current;
          const scrollHeight = container.scrollHeight;
          const scrollTop = container.scrollTop;
          const clientHeight = container.clientHeight;
          
          // Check if user is at or near the bottom (within 50px threshold)
          const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
          
          // Only auto-scroll if user is already at the bottom
          if (isNearBottom) {
            container.scrollTop = scrollHeight;
          }
        }
      }, 50);
    }
  }, [picks.length]);

  // Track if draft board is scrolled up (for scrollbar visibility)
  const handleDraftBoardScroll = useCallback(() => {
    const container = draftBoardRef.current;
    if (!container) return;
    const { scrollHeight, scrollTop, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 30;
    setDraftBoardScrolledUp(!isNearBottom);
  }, []);

  // Sync scroll state when picks change (e.g. after auto-scroll to bottom)
  useEffect(() => {
    const t = setTimeout(handleDraftBoardScroll, 60);
    return () => clearTimeout(t);
  }, [picks.length, handleDraftBoardScroll]);

  // Bucket-based archetype assignment: prefer unearned badges in the same strategy bucket, then rotate when the bucket is fully earned.
  const resolveArchetypeForCompletion = useCallback(
    async (
      draftVal: MockDraft,
      picksVal: DraftPick[],
      playersVal: RankedPlayer[],
      config: DraftConfig,
      isSuperflexVal: boolean
    ): Promise<{
      userDetectedArchetype: string;
      userDetectedArchetypeIndex: number;
      userDetectedChaosArchetype: string | null;
    }> => {
      const userPicks = picksVal.filter((p) => p.team_number === draftVal.user_pick_position);
      const teamPicksForDetection = userPicks
        .map((pick) => {
          const pl = playersVal.find((p) => p.id === pick.player_id);
          if (!pl) return null;
          return {
            round_number: pick.round_number,
            pick_number: pick.pick_number,
            position: pl.position || '',
            rank: pl.rank ?? pl.adp ?? 999,
            adp: pl.adp ?? pl.rank ?? 999,
            team: pl.team ?? undefined,
            name: pl.name ?? undefined,
          };
        })
        .filter((p): p is NonNullable<typeof p> => !!p)
        .sort((a, b) => a.pick_number - b.pick_number);
      const strategies = detectStrategiesFromPicks(teamPicksForDetection, config);
      const bucket = getArchetypeBucketFromStrategies(strategies);
      let earnedSet = new Set<number>();
      let timesAssignedFromBucket = 0;
      let earnedChaosNames = new Set<string>();
      if (user?.id) {
        const { data: completed } = await supabase
          .from('mock_drafts')
          .select('user_detected_archetype_index, user_detected_chaos_archetype')
          .eq('user_id', user.id)
          .eq('status', 'completed');
        for (const r of completed || []) {
          const row = r as { user_detected_archetype_index?: number | null; user_detected_chaos_archetype?: string | null };
          if (typeof row.user_detected_archetype_index === 'number') {
            earnedSet.add(row.user_detected_archetype_index);
          }
          if (row.user_detected_chaos_archetype) {
            earnedChaosNames.add(row.user_detected_chaos_archetype);
          }
        }
        timesAssignedFromBucket = (completed || []).filter((r) => {
          const idx = (r as { user_detected_archetype_index?: number }).user_detected_archetype_index;
          return typeof idx === 'number' && bucket.includes(idx);
        }).length;
      } else {
        const tempIds = tempDraftStorage.getDraftList();
        const tempIndices: number[] = [];
        for (const id of tempIds) {
          const t = tempDraftStorage.getDraft(id);
          if (t?.draft.status === 'completed') {
            const d = t.draft as { user_detected_archetype_index?: number; user_detected_chaos_archetype?: string | null };
            if (typeof d.user_detected_archetype_index === 'number') tempIndices.push(d.user_detected_archetype_index);
            if (d.user_detected_chaos_archetype) earnedChaosNames.add(d.user_detected_chaos_archetype);
          }
        }
        tempIndices.forEach((i) => earnedSet.add(i));
        timesAssignedFromBucket = tempIndices.filter((i) => bucket.includes(i)).length;
      }
      const tieBreakHash = hashPicksForTieBreak(teamPicksForDetection);
      const chosenIndex = chooseArchetypeIndexFromBucket(bucket, earnedSet, timesAssignedFromBucket, tieBreakHash);
      const name = FULL_ARCHETYPE_LIST[chosenIndex]?.name ?? detectArchetypeName(teamPicksForDetection, config);

      // Fetch age for chaos (Old Boys Club, Time Traveler, Retirement Watch)
      const espnIds = [...new Set(userPicks.map((pick) => {
        const pl = playersVal.find((p) => p.id === pick.player_id);
        return pl?.espn_id != null ? String(pl.espn_id) : null;
      }).filter(Boolean))] as string[];
      const ageByEspnId = new Map<string, number>();
      if (espnIds.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < espnIds.length; i += batchSize) {
          const batch = espnIds.slice(i, i + batchSize);
          const { data: rows } = await supabase.from('players_info').select('espn_id, birth_date').in('espn_id', batch);
          for (const row of rows || []) {
            const age = getAgeFromBirthDate(row.birth_date);
            if (age != null) ageByEspnId.set(String(row.espn_id), age);
          }
        }
      }

      const chaosPicks: ChaosPick[] = userPicks
        .map((pick) => {
          const pl = playersVal.find((p) => p.id === pick.player_id);
          if (!pl) return null;
          const espnId = pl.espn_id != null ? String(pl.espn_id) : null;
          const age = espnId != null ? (ageByEspnId.get(espnId) ?? undefined) : undefined;
          return {
            round_number: pick.round_number,
            pick_number: pick.pick_number,
            position: pl.position || '',
            rank: pl.rank ?? pl.adp ?? 999,
            adp: pl.adp ?? pl.rank ?? 999,
            team: pl.team ?? undefined,
            name: pl.name ?? undefined,
            age,
          };
        })
        .filter((p): p is ChaosPick => p != null)
        .sort((a, b) => a.pick_number - b.pick_number);
      const chaosName = detectChaosArchetype(chaosPicks, {
        totalRounds: config.totalRounds,
        leagueSize: config.leagueSize,
        isSuperflex: isSuperflexVal,
      }, earnedChaosNames);

      return {
        userDetectedArchetype: name,
        userDetectedArchetypeIndex: chosenIndex,
        userDetectedChaosArchetype: chaosName ?? null,
      };
    },
    [user?.id]
  );

  // Handle showing completion screen when draft was already completed
  useEffect(() => {
    if (!draft || picks.length < totalPicks || totalPicks <= 0 || draft.status === 'completed') return;
    const flexCount = positionLimits?.FLEX ?? (isSuperflex ? 2 : 1);
    const benchCount = positionLimits?.BENCH ?? 6;
    const config = buildDraftConfig(flexCount, benchCount, draft.num_teams);
    let cancelled = false;
    (async () => {
      const { userDetectedArchetype, userDetectedArchetypeIndex, userDetectedChaosArchetype } = await resolveArchetypeForCompletion(draft, picks, players, config, isSuperflex);
      if (cancelled) return;
      if (isTempDraft) {
        const updatedDraft = {
          ...draft,
          status: 'completed' as const,
          completed_at: new Date().toISOString(),
          user_detected_archetype: userDetectedArchetype,
          user_detected_archetype_index: userDetectedArchetypeIndex,
          user_detected_chaos_archetype: userDetectedChaosArchetype ?? undefined,
        };
        tempDraftStorage.saveDraft(updatedDraft, picks);
        setDraft(updatedDraft);
      } else {
        await supabase
          .from('mock_drafts')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            user_detected_archetype: userDetectedArchetype,
            user_detected_archetype_index: userDetectedArchetypeIndex,
            user_detected_chaos_archetype: userDetectedChaosArchetype,
          })
          .eq('id', draftId);
        setDraft((prev) =>
          prev
            ? {
                ...prev,
                status: 'completed',
                user_detected_archetype: userDetectedArchetype,
                user_detected_archetype_index: userDetectedArchetypeIndex,
                user_detected_chaos_archetype: userDetectedChaosArchetype ?? undefined,
              }
            : prev
        );
      }
    })();
    return () => { cancelled = true; };
  }, [draft, picks.length, totalPicks, draftId, picks, isTempDraft, players, positionLimits, isSuperflex, resolveArchetypeForCompletion]);

  // Trigger confetti when draft completes
  useEffect(() => {
    if (isDraftComplete) {
      // Confetti configuration
      const duration = 1500;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
      }

      const interval: NodeJS.Timeout = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [isDraftComplete]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading draft...</p>
        </div>
      </div>
    );
  }

  // Show error state if draft failed to load
  if (!draft && !loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="glass-card p-8 text-center">
            <h1 className="font-display text-2xl mb-4">Failed to Load Draft</h1>
            <p className="text-muted-foreground mb-6">
              There was an error loading the draft. This may be due to invalid league settings.
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={() => navigate('/mock-draft')}>
                Back to Drafts
              </Button>
              <Button variant="hero" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isDraftComplete) {
    // Get user's team data
    const userPicks = picks.filter((p) => p.team_number === (draft?.user_pick_position || 1));
    const draftedPlayers = userPicks
      .map((pick) => players.find((p) => p.id === pick.player_id))
      .filter((p): p is RankedPlayer => !!p);

    const startingSlots = getStartingSlots();
    const assignedPlayerIds = new Set<string>();
    const filledSlots: (RankedPlayer | null)[] = [];

    startingSlots.forEach((slot) => {
      const availablePlayer = draftedPlayers.find(
        (p) => {
          const pos = p.position === 'D/ST' ? 'DEF' : p.position;
          return slot.positions.includes(pos) && !assignedPlayerIds.has(p.id);
        }
      );
      if (availablePlayer) {
        assignedPlayerIds.add(availablePlayer.id);
        filledSlots.push(availablePlayer);
      } else {
        filledSlots.push(null);
      }
    });

    // Remaining players go to bench
    const benchCount = positionLimits?.BENCH ?? 6;
    const benchPlayers = draftedPlayers.filter((p) => !assignedPlayerIds.has(p.id));
    const teamName = teamNames.get(draft?.user_pick_position || 1) || 'MY TEAM';
    const sortedCompletionPicks = [...userPicks].sort((a, b) => a.pick_number - b.pick_number);

    // Detect archetype from user's picks
    const flexCount = positionLimits?.FLEX ?? (isSuperflex ? 2 : 1);
    const config = buildDraftConfig(flexCount, benchCount, draft?.num_teams ?? 12);
    const teamPicksForDetection = userPicks
      .map((pick) => {
        const pl = players.find((p) => p.id === pick.player_id);
        if (!pl) return null;
        return {
          round_number: pick.round_number,
          pick_number: pick.pick_number,
          position: pl.position || '',
          rank: pl.rank ?? pl.adp ?? 999,
          adp: pl.adp ?? pl.rank ?? 999,
        };
      })
      .filter((p): p is NonNullable<typeof p> => !!p)
      .sort((a, b) => a.pick_number - b.pick_number);
    /** Picks are done but resolveArchetypeForCompletion / Finish Draft has not persisted yet — avoid wrong detectArchetypeName vs bucket-assigned badge. */
    const isFinalizingBadge =
      draft?.status !== 'completed' && teamPicksForDetection.length > 0;
    const detectedArchetype = isFinalizingBadge
      ? ''
      : (draft?.user_detected_archetype ??
        (teamPicksForDetection.length > 0 ? detectArchetypeName(teamPicksForDetection, config) : 'Unknown'));
    const chaosName = isFinalizingBadge ? null : (draft?.user_detected_chaos_archetype ?? null);
    const chaosMeta = chaosName ? getChaosArchetypeByName(chaosName) : null;
    const isReplaceChaos = chaosName != null && isChaosReplace(chaosName);
    const headlineBadgeLabel =
      isFinalizingBadge
        ? ''
        : isReplaceChaos && chaosName
          ? chaosName
          : !isReplaceChaos && chaosName && chaosMeta && detectedArchetype
            ? `${detectedArchetype} & ${chaosName}`
            : detectedArchetype;
    const archetypeMeta = getArchetypeByNameOrImproviser(detectedArchetype);
    const mainFlavor = archetypeMeta?.flavorText;
    const flavorText = isReplaceChaos ? (chaosMeta?.flavorText ?? null) : mainFlavor;

    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <Trophy className="w-16 h-16 text-accent mx-auto mb-4" />
            <h1 className="font-display text-4xl mb-4">DRAFT COMPLETE!</h1>
            <p className="text-xl font-medium text-accent mb-1">
              {isFinalizingBadge ? 'Locking in your badges…' : `You're ${headlineBadgeLabel}`}
            </p>
            <div className="flex flex-col items-center gap-4 mb-4 w-full max-w-5xl mx-auto">
              {isFinalizingBadge ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                  <p className="text-muted-foreground text-sm text-center max-w-sm">
                    Assigning your archetype and any chaos badges from this draft…
                  </p>
                </div>
              ) : isReplaceChaos && chaosMeta ? (
                <>
                  <ArchetypeBadge
                    archetypeName={chaosName!}
                    iconOnly={false}
                    size="md"
                    flavorText={chaosMeta.flavorText}
                    locked={false}
                    className="shrink-0"
                  />
                  {chaosMeta.flavorText && (
                    <p className="text-muted-foreground text-sm max-w-xl text-center">
                      {capitalizeSentenceStart(chaosMeta.flavorText)}
                    </p>
                  )}
                </>
              ) : !isReplaceChaos && chaosName && chaosMeta ? (
                <div className="flex flex-col sm:flex-row items-start justify-center gap-8 md:gap-12 w-full">
                  <div className="flex flex-col items-center gap-2 flex-1 min-w-0 max-w-sm">
                    <ArchetypeBadge
                      archetypeName={detectedArchetype}
                      archetypeIndex={typeof draft?.user_detected_archetype_index === 'number' ? draft.user_detected_archetype_index : undefined}
                      iconOnly={false}
                      size="md"
                      locked={false}
                      className="shrink-0"
                    />
                    {mainFlavor && (
                      <p className="text-muted-foreground text-sm text-center max-w-sm">
                        {capitalizeSentenceStart(mainFlavor)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-2 flex-1 min-w-0 max-w-sm">
                    <ArchetypeBadge
                      archetypeName={chaosName}
                      iconOnly={false}
                      size="md"
                      flavorText={chaosMeta.flavorText}
                      locked={false}
                      className="shrink-0"
                    />
                    {chaosMeta.flavorText && (
                      <p className="text-muted-foreground text-xs text-center max-w-sm">
                        {capitalizeSentenceStart(chaosMeta.flavorText)}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <ArchetypeBadge
                    archetypeName={detectedArchetype}
                    archetypeIndex={typeof draft?.user_detected_archetype_index === 'number' ? draft.user_detected_archetype_index : undefined}
                    iconOnly={false}
                    size="md"
                    locked={false}
                    className="shrink-0"
                  />
                  {flavorText && (
                    <p className="text-muted-foreground text-sm max-w-xl text-center">
                      {capitalizeSentenceStart(flavorText)}
                    </p>
                  )}
                </>
              )}
            </div>
            <p className="text-muted-foreground mb-6 mt-6">
              {draft?.name} has been completed and saved to your history.
            </p>
            <div className="flex justify-center gap-4 flex-wrap">
              <Button variant="outline" onClick={() => navigate('/history')}>
                View History
              </Button>
              <Button variant="outline" onClick={() => navigate('/badges', { state: { fromDraftComplete: true } })}>
                View Badges
              </Button>
              <Button variant="hero" onClick={() => navigate('/mock-draft')}>
                Start New Draft
              </Button>
            </div>
          </div>

          {/* Team Display - Two Column Layout (or ordered pick slots for rookie-only) */}
          <div className="glass-card p-6">
            <h2 className="font-display text-2xl mb-6 text-center">{teamName}</h2>

            {isRookiesOnlyDraft && draft ? (
              <div>
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Rookie draft — {draft.num_rounds} pick{draft.num_rounds !== 1 ? 's' : ''} in order (any position per slot).
                </p>
                <div className="max-w-xl mx-auto space-y-2">
                  {Array.from({ length: draft.num_rounds }, (_, index) => {
                    const pick = sortedCompletionPicks[index];
                    const player = pick ? players.find((p) => p.id === pick.player_id) : undefined;
                    return (
                      <div
                        key={pick?.id ?? `rookie-complete-${index}`}
                        className={cn(
                          'flex items-center gap-2 p-3 rounded-lg text-sm border',
                          player ? 'bg-secondary/50 border-border/30' : 'bg-secondary/30 border-border/30'
                        )}
                      >
                        <div className="w-14 text-xs font-semibold text-muted-foreground shrink-0">
                          Pick {index + 1}
                        </div>
                        {player ? (
                          <>
                            <div className="flex-1 truncate font-medium">{player.name}</div>
                            <PositionBadge position={player.position} className="text-[10px]" />
                            <div className="text-xs text-muted-foreground shrink-0">{displayTeamAbbrevOrFa(player.team, player.position, player.name)}</div>
                          </>
                        ) : (
                          <div className="flex-1 text-muted-foreground/50 italic">Empty</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Starting Lineup - Left Column */}
              <div>
                <div className="text-sm text-muted-foreground uppercase tracking-wider mb-3 font-semibold">
                  Starting Lineup
                </div>
                <div className="space-y-2">
                  {startingSlots.map((slot, index) => {
                    const player = filledSlots[index];
                    return (
                      <div
                        key={`${slot.label}-${index}`}
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-lg text-sm border",
                          player ? "bg-secondary/50 border-border/30" : "bg-secondary/30 border-border/30"
                        )}
                      >
                        <div className="w-12 text-xs font-semibold text-muted-foreground">
                          {slot.label}
                        </div>
                        {player ? (
                          <>
                            <div className="flex-1 truncate font-medium">{player.name}</div>
                            <PositionBadge position={player.position} className="text-[10px]" />
                            <div className="text-xs text-muted-foreground">{displayTeamAbbrevOrFa(player.team, player.position, player.name)}</div>
                          </>
                        ) : (
                          <div className="flex-1 text-muted-foreground/50 italic">Empty</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bench - Right Column */}
              <div>
                <div className="text-sm text-muted-foreground uppercase tracking-wider mb-3 font-semibold">
                  Bench
                </div>
                <div className="space-y-2">
                  {Array.from({ length: benchCount }).map((_, index) => {
                    const player = benchPlayers[index];
                    return (
                      <div
                        key={`bench-${index}`}
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-lg text-sm border",
                          player ? "bg-secondary/50 border-border/30" : "bg-secondary/20 border-border/20"
                        )}
                      >
                        <div className="w-12 text-xs font-semibold text-muted-foreground">
                          BN{index + 1}
                        </div>
                        {player ? (
                          <>
                            <div className="flex-1 truncate font-medium">{player.name}</div>
                            <PositionBadge position={player.position} className="text-[10px]" />
                            <div className="text-xs text-muted-foreground">{displayTeamAbbrevOrFa(player.team, player.position, player.name)}</div>
                          </>
                        ) : (
                          <div className="flex-1 text-muted-foreground/50 italic">Empty</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background overflow-hidden flex flex-col">
      <Navbar />

      <main className="flex-1 min-h-0 overflow-hidden flex flex-col max-w-[1400px] w-full mx-auto px-4 py-4">
        {/* Draft Header */}
        <div className="glass-card p-4 mb-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="font-display text-2xl">{draft?.name}</h1>
            <p className="text-sm text-muted-foreground">
              {draft?.num_teams} teams • {draft?.num_rounds} rounds • {draft?.draft_order} draft
            </p>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Timer - show when user has a timer set, pause button always available */}
            {draft && draft.pick_timer && draft.pick_timer > 0 && (
              <div className="text-center">
                {isUserPick && timeRemaining !== null ? (
                  <>
                    <div className="text-sm text-muted-foreground flex items-center gap-1 justify-center">
                      <Timer className="w-3 h-3" /> Timer
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "font-display text-3xl transition-colors",
                        timeRemaining <= 5 ? "text-destructive animate-pulse" : "text-accent"
                      )}>
                        {timeRemaining}s
                      </div>
                      <Button
                        variant="outline"
                        size="default"
                        className="h-10 px-4 gap-2 border-2 border-primary/30 bg-primary/10 hover:bg-primary/20 hover:border-primary/50"
                        onClick={() => {
                          const newPausedState = !isDraftPaused;
                          console.log('🛑 PAUSE BUTTON CLICKED (timer view):', {
                            currentState: isDraftPaused,
                            newState: newPausedState,
                            refBefore: isDraftPausedRef.current,
                            isDrafting,
                            hasTimeout: !!cpuDraftTimeoutRef.current,
                            currentPick
                          });
                          setIsDraftPaused(newPausedState);
                          isDraftPausedRef.current = newPausedState;
                          console.log('🛑 PAUSE STATE UPDATED (timer view):', {
                            state: newPausedState,
                            refAfter: isDraftPausedRef.current
                          });
                          // Clear any pending CPU picks immediately when pausing
                          if (newPausedState && cpuDraftTimeoutRef.current) {
                            console.log('🛑 Clearing CPU timeout (timer view)');
                            clearTimeout(cpuDraftTimeoutRef.current);
                            cpuDraftTimeoutRef.current = null;
                          }
                          // When resuming, the useEffect will automatically re-run due to isDraftPaused in dependency array
                          if (!newPausedState) {
                            console.log('▶️ RESUMED: useEffect should re-run to continue CPU picks');
                          }
                        }}
                        title={isDraftPaused ? "Resume draft" : "Pause draft"}
                      >
                        {isDraftPaused ? (
                          <>
                            <Play className="w-4 h-4" />
                            <span className="text-sm">Resume</span>
                          </>
                        ) : (
                          <>
                            <Pause className="w-4 h-4" />
                            <span className="text-sm">Pause</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-muted-foreground">Timer</div>
                    <Button
                      variant="outline"
                      size="default"
                      className="h-10 px-4 gap-2 border-2 border-primary/30 bg-primary/10 hover:bg-primary/20 hover:border-primary/50"
                      onClick={() => {
                        const newPausedState = !isDraftPaused;
                        console.log('🛑 PAUSE BUTTON CLICKED:', {
                          currentState: isDraftPaused,
                          newState: newPausedState,
                          refBefore: isDraftPausedRef.current,
                          isDrafting,
                          hasTimeout: !!cpuDraftTimeoutRef.current,
                          currentPick
                        });
                        setIsDraftPaused(newPausedState);
                        isDraftPausedRef.current = newPausedState;
                        console.log('🛑 PAUSE STATE UPDATED:', {
                          state: newPausedState,
                          refAfter: isDraftPausedRef.current
                        });
                        // Clear any pending CPU picks immediately when pausing
                        if (newPausedState && cpuDraftTimeoutRef.current) {
                          console.log('🛑 Clearing CPU timeout');
                          clearTimeout(cpuDraftTimeoutRef.current);
                          cpuDraftTimeoutRef.current = null;
                        }
                        // When resuming, the useEffect will automatically re-run due to isDraftPaused in dependency array
                        if (!newPausedState) {
                          console.log('▶️ RESUMED: useEffect should re-run to continue CPU picks');
                        }
                      }}
                      title={isDraftPaused ? "Resume draft" : "Pause draft"}
                    >
                      {isDraftPaused ? (
                        <>
                          <Play className="w-4 h-4" />
                          <span className="text-sm">Resume</span>
                        </>
                      ) : (
                        <>
                          <Pause className="w-4 h-4" />
                          <span className="text-sm">Pause</span>
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Round</div>
              <div className="font-display text-3xl text-gradient">{getCurrentRound()}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Pick</div>
              <div className="font-display text-3xl text-gradient">{currentPick}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">On the Clock</div>
              <div className={cn(
                "font-display text-3xl",
                isUserPick ? "text-accent" : "text-foreground"
              )}>
                {getTeamName(getCurrentTeam())}
                {isUserPick && <span className="text-sm ml-2">(YOU)</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentPick > totalPicks && !isDraftComplete && (
              <Button 
                variant="gold" 
                size="sm" 
                onClick={async () => {
                  if (!draft) return;
                  const flexCount = positionLimits?.FLEX ?? (isSuperflex ? 2 : 1);
                  const benchCount = positionLimits?.BENCH ?? 6;
                  const config = buildDraftConfig(flexCount, benchCount, draft.num_teams);
                  const userPicks = picks.filter((p) => p.team_number === draft.user_pick_position);
                  const teamPicksForDetection = userPicks
                    .map((pick) => {
                      const pl = players.find((p) => p.id === pick.player_id);
                      if (!pl) return null;
                      return {
                        round_number: pick.round_number,
                        pick_number: pick.pick_number,
                        position: pl.position || '',
                        rank: pl.rank ?? pl.adp ?? 999,
                        adp: pl.adp ?? pl.rank ?? 999,
                      };
                    })
                    .filter((p): p is NonNullable<typeof p> => !!p)
                    .sort((a, b) => a.pick_number - b.pick_number);
                  const { userDetectedArchetype, userDetectedArchetypeIndex, userDetectedChaosArchetype } = await resolveArchetypeForCompletion(draft, picks, players, config, isSuperflex);
                  if (isTempDraft) {
                    const updatedDraft = {
                      ...draft,
                      status: 'completed' as const,
                      completed_at: new Date().toISOString(),
                      user_detected_archetype: userDetectedArchetype,
                      user_detected_archetype_index: userDetectedArchetypeIndex,
                      user_detected_chaos_archetype: userDetectedChaosArchetype ?? undefined,
                    };
                    tempDraftStorage.saveDraft(updatedDraft, picks);
                    setDraft(updatedDraft);
                    toast.success('Draft complete!');
                  } else {
                    await supabase
                      .from('mock_drafts')
                      .update({
                        status: 'completed',
                        completed_at: new Date().toISOString(),
                        user_detected_archetype: userDetectedArchetype,
                        user_detected_archetype_index: userDetectedArchetypeIndex,
                        user_detected_chaos_archetype: userDetectedChaosArchetype,
                      })
                      .eq('id', draftId);
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            status: 'completed',
                            user_detected_archetype: userDetectedArchetype,
                            user_detected_archetype_index: userDetectedArchetypeIndex,
                            user_detected_chaos_archetype: userDetectedChaosArchetype ?? undefined,
                          }
                        : prev
                    );
                    toast.success('Draft complete!');
                  }
                }}
              >
                <Trophy className="w-4 h-4 mr-1" /> Finish Draft
              </Button>
            )}
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => navigate('/mock-draft')}
            >
              <LogOut className="w-4 h-4 mr-1" /> Exit Draft
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-0 overflow-hidden">
          {/* My Roster: align to top of row; scroll inside cell if roster is taller than the players column */}
          <div className="lg:col-span-1 min-h-0 flex flex-col justify-start overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin">
            <MyRoster 
              picks={picks} 
              players={players} 
              userPickPosition={draft?.user_pick_position || 1}
              positionLimits={positionLimits}
              isSuperflex={isSuperflex}
              userKeepers={draft?.user_pick_position ? keepers.filter((k) => k.team_number === draft.user_pick_position).map((k) => ({ player_id: k.player_id, round_number: k.round_number })) : undefined}
              currentRound={getCurrentRound()}
              rookieDraftSlots={isRookiesOnlyDraft && draft ? draft.num_rounds : undefined}
            />
          </div>

          {/* Available Players */}
          <div className="lg:col-span-2 min-h-0 glass-card p-4 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h2 className="font-display text-xl">AVAILABLE PLAYERS</h2>
              <div className="flex items-center gap-2">
                <Select value={positionFilter} onValueChange={setPositionFilter}>
                  <SelectTrigger className="w-32 bg-secondary/50 border-border/50 h-9">
                    <SelectValue placeholder="Position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Positions</SelectItem>
                    <SelectItem value="QB">QB</SelectItem>
                    <SelectItem value="RB">RB</SelectItem>
                    <SelectItem value="WR">WR</SelectItem>
                    <SelectItem value="TE">TE</SelectItem>
                    <SelectItem value="K">K</SelectItem>
                    {!isRookiesOnlyDraft && draft && canDraftDefense(draft.user_pick_position) && (
                      <SelectItem value="DEF">DEF</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-secondary/50 border-border/50 h-9"
                  />
                </div>
              </div>
            </div>

            {/* Show picks until next user pick */}
            {picksUntilNext() > 0 && (
              <div className="mb-3 text-sm text-muted-foreground text-center flex-shrink-0">
                {picksUntilNext()} pick{picksUntilNext() !== 1 ? 's' : ''} until your next pick
              </div>
            )}
            
            <div className="space-y-1 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin">
              {/* Include highlighted players even if they're not in filteredPlayers (e.g., when position-filtered) */}
              {(() => {
                const term = searchTerm.trim().toLowerCase();
                const hasActiveSearch = term.length > 0;
                const hasPositionFilter = positionFilter !== 'ALL';
                const filteredPlayerIds = new Set(filteredPlayers.map(p => p.id));
                // Only add highlighted players when NOT searching AND NOT position-filtering - otherwise show only filtered results
                const highlightedButNotFiltered = (hasActiveSearch || hasPositionFilter) ? [] : Array.from(highlightedPlayerIds)
                  .map(id => availablePlayers.find(p => p.id === id))
                  .filter((p): p is RankedPlayer => {
                    if (!p || filteredPlayerIds.has(p.id)) return false;
                    const spotOpts = draft ? { teamNumber: draft.user_pick_position, currentRound: getCurrentRound() } : undefined;
                    if (!hasAvailableSpotForPosition(p.position, userDraftedPlayers, spotOpts)) return false;
                    if (!isRookiesOnlyDraft && (p.position === 'DEF' || p.position === 'D/ST')) {
                      return draft ? canDraftDefense(draft.user_pick_position) : false;
                    }
                    return true;
                  });
                
                // Combine filtered players with highlighted players (only when no search/position filter)
                // Deduplicate by id to avoid React key warnings and ensure correct display
                const combined = [...filteredPlayers, ...highlightedButNotFiltered];
                const seenIds = new Set<string>();
                const deduped = combined.filter((p) => {
                  if (seenIds.has(p.id)) return false;
                  seenIds.add(p.id);
                  return true;
                });
                const playersToRender = deduped.sort((a, b) => a.rank - b.rank);
                
                return playersToRender.map((player) => {
                const getPositionRankClass = (pos: string) => {
                  switch (pos.toUpperCase()) {
                    case 'QB': return 'bg-qb/20 text-qb border border-qb/50';
                    case 'RB': return 'bg-rb/20 text-rb border border-rb/50';
                    case 'WR': return 'bg-wr/20 text-wr border border-wr/50';
                    case 'TE': return 'bg-te/20 text-te border border-te/50';
                    case 'K': return 'bg-k/20 text-k border border-k/50';
                    case 'DEF': return 'bg-def/20 text-def border border-def/50';
                    default: return 'bg-muted text-muted-foreground';
                  }
                };
                
                // Check if this player should be highlighted (one of the players that would be available at user's picks)
                const shouldHighlight = highlightedPlayerIds.has(player.id);
                
                return (
                  <div
                    key={player.id}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors group",
                      shouldHighlight && "bg-accent/20 border-2 border-accent/50 ring-2 ring-accent/30"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded flex items-center justify-center text-sm font-bold",
                      getPositionRankClass(player.position)
                    )}>
                      {player.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span 
                          className="font-medium truncate cursor-pointer hover:text-primary transition-colors"
                          onClick={() => {
                            setSelectedPlayerForStats(player);
                            setIsStatsDialogOpen(true);
                          }}
                        >
                          {player.name}
                        </span>
                        <PositionBadge position={player.position} />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {displayTeamAbbrevOrFa(player.team, player.position, player.name)} • ADP: {player.adp}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUserDraft(player);
                      }}
                    >
                      <Check className="w-4 h-4" /> Draft
                    </Button>
                  </div>
                );
                });
              })()}
            </div>
          </div>

          {/* Draft Board */}
          <div className="min-h-0 glass-card p-4 flex flex-col overflow-hidden">
            <h2 className="font-display text-xl mb-4 flex-shrink-0">DRAFT BOARD</h2>
            <div 
              ref={draftBoardRef}
              onScroll={handleDraftBoardScroll}
              className={cn(
                "space-y-1 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-2",
                draftBoardScrolledUp ? "scrollbar-thin" : "scrollbar-hide"
              )}
            >
              {picks.map((pick) => {
                const player = players.find((p) => p.id === pick.player_id);
                if (!player) return null;

                return (
                  <div
                    key={pick.id}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg text-sm min-w-0",
                      pick.team_number === draft?.user_pick_position
                        ? "bg-accent/10 border border-accent/30"
                        : "bg-secondary/30"
                    )}
                  >
                    <div className="w-6 shrink-0 text-muted-foreground text-xs">
                      {pick.round_number}.{((pick.pick_number - 1) % (draft?.num_teams || 12)) + 1}
                    </div>
                    <div className="font-medium w-16 shrink-0 truncate">{getTeamName(pick.team_number)}</div>
                    <div className="flex-1 min-w-0 truncate text-muted-foreground">{player.name}</div>
                    <PositionBadge position={player.position} className="shrink-0 text-[10px]" />
                  </div>
                );
              })}

              {picks.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No picks yet. Click a player to draft them.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <PlayerDetailDialog
        player={selectedPlayerForStats}
        open={isStatsDialogOpen}
        onOpenChange={setIsStatsDialogOpen}
        stats2025={selectedPlayerForStats ? player2025Stats.get(selectedPlayerForStats.id) : undefined}
      />
    </div>
  );
};

export default DraftRoom;
