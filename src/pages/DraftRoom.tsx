import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { PositionBadge } from '@/components/PositionBadge';
import { MyRoster } from '@/components/MyRoster';
import { fillDraftTeamLineup } from '@/components/DraftTeamResultDialog';
import { PlayerDetailDialog } from '@/components/PlayerDetailDialog';
import {
  DraftMobilePanelTabs,
  draftMobilePanelClass,
  type DraftMobilePanel,
} from '@/components/DraftMobilePanelTabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Search, Trophy, LogOut, Timer, Pause, Play } from 'lucide-react';
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
import { compareDefensesByFantasyRank, NFL_DEFENSE_TEAM_NAMES } from '@/constants/nflDefenses';
import { BrandedLoader } from '@/components/BrandedLoader';
import {
  PLAYER_POOL_PRIOR_SEASON,
  PLAYER_POOL_CURRENT_SEASON,
} from '@/constants/playerPoolSeason';
import { cn, capitalizeSentenceStart } from '@/lib/utils';
import { userFacingErrorMessage } from '@/utils/userFacingError';
import { tempDraftStorage, tempSettingsStorage, getOrCreateGuestSessionId } from '@/utils/temporaryStorage';
import {
  buildDraftRankingsFromCommunity,
  fetchCommunityRankingsForDraft,
} from '@/utils/communityRankingsMerge';
import { deduplicatePlayersByIdentity, mergePlayerPoolAcrossSeasons } from '@/utils/playerDeduplication';
import { fetchMergedPlayerPool } from '@/utils/playerPoolFetch';
import { mergeMissingRankedPlayers } from '@/utils/fetchPlayersByIds';
import { usePlayer2025Stats } from '@/hooks/usePlayer2025Stats';
import { useStickScrollToBottom } from '@/hooks/useStickScrollToBottom';
import { selectCpuPick, assignRandomNamedArchetypesForDraft } from '@/utils/cpuDraftLogic';
import { countTeamPositions } from '@/utils/cpuStarterNeeds';
import {
  mpCanDraftPosition,
  mpNormalizePos,
  mpStarterNeeds,
  selectNeedAwareBpa,
} from '@/utils/multiplayerDraftMath';
import {
  detectArchetypeName,
  detectArchetypeIndex,
  detectStrategiesFromPicks,
  chooseArchetypeIndexForAward,
  hashPicksForTieBreak,
} from '@/utils/archetypeDetection';
import { getArchetypeByNameOrImproviser, FULL_ARCHETYPE_LIST } from '@/constants/archetypeListWithImproviser';
import { getChaosArchetypeByName, isChaosReplace } from '@/constants/chaosArchetypes';
import { ArchetypeBadge } from '@/components/ArchetypeBadge';
import { DraftGradeBanner } from '@/components/DraftGradeDisplay';
import { computeDraftGrade, parseStoredDraftGrade, toDraftGradePicks, type DraftGradeResult } from '@/utils/draftGrade';
import { buildPriorSeasonRankByPlayerId } from '@/utils/draftGradePriorSeason';
import {
  countLeagueTop12Te,
  countRbsInRounds12,
  countRbsInPickWindow,
  countPositionInRecentWindow,
  countRecentPositionStreak,
  countRound1Qb,
  draftIdToSeed,
} from '@/utils/cpuDraftRealism';
import { buildDraftConfig, type DraftConfig } from '@/constants/buildDraftConfig';
import {
  buildStartingSlots,
  countBaseStarters,
  getBenchCount,
  getFlexCount,
  getPositionMax,
  getRosterRounds,
  parseStarters,
  toNumericPositionLimits,
} from '@/utils/rosterSlots';
import { detectChaosArchetype, type ChaosPick } from '@/utils/chaosDetection';
import { getAgeFromBirthDate } from '@/utils/playerAge';
import { displayTeamAbbrevOrFa } from '@/utils/teamMapping';
import {
  buildDefenseRankFromList,
  buildPositionAdpRankMap,
  resolvePositionAdpRankForDisplay,
} from '@/utils/positionAdpRank';
import { DraftAvailablePlayerRow } from '@/components/DraftAvailablePlayerRow';
import {
  buildDraftListTierBreakBeforeIds,
  loadPersonalDraftBoardOverlay,
  type DraftDisplayBucket,
  type PersonalDraftBoardOverlay,
} from '@/utils/draftPersonalBoard';
import { applyNamedBoardToPlayers, fetchAdpSourceBoardForBucket, sourceRowsForBoard } from '@/utils/adpSourceBoards';
import { normalizeDraftAgainstId } from '@/constants/adpRankingSources';

/** Minimum ms between rapid CPU picks finishing — keeps pace steady when the board is lighter late in the draft. */
const RAPID_CPU_PICK_GAP_MS = 360;

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DraftRoom = () => {
  const { draftId } = useParams<{ draftId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const player2025Stats = usePlayer2025Stats();
  const priorSeasonRankByPlayerId = useMemo(
    () => buildPriorSeasonRankByPlayerId(player2025Stats),
    [player2025Stats]
  );

  const [draft, setDraft] = useState<MockDraft | null>(null);
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [draftBucket, setDraftBucket] = useState<DraftDisplayBucket | null>(null);
  const [draftLeagueId, setDraftLeagueId] = useState<string | null>(null);
  const [personalBoard, setPersonalBoard] = useState<PersonalDraftBoardOverlay | null>(null);
  const [sourceRankById, setSourceRankById] = useState<Map<string, number> | null>(null);
  const positionAdpRankMap = useMemo(
    () => buildPositionAdpRankMap(players),
    [players]
  );
  /** Draft pool is community-ordered; defense Pos ADP follows that list. */
  const communityDefenseRankFromList = useMemo(
    () =>
      buildDefenseRankFromList(
        players.map((p) => ({ id: p.id, position: p.position, rank: p.rank }))
      ),
    [players]
  );
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const {
    containerRef: draftBoardRef,
    onScroll: handleDraftBoardScroll,
    scrolledUp: draftBoardScrolledUp,
  } = useStickScrollToBottom(picks.length);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [mobilePanel, setMobilePanel] = useState<DraftMobilePanel>('players');
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
    starters?: {
      QB?: number;
      RB?: number;
      WR?: number;
      TE?: number;
      DEF?: number;
      K?: number;
    };
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
  const lastPickRef = useRef<number>(0);
  const lastRapidCpuPickAtRef = useRef(0);
  const isDraftPausedRef = useRef<boolean>(false);

  // Keep ref in sync with state for async functions
  useEffect(() => {
    console.log('🔄 Syncing ref with state:', { state: isDraftPaused, refBefore: isDraftPausedRef.current });
    isDraftPausedRef.current = isDraftPaused;
    console.log('🔄 Ref synced:', { refAfter: isDraftPausedRef.current });
  }, [isDraftPaused]);

  // Don't redirect - allow non-logged-in users to access temporary drafts
  const isTempDraft = draftId?.startsWith('temp_');

  useEffect(() => {
    lastRapidCpuPickAtRef.current = 0;
  }, [draftId]);

  const fetchDraftData = useCallback(async () => {
    if (!draftId) return;
    setIsRookiesOnlyDraft(false);

    try {
      let draftData: MockDraft;
      let existingPicks: DraftPick[] = [];
      let loadedKeepers: Array<{ team_number: number; player_id: string; round_number: number }> = [];
      let limitsForRounds: Parameters<typeof getRosterRounds>[0] = { BENCH: 6 };
      let superflexForRounds = false;

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
            limitsForRounds = tempSettings.positionLimits;
            setPositionLimits(tempSettings.positionLimits);
          }
          if (tempSettings.isSuperflex !== undefined) {
            superflexForRounds = !!tempSettings.isSuperflex;
            setIsSuperflex(tempSettings.isSuperflex);
          }
          if (Array.isArray(tempSettings.teamNames)) {
            const namesMap = new Map<number, string>();
            tempSettings.teamNames.forEach((team: { team_number: number; team_name: string }) => {
              if (team.team_name) namesMap.set(team.team_number, team.team_name);
            });
            setTeamNames(namesMap);
          }
          if (Array.isArray(tempSettings.keepers) && tempSettings.keepers.length > 0) {
            loadedKeepers = tempSettings.keepers;
            setKeepers(tempSettings.keepers);
          } else {
            setKeepers([]);
          }
        } else {
          setKeepers([]);
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
      let leagueData: {
        position_limits?: any;
        is_superflex?: boolean;
        scoring_format?: string;
        league_type?: string;
        rookies_only?: boolean;
      } | null = null;
      if (!isTempDraft && draftData.league_id) {
        const { data: ld } = await supabase
          .from('leagues')
          .select('position_limits, is_superflex, scoring_format, league_type, rookies_only')
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
          limitsForRounds = leagueData.position_limits;
          setPositionLimits(limits);
        }
        
        if (leagueData?.is_superflex !== undefined) {
          superflexForRounds = !!leagueData.is_superflex;
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
          loadedKeepers = keepersData;
          setKeepers(keepersData);
        } else {
          setKeepers([]);
        }
      } else if (!isTempDraft) {
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
        allPlayersData = await fetchMergedPlayerPool();
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
        // Insert missing defenses - distribute ADPs between 150-200
        const defenseInserts = missingDefenses.map((teamName, index) => {
          // Distribute evenly across ADP 150-200 (50 point range)
          const adp = 150 + Math.floor((index / missingDefenses.length) * 50);
          return {
            name: teamName,
            position: 'D/ST',
            team: defenseTeamAbbrByName.get(teamName) ?? null,
            season: PLAYER_POOL_PRIOR_SEASON,
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
        } else if (insertData && insertData.length > 0) {
          allPlayersData = [...(allPlayersData || []), ...insertData];
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
          .in('season', [PLAYER_POOL_PRIOR_SEASON, PLAYER_POOL_CURRENT_SEASON])
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

      nonDefensePlayers = mergePlayerPoolAcrossSeasons(
        nonDefensePlayers,
        PLAYER_POOL_PRIOR_SEASON,
        PLAYER_POOL_CURRENT_SEASON
      );
      
      // Then, separately query all defenses (they should be 32, well under any limit)
      const { data: allDefensePlayersRaw, error: defenseError } = await supabase
        .from('players')
        .select('*')
        .in('season', [PLAYER_POOL_PRIOR_SEASON, PLAYER_POOL_CURRENT_SEASON])
        .eq('position', 'D/ST')
        .order('created_at', { ascending: false }); // Get most recent first

      const mergedDefenseRows = mergePlayerPoolAcrossSeasons(
        allDefensePlayersRaw || [],
        PLAYER_POOL_PRIOR_SEASON,
        PLAYER_POOL_CURRENT_SEASON
      );
      
      // Keep only canonical 32 teams (drop legacy rows like Oakland Raiders, San Diego Chargers, St. Louis Rams)
      const allDefensePlayers = mergedDefenseRows.filter((d: { name: string }) => canonicalDefenseSet.has(d.name));
      
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
      // Sort by fantasy D/ST rank order (HOU first … ARI last), not alphabetical
      defensePlayers = defensePlayers.sort((a, b) => compareDefensesByFantasyRank(a.name, b.name));
      const defensesToUpdate: { id: string; adp: number }[] = [];
      defensePlayers = defensePlayers.map((defense, index) => {
        const adp = 150 + Math.floor((index / defensePlayers.length) * 50);
        const normalizedTeam = defense.team && defense.team !== 'FA'
          ? defense.team
          : (defenseTeamAbbrByName.get(defense.name) ?? defense.team);
        if (Number(defense.adp) !== adp) {
          defensesToUpdate.push({ id: defense.id, adp });
        }
        return { ...defense, adp, team: normalizedTeam };
      });
      
      // Update defenses in database if needed
      if (defensesToUpdate.length > 0) {
        for (const defenseUpdate of defensesToUpdate) {
          await supabase
            .from('players')
            .update({ adp: defenseUpdate.adp })
            .eq('id', defenseUpdate.id);
        }
      }

      // Filter to standard fantasy positions only - exclude IDP (DL, LB, DB, DE, DT, etc.) that aren't in Rankings
      const VALID_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K']);
      const filteredNonDefense = (nonDefensePlayers || []).filter((p) =>
        p.position && VALID_POSITIONS.has(String(p.position).toUpperCase())
      );

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

      if (updatedPlayersData && updatedPlayersData.length > 0) {
        allPlayersData = updatedPlayersData;
      }
      }

      // Draft bucket for community consensus (CPUs use league board, not your personal rankings)
      const draftBucket = (() => {
        const tempSettings = isTempDraft ? tempSettingsStorage.get() : null;
        const rookiesOnly =
          isRookiesOnly ||
          (leagueData?.league_type === 'dynasty' && leagueData?.rookies_only === true) ||
          tempSettings?.rookiesOnly === true;
        if (isTempDraft) {
          return {
            scoringFormat: ((draftData as any).scoring_format as string) || 'ppr',
            leagueType: (tempSettings?.leagueType as string) || 'season',
            isSuperflex: tempSettings?.isSuperflex ?? false,
            rookiesOnly,
          };
        }
        if (leagueData) {
          return {
            scoringFormat: (leagueData.scoring_format as string) || ((draftData as any).scoring_format as string) || 'ppr',
            leagueType: (leagueData.league_type as string) || 'season',
            isSuperflex: (leagueData.is_superflex as boolean) ?? false,
            rookiesOnly,
          };
        }
        return {
          scoringFormat: ((draftData as any).scoring_format as string) || 'ppr',
          leagueType: 'season',
          isSuperflex: false,
          rookiesOnly,
        };
      })();

      const communityExclude = user
        ? { excludeUserId: user.id }
        : { excludeGuestSessionId: getOrCreateGuestSessionId() };

      const communityRows = await fetchCommunityRankingsForDraft(supabase, draftBucket, communityExclude);
      let sortedRankedPlayers = await buildDraftRankingsFromCommunity(
        supabase,
        allPlayersData || [],
        communityRows
      );

      const cpuSource = normalizeDraftAgainstId((draftData as MockDraft).cpu_board_source);
      const adpBoard = await fetchAdpSourceBoardForBucket(draftBucket);
      sortedRankedPlayers = applyNamedBoardToPlayers(sortedRankedPlayers, adpBoard, cpuSource);

      if (communityRows.length > 0) {
        console.log(
          `[DraftRoom] CPU board: ${cpuSource} (${draftBucket.scoringFormat}/${draftBucket.leagueType}/sf=${draftBucket.isSuperflex})`
        );
      } else {
        console.warn('[DraftRoom] No community rankings for bucket — CPU board using ADP consensus / players.adp order');
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
      if (isRookiesOnly) {
        if (finalNumRounds > maxRoundsByLoadedPool) {
          finalNumRounds = maxRoundsByLoadedPool;
        }
      } else {
        const rosterRounds = getRosterRounds(limitsForRounds, superflexForRounds);
        if (maxRoundsByLoadedPool < rosterRounds) {
          toast.error(
            `Not enough players in the pool (${poolSize}) for ${numTeamsCap} teams to fill a ${rosterRounds}-round roster.`
          );
          setLoading(false);
          navigate('/mock-draft');
          return;
        }
        if (finalNumRounds < rosterRounds) {
          finalNumRounds = rosterRounds;
        }
        if (finalNumRounds > maxRoundsByLoadedPool) {
          finalNumRounds = maxRoundsByLoadedPool;
        }
      }

      if (finalNumRounds !== draftWithDefaults.num_rounds) {
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

      const playersWithPicks = await mergeMissingRankedPlayers(sortedRankedPlayers, [
        ...loadedPicks.map((p) => p.player_id),
        ...loadedKeepers.map((k) => k.player_id),
      ]);

      setDraft(finalDraft);
      setDraftBucket(draftBucket);
      setDraftLeagueId((draftData as { league_id?: string | null }).league_id ?? null);
      setPlayers(playersWithPicks);
      setPicks(loadedPicks);
      setCurrentPick(loadedPicks.length + 1);
    } catch (error: any) {
      console.error('Error loading draft:', error);
      setIsRookiesOnlyDraft(false);
      toast.error(userFacingErrorMessage(error, "Couldn't load draft. Please try again."));
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

  const soloPoolKey = useMemo(() => players.map((p) => p.id).join(','), [players]);

  // Personal rankings + tiers for the available list (CPUs use cpu_board_source).
  useEffect(() => {
    if (!draftBucket || players.length === 0) {
      setPersonalBoard(null);
      return;
    }
    let cancelled = false;
    void loadPersonalDraftBoardOverlay({
      userId: user?.id ?? null,
      leagueId: draftLeagueId,
      bucket: draftBucket,
      poolPlayers: players.map((p) => ({ id: p.id, position: p.position })),
    }).then((overlay) => {
      if (!cancelled) setPersonalBoard(overlay);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pool via soloPoolKey
  }, [draftBucket, draftLeagueId, user?.id, soloPoolKey]);

  useEffect(() => {
    const source = draft?.board_source;
    if (!draftBucket || !source || source === 'yours' || source === 'mine') {
      setSourceRankById(null);
      return;
    }
    let cancelled = false;
    void fetchAdpSourceBoardForBucket(draftBucket).then((board) => {
      if (cancelled) return;
      const rows = sourceRowsForBoard(board, source);
      if (!rows?.length) {
        setSourceRankById(null);
        return;
      }
      setSourceRankById(new Map(rows.map((row, i) => [row.id, i + 1])));
    });
    return () => {
      cancelled = true;
    };
  }, [draft?.board_source, draftBucket]);

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

  // Build starting roster slots from league starter config. Superflex: one QB across all FLEX slots.
  const getStartingSlots = (): { label: string; positions: string[] }[] =>
    buildStartingSlots(positionLimits, isSuperflex);

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
    const positionLimit = getPositionMax(positionLimits, pos);
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

    if (draft && !isRookiesOnlyDraft) {
      const counts = countTeamPositions(draftedPlayers);
      if (opts && keepers.length > 0) {
        for (const k of keepers) {
          if (k.team_number !== opts.teamNumber || k.round_number <= opts.currentRound) continue;
          const keeperPlayer = players.find((pl) => pl.id === k.player_id);
          if (!keeperPlayer) continue;
          const keeperPos = mpNormalizePos(keeperPlayer.position);
          counts[keeperPos] = (counts[keeperPos] ?? 0) + 1;
        }
      }
      if (
        !mpCanDraftPosition({
          position: pos,
          positionCounts: counts,
          rosterSize: draftedPlayers.length,
          numRounds: draft.num_rounds,
          positionLimits: positionLimits as Record<string, number | undefined>,
        })
      ) {
        return false;
      }
    }

    const startingSlots = getStartingSlots();
    const benchCount = getBenchCount(positionLimits);

    // Simulate roster assignment. In superflex, at most one QB is allowed in FLEX slots (2nd QB can go in any open FLEX).
    const assignedPlayerIds = new Set<string>();
    let qbPlacedInFlex = false;
    const availableSlots: { label: string; positions: string[] }[] = [];

    startingSlots.forEach((slot) => {
      const isFlexSlot = slot.label === 'FLEX';
      // In superflex, only one FLEX slot can hold a QB; once we've placed a QB in a FLEX, treat remaining FLEX as RB/WR/TE only
      const effectivePositions = isFlexSlot && isSuperflex && qbPlacedInFlex
        ? ['RB', 'WR', 'TE']
        : slot.positions.map((slotPos) => mpNormalizePos(slotPos));
      const canAcceptPosition = effectivePositions.includes(pos);

      const availablePlayer = draftedPlayers.find((p) => {
        if (assignedPlayerIds.has(p.id)) return false;
        return effectivePositions.includes(mpNormalizePos(p.position));
      });

      if (availablePlayer) {
        assignedPlayerIds.add(availablePlayer.id);
        if (isFlexSlot && mpNormalizePos(availablePlayer.position) === 'QB') {
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
      const limit = getPositionMax(positionLimits, playerPos);
      const currentCount = userPositionCounts[playerPos] || 0;
      
      if (limit !== undefined && currentCount >= limit) {
        toast.error(`You have reached the limit for ${playerPos} (${limit} players)`);
      } else {
        const remaining = draft.num_rounds - userDraftedPlayers.length;
        const needCounts = countTeamPositions(userDraftedPlayers);
        const needed = mpStarterNeeds(needCounts, positionLimits);
        if (needed.length > 0 && remaining <= needed.length && !needed.includes(playerPos)) {
          toast.error(`You still need ${needed.join(', ')} before the draft ends`);
        } else {
          toast.error(`You have no more roster spots available for ${playerPos}`);
        }
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
      // Pause can interrupt mid-pick; clear drafting lock so resume can continue
      if (isDrafting) {
        setIsDrafting(false);
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
            toast.error(userFacingErrorMessage(e, "Couldn't place keeper pick. Please try again."));
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
        const futureKeeperPlayers = keepers
          .filter((k) => k.team_number === currentTeam && k.round_number > currentRound)
          .map((k) => players.find((pl) => pl.id === k.player_id))
          .filter((p): p is RankedPlayer => !!p);
        const teamRosterForNeeds = [...teamDraftedPlayers, ...futureKeeperPlayers];
        
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
          console.warn('No available players matching position limits, falling back to need-aware pool');
          const draftedIdsFallback = new Set(picks.map((p) => p.player_id));
          const unfiltered = players
            .filter((p) => p && p.id && !draftedIdsFallback.has(p.id) && !keeperIds.has(p.id))
            .sort((a, b) => a.rank - b.rank);
          const needPick = selectNeedAwareBpa(unfiltered, {
            positionCounts: countTeamPositions(teamRosterForNeeds),
            rosterSize: teamDraftedPlayers.length,
            numRounds: draft.num_rounds,
            positionLimits,
          });
          available = needPick ? [needPick, ...unfiltered.filter((p) => p.id !== needPick.id)] : unfiltered;
          
          if (available.length === 0) {
            console.error('No players available at all - draft may be complete or stuck');
            setIsDrafting(false);
            return;
          }
        }
        
        // Pick using archetype-aware logic (combo of 2–3 archetypes per CPU; fallback: BPA-style random from top 5)
        const archetypeIdOrIds = draft?.cpu_archetypes?.[currentTeam];
        const flexCount = getFlexCount(positionLimits, isSuperflex);
        const benchCount = getBenchCount(positionLimits);
        const starters = parseStarters(positionLimits);
        const baseStarters = countBaseStarters(starters);
        const picksWithPlayer = picks.map((p) => ({
          pick_number: p.pick_number,
          round_number: p.round_number,
          player: players.find((pl) => pl.id === p.player_id),
        }));
        const context = {
          roundNumber: getCurrentRound(),
          numRounds: draft.num_rounds,
          numTeams: draft.num_teams,
          teamDraftedPlayers: teamRosterForNeeds,
          positionLimits: toNumericPositionLimits(positionLimits),
          scoringFormat: (draft as any).scoring_format,
          pickNumber: currentPick,
          draftOrder: draft.draft_order,
          flexSlots: flexCount,
          benchSize: benchCount,
          baseStarters,
          starters,
          isSuperflex,
          rookieFlexDraft: isRookiesOnlyDraft,
          realism: {
            roundNumber: getCurrentRound(),
            pickNumber: currentPick,
            numTeams: draft.num_teams,
            teTakenInTop12: countLeagueTop12Te(picksWithPlayer),
            qbTakenInRound1: countRound1Qb(picksWithPlayer, draft.num_teams),
            rbsTakenRounds12: countRbsInRounds12(picksWithPlayer),
            rbsInTop12: countRbsInPickWindow(picksWithPlayer, 12),
            recentRbPickStreak: countRecentPositionStreak(picksWithPlayer, 'RB', 8),
            rbInRecentWindow: countPositionInRecentWindow(picksWithPlayer, 'RB', 8),
            teamRbCount: teamDraftedPlayers.filter(
              (p) => (p.position || '').toUpperCase() === 'RB'
            ).length,
            starters,
            draftSeed: draftIdToSeed(draftId),
          },
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
        
        const cpuSpeed = (draft?.cpu_speed || 'normal') as 'slow' | 'normal' | 'fast' | 'rapid' | 'instant';
        const isRapidCpu = cpuSpeed === 'rapid' || cpuSpeed === 'instant';
        const roundNumber = getCurrentRound();
        const pickNumber = currentPick;

        if (!isRapidCpu) {
          const baseDelay = 750;
          const delay =
            cpuSpeed === 'slow' ? baseDelay * 2 : cpuSpeed === 'fast' ? baseDelay / 2 : baseDelay;
          if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
          if (isDraftPausedRef.current) {
            setIsDrafting(false);
            return;
          }
        }

        if (isDraftPausedRef.current) {
          setIsDrafting(false);
          return;
        }

        const applyPick = (data: DraftPick) => {
          setPicks((prev) => [...prev, data]);
          setCurrentPick(pickNumber + 1);
        };

        if (isRapidCpu) {
          const paceWaitMs =
            lastRapidCpuPickAtRef.current > 0
              ? Math.max(
                  0,
                  RAPID_CPU_PICK_GAP_MS -
                    (performance.now() - lastRapidCpuPickAtRef.current)
                )
              : 0;
          if (paceWaitMs > 0) {
            await sleepMs(paceWaitMs);
          }
          if (isDraftPausedRef.current) {
            setIsDrafting(false);
            return;
          }

          const optimisticPick: DraftPick = {
            id: isTempDraft
              ? `temp_pick_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
              : `pending_${pickNumber}`,
            mock_draft_id: draftId!,
            player_id: cpuPick.id,
            team_number: currentTeam,
            round_number: roundNumber,
            pick_number: pickNumber,
            created_at: new Date().toISOString(),
          };
          applyPick(optimisticPick);
          lastRapidCpuPickAtRef.current = performance.now();
          setIsDrafting(false);

          void draftPlayer(cpuPick, pickNumber, currentTeam, roundNumber)
            .then((data) => {
              if (!data) return;
              setPicks((prev) =>
                prev.map((p) =>
                  p.pick_number === pickNumber ? { ...data, id: data.id || p.id } : p
                )
              );
            })
            .catch((error: unknown) => {
              console.error('Rapid CPU pick save failed:', error);
              setPicks((prev) => prev.filter((p) => p.pick_number !== pickNumber));
              setCurrentPick(pickNumber);
              toast.error(userFacingErrorMessage(error, "Couldn't save CPU pick. Please try again."));
            });
          return;
        }

        const data = await draftPlayer(cpuPick, pickNumber, currentTeam, roundNumber);
        if (data) {
          applyPick(data);
        }

        setIsDrafting(false);
      } catch (error: any) {
        console.error('CPU draft error:', error);
        toast.error(userFacingErrorMessage(error, "Couldn't make CPU pick. Please try again."));
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
      
      const futureKeepers = keepers
        .filter((k) => k.team_number === draft.user_pick_position && k.round_number > getCurrentRound())
        .map((k) => players.find((pl) => pl.id === k.player_id))
        .filter((p): p is RankedPlayer => !!p);
      const rosterForNeeds = [...userDraftedPlayersForAuto, ...futureKeepers];
      const topPlayer = selectNeedAwareBpa(available, {
        positionCounts: countTeamPositions(rosterForNeeds),
        rosterSize: userDraftedPlayersForAuto.length,
        numRounds: draft.num_rounds,
        positionLimits,
      }) ?? available[0];
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


  const draftedPlayerIds = useMemo(
    () => new Set(picks.map((p) => p.player_id)),
    [picks]
  );
  const keeperPlayerIds = useMemo(
    () => new Set(keepers.map((k) => k.player_id)),
    [keepers]
  );
  // Deduplicate by id - exclude drafted and keeper players (keepers are auto-assigned in their round)
  const availablePlayers = useMemo(
    () =>
      Array.from(
        new Map(
          players
            .filter((p) => !draftedPlayerIds.has(p.id) && !keeperPlayerIds.has(p.id))
            .map((p) => [p.id, p])
        ).values()
      ),
    [players, draftedPlayerIds, keeperPlayerIds]
  );

  // Calculate user's current position counts
  const userDraftedPlayers = useMemo(() => {
    const userPicks = picks.filter((p) => p.team_number === (draft?.user_pick_position || 1));
    return userPicks
      .map((pick) => players.find((p) => p.id === pick.player_id))
      .filter((p): p is RankedPlayer => !!p);
  }, [picks, players, draft?.user_pick_position]);
  
  const userPositionCounts: Record<string, number> = {};
  userDraftedPlayers.forEach((player) => {
    let pos = player.position.toUpperCase();
    // Map D/ST to DEF for position limits
    if (pos === 'D/ST') {
      pos = 'DEF';
    }
    userPositionCounts[pos] = (userPositionCounts[pos] || 0) + 1;
  });

  // Check if a team has a complete roster (all starting positions filled with real players)
  const isTeamRosterComplete = (teamNumber: number): boolean => {
    if (!draft) return false;
    const teamPicks = picks.filter((p) => p.team_number === teamNumber);
    if (isRookiesOnlyDraft) {
      return teamPicks.length >= draft.num_rounds && teamPicks.every((p) => players.some((pl) => pl.id === p.player_id));
    }
    const teamDraftedPlayers = teamPicks
      .map((pick) => players.find((p) => p.id === pick.player_id))
      .filter((p): p is RankedPlayer => !!p);
    if (teamDraftedPlayers.length !== teamPicks.length) return false;

    const teamStartingSlots = getStartingSlots();
    const benchCount = getBenchCount(positionLimits);
    const { filledSlots } = fillDraftTeamLineup(teamDraftedPlayers, teamStartingSlots, benchCount, {
      isSuperflex,
    });
    return filledSlots.length === teamStartingSlots.length && filledSlots.every((p) => p != null);
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

  const currentRound = draft ? Math.ceil(currentPick / draft.num_teams) : 1;

  // Filter players based on search term, position filter, position limits, and available roster spots (only for user's view)
  // Uses same search logic as Rankings page: name, team, or name parts (e.g. "Hunter" matches "Travis Hunter")
  const filteredPlayers = useMemo(() => {
    const searchLower = searchTerm.toLowerCase().trim();
    const spotOpts = draft
      ? { teamNumber: draft.user_pick_position, currentRound }
      : undefined;
    return availablePlayers.filter((p) => {
      if (positionFilter !== 'ALL') {
        const playerPos = mpNormalizePos(p.position);
        if (playerPos !== positionFilter) return false;
      }
      const matchesSearch =
        searchLower === '' ||
        p.name.toLowerCase().includes(searchLower) ||
        p.team?.toLowerCase().includes(searchLower) ||
        p.name.toLowerCase().split(' ').some((part) => part.includes(searchLower));
      if (!matchesSearch) return false;
      if (!hasAvailableSpotForPosition(p.position, userDraftedPlayers, spotOpts)) return false;
      if (!isRookiesOnlyDraft && (p.position === 'DEF' || p.position === 'D/ST')) {
        return draft ? canDraftDefense(draft.user_pick_position) : false;
      }
      return true;
    });
  }, [
    availablePlayers,
    searchTerm,
    positionFilter,
    draft,
    currentRound,
    userDraftedPlayers,
    isRookiesOnlyDraft,
  ]);

  useEffect(() => {
    if (positionFilter === 'ALL' || !draft) return;
    const stillOpen = filteredPlayers.some((p) => mpNormalizePos(p.position) === positionFilter);
    if (!stillOpen) setPositionFilter('ALL');
  }, [draft, positionFilter, filteredPlayers]);

  const personalMetaById = personalBoard?.metaById;
  const visibleBoardRank = (p: RankedPlayer) => {
    const source = draft?.board_source;
    if (source && source !== 'yours' && source !== 'mine') {
      return sourceRankById?.get(p.id) ?? 10_000 + (Number(p.rank) || 9999);
    }
    return personalMetaById?.get(p.id)?.overallRank ?? p.rank;
  };

  // Highlight who falls to you at each remaining pick on YOUR board order
  // (same sort as the available list): next round, then 5th/6th/7th… as you scroll.
  // N picks before a slot → N players gone → index N in the remaining list.
  const highlightedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    if (!draft) return ids;

    const sortedAvailable = [...availablePlayers].sort((a, b) => {
      return visibleBoardRank(a) - visibleBoardRank(b);
    });

    for (const pickNum of getUserUpcomingPicks()) {
      if (pickNum < currentPick) continue;
      const picksUntil = pickNum - currentPick;
      // On the clock: no forecast highlight for the current pick.
      if (picksUntil <= 0) continue;
      const target = sortedAvailable[picksUntil];
      if (target) ids.add(target.id);
    }
    return ids;
  }, [
    availablePlayers,
    personalMetaById,
    sourceRankById,
    draft?.board_source,
    currentPick,
    draft?.user_pick_position,
    draft?.num_teams,
    draft?.num_rounds,
    draft?.draft_order,
  ]);

  const availableListRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const hasActiveSearch = term.length > 0;
    const hasPositionFilter = positionFilter !== 'ALL';
    const filteredPlayerIds = new Set(filteredPlayers.map((p) => p.id));
    const highlightedButNotFiltered =
      hasActiveSearch || hasPositionFilter
        ? []
        : Array.from(highlightedPlayerIds)
            .map((id) => availablePlayers.find((p) => p.id === id))
            .filter((p): p is RankedPlayer => {
              if (!p || filteredPlayerIds.has(p.id)) return false;
              const spotOpts = draft
                ? { teamNumber: draft.user_pick_position, currentRound }
                : undefined;
              if (!hasAvailableSpotForPosition(p.position, userDraftedPlayers, spotOpts)) {
                return false;
              }
              if (!isRookiesOnlyDraft && (p.position === 'DEF' || p.position === 'D/ST')) {
                return draft ? canDraftDefense(draft.user_pick_position) : false;
              }
              return true;
            });

    const combined = [...filteredPlayers, ...highlightedButNotFiltered];
    const seenIds = new Set<string>();
    const deduped = combined.filter((p) => {
      if (seenIds.has(p.id)) return false;
      seenIds.add(p.id);
      return true;
    });

    const playersToRender = deduped.sort((a, b) => visibleBoardRank(a) - visibleBoardRank(b));

    // All Positions: fixed breaks from board load (never reset when a late T1 QB rises).
    // Position filter: live frontier breaks for that position's leftovers.
    const breakBeforeIds =
      positionFilter === 'ALL'
        ? personalBoard?.allViewBreakBeforeIds ?? new Set<string>()
        : buildDraftListTierBreakBeforeIds(
            playersToRender.map((p) => ({
              id: p.id,
              tier: personalMetaById?.get(p.id)?.tier ?? null,
            }))
          );

    return playersToRender.map((player) => {
      const meta = personalMetaById?.get(player.id);
      const source = draft?.board_source;
      const usingSiteBoard = Boolean(source && source !== 'yours' && source !== 'mine');
      return {
        player,
        displayRank: usingSiteBoard
          ? sourceRankById?.get(player.id) ?? player.rank
          : meta?.overallRank ?? player.rank,
        myPosRank: meta?.posRank ?? null,
        tier: meta?.tier ?? null,
        hasTierBreakBefore: breakBeforeIds.has(player.id),
        highlighted: highlightedPlayerIds.has(player.id),
      };
    });
  }, [
    searchTerm,
    positionFilter,
    filteredPlayers,
    highlightedPlayerIds,
    availablePlayers,
    draft,
    currentRound,
    userDraftedPlayers,
    isRookiesOnlyDraft,
    personalMetaById,
    sourceRankById,
    draft?.board_source,
    personalBoard?.allViewBreakBeforeIds,
  ]);

  const handleAvailablePlayerStats = useCallback((player: RankedPlayer) => {
    setSelectedPlayerForStats(player);
    setIsStatsDialogOpen(true);
  }, []);

  const handleUserDraftRef = useRef(handleUserDraft);
  handleUserDraftRef.current = handleUserDraft;
  const handleAvailablePlayerDraft = useCallback((player: RankedPlayer) => {
    void handleUserDraftRef.current(player);
  }, []);

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
      let earnedSet = new Set<number>();
      const earnedCountByIndex = new Map<number, number>();
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
            const idx = row.user_detected_archetype_index;
            earnedSet.add(idx);
            earnedCountByIndex.set(idx, (earnedCountByIndex.get(idx) ?? 0) + 1);
          }
          if (row.user_detected_chaos_archetype) {
            earnedChaosNames.add(row.user_detected_chaos_archetype);
          }
        }
      } else {
        const tempIds = tempDraftStorage.getDraftList();
        for (const id of tempIds) {
          const t = tempDraftStorage.getDraft(id);
          if (t?.draft.status === 'completed') {
            const d = t.draft as { user_detected_archetype_index?: number; user_detected_chaos_archetype?: string | null };
            if (typeof d.user_detected_archetype_index === 'number') {
              const idx = d.user_detected_archetype_index;
              earnedSet.add(idx);
              earnedCountByIndex.set(idx, (earnedCountByIndex.get(idx) ?? 0) + 1);
            }
            if (d.user_detected_chaos_archetype) earnedChaosNames.add(d.user_detected_chaos_archetype);
          }
        }
      }
      const tieBreakHash = hashPicksForTieBreak(teamPicksForDetection);
      const chosenIndex = chooseArchetypeIndexForAward(strategies, earnedSet, earnedCountByIndex, tieBreakHash);
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

  const buildCompletionGrade = useCallback(
    (
      draftVal: MockDraft,
      picksVal: DraftPick[],
      playersVal: RankedPlayer[],
      chaosArchetype: string | null | undefined,
      archetypeName: string | null | undefined
    ): DraftGradeResult | null => {
      const userPicks = picksVal.filter((p) => p.team_number === draftVal.user_pick_position);
      if (userPicks.length === 0) return null;
      return computeDraftGrade(
        toDraftGradePicks(
          userPicks
            .map((pick) => {
              const pl = playersVal.find((p) => p.id === pick.player_id);
              if (!pl) return null;
              const isKeeper = keepers.some(
                (k) =>
                  k.player_id === pick.player_id &&
                  k.round_number === pick.round_number &&
                  k.team_number === pick.team_number
              );
              return {
                pick_number: pick.pick_number,
                round_number: pick.round_number,
                is_autodraft: pick.is_autodraft,
                is_keeper: isKeeper,
                player: {
                  id: pl.id,
                  name: pl.name,
                  adp: pl.adp,
                  position: pl.position,
                  team: pl.team,
                  bye_week: pl.bye_week,
                },
              };
            })
            .filter((p): p is NonNullable<typeof p> => p != null)
        ),
        {
          numTeams: draftVal.num_teams,
          numRounds: draftVal.num_rounds,
          chaosArchetype: chaosArchetype ?? null,
          isSuperflex,
          starters: parseStarters(positionLimits),
          flexCount: getFlexCount(positionLimits, isSuperflex),
          playerPool: playersVal,
          priorSeasonRankByPlayerId,
          archetypeName: archetypeName || null,
        }
      );
    },
    [keepers, isSuperflex, priorSeasonRankByPlayerId, positionLimits]
  );

  // Handle showing completion screen when draft was already completed
  useEffect(() => {
    if (!draft || picks.length < totalPicks || totalPicks <= 0 || draft.status === 'completed') return;
    if (!isRookiesOnlyDraft && !areAllTeamsComplete()) {
      console.warn('Draft pick count reached with unfilled starter slots');
    }
    const flexCount = getFlexCount(positionLimits, isSuperflex);
    const benchCount = getBenchCount(positionLimits);
    const baseStarters = countBaseStarters(parseStarters(positionLimits));
    const config = buildDraftConfig(flexCount, benchCount, draft.num_teams, baseStarters);
    let cancelled = false;
    (async () => {
      const { userDetectedArchetype, userDetectedArchetypeIndex, userDetectedChaosArchetype } = await resolveArchetypeForCompletion(draft, picks, players, config, isSuperflex);
      if (cancelled) return;
      const replaceChaos =
        !!userDetectedChaosArchetype && isChaosReplace(userDetectedChaosArchetype);
      const grade = buildCompletionGrade(
        draft,
        picks,
        players,
        userDetectedChaosArchetype,
        replaceChaos ? userDetectedChaosArchetype : userDetectedArchetype
      );
      const gradeFields = grade
        ? {
            grade_letter: grade.grade,
            grade_score: grade.numericScore,
            grade_payload: grade as unknown as Record<string, unknown>,
          }
        : {};
      if (isTempDraft) {
        const updatedDraft = {
          ...draft,
          status: 'completed' as const,
          completed_at: new Date().toISOString(),
          user_detected_archetype: userDetectedArchetype,
          user_detected_archetype_index: userDetectedArchetypeIndex,
          user_detected_chaos_archetype: userDetectedChaosArchetype ?? undefined,
          ...gradeFields,
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
            ...gradeFields,
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
                ...gradeFields,
              }
            : prev
        );
      }
    })();
    return () => { cancelled = true; };
  }, [draft, picks.length, totalPicks, draftId, picks, isTempDraft, players, positionLimits, isSuperflex, resolveArchetypeForCompletion, buildCompletionGrade]);

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
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="flex min-h-[70vh] items-center justify-center px-4">
          <BrandedLoader label="Loading draft..." />
        </main>
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
    const benchCount = getBenchCount(positionLimits);
    const userTeam = draft?.user_pick_position || 1;
    const userKeeperIds = keepers
      .filter((k) => k.team_number === userTeam)
      .map((k) => k.player_id);
    const { filledSlots, benchPlayers } = fillDraftTeamLineup(
      draftedPlayers,
      startingSlots,
      benchCount,
      { keeperPlayerIds: userKeeperIds, isSuperflex }
    );
    const teamName = teamNames.get(userTeam) || 'MY TEAM';
    const sortedCompletionPicks = [...userPicks].sort((a, b) => a.pick_number - b.pick_number);

    // Detect archetype from user's picks
    const flexCount = getFlexCount(positionLimits, isSuperflex);
    const baseStarters = countBaseStarters(parseStarters(positionLimits));
    const config = buildDraftConfig(flexCount, benchCount, draft?.num_teams ?? 12, baseStarters);
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

    const completionGrade =
      !isFinalizingBadge && draft?.status === 'completed' && userPicks.length > 0
        ? parseStoredDraftGrade(draft.grade_payload) ??
          buildCompletionGrade(
            draft,
            picks,
            players,
            draft.user_detected_chaos_archetype ?? chaosName,
            isReplaceChaos ? chaosName : detectedArchetype || null
          )
        : null;

    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 py-4 sm:py-5">
          <div className="text-center mb-3">
            <Trophy className="w-8 h-8 text-accent mx-auto mb-1.5" />
            <h1 className="font-display text-2xl sm:text-3xl mb-0.5">DRAFT COMPLETE!</h1>
            {!isFinalizingBadge && headlineBadgeLabel && (
              <p className="text-sm font-medium text-accent mb-2">
                You&apos;re {headlineBadgeLabel}
              </p>
            )}
            {isFinalizingBadge ? (
              <div className="flex flex-col items-center gap-2 py-2 mb-2">
                <BrandedLoader size={40} />
                <p className="text-muted-foreground text-sm text-center max-w-sm">
                  Locking in your badges…
                </p>
              </div>
            ) : null}
            {!isFinalizingBadge && completionGrade && (
              <DraftGradeBanner
                compact
                result={completionGrade}
                className="w-full max-w-4xl mx-auto mb-2 text-left"
              >
                {isReplaceChaos && chaosMeta ? (
                  <ArchetypeBadge
                    archetypeName={chaosName!}
                    iconOnly
                    size="lg"
                    flavorText={chaosMeta.flavorText}
                    locked={false}
                    className="shrink-0"
                  />
                ) : !isReplaceChaos && chaosName && chaosMeta ? (
                  <>
                    <ArchetypeBadge
                      archetypeName={detectedArchetype}
                      archetypeIndex={
                        typeof draft?.user_detected_archetype_index === 'number'
                          ? draft.user_detected_archetype_index
                          : undefined
                      }
                      iconOnly
                      size="lg"
                      flavorText={mainFlavor}
                      locked={false}
                      className="shrink-0"
                    />
                    <ArchetypeBadge
                      archetypeName={chaosName}
                      iconOnly
                      size="lg"
                      flavorText={chaosMeta.flavorText}
                      locked={false}
                      className="shrink-0"
                    />
                  </>
                ) : detectedArchetype ? (
                  <ArchetypeBadge
                    archetypeName={detectedArchetype}
                    archetypeIndex={
                      typeof draft?.user_detected_archetype_index === 'number'
                        ? draft.user_detected_archetype_index
                        : undefined
                    }
                    iconOnly
                    size="lg"
                    flavorText={flavorText ?? undefined}
                    locked={false}
                    className="shrink-0"
                  />
                ) : null}
              </DraftGradeBanner>
            )}
            {!isFinalizingBadge && (
              <p className="text-muted-foreground text-xs sm:text-sm mt-1 mb-0">
                {draft?.name} saved to your history.
              </p>
            )}
          </div>

          {/* Team Display - Two Column Layout (or ordered pick slots for rookie-only) */}
          <div className="glass-card p-6 mt-2">
            <h2 className="font-display text-2xl mb-4 text-center">{teamName}</h2>

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

          {!isFinalizingBadge && (
            <div className="flex justify-center gap-3 sm:gap-4 flex-wrap mt-6 pb-4">
              <Button variant="outline" onClick={() => navigate('/history')}>
                View History
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/badges', { state: { fromDraftComplete: true } })}
              >
                View Badges
              </Button>
              <Button variant="hero" onClick={() => navigate('/mock-draft')}>
                Start New Draft
              </Button>
            </div>
          )}
        </main>
      </div>
    );
  }

  const toggleDraftPaused = () => {
    const newPausedState = !isDraftPaused;
    setIsDraftPaused(newPausedState);
    isDraftPausedRef.current = newPausedState;
    if (newPausedState && cpuDraftTimeoutRef.current) {
      clearTimeout(cpuDraftTimeoutRef.current);
      cpuDraftTimeoutRef.current = null;
    }
  };

  return (
    <div className="h-screen bg-background overflow-hidden flex flex-col">
      {/* Hide site nav on short phones so the pick list keeps height */}
      <div className="shrink-0 [@media(max-height:640px)]:hidden">
        <Navbar />
      </div>

      <main className="flex-1 min-h-0 overflow-hidden flex flex-col max-w-[1400px] w-full mx-auto px-3 py-2 gap-2 sm:px-4 sm:py-3 sm:gap-3 [@media(max-height:700px)]:py-1.5 [@media(max-height:700px)]:gap-1.5">
        {/* Draft Header */}
        <div className="glass-card px-3 py-2 sm:p-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 shrink-0 [@media(max-height:700px)]:py-1.5">
          <div className="hidden md:block min-w-0 [@media(max-height:700px)]:hidden">
            <h1 className="font-display text-xl lg:text-2xl truncate">{draft?.name}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {draft?.num_teams} teams • {draft?.num_rounds} rounds • {draft?.draft_order} draft
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            {/* Timer - show when user has a timer set, pause button always available */}
            {draft && draft.pick_timer && draft.pick_timer > 0 && (
              <div className="text-center">
                {isUserPick && timeRemaining !== null ? (
                  <>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-0.5 justify-center leading-none mb-0.5">
                      <Timer className="w-3 h-3" /> Timer
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "font-display text-xl sm:text-2xl leading-none transition-colors",
                        timeRemaining <= 5 ? "text-destructive animate-pulse" : "text-accent"
                      )}>
                        {timeRemaining}s
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 gap-1.5 border border-primary/30 bg-primary/10 hover:bg-primary/20 hover:border-primary/50"
                        onClick={toggleDraftPaused}
                        title={isDraftPaused ? "Resume draft" : "Pause draft"}
                      >
                        {isDraftPaused ? (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span className="text-xs">Resume</span>
                          </>
                        ) : (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span className="text-xs">Pause</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Timer</div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 gap-1.5 border border-primary/30 bg-primary/10 hover:bg-primary/20 hover:border-primary/50"
                      onClick={toggleDraftPaused}
                      title={isDraftPaused ? "Resume draft" : "Pause draft"}
                    >
                      {isDraftPaused ? (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span className="text-xs">Resume</span>
                        </>
                      ) : (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span className="text-xs">Pause</span>
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none mb-0.5">Round</div>
              <div className="font-display text-xl sm:text-2xl text-gradient leading-none">{getCurrentRound()}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none mb-0.5">Pick</div>
              <div className="font-display text-xl sm:text-2xl text-gradient leading-none">{currentPick}</div>
            </div>
            <div className="text-center min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none mb-0.5">On the Clock</div>
              <div className={cn(
                "font-display text-xl sm:text-2xl leading-none truncate max-w-[9rem] sm:max-w-[14rem]",
                isUserPick ? "text-accent" : "text-foreground"
              )}>
                {getTeamName(getCurrentTeam())}
                {isUserPick && <span className="text-xs ml-1 font-sans font-medium">(YOU)</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentPick > totalPicks && !isDraftComplete && (
              <Button 
                variant="gold" 
                size="sm"
                className="h-8"
                onClick={async () => {
                  if (!draft) return;
                  const flexCount = getFlexCount(positionLimits, isSuperflex);
                  const benchCount = getBenchCount(positionLimits);
                  const baseStarters = countBaseStarters(parseStarters(positionLimits));
                  const config = buildDraftConfig(flexCount, benchCount, draft.num_teams, baseStarters);
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
                  const replaceChaos =
                    !!userDetectedChaosArchetype && isChaosReplace(userDetectedChaosArchetype);
                  const grade = buildCompletionGrade(
                    draft,
                    picks,
                    players,
                    userDetectedChaosArchetype,
                    replaceChaos ? userDetectedChaosArchetype : userDetectedArchetype
                  );
                  const gradeFields = grade
                    ? {
                        grade_letter: grade.grade,
                        grade_score: grade.numericScore,
                        grade_payload: grade as unknown as Record<string, unknown>,
                      }
                    : {};
                  if (isTempDraft) {
                    const updatedDraft = {
                      ...draft,
                      status: 'completed' as const,
                      completed_at: new Date().toISOString(),
                      user_detected_archetype: userDetectedArchetype,
                      user_detected_archetype_index: userDetectedArchetypeIndex,
                      user_detected_chaos_archetype: userDetectedChaosArchetype ?? undefined,
                      ...gradeFields,
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
                        ...gradeFields,
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
                            ...gradeFields,
                          }
                        : prev
                    );
                    toast.success('Draft complete!');
                  }
                }}
              >
                <Trophy className="w-4 h-4 mr-1" /> Finish
              </Button>
            )}
            <Button 
              variant="destructive" 
              size="sm"
              className="h-8"
              onClick={() => navigate('/mock-draft')}
            >
              <LogOut className="w-4 h-4 mr-1" /> Exit
            </Button>
          </div>
        </div>

        <DraftMobilePanelTabs value={mobilePanel} onChange={setMobilePanel} />

        <div className="flex flex-col lg:grid lg:grid-cols-4 gap-2 sm:gap-3 flex-1 min-h-0 overflow-hidden">
          {/* My Roster: align to top of row; scroll inside cell if roster is taller than the players column */}
          <div
            className={cn(
              'lg:col-span-1 flex-col justify-start overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin',
              draftMobilePanelClass(mobilePanel, 'roster')
            )}
          >
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
          <div
            className={cn(
              'lg:col-span-2 glass-card p-2.5 sm:p-3 flex-col overflow-hidden',
              draftMobilePanelClass(mobilePanel, 'players')
            )}
          >
            <div className="flex flex-wrap gap-1.5 items-center shrink-0 mb-1.5">
              <h2 className="font-display text-base sm:text-lg shrink-0 hidden sm:block">AVAILABLE PLAYERS</h2>
              <div className="relative flex-1 min-w-[10rem]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search players"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 bg-secondary/50 border-border/50 text-sm"
                />
              </div>
              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger className="w-[104px] h-8 bg-secondary/50 border-border/50 text-sm shrink-0">
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
            </div>

            {/* Show picks until next user pick */}
            {picksUntilNext() > 0 && (
              <div className="mb-1 text-xs text-muted-foreground px-0.5 shrink-0">
                {picksUntilNext()} pick{picksUntilNext() !== 1 ? 's' : ''} until your next pick
              </div>
            )}
            {!user && (
              <p className="mb-1 text-[11px] text-muted-foreground px-0.5 shrink-0 leading-snug line-clamp-2 sm:line-clamp-none">
                Your board uses rankings from this device if you finalized them; otherwise Consensus.
              </p>
            )}

            <div className="space-y-0.5 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin">
              {availableListRows.map((row) => (
                <DraftAvailablePlayerRow
                  key={row.player.id}
                  player={row.player}
                  displayRank={row.displayRank}
                  myPosRank={row.myPosRank}
                  tier={row.tier}
                  hasTierBreakBefore={row.hasTierBreakBefore}
                  showPlayerTier={positionFilter !== 'ALL'}
                  highlighted={row.highlighted}
                  onNameClick={handleAvailablePlayerStats}
                  onDraft={handleAvailablePlayerDraft}
                />
              ))}
            </div>
          </div>

          {/* Draft Board */}
          <div
            className={cn(
              'glass-card p-2.5 sm:p-3 flex-col overflow-hidden',
              draftMobilePanelClass(mobilePanel, 'board')
            )}
          >
            <h2 className="font-display text-base sm:text-lg mb-2 flex-shrink-0">DRAFT BOARD</h2>
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
        allStats2025={player2025Stats}
        positionAdpRank={
          selectedPlayerForStats
            ? resolvePositionAdpRankForDisplay(
                selectedPlayerForStats,
                positionAdpRankMap,
                communityDefenseRankFromList
              )
            : null
        }
      />
    </div>
  );
};

export default DraftRoom;
