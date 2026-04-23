import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLeagues } from '@/hooks/useLeagues';
import { useCommunityRankingsBucket } from '@/hooks/useCommunityRankingsBucket';
import { usePlayer2025Stats } from '@/hooks/usePlayer2025Stats';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { PlayerCard } from '@/components/PlayerCard';
import { PlayerDetailDialog } from '@/components/PlayerDetailDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { RotateCcw, Search, Filter, Loader2, Users, User, Save, Edit } from 'lucide-react';
import type { RankedPlayer } from '@/types/database';
import {
  tempRankingsStorage,
  tempSettingsStorage,
  getOrCreateGuestSessionId,
  allLeaguesBucketStorage,
  getRankingsDraftSessionStorageKey,
  rankingsDraftSessionStorage,
} from '@/utils/temporaryStorage';
import { deduplicatePlayersByIdentity } from '@/utils/playerDeduplication';
import { displayTeamAbbrevOrFa } from '@/utils/teamMapping';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
} from '@dnd-kit/core';
import { useRampUpAutoScroll } from '@/hooks/useRampUpAutoScroll';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchRookiesRankings, filterPlayersToRookieIds } from '@/utils/rookiesFilter';
import { useNflTeams } from '@/hooks/useNflTeams';
import { NFL_DEFENSE_TEAM_NAMES } from '@/constants/nflDefenses';

/** Disable dnd-kit built-in auto-scroll - we use custom ramp-up scroll instead */
const autoScrollConfig = false;

function RampUpScrollHandler({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  useRampUpAutoScroll(containerRef);
  return null;
}

/** Build community RankedPlayer list from RPC results. Uses RPC order as source of truth.
 * ADP = bucket-specific community rank (rank_position), so ADP reflects consensus for this scoring/league type. */
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
      result.push({
        ...player,
        adp: Number(r.rank_position),
        rank: result.length + 1,
      } as RankedPlayer);
    }
  }
  const maxRank = result.length;
  for (let i = 0; i < allPlayersData.length; i++) {
    const p = allPlayersData[i];
    if (!seenIds.has(p.id)) {
      seenIds.add(p.id);
      result.push({
        ...p,
        adp: maxRank + i + 1,
        rank: maxRank + i + 1,
      } as RankedPlayer);
    }
  }
  return result.map((p, index) => ({ ...p, rank: index + 1 }));
}

/** Merge my current rankings into community (excluding me) for live update when dragging. */
/** ADP = position in merged list so ADP always matches community rank (updates as user drags). */
function mergeLiveCommunity(
  allPlayersData: any[],
  communityRaw: { player_id: string; avg_rank: number; sample_count: number }[],
  myRankedPlayers: RankedPlayer[]
): RankedPlayer[] {
  const playerById = new Map(allPlayersData.map((p) => [p.id, p]));
  const communityMap = new Map(communityRaw.map((r) => [r.player_id, { avg: Number(r.avg_rank), n: Number(r.sample_count) || 1 }]));
  const myRankMap = new Map(myRankedPlayers.map((p) => [p.id, p.rank]));

  const withNewAvg: { id: string; newAvg: number }[] = [];
  const seen = new Set<string>();
  for (const p of myRankedPlayers) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const entry = communityMap.get(p.id);
    const myRank = myRankMap.get(p.id) ?? 9999;
    const avg = entry ? entry.avg : 0;
    const n = entry ? entry.n : 0;
    const newAvg = n > 0 ? (avg * n + myRank) / (n + 1) : myRank;
    withNewAvg.push({ id: p.id, newAvg });
  }
  for (const r of communityRaw) {
    if (seen.has(r.player_id)) continue;
    seen.add(r.player_id);
    const myRank = myRankMap.get(r.player_id) ?? 9999;
    const n = Number(r.sample_count) || 1;
    const newAvg = (Number(r.avg_rank) * n + myRank) / (n + 1);
    withNewAvg.push({ id: r.player_id, newAvg });
  }
  withNewAvg.sort((a, b) => a.newAvg - b.newAvg);
  const result: RankedPlayer[] = [];
  for (let i = 0; i < withNewAvg.length; i++) {
    const p = playerById.get(withNewAvg[i].id);
    if (p) {
      const communityRank = i + 1;
      result.push({
        ...p,
        adp: communityRank,
        rank: communityRank,
      } as RankedPlayer);
    }
  }
  return result;
}

/** Rounds midpoint ADP: nearest integer, but exactly .5 rounds down. */
function roundAdpMidpoint(n: number): number {
  const frac = Math.abs(n % 1);
  if (Math.abs(frac - 0.5) < 1e-9) return Math.floor(n);
  return Math.round(n);
}

/** Target rank when dropping between two neighbors in a filtered list (by their current ranks). */
function rankFromFilteredNeighbors(rankAbove: number | undefined, rankBelow: number | undefined): number {
  if (rankAbove != null && rankBelow != null) {
    return roundAdpMidpoint((rankAbove + rankBelow) / 2);
  }
  if (rankBelow != null) return Math.max(1, rankBelow - 1);
  if (rankAbove != null) return rankAbove + 1;
  return 1;
}

/**
 * When reordering inside a position (or filtered) list, set the moved player's rank to the midpoint
 * between the neighbors' ranks and shift other players' ranks so order stays unique integers.
 */
function applyFilteredMidpointRankDrag(
  allPlayers: RankedPlayer[],
  filteredOrdered: RankedPlayer[],
  activeId: string,
  overId: string
): RankedPlayer[] {
  const oldF = filteredOrdered.findIndex((p) => p.id === activeId);
  const newF = filteredOrdered.findIndex((p) => p.id === overId);
  if (oldF < 0 || newF < 0) return allPlayers;

  const reorderedF = arrayMove(filteredOrdered, oldF, newF);
  const newIdx = reorderedF.findIndex((p) => p.id === activeId);
  const above = reorderedF[newIdx - 1];
  const below = reorderedF[newIdx + 1];

  const movedEntry = allPlayers.find((p) => p.id === activeId);
  if (!movedEntry) return allPlayers;
  const oldPRank = movedEntry.rank;
  const newMid = rankFromFilteredNeighbors(above?.rank, below?.rank);

  const updated = allPlayers.map((p) => ({ ...p }));

  if (newMid < oldPRank) {
    for (const q of updated) {
      if (q.id === activeId) continue;
      if (q.rank >= newMid && q.rank < oldPRank) q.rank += 1;
    }
  } else if (newMid > oldPRank) {
    for (const q of updated) {
      if (q.id === activeId) continue;
      if (q.rank > oldPRank && q.rank <= newMid) q.rank -= 1;
    }
  }

  const moved = updated.find((p) => p.id === activeId);
  if (moved) moved.rank = newMid;

  updated.sort((a, b) => a.rank - b.rank);
  return updated;
}

/** Reapply in-session draft order onto a freshly fetched list (new players append by rank). */
function mergeRankingsWithDraftOrder(fetched: RankedPlayer[], draftIds: string[]): RankedPlayer[] {
  const byId = new Map(fetched.map((p) => [p.id, p]));
  const used = new Set<string>();
  const ordered: RankedPlayer[] = [];
  for (const id of draftIds) {
    const p = byId.get(id);
    if (p) {
      used.add(p.id);
      ordered.push({ ...p });
    }
  }
  const rest = fetched.filter((p) => !used.has(p.id)).sort((a, b) => a.rank - b.rank);
  for (const p of rest) ordered.push({ ...p });
  return ordered.map((p, i) => ({ ...p, rank: i + 1 }));
}

// Sortable player with grab handle on the right and position-colored rank
const SortablePlayerWithHandle = ({ 
  player, 
  rank, 
  onPlayerClick,
  stats2025
}: { 
  player: RankedPlayer; 
  rank: number;
  onPlayerClick: (player: RankedPlayer) => void;
  stats2025?: { avgPointsPerGame: number | null } | undefined;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: player.id,
    animateLayoutChanges: () => false,
  });

  // Force vertical-only: ignore transform.x entirely
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(0, ${transform.y ?? 0}px, 0)` : undefined,
    transition: isDragging ? 'none' : undefined, // Remove transition entirely for instant response
    touchAction: 'none', // Prevent touch scrolling during drag
    pointerEvents: (isDragging ? 'none' : 'auto') as React.CSSProperties['pointerEvents'], // Improve performance during drag
  };

  return (
    <div 
      ref={setNodeRef} 
      style={{ ...style, overflow: 'hidden' }}
      className="relative min-w-0"
    >
      <div 
        onClick={(e) => {
          if (!isDragging) {
            onPlayerClick(player);
          }
        }}
        className="pointer-events-auto"
      >
        <PlayerCard
          player={player}
          rank={rank}
          isDragging={isDragging}
          positionColoredRank
          showGrabHandle
          stats2025={stats2025}
        />
      </div>
      <div 
        {...attributes}
        {...listeners}
        className="absolute right-2 top-0 bottom-0 w-10 flex items-center justify-center cursor-grab active:cursor-grabbing z-10 touch-none"
      />
    </div>
  );
};

const Rankings = () => {
  const { user, loading: authLoading } = useAuth();
  const { selectedLeague, leagues, loading: leaguesLoading } = useLeagues();
  const [guestSettingsVersion, setGuestSettingsVersion] = useState(0);
  const bucket = useCommunityRankingsBucket(user ? undefined : guestSettingsVersion);
  const { teamNames: defenseTeamNames, teams: nflTeams } = useNflTeams();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [communityPlayers, setCommunityPlayers] = useState<RankedPlayer[]>([]);
  const [communityRawExcludingMe, setCommunityRawExcludingMe] = useState<{ player_id: string; avg_rank: number; sample_count: number }[] | null>(null);
  const allPlayersDataRef = useRef<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<RankedPlayer | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [hasExistingRankings, setHasExistingRankings] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hasCommunityConsensus, setHasCommunityConsensus] = useState(false);
  const [allLeaguesBucketScoring, setAllLeaguesBucketScoring] = useState<'standard' | 'ppr' | 'half_ppr'>('ppr');
  const [allLeaguesBucketLeagueType, setAllLeaguesBucketLeagueType] = useState<'season' | 'dynasty'>('season');
  const [allLeaguesBucketSuperflex, setAllLeaguesBucketSuperflex] = useState(false);
  const [allLeaguesBucketRookiesOnly, setAllLeaguesBucketRookiesOnly] = useState(false);
  const [allLeaguesSelectedMatchingLeagueId, setAllLeaguesSelectedMatchingLeagueId] = useState<string | null>(null);
  const fetchInProgressRef = useRef(false);
  const myRankingsScrollRef1 = useRef<HTMLDivElement>(null);
  const myRankingsScrollRef2 = useRef<HTMLDivElement>(null);
  const myRankingsScrollRef3 = useRef<HTMLDivElement>(null);
  const bucketRef = useRef<string>('');
  // Ref to latest fetchPlayers so refetch-after-bucket-change uses current bucket, not stale closure
  const fetchPlayersRef = useRef<() => void>(() => {});
  // Skip one fetch after guest "no saved rankings" path syncs dropdown/temp (avoids refresh loop)
  const skipNextFetchForGuestSyncRef = useRef(false);
  // Skip sync effect from overwriting dropdown when guest path just set it (avoids sf/non-sf flip)
  const skipSyncFromBucketRef = useRef(false);
  // Don't refetch when guest path just completed (avoids flip loop from effect ordering)
  const guestPathJustCompletedRef = useRef(false);
  // Defer first fetch one frame when leagues just loaded but selectedLeague still null (restoration pending)
  const deferredFetchScheduledRef = useRef(false);
  // When we refetch due to bucket change, the refetch's completion should set loading false without triggering another refetch
  const isRefetchAfterBucketChangeRef = useRef(false);
  // Ref for community bucket so refetch (triggered after bucket change) uses current values, not stale closure
  const communityBucketRef = useRef<{ scoringFormat: string; leagueType: string; isSuperflex: boolean; rookiesOnly?: boolean }>({
    scoringFormat: 'ppr',
    leagueType: 'season',
    isSuperflex: false,
  });
  // Fetch context: only apply fetch result if still matching (avoids stale deferred fetch overwriting correct bucket/view)
  const fetchContextRef = useRef<{ leagueId: string | null; bucketKey: string } | null>(null);
  // Updated in render so deferred callback and completion guard can read current selected league
  const selectedLeagueIdRef = useRef<string | null>(null);
  // When we skip applying state due to stale fetch, finally should only clear loading (no refetch)
  const staleFetchReturnedRef = useRef(false);

  const handlePlayerClick = (player: RankedPlayer) => {
    setSelectedPlayer(player);
    setDetailDialogOpen(true);
  };

  const isAllLeagues = !selectedLeague;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 0, // Instant drag when using handle
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Don't redirect - allow non-authenticated users to view rankings (read-only)

  // Effective bucket: from selected league when we have one; from dropdowns for All Leagues (both guest and logged-in) so changing league type refetches correct bucket; from bucket (hook) when not All Leagues
  const displayBucket = user && selectedLeague && !isAllLeagues
    ? {
        scoringFormat: (selectedLeague.scoring_format as 'standard' | 'ppr' | 'half_ppr') || 'ppr',
        leagueType: (selectedLeague.league_type as 'season' | 'dynasty') || 'season',
        isSuperflex: Boolean(selectedLeague.is_superflex),
        rookiesOnly: Boolean((selectedLeague as any).rookies_only) && (selectedLeague.league_type as string) === 'dynasty',
      }
    : isAllLeagues
      ? {
          scoringFormat: allLeaguesBucketScoring,
          leagueType: allLeaguesBucketLeagueType,
          isSuperflex: allLeaguesBucketSuperflex,
          rookiesOnly: allLeaguesBucketLeagueType === 'dynasty' && allLeaguesBucketRookiesOnly,
        }
      : { ...bucket, rookiesOnly: bucket.rookiesOnly };
  const player2025Stats = usePlayer2025Stats(displayBucket.scoringFormat as 'standard' | 'ppr' | 'half_ppr');
  const positions = displayBucket.rookiesOnly ? ['QB', 'RB', 'WR', 'TE'] : ['QB', 'RB', 'WR', 'TE', 'K', 'D/ST'];
  const bucketKey = `${displayBucket.scoringFormat}/${displayBucket.leagueType}/${displayBucket.isSuperflex}/${displayBucket.rookiesOnly || false}`;
  bucketRef.current = bucketKey;
  communityBucketRef.current = displayBucket;
  const defenseTeamAbbrByName = useMemo(
    () =>
      new Map(
        (nflTeams || [])
          .filter((t) => t.team_name && t.team_abbr)
          .map((t) => [t.team_name as string, t.team_abbr as string])
      ),
    [nflTeams]
  );
  selectedLeagueIdRef.current = selectedLeague?.id ?? null;

  const rankingsSessionDraftKey = useMemo(
    () =>
      getRankingsDraftSessionStorageKey({
        userId: user?.id ?? null,
        guestSessionId: user ? null : getOrCreateGuestSessionId(),
        leagueId: user ? (selectedLeague?.id ?? null) : null,
        bucketKey,
      }),
    [user?.id, user, selectedLeague?.id, bucketKey]
  );

  const persistRankingsSessionDraft = useCallback(
    (list: RankedPlayer[], editMode: boolean) => {
      rankingsDraftSessionStorage.save(rankingsSessionDraftKey, {
        v: 1,
        ids: list.map((p) => p.id),
        isEditMode: editMode,
      });
    },
    [rankingsSessionDraftKey]
  );

  // Guest only: persist bucket to League Settings so Rankings dropdown and League Settings always match
  const saveGuestBucketToTempSettings = useCallback((scoringFormat: 'standard' | 'ppr' | 'half_ppr', leagueType: 'season' | 'dynasty', isSuperflex: boolean, rookiesOnly: boolean) => {
    if (typeof window === 'undefined') return;
    const cur = tempSettingsStorage.get() || {};
    tempSettingsStorage.save({
      ...cur,
      scoringFormat: scoringFormat || 'ppr',
      leagueType: leagueType || 'season',
      isSuperflex: isSuperflex ?? false,
      rookiesOnly: leagueType === 'dynasty' ? (rookiesOnly ?? false) : false,
    });
    setGuestSettingsVersion((v) => v + 1);
  }, []);

      // Live community: when we have communityRawExcludingMe, merge in current rankings so dragging updates Community column
  // (signed-in with league, or guest in edit mode - both get real-time ADP updates)
  const displayedCommunityPlayers = useMemo(() => {
    if (communityRawExcludingMe && communityRawExcludingMe.length > 0 && players.length > 0) {
      return mergeLiveCommunity(allPlayersDataRef.current, communityRawExcludingMe, players);
    }
    return communityPlayers;
  }, [communityRawExcludingMe, players, communityPlayers]);

  // ADP = current community rank (updates as user drags). Used to override player.adp in My Rankings column.
  const communityRankMap = useMemo(
    () => new Map(displayedCommunityPlayers.map((p, i) => [p.id, i + 1])),
    [displayedCommunityPlayers]
  );

  // Leagues matching the current bucket (for All Leagues dropdown)
  const matchingLeaguesForBucket = useMemo(
    () =>
      leagues.filter(
        (l) =>
          ((l.scoring_format as string) || 'ppr') === displayBucket.scoringFormat &&
          ((l.league_type as string) || 'season') === displayBucket.leagueType &&
          Boolean(l.is_superflex) === displayBucket.isSuperflex &&
          (displayBucket.leagueType !== 'dynasty' || Boolean((l as any).rookies_only) === (displayBucket.rookiesOnly ?? false))
      ),
    [leagues, displayBucket.scoringFormat, displayBucket.leagueType, displayBucket.isSuperflex, displayBucket.rookiesOnly]
  );

  const fetchPlayers = useCallback(async () => {
    const currentBucketKey = bucketRef.current;
    // If a fetch is in progress for the same bucket, skip (allow refetch when bucket changed)
    if (fetchInProgressRef.current) {
      console.log('Rankings: Fetch in progress, skipping (bucket may have changed)');
      return;
    }

    // Use ref so we always have the latest bucket (avoids stale closure when refetching after bucket change)
    const effectiveBucket = { ...communityBucketRef.current };
    const effectiveBucketKey = `${effectiveBucket.scoringFormat}/${effectiveBucket.leagueType}/${effectiveBucket.isSuperflex}/${effectiveBucket.rookiesOnly || false}`;
    // Capture context so we can ignore this fetch's result if league/bucket changed before it completed (e.g. stale deferred fetch)
    fetchContextRef.current = { leagueId: selectedLeague?.id ?? null, bucketKey: effectiveBucketKey };

    fetchInProgressRef.current = true;
    try {
      // Fetch all players (including defenses) - they're just regular players with position 'D/ST'
      // Use range query to fetch all players (Supabase default limit is 1000)
      let allPlayersData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error: playersError } = await supabase
          .from('players')
          .select('*')
          .eq('season', 2025)
          .order('adp', { ascending: true })
          .range(from, from + pageSize - 1);

        if (playersError) throw playersError;
        
        if (data && data.length > 0) {
          allPlayersData = [...allPlayersData, ...data];
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      // Use teams table for D/ST list when available; fallback to constant (see useNflTeams)
      const defenseNamesList = defenseTeamNames.length > 0 ? defenseTeamNames : NFL_DEFENSE_TEAM_NAMES;
      // Always filter to the 32 current teams (constant); teams table may have legacy rows (Oakland, San Diego, St. Louis)
      const canonicalDefenseSet = new Set(NFL_DEFENSE_TEAM_NAMES);
      // Add any missing defenses in memory only (no DB write - RLS blocks client insert/update on players)
      const existingDefenseNames = new Set(
        (allPlayersData || [])
          .filter(p => p.position === 'D/ST')
          .map(p => p.name)
      );
      
      const missingDefenses = defenseNamesList.filter((teamName: string) => !existingDefenseNames.has(teamName));
      
      if (missingDefenses.length > 0) {
        const defenseInserts = missingDefenses.map((teamName, index) => {
          const adp = 150 + Math.floor((index / missingDefenses.length) * 50);
          return {
            id: `defense-${teamName.replace(/\s/g, '-').toLowerCase()}`,
            name: teamName,
            position: 'D/ST',
            team: defenseTeamAbbrByName.get(teamName) ?? null,
            season: 2025,
            adp,
            bye_week: null,
          };
        });
        allPlayersData = [...(allPlayersData || []), ...defenseInserts];
      }
      
      // Process the already-fetched players (no DB writes - RLS blocks anon insert/update on players)
      // Separate defenses from non-defenses; keep only canonical 32 teams (drop legacy rows like Oakland Raiders, San Diego Chargers, St. Louis Rams)
      const nonDefensePlayers = allPlayersData.filter(p => p.position !== 'D/ST');
      const allDefensePlayers = allPlayersData
        .filter(p => p.position === 'D/ST' && canonicalDefenseSet.has(p.name));
      
      // Deduplicate defenses by name - keep only the first occurrence of each team
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
      defensePlayers = defensePlayers.map((defense, index) => {
        const adp = 150 + Math.floor((index / Math.max(defensePlayers.length, 1)) * 50);
        const normalizedTeam = defense.team && defense.team !== 'FA'
          ? defense.team
          : (defenseTeamAbbrByName.get(defense.name) ?? defense.team);
        if (Number(defense.adp) >= 200 || Number(defense.adp) < 150) {
          return { ...defense, adp, team: normalizedTeam };
        }
        return { ...defense, team: normalizedTeam };
      });
      
      // Do not persist defense ADP updates - RLS blocks anon update on players; in-memory is enough
      
      console.log(`Rankings: Found ${allDefensePlayers?.length || 0} total defenses, deduplicated to ${defensePlayers.length} unique defenses`);
      
      // Merge non-defense players with processed defenses, then deduplicate multi-position players
      // (e.g. Taysom Hill QB/TE/RB, Connor Heyward RB/TE) who appear as separate rows
      const merged = [
        ...nonDefensePlayers,
        ...defensePlayers
      ].sort((a, b) => {
        const adpA = Number(a.adp) || 999;
        const adpB = Number(b.adp) || 999;
        return adpA - adpB;
      });
      const updatedPlayersData = deduplicatePlayersByIdentity(merged);
      
      console.log(`Rankings: Merged ${nonDefensePlayers?.length || 0} non-defense + ${defensePlayers.length} defenses, deduped to ${updatedPlayersData.length}`);
      console.log(`Rankings: Total players after merge: ${updatedPlayersData.length}`);
      
      // If we got no players, log a warning
      if (updatedPlayersData.length === 0) {
        console.warn('Rankings: WARNING - No players found in database!');
        console.warn('Rankings: nonDefensePlayers:', nonDefensePlayers?.length || 0);
        console.warn('Rankings: defensePlayers:', defensePlayers.length);
      }
      
      // Debug: Check what positions exist in the returned data
      if (updatedPlayersData) {
        const uniquePositions = [...new Set(updatedPlayersData.map(p => p.position))];
        console.log(`Rankings: Unique positions in query result:`, uniquePositions);
        console.log(`Rankings: Total players returned: ${updatedPlayersData.length}`);
        
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
        console.log(`Rankings: Players with defense-like positions:`, allDefenseVariations.length);
        if (allDefenseVariations.length > 0) {
          console.log(`Rankings: Defense-like position values:`, [...new Set(allDefenseVariations.map(p => p.position))]);
        }
      }
      
      if (updatedPlayersData) {
        allPlayersData = updatedPlayersData;
        allPlayersDataRef.current = allPlayersData;
        const defensesAfterRefetch = (allPlayersData || []).filter(p => p.position === 'D/ST');
        console.log(`Rankings: After refetch, found ${defensesAfterRefetch.length} defenses in database`);
        console.log(`Rankings: Defense names:`, defensesAfterRefetch.map(d => d.name));
        if (defensesAfterRefetch.length !== 32) {
          console.warn(`Rankings: Expected 32 defenses but found ${defensesAfterRefetch.length}`);
          // Try to find defenses by name instead
          const defensesByName = (allPlayersData || []).filter(p => 
            defenseNamesList.includes(p.name)
          );
          console.log(`Rankings: Found ${defensesByName.length} defenses by name matching`);
          if (defensesByName.length > 0) {
            console.log(`Rankings: Defense positions in DB:`, [...new Set(defensesByName.map(d => d.position))]);
          }
        }
      }

      // Debug: Check defenses before processing
      const defensesBeforeProcessing = (allPlayersData || []).filter(p => p.position === 'D/ST');
      console.log(`Rankings: Defenses in allPlayersData before processing: ${defensesBeforeProcessing.length}`);

      // When rookies-only, filter to rookies and exclude D/ST, K
      if (effectiveBucket.rookiesOnly) {
        const rookiesRows = await fetchRookiesRankings({
          scoringFormat: effectiveBucket.scoringFormat,
          leagueType: effectiveBucket.leagueType,
          isSuperflex: effectiveBucket.isSuperflex,
        });
        const rookieIds = new Set(rookiesRows.map((r) => r.player_id));
        allPlayersData = filterPlayersToRookieIds(allPlayersData, rookieIds);
      }
      
      type CommunityRow = { player_id: string; avg_rank: number; rank_position: number; sample_count: number };
      const fetchCommunity = async (opts?: { excludeUserId?: string | null; excludeGuestSessionId?: string | null }) => {
        if (effectiveBucket.rookiesOnly) {
          const rookiesRows = await fetchRookiesRankings({
            scoringFormat: effectiveBucket.scoringFormat,
            leagueType: effectiveBucket.leagueType,
            isSuperflex: effectiveBucket.isSuperflex,
          });
          return rookiesRows.map((r) => ({
            player_id: r.player_id,
            avg_rank: r.rank,
            rank_position: r.rank,
            sample_count: 100,
          }));
        }
        const sf = selectedLeague != null ? Boolean(selectedLeague.is_superflex) : effectiveBucket.isSuperflex;
        const fmt = selectedLeague ? (selectedLeague.scoring_format || 'ppr') : effectiveBucket.scoringFormat;
        const typ = selectedLeague ? (selectedLeague.league_type || 'season') : effectiveBucket.leagueType;
        const { data } = (await supabase.rpc('get_community_rankings' as any, {
          p_scoring_format: fmt,
          p_league_type: typ,
          p_is_superflex: sf,
          p_exclude_user_id: opts?.excludeUserId ?? null,
          p_exclude_guest_session_id: opts?.excludeGuestSessionId ?? null,
        })) as { data: CommunityRow[] | null };
        return Array.isArray(data) && data.length > 0 ? data : [];
      };

      const excludeForLive = user ? { excludeUserId: user.id } : (typeof window !== 'undefined' ? { excludeGuestSessionId: getOrCreateGuestSessionId() } : {});
      let communityData: CommunityRow[] = await fetchCommunity(excludeForLive);
      // If no baseline for this bucket, try same league_type + is_superflex with fallback scoring so we always show community order (not raw ADP)
      if (communityData.length === 0 && !effectiveBucket.rookiesOnly) {
        const fallbacks: Array<'ppr' | 'half_ppr' | 'standard'> = ['ppr', 'half_ppr', 'standard'];
        const typ = effectiveBucket.leagueType as string;
        const sf = effectiveBucket.isSuperflex;
        for (const fmt of fallbacks) {
          const { data } = (await supabase.rpc('get_community_rankings' as any, {
            p_scoring_format: fmt,
            p_league_type: typ,
            p_is_superflex: sf,
            p_exclude_user_id: excludeForLive && 'excludeUserId' in excludeForLive ? excludeForLive.excludeUserId : null,
            p_exclude_guest_session_id: excludeForLive && 'excludeGuestSessionId' in excludeForLive ? excludeForLive.excludeGuestSessionId : null,
          })) as { data: CommunityRow[] | null };
          if (Array.isArray(data) && data.length > 0) {
            communityData = data;
            break;
          }
        }
      }
      setHasCommunityConsensus(communityData.length > 0);
      const bucketAdpMap = new Map(communityData.map((r) => [r.player_id, Number(r.rank_position)]));

      // Ignore result if league/bucket changed during fetch (e.g. deferred fetch completed after selectedLeague restored)
      const ctx = fetchContextRef.current;
      const isStale = ctx && (ctx.leagueId !== selectedLeagueIdRef.current || ctx.bucketKey !== bucketRef.current);
      if (isStale) {
        staleFetchReturnedRef.current = true;
        fetchInProgressRef.current = false;
        // Trigger fetch for current context so data actually loads (the correct fetch was skipped earlier due to "in progress")
        setLoading(true);
        queueMicrotask(() => fetchPlayersRef.current());
        return;
      }

      // If no user, check for temporary rankings in localStorage
      if (!user) {
        const adpPlayers: RankedPlayer[] = allPlayersData.map((p, index) => ({
          ...p,
          adp: bucketAdpMap.get(p.id) ?? Number(p.adp),
          rank: index + 1,
        }));
        const defensesInAdp = adpPlayers.filter(p => p.position === 'D/ST');
        console.log(`Rankings: Defenses in adpPlayers: ${defensesInAdp.length}`);
        
        // Set community rankings (bucket-based, or ADP for dynasty/empty)
        const guestCommunity = communityData.length > 0
          ? buildCommunityFromRpc(allPlayersData, communityData)
          : adpPlayers;
        setCommunityPlayers(guestCommunity);
        // Set communityRawExcludingMe so live merge runs when guest drags (Community column updates in real time)
        setCommunityRawExcludingMe(
          communityData.length > 0
            ? communityData.map((r) => ({
                player_id: r.player_id,
                avg_rank: Number(r.avg_rank),
                sample_count: Number(r.sample_count) || 1,
              }))
            : null
        );
        
        // Only use saved rankings if they are for this bucket (guest must re-rank when changing league type)
        const currentBucketKey = `${effectiveBucket.scoringFormat}/${effectiveBucket.leagueType}/${effectiveBucket.isSuperflex}/${effectiveBucket.rookiesOnly || false}`;
        const guestDraftKey = getRankingsDraftSessionStorageKey({
          userId: null,
          guestSessionId: getOrCreateGuestSessionId(),
          leagueId: null,
          bucketKey: effectiveBucketKey,
        });
        const guestSessionDraft = rankingsDraftSessionStorage.get(guestDraftKey);
        const tempRankings = tempRankingsStorage.get(currentBucketKey);
        if (tempRankings && tempRankings.length > 0) {
          // User has finalized rankings for this bucket, show comparison view
          guestPathJustCompletedRef.current = true; // So finally clears loading and doesn't refetch
          let list = tempRankings;
          if (guestSessionDraft?.ids.length) {
            list = mergeRankingsWithDraftOrder(tempRankings, guestSessionDraft.ids);
          }
          setPlayers(list);
          setHasExistingRankings(true);
          if (guestSessionDraft?.ids.length) setIsEditMode(guestSessionDraft.isEditMode);
          else setIsEditMode(false);
        } else {
          // No rankings for this bucket: show edit mode with community seed (force resubmit when bucket changes)
          // Use guestCommunity so both columns show the same order (community rankings for this bucket)
          guestPathJustCompletedRef.current = true; // Don't refetch in finally (avoids flip loop)
          let list = guestCommunity;
          if (guestSessionDraft?.ids.length) {
            list = mergeRankingsWithDraftOrder(guestCommunity, guestSessionDraft.ids);
          }
          setPlayers(list);
          setHasExistingRankings(false);
          if (guestSessionDraft?.ids.length) setIsEditMode(guestSessionDraft.isEditMode);
          else setIsEditMode(true);
          // Keep dropdown and League Settings in sync with the bucket we actually used (so badge shows correct bucket)
          setAllLeaguesBucketScoring((effectiveBucket.scoringFormat as 'standard' | 'ppr' | 'half_ppr') || 'ppr');
          setAllLeaguesBucketLeagueType((effectiveBucket.leagueType as 'season' | 'dynasty') || 'season');
          setAllLeaguesBucketSuperflex(effectiveBucket.isSuperflex);
          setAllLeaguesBucketRookiesOnly(effectiveBucket.rookiesOnly ?? false);
          skipSyncFromBucketRef.current = true; // Prevent sync effect from overwriting and causing flip
          const cur = tempSettingsStorage.get() || {};
          tempSettingsStorage.save({
            ...cur,
            scoringFormat: effectiveBucket.scoringFormat,
            leagueType: effectiveBucket.leagueType,
            isSuperflex: effectiveBucket.isSuperflex,
            rookiesOnly: effectiveBucket.rookiesOnly ?? false,
          });
          setGuestSettingsVersion((v) => v + 1);
          // Prevent the state updates above from retriggering the fetch effect (break refresh loop)
          skipNextFetchForGuestSyncRef.current = true;
        }
        return;
      }

      if (isAllLeagues) {
        // Filter leagues to only those matching the selected bucket (scoring/league type/superflex)
        const matchingLeagues = leagues.filter(
          (l) =>
            (l.scoring_format as string || 'ppr') === effectiveBucket.scoringFormat &&
            (l.league_type as string || 'season') === effectiveBucket.leagueType &&
            Boolean(l.is_superflex) === effectiveBucket.isSuperflex
        );
        const selectedLeagueInBucket = allLeaguesSelectedMatchingLeagueId && matchingLeagues.some((l) => l.id === allLeaguesSelectedMatchingLeagueId);
        const leagueIdsToFetch = selectedLeagueInBucket
          ? [allLeaguesSelectedMatchingLeagueId!]
          : matchingLeagues.map((l) => l.id);

        console.log(`Rankings (All Leagues): Found ${matchingLeagues.length} leagues matching bucket; ${allLeaguesSelectedMatchingLeagueId ? 'showing single league' : 'averaging all'}`);

        // Signed-in All Leagues: always use rankings from each league (average or selected league), never a single "All Leagues" saved list
        let allLeagueRankingsData: any[] = [];
        if (leagueIdsToFetch.length > 0) {
          const { data, error: allLeagueRankingsError } = await supabase
            .from('user_rankings')
            .select('*')
            .eq('user_id', user.id)
            .not('league_id', 'is', null)
            .in('league_id', leagueIdsToFetch);

          if (allLeagueRankingsError) throw allLeagueRankingsError;
          allLeagueRankingsData = data || [];
          console.log(`Rankings (All Leagues): Fetched ${allLeagueRankingsData.length} rankings from ${leagueIdsToFetch.length} league(s)`);
        } else {
          console.log(`Rankings (All Leagues): No leagues match selected bucket, using community seed`);
        }

        const playerRankingsMap = new Map<string, number[]>();
        allLeagueRankingsData.forEach((ranking) => {
          if (!playerRankingsMap.has(ranking.player_id)) {
            playerRankingsMap.set(ranking.player_id, []);
          }
          playerRankingsMap.get(ranking.player_id)!.push(ranking.rank);
        });
        console.log(`Rankings (All Leagues): Found rankings for ${playerRankingsMap.size} unique players`);

        let sortedPersonal: RankedPlayer[];
        if (playerRankingsMap.size === 0) {
          sortedPersonal = communityData.length > 0
            ? buildCommunityFromRpc(allPlayersData, communityData)
            : allPlayersData.map((p, index) => ({ ...p, adp: bucketAdpMap.get(p.id) ?? Number(p.adp), rank: index + 1 }));
        } else {
          const averageRankingsMap = new Map<string, number>();
          playerRankingsMap.forEach((ranks, playerId) => {
            const average = ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
            averageRankingsMap.set(playerId, average);
          });
          const personalPlayers: RankedPlayer[] = allPlayersData.map((p, index) => {
            const avgRank = averageRankingsMap.get(p.id);
            const fallbackRank = bucketAdpMap.get(p.id) ?? (Number(p.adp) || index + 1);
            return {
              ...p,
              adp: bucketAdpMap.get(p.id) ?? Number(p.adp),
              rank: avgRank !== undefined ? avgRank : fallbackRank,
            };
          });
          personalPlayers.sort((a, b) => a.rank - b.rank);
          sortedPersonal = personalPlayers.map((p, index) => ({ ...p, rank: index + 1 }));
        }
        console.log(`Rankings (All Leagues): Sorted ${sortedPersonal.length} players by average rank across leagues for this bucket`);
        const defensesInPersonal = sortedPersonal.filter(p => p.position === 'D/ST');
        console.log(`Rankings: Defenses in sortedPersonal: ${defensesInPersonal.length}`);
        const allLeaguesDraftKey = getRankingsDraftSessionStorageKey({
          userId: user.id,
          guestSessionId: null,
          leagueId: null,
          bucketKey: effectiveBucketKey,
        });
        const allLeaguesSessionDraft = rankingsDraftSessionStorage.get(allLeaguesDraftKey);
        let personalForUi = sortedPersonal;
        if (allLeaguesSessionDraft?.ids.length) {
          personalForUi = mergeRankingsWithDraftOrder(sortedPersonal, allLeaguesSessionDraft.ids);
        }
        setPlayers(personalForUi);
        setHasExistingRankings(true);
        if (allLeaguesSessionDraft?.ids.length) setIsEditMode(allLeaguesSessionDraft.isEditMode);
        else setIsEditMode(false);

        // Community rankings: bucket-based from RPC, ADP fallback (dynasty shows ADP + "coming soon")
        const allLeaguesCommunity = communityData.length > 0
          ? buildCommunityFromRpc(allPlayersData, communityData)
          : allPlayersData.map((p, index) => ({ ...p, adp: bucketAdpMap.get(p.id) ?? Number(p.adp), rank: index + 1 }));
        setCommunityPlayers(allLeaguesCommunity);
        setCommunityRawExcludingMe(null);
      } else {
        // Fetch league-specific rankings
        const { data: rankingsData, error: rankingsError } = await supabase
          .from('user_rankings')
          .select('*')
          .eq('user_id', user.id)
          .eq('league_id', selectedLeague.id);

        if (rankingsError) throw rankingsError;

        const hasRankings = rankingsData && rankingsData.length > 0;

        let rankedPlayers: RankedPlayer[];

        if (hasRankings) {
          // Use existing league rankings
          const rankingsMap = new Map(
            rankingsData.map((r) => [r.player_id, r.rank])
          );

          rankedPlayers = allPlayersData.map((p, index) => ({
            ...p,
            adp: bucketAdpMap.get(p.id) ?? Number(p.adp),
            rank: rankingsMap.get(p.id) ?? bucketAdpMap.get(p.id) ?? Number(p.adp) ?? index + 1,
          }));
        } else {
          // No saved rankings for this league: seed from community average for this bucket.
          // This ensures new leagues (e.g. after "Create League") start with the correct
          // community consensus (half_ppr, ppr, etc.) instead of ADP or "All Leagues" seed.
          if (communityData.length > 0) {
            rankedPlayers = buildCommunityFromRpc(allPlayersData, communityData);
          } else {
            // Fallback: ADP order if no community baseline for this bucket (e.g. dynasty)
            rankedPlayers = allPlayersData.map((p, index) => ({
              ...p,
              adp: bucketAdpMap.get(p.id) ?? Number(p.adp),
              rank: bucketAdpMap.get(p.id) ?? (Number(p.adp) || index + 1),
            }));
            rankedPlayers.sort((a, b) => a.rank - b.rank);
            rankedPlayers = rankedPlayers.map((p, index) => ({ ...p, rank: index + 1 }));
          }
        }

        // Sort by rank
        rankedPlayers.sort((a, b) => a.rank - b.rank);
        
        // Reassign sequential ranks after sorting
        const sortedPlayers = rankedPlayers.map((p, index) => ({
          ...p,
          rank: index + 1,
        }));
        
        const defensesInSorted = sortedPlayers.filter(p => p.position === 'D/ST');
        console.log(`Rankings: Defenses in sortedPlayers: ${defensesInSorted.length}`);
        if (defensesInSorted.length === 0) {
          console.error(`Rankings: WARNING - No defenses found in sortedPlayers! Total players: ${sortedPlayers.length}`);
        }

        const leagueDraftKey = getRankingsDraftSessionStorageKey({
          userId: user.id,
          guestSessionId: null,
          leagueId: selectedLeague.id,
          bucketKey: effectiveBucketKey,
        });
        const leagueSessionDraft = rankingsDraftSessionStorage.get(leagueDraftKey);
        const displayPlayers =
          leagueSessionDraft?.ids.length
            ? mergeRankingsWithDraftOrder(sortedPlayers, leagueSessionDraft.ids)
            : sortedPlayers;

        setHasExistingRankings(hasRankings);
        setPlayers(displayPlayers);
        if (leagueSessionDraft?.ids.length) setIsEditMode(leagueSessionDraft.isEditMode);
        else setIsEditMode(!hasRankings);

        // Fetch community EXCLUDING current user so we can merge in live when they drag
        let communityExcludingMe: CommunityRow[] = [];
        if (user) {
          communityExcludingMe = await fetchCommunity({ excludeUserId: user.id });
          setCommunityRawExcludingMe(communityExcludingMe.map((r) => ({
            player_id: r.player_id,
            avg_rank: Number(r.avg_rank),
            sample_count: Number(r.sample_count) || 1,
          })));
        } else {
          setCommunityRawExcludingMe(null);
        }

        // Initial community display: merge excluded + my rankings for live-updating view
        const leagueCommunity = communityExcludingMe.length > 0
          ? mergeLiveCommunity(allPlayersData, communityExcludingMe.map((r) => ({
              player_id: r.player_id,
              avg_rank: Number(r.avg_rank),
              sample_count: Number(r.sample_count) || 1,
            })), displayPlayers)
          : communityData.length > 0
            ? buildCommunityFromRpc(allPlayersData, communityData)
            : allPlayersData.map((p, index) => ({ ...p, adp: bucketAdpMap.get(p.id) ?? Number(p.adp), rank: index + 1 }));
        setCommunityPlayers(leagueCommunity);
      }
    } catch (error: any) {
      console.error('Failed to load players:', error);
      
      // Check if it's a rate limit error
      if (error?.message?.includes('rate limit') || error?.code === 'PGRST116' || error?.status === 429) {
        toast.error('Rate limit exceeded. Please wait a moment and refresh the page. Your data is safe.');
        console.error('Supabase rate limit hit. Consider reducing query frequency.');
      } else {
        toast.error(`Failed to load players: ${error instanceof Error ? error.message : 'Unknown error'}. Your data is safe - try refreshing.`);
      }
      
      // DON'T clear existing data on error - keep what we have so user doesn't lose their view
      // Only set empty arrays if we truly have no data (first load)
      if (players.length === 0 && communityPlayers.length === 0) {
        setPlayers([]);
        setCommunityPlayers([]);
      }
      // Otherwise, keep existing data so user doesn't see empty screen
    } finally {
      fetchInProgressRef.current = false;
      if (staleFetchReturnedRef.current) {
        staleFetchReturnedRef.current = false;
        return;
      }
      if (guestPathJustCompletedRef.current) {
        guestPathJustCompletedRef.current = false;
        setLoading(false); // Guest path returned early from try; must clear loading here
        return; // Don't refetch - guest path just set dropdown; refetch would cause flip loop
      }
      // This completion was the refetch we triggered due to bucket change — stop here and show data (avoid perpetual refetch loop)
      if (isRefetchAfterBucketChangeRef.current) {
        isRefetchAfterBucketChangeRef.current = false;
        setLoading(false);
        return;
      }
      // If bucket changed while we were fetching, refetch once with current bucket; mark so that refetch doesn't loop
      const nowKey = bucketRef.current;
      if (nowKey !== currentBucketKey) {
        console.log(`Rankings: Bucket changed during fetch (${currentBucketKey} -> ${nowKey}), refetching`);
        isRefetchAfterBucketChangeRef.current = true;
        setLoading(true);
        fetchPlayersRef.current();
        return;
      }
      setLoading(false);
    }
  }, [user, selectedLeague, isAllLeagues, leagues, bucket, allLeaguesBucketScoring, allLeaguesBucketLeagueType, allLeaguesBucketSuperflex, allLeaguesBucketRookiesOnly, allLeaguesSelectedMatchingLeagueId]);

  // Keep ref updated so refetch-after-bucket-change uses current displayBucket
  fetchPlayersRef.current = fetchPlayers;

  const prevBucketKeyRef = useRef('');
  const hasSyncedBucketRef = useRef(false);
  // Keep Rankings dropdowns in sync with bucket (from selected league, saved All Leagues bucket, or guest League Settings)
  // Skip when guest path just set the dropdown to avoid overwriting and causing sf/non-sf flip
  useEffect(() => {
    if (skipSyncFromBucketRef.current) {
      skipSyncFromBucketRef.current = false;
      return;
    }
    if (isAllLeagues) {
      // Logged-in All Leagues: restore last bucket (dynasty/SF/standard) so refresh keeps it
      const saved = user ? allLeaguesBucketStorage.get() : null;
      if (saved) {
        setAllLeaguesBucketScoring(saved.scoringFormat);
        setAllLeaguesBucketLeagueType(saved.leagueType);
        setAllLeaguesBucketSuperflex(saved.isSuperflex);
        setAllLeaguesBucketRookiesOnly(saved.rookiesOnly);
      } else {
        setAllLeaguesBucketScoring((bucket.scoringFormat as 'standard' | 'ppr' | 'half_ppr') || 'ppr');
        setAllLeaguesBucketLeagueType((bucket.leagueType as 'season' | 'dynasty') || 'season');
        setAllLeaguesBucketSuperflex(bucket.isSuperflex);
        setAllLeaguesBucketRookiesOnly(bucket.rookiesOnly ?? false);
      }
      hasSyncedBucketRef.current = true;
    } else {
      hasSyncedBucketRef.current = false;
    }
  }, [isAllLeagues, user, bucket.scoringFormat, bucket.leagueType, bucket.isSuperflex, bucket.rookiesOnly]);

  useEffect(() => {
    const bucketKey = `${displayBucket.scoringFormat}/${displayBucket.leagueType}/${displayBucket.isSuperflex}/${displayBucket.rookiesOnly ?? false}`;
    if (isAllLeagues && bucketKey !== prevBucketKeyRef.current) {
      setAllLeaguesSelectedMatchingLeagueId(null);
      prevBucketKeyRef.current = bucketKey;
    } else if (isAllLeagues) {
      prevBucketKeyRef.current = bucketKey;
    }
  }, [isAllLeagues, displayBucket.scoringFormat, displayBucket.leagueType, displayBucket.isSuperflex, displayBucket.rookiesOnly]);

  useEffect(() => {
    // Wait for auth so we don't run fetch with user=null and take guest path (edit mode / wrong bucket)
    if (authLoading) return;
    // Wait for leagues to load (when logged in) so we fetch with correct selectedLeague/bucket
    if (user && leaguesLoading) return;
    // When in All leagues (logged-in only), wait for dropdown sync from bucket so first fetch uses correct bucket.
    // Guests: don't wait for sync so we never block; first fetch uses correct bucket from hook below.
    if (isAllLeagues && user && !hasSyncedBucketRef.current) return;
    // Skip one run after guest path synced dropdown/temp to avoid refresh loop
    if (skipNextFetchForGuestSyncRef.current) {
      skipNextFetchForGuestSyncRef.current = false;
      return;
    }
    // If we already scheduled a deferred fetch and selectedLeague is still null (All Leagues), run the fetch now.
    // Otherwise the effect cleanup can clear the timeout on re-run and the deferred fetch never runs (stuck loading / wrong view).
    if (deferredFetchScheduledRef.current && selectedLeagueIdRef.current === null) {
      deferredFetchScheduledRef.current = false;
      setLoading(true);
      fetchPlayers();
      return;
    }

    // When logged in with leagues but selectedLeague still null, defer so selectedLeague
    // restoration from localStorage can commit (avoids fetching with wrong bucket then overwriting).
    if (user && leagues.length > 0 && selectedLeague === null) {
      setLoading(true);
      deferredFetchScheduledRef.current = true;
      const t = setTimeout(() => {
        deferredFetchScheduledRef.current = false;
        // If selectedLeague was restored before timeout fired, skip — the effect already ran with correct league
        if (selectedLeagueIdRef.current !== null) return;
        fetchPlayers();
      }, 0);
      return () => clearTimeout(t);
    }

    // Guest in All Leagues: use bucket from hook so first fetch uses temp settings (avoids bucket-changed refetch)
    if (!user && isAllLeagues) {
      communityBucketRef.current = {
        scoringFormat: bucket.scoringFormat,
        leagueType: bucket.leagueType,
        isSuperflex: bucket.isSuperflex,
        rookiesOnly: bucket.rookiesOnly ?? false,
      };
    }

    setLoading(true);
    fetchPlayers();
  }, [fetchPlayers, user, authLoading, leaguesLoading, isAllLeagues, leagues.length, selectedLeague, bucket.scoringFormat, bucket.leagueType, bucket.isSuperflex, bucket.rookiesOnly]);

  const saveRankings = useCallback(async (
    playersToSave: RankedPlayer[],
    leagueId: string | null,
    onSuccess?: () => void
  ) => {
    if (!user) return;
    setSaving(true);

    try {
      // Delete existing rankings first
      let deleteError;
      if (leagueId) {
        const { error } = await supabase
          .from('user_rankings')
          .delete()
          .eq('user_id', user.id)
          .eq('league_id', leagueId);
        deleteError = error;
      } else {
        const { error } = await supabase
          .from('user_rankings')
          .delete()
          .eq('user_id', user.id)
          .is('league_id', null);
        deleteError = error;
      }

      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw deleteError;
      }

      // Only include players with valid UUIDs (exclude synthetic ids like defense-arizona-cardinals)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validPlayers = playersToSave.filter((p) => uuidRegex.test(p.id));

      // Insert new rankings in batches to avoid timeout
      const rankings = validPlayers.map((p, index) => ({
        user_id: user.id,
        player_id: p.id,
        rank: index + 1,
        league_id: leagueId,
      }));

      // Insert in batches of 500 to avoid potential timeout issues
      const BATCH_SIZE = 500;
      for (let i = 0; i < rankings.length; i += BATCH_SIZE) {
        const batch = rankings.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('user_rankings').insert(batch);
        
        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
      }

      onSuccess?.();
    } catch (error: any) {
      console.error('Failed to save rankings:', error);
      toast.error(`Failed to save rankings: ${error?.message || 'Unknown error'}`);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [user]);

  const filteredPlayers = useMemo(() => {
    const searchLower = searchTerm.toLowerCase().trim();
    return players.filter((p) => {
      const matchesSearch =
        searchLower === '' ||
        p.name.toLowerCase().includes(searchLower) ||
        p.team?.toLowerCase().includes(searchLower) ||
        p.name.toLowerCase().split(' ').some((part) => part.includes(searchLower));

      const matchesPosition =
        positionFilter.length === 0 || positionFilter.includes(p.position);

      if (positionFilter.includes('D/ST') && p.position === 'D/ST') {
        console.log(
          `Rankings: D/ST player found: ${p.name}, matchesSearch: ${matchesSearch}, matchesPosition: ${matchesPosition}`
        );
      }

      return matchesSearch && matchesPosition;
    });
  }, [players, searchTerm, positionFilter]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const useMidpointDrag = positionFilter.length > 0;
    if (useMidpointDrag) {
      const updated = applyFilteredMidpointRankDrag(players, filteredPlayers, String(active.id), String(over.id));
      setPlayers(updated);
      persistRankingsSessionDraft(updated, isEditMode);
      return;
    }

    const oldIndex = players.findIndex((item) => item.id === active.id);
    const newIndex = players.findIndex((item) => item.id === over.id);
    const newItems = arrayMove(players, oldIndex, newIndex);
    const updatedPlayers = newItems.map((item, index) => ({ ...item, rank: index + 1 }));
    setPlayers(updatedPlayers);
    persistRankingsSessionDraft(updatedPlayers, isEditMode);
  };

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id as string);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const finalizeRankings = async () => {
    if (!user) {
      const guestSessionId = getOrCreateGuestSessionId();
      // Only include players with valid UUIDs (exclude synthetic ids like defense-arizona-cardinals)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const rankingsPayload = players.filter((p) => uuidRegex.test(p.id)).map((p) => ({ id: p.id }));
      const { error } = await supabase.rpc('save_guest_rankings', {
        p_guest_session_id: guestSessionId,
        p_scoring_format: displayBucket.scoringFormat,
        p_league_type: displayBucket.leagueType,
        p_is_superflex: displayBucket.isSuperflex,
        p_rookies_only: displayBucket.rookiesOnly ?? false,
        p_rankings: rankingsPayload,
      });
      if (error) {
        console.error('Failed to save guest rankings to community:', error);
        toast.error('Could not submit rankings to community. Your rankings are saved locally.');
      }
      tempRankingsStorage.save(players, bucketKey);
      rankingsDraftSessionStorage.clear(rankingsSessionDraftKey);
      setHasExistingRankings(true);
      setIsEditMode(false);
      toast.success(
        error
          ? 'Rankings saved locally. Sign in to have them count toward community.'
          : 'Rankings finalized! Your rankings now count toward the community consensus.'
      );
      return;
    }

    if (!selectedLeague) return;
    setIsFinalizing(true);
    try {
      await saveRankings(players, selectedLeague.id);
      rankingsDraftSessionStorage.clear(rankingsSessionDraftKey);
      setHasExistingRankings(true);
      setIsEditMode(false);
      toast.success('Rankings finalized!');
      fetchPlayers();
    } catch {
      // saveRankings already showed error toast; stay in edit mode
    } finally {
      setIsFinalizing(false);
    }
  };
  const resetToADP = () => {
    // Reset to community rankings for current bucket (uses live community when dragging)
    const communityRankMap = new Map(displayedCommunityPlayers.map((p, i) => [p.id, i]));
    const sorted = [...players].sort((a, b) => {
      const ra = communityRankMap.get(a.id) ?? 9999;
      const rb = communityRankMap.get(b.id) ?? 9999;
      return (ra as number) - (rb as number);
    });
    const resetPlayers = sorted.map((p, index) => ({ ...p, rank: index + 1 }));
    setPlayers(resetPlayers);
    if (isAllLeagues && user) {
      void saveRankings(resetPlayers, null).then(() => rankingsDraftSessionStorage.clear(rankingsSessionDraftKey));
    } else {
      persistRankingsSessionDraft(resetPlayers, isEditMode);
    }
    toast.info('Rankings reset to community consensus');
  };

  // Debug: Log total defenses in players array (only warn when we have players but no D/ST — skip during initial load)
  const totalDefenses = players.filter(p => p.position === 'D/ST').length;
  if (totalDefenses > 0) {
    console.log(`Rankings: Total D/ST players in players array: ${totalDefenses}`);
  } else if (!loading && players.length > 0) {
    console.warn(`Rankings: No D/ST players found in players array! Total players: ${players.length}`);
  }

  const filteredCommunityPlayers = displayedCommunityPlayers.filter((p) => {
    // Improved search: search in full name (handles "Travis Hunter" when searching "hunter")
    const searchLower = searchTerm.toLowerCase().trim();
    const matchesSearch = searchLower === '' || 
      p.name.toLowerCase().includes(searchLower) ||
      p.team?.toLowerCase().includes(searchLower) ||
      // Also search by splitting name (handles "Travis Hunter" when searching "hunter")
      p.name.toLowerCase().split(' ').some(part => part.includes(searchLower));
    
    const matchesPosition =
      positionFilter.length === 0 || positionFilter.includes(p.position);
    return matchesSearch && matchesPosition;
  });

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
      
      <main className="max-w-screen-2xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-4xl tracking-wide">
              {isAllLeagues ? 'RANKINGS' : 'MY RANKINGS'}
            </h1>
            {/* All Leagues + guest: show bucket dropdowns under title instead of format badge */}
            {(isAllLeagues || !user) && (
              <div className="flex flex-wrap items-center gap-2">
                <Select value={allLeaguesBucketScoring} onValueChange={(v) => {
                  const next = v as 'standard' | 'ppr' | 'half_ppr';
                  setAllLeaguesBucketScoring(next);
                  if (!user) saveGuestBucketToTempSettings(next, allLeaguesBucketLeagueType, allLeaguesBucketSuperflex, allLeaguesBucketLeagueType === 'dynasty' && allLeaguesBucketRookiesOnly);
                  else if (isAllLeagues) allLeaguesBucketStorage.save({ scoringFormat: next, leagueType: allLeaguesBucketLeagueType, isSuperflex: allLeaguesBucketSuperflex, rookiesOnly: allLeaguesBucketLeagueType === 'dynasty' && allLeaguesBucketRookiesOnly });
                }}>
                  <SelectTrigger className="w-[110px] h-8 bg-secondary/50 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="ppr">PPR</SelectItem>
                    <SelectItem value="half_ppr">1/2 PPR</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={allLeaguesBucketLeagueType} onValueChange={(v) => {
                  const next = v as 'season' | 'dynasty';
                  setAllLeaguesBucketLeagueType(next);
                  if (next === 'season') setAllLeaguesBucketRookiesOnly(false);
                  if (!user) saveGuestBucketToTempSettings(allLeaguesBucketScoring, next, allLeaguesBucketSuperflex, next === 'dynasty' && allLeaguesBucketRookiesOnly);
                  else if (isAllLeagues) allLeaguesBucketStorage.save({ scoringFormat: allLeaguesBucketScoring, leagueType: next, isSuperflex: allLeaguesBucketSuperflex, rookiesOnly: next === 'dynasty' ? allLeaguesBucketRookiesOnly : false });
                }}>
                  <SelectTrigger className="w-[100px] h-8 bg-secondary/50 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="season">Season</SelectItem>
                    <SelectItem value="dynasty">Dynasty</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={allLeaguesBucketSuperflex ? 'sf' : 'non-sf'} onValueChange={(v) => {
                  const next = v === 'sf';
                  setAllLeaguesBucketSuperflex(next);
                  if (!user) saveGuestBucketToTempSettings(allLeaguesBucketScoring, allLeaguesBucketLeagueType, next, allLeaguesBucketLeagueType === 'dynasty' && allLeaguesBucketRookiesOnly);
                  else if (isAllLeagues) allLeaguesBucketStorage.save({ scoringFormat: allLeaguesBucketScoring, leagueType: allLeaguesBucketLeagueType, isSuperflex: next, rookiesOnly: allLeaguesBucketLeagueType === 'dynasty' && allLeaguesBucketRookiesOnly });
                }}>
                  <SelectTrigger className="w-[140px] h-8 bg-secondary/50 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="non-sf">Non-Superflex</SelectItem>
                    <SelectItem value="sf">Superflex</SelectItem>
                  </SelectContent>
                </Select>
                {allLeaguesBucketLeagueType === 'dynasty' && (
                  <Select value={allLeaguesBucketRookiesOnly ? 'rookies' : 'all'} onValueChange={(v) => {
                    const next = v === 'rookies';
                    setAllLeaguesBucketRookiesOnly(next);
                    if (!user) saveGuestBucketToTempSettings(allLeaguesBucketScoring, allLeaguesBucketLeagueType, allLeaguesBucketSuperflex, next);
                    else if (isAllLeagues) allLeaguesBucketStorage.save({ scoringFormat: allLeaguesBucketScoring, leagueType: allLeaguesBucketLeagueType, isSuperflex: allLeaguesBucketSuperflex, rookiesOnly: next });
                  }}>
                    <SelectTrigger className="w-[130px] h-8 bg-secondary/50 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All players</SelectItem>
                      <SelectItem value="rookies">Rookies only</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            <p className="text-muted-foreground">
              {isEditMode && (
                <>Drag players to customize your rankings, then finalize</>
              )}
              {!(isAllLeagues || !user) && (
                <span className={`text-xs bg-secondary px-2 py-0.5 rounded ${isEditMode ? 'ml-2' : ''}`}>
                  {displayBucket.scoringFormat.replace('_', '-').toUpperCase()}
                  {displayBucket.leagueType === 'dynasty' ? ' Dynasty' : ''}
                  {displayBucket.isSuperflex ? ' SF' : ''}
                  {displayBucket.rookiesOnly ? ' Rookies only' : ''}
                  {displayBucket.leagueType === 'dynasty' && !hasCommunityConsensus ? ' — Community rankings coming soon' : ''}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isEditMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetToADP}
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset to ADP
              </Button>
            )}
            {((!user && isEditMode) || (!isAllLeagues && isEditMode)) && (
              <Button
                size="sm"
                onClick={finalizeRankings}
                disabled={isFinalizing}
                className="gap-2"
              >
                {isFinalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Finalize Rankings
              </Button>
            )}
            {((!user && !isEditMode) || (!isAllLeagues && !isEditMode)) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  persistRankingsSessionDraft(players, true);
                  setIsEditMode(true);
                }}
                className="gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit Rankings
              </Button>
            )}
            {isAllLeagues && !isEditMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetToADP}
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset to ADP
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-secondary/50 border-border/50"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
                <Filter className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuCheckboxItem
                checked={positionFilter.length === 0}
                onCheckedChange={() => setPositionFilter([])}
              >
                All
              </DropdownMenuCheckboxItem>
              {positions.map((pos) => (
                <DropdownMenuCheckboxItem
                  key={pos}
                  checked={positionFilter.includes(pos)}
                  onCheckedChange={(checked) => {
                    setPositionFilter((prev) =>
                      checked
                        ? [...prev, pos]
                        : prev.filter((p) => p !== pos)
                    );
                  }}
                >
                  {pos}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {((!user && !isEditMode) || (user && isAllLeagues && !isEditMode)) ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Community Rankings Column */}
              <div className="bg-secondary/30 rounded-lg border border-border/50 p-5">
                <div className="flex flex-wrap items-center gap-2 mb-3 pb-2 border-b border-border">
                  <Users className="w-5 h-5 text-accent shrink-0" />
                  <h2 className="font-display text-xl tracking-wide shrink-0">COMMUNITY RANKINGS</h2>
                </div>
                <div className="h-[480px] overflow-y-auto pr-2 scrollbar-thin">
                  <div className="space-y-2">
                    {filteredCommunityPlayers.map((player) => (
                      <PlayerCard
                        key={player.id}
                        player={player}
                        rank={displayedCommunityPlayers.findIndex((p) => p.id === player.id) + 1}
                        onClick={() => handlePlayerClick(player)}
                        positionColoredRank
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* My Rankings Column */}
              <div className="bg-secondary/30 rounded-lg border border-border/50 p-5">
                <div className="flex flex-wrap items-center gap-2 mb-3 pb-2 border-b border-border">
                  <User className="w-5 h-5 text-primary shrink-0" />
                  <h2 className="font-display text-xl tracking-wide shrink-0">MY RANKINGS</h2>
                  {isAllLeagues && user && matchingLeaguesForBucket.length > 1 && (
                    <Select
                      value={allLeaguesSelectedMatchingLeagueId ?? 'average'}
                      onValueChange={(v) => setAllLeaguesSelectedMatchingLeagueId(v === 'average' ? null : v)}
                    >
                      <SelectTrigger className="min-w-[180px] max-w-[240px] h-8 bg-background/50 shrink-0">
                        <SelectValue placeholder="Select league" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="average">
                          Average of all {matchingLeaguesForBucket.length} leagues
                        </SelectItem>
                        {matchingLeaguesForBucket.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Drag to reorder your personal rankings
                </p>
                <div ref={myRankingsScrollRef1} className="h-[480px] overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin" style={{ touchAction: 'pan-y' }}>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                    onDragEnd={handleDragEnd}
                    onDragStart={handleDragStart}
                    onDragCancel={handleDragCancel}
                    autoScroll={autoScrollConfig}
                  >
                    <RampUpScrollHandler containerRef={myRankingsScrollRef1} />
                    <SortableContext
                      items={filteredPlayers.map((p) => p.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2 overflow-x-hidden" style={{ touchAction: 'none' }}>
                        {filteredPlayers.map((player) => (
                          <SortablePlayerWithHandle
                            key={player.id}
                            player={{ ...player, adp: communityRankMap.get(player.id) ?? player.adp }}
                            rank={player.rank}
                            onPlayerClick={handlePlayerClick}
                            stats2025={player2025Stats.get(player.id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              </div>
            </div>

            {/* Differential Analysis Section */}
            {players.length > 0 && displayedCommunityPlayers.length > 0 && (
              <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Your Studs */}
                <div className="bg-green-500/10 rounded-lg border border-green-500/30 p-4">
                  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-green-500/30">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <h2 className="font-display text-xl tracking-wide text-green-400">YOUR STUDS</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Top 10 players you rank higher than the community
                  </p>
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-2 scrollbar-thin">
                    {(() => {
                      const diffs = players.slice(0, 150).map((myPlayer) => {
                        const myRank = myPlayer.rank;
                        const communityRank = displayedCommunityPlayers.findIndex((p) => p.id === myPlayer.id) + 1;
                        return { player: myPlayer, myRank, communityRank, diff: communityRank - myRank };
                      });
                      return diffs
                        .filter((d) => d.diff > 0 && d.myRank <= 150 && d.communityRank <= 150)
                        .sort((a, b) => b.diff - a.diff)
                        .slice(0, 10)
                        .map(({ player, myRank, communityRank, diff }) => (
                          <div
                            key={player.id}
                            className="flex items-center justify-between bg-background/50 rounded-md p-3 cursor-pointer hover:bg-background/70 transition-colors"
                            onClick={() => handlePlayerClick(player)}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-green-400">+{diff}</span>
                              <div>
                                <p className="font-medium">{player.name}</p>
                                <p className="text-xs text-muted-foreground">{displayTeamAbbrevOrFa(player.team, player.position, player.name)} • {player.position}</p>
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <p className="text-green-400">#{myRank} <span className="text-muted-foreground">vs</span> #{communityRank}</p>
                            </div>
                          </div>
                        ));
                    })()}
                  </div>
                </div>

                {/* Your Duds */}
                <div className="bg-red-500/10 rounded-lg border border-red-500/30 p-4">
                  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-red-500/30">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <h2 className="font-display text-xl tracking-wide text-red-400">YOUR DUDS</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Top 10 players you rank lower than the community
                  </p>
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-2 scrollbar-thin">
                    {(() => {
                      const diffs = players.slice(0, 150).map((myPlayer) => {
                        const myRank = myPlayer.rank;
                        const communityRank = displayedCommunityPlayers.findIndex((p) => p.id === myPlayer.id) + 1;
                        return { player: myPlayer, myRank, communityRank, diff: communityRank - myRank };
                      });
                      return diffs
                        .filter((d) => d.diff < 0 && d.myRank <= 150 && d.communityRank <= 150)
                        .sort((a, b) => a.diff - b.diff)
                        .slice(0, 10)
                        .map(({ player, myRank, communityRank, diff }) => (
                          <div
                            key={player.id}
                            className="flex items-center justify-between bg-background/50 rounded-md p-3 cursor-pointer hover:bg-background/70 transition-colors"
                            onClick={() => handlePlayerClick(player)}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-red-400">{diff}</span>
                              <div>
                                <p className="font-medium">{player.name}</p>
                                <p className="text-xs text-muted-foreground">{displayTeamAbbrevOrFa(player.team, player.position, player.name)} • {player.position}</p>
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <p className="text-red-400">#{myRank} <span className="text-muted-foreground">vs</span> #{communityRank}</p>
                            </div>
                          </div>
                        ));
                    })()}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (isEditMode || (!user && !hasExistingRankings)) ? (
          // Edit Mode - Drag and drop rankings (for logged-in users editing, or non-logged-in users who haven't finalized)
          <div ref={myRankingsScrollRef2} className="h-[70vh] min-h-[500px] overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin" style={{ touchAction: 'pan-y' }}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
            onDragCancel={handleDragCancel}
            autoScroll={autoScrollConfig}
          >
            <RampUpScrollHandler containerRef={myRankingsScrollRef2} />
            <SortableContext
              items={filteredPlayers.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 overflow-x-hidden" style={{ touchAction: 'none' }}>
                {filteredPlayers.map((player) => (
                  <SortablePlayerWithHandle
                    key={player.id}
                    player={{ ...player, adp: communityRankMap.get(player.id) ?? player.adp }}
                    rank={player.rank}
                    onPlayerClick={handlePlayerClick}
                    stats2025={player2025Stats.get(player.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          </div>
        ) : (
          // Comparison View - Similar to All Leagues
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Community Rankings Column */}
              <div className="bg-secondary/30 rounded-lg border border-border/50 p-5">
                <div className="flex flex-wrap items-center gap-2 mb-3 pb-2 border-b border-border">
                  <Users className="w-5 h-5 text-accent shrink-0" />
                  <h2 className="font-display text-xl tracking-wide shrink-0">COMMUNITY RANKINGS</h2>
                </div>
                <div className="h-[480px] overflow-y-auto pr-2 scrollbar-thin">
                  <div className="space-y-2">
                    {filteredCommunityPlayers.map((player) => (
                      <PlayerCard
                        key={player.id}
                        player={player}
                        rank={displayedCommunityPlayers.findIndex((p) => p.id === player.id) + 1}
                        onClick={() => handlePlayerClick(player)}
                        positionColoredRank
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* My Rankings Column */}
              <div className="bg-secondary/30 rounded-lg border border-border/50 p-5">
                <div className="flex flex-wrap items-center gap-2 mb-3 pb-2 border-b border-border">
                  <User className="w-5 h-5 text-primary shrink-0" />
                  <h2 className="font-display text-xl tracking-wide shrink-0">MY RANKINGS</h2>
                  {isAllLeagues && user && matchingLeaguesForBucket.length > 1 && (
                    <Select
                      value={allLeaguesSelectedMatchingLeagueId ?? 'average'}
                      onValueChange={(v) => setAllLeaguesSelectedMatchingLeagueId(v === 'average' ? null : v)}
                    >
                      <SelectTrigger className="min-w-[180px] max-w-[240px] h-8 bg-background/50 shrink-0">
                        <SelectValue placeholder="Select league" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="average">
                          Average of all {matchingLeaguesForBucket.length} leagues
                        </SelectItem>
                        {matchingLeaguesForBucket.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Drag the handle to adjust rankings
                </p>
                <div ref={myRankingsScrollRef3} className="h-[480px] overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin" style={{ touchAction: 'pan-y' }}>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                    onDragEnd={handleDragEnd}
                    onDragStart={handleDragStart}
                    onDragCancel={handleDragCancel}
                    autoScroll={autoScrollConfig}
                  >
                    <RampUpScrollHandler containerRef={myRankingsScrollRef3} />
                    <SortableContext
                      items={filteredPlayers.map((p) => p.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2 overflow-x-hidden" style={{ touchAction: 'none' }}>
                        {filteredPlayers.map((player) => (
                          <SortablePlayerWithHandle
                            key={player.id}
                            player={{ ...player, adp: communityRankMap.get(player.id) ?? player.adp }}
                            rank={player.rank}
                            onPlayerClick={handlePlayerClick}
                            stats2025={player2025Stats.get(player.id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              </div>
            </div>

            {/* Differential Analysis Section */}
            {players.length > 0 && displayedCommunityPlayers.length > 0 && (
              <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Your Studs */}
                <div className="bg-green-500/10 rounded-lg border border-green-500/30 p-4">
                  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-green-500/30">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <h2 className="font-display text-xl tracking-wide text-green-400">YOUR STUDS</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Top 10 players you rank higher than the community
                  </p>
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-2 scrollbar-thin">
                    {(() => {
                      const diffs = players.slice(0, 150).map((myPlayer) => {
                        const myRank = myPlayer.rank;
                        const communityRank = displayedCommunityPlayers.findIndex((p) => p.id === myPlayer.id) + 1;
                        return { player: myPlayer, myRank, communityRank, diff: communityRank - myRank };
                      });
                      return diffs
                        .filter((d) => d.diff > 0 && d.myRank <= 150 && d.communityRank <= 150)
                        .sort((a, b) => b.diff - a.diff)
                        .slice(0, 10)
                        .map(({ player, myRank, communityRank, diff }) => (
                          <div
                            key={player.id}
                            className="flex items-center justify-between bg-background/50 rounded-md p-3 cursor-pointer hover:bg-background/70 transition-colors"
                            onClick={() => handlePlayerClick(player)}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-green-400">+{diff}</span>
                              <div>
                                <p className="font-medium">{player.name}</p>
                                <p className="text-xs text-muted-foreground">{displayTeamAbbrevOrFa(player.team, player.position, player.name)} • {player.position}</p>
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <p className="text-green-400">#{myRank} <span className="text-muted-foreground">vs</span> #{communityRank}</p>
                            </div>
                          </div>
                        ));
                    })()}
                  </div>
                </div>

                {/* Your Duds */}
                <div className="bg-red-500/10 rounded-lg border border-red-500/30 p-4">
                  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-red-500/30">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <h2 className="font-display text-xl tracking-wide text-red-400">YOUR DUDS</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Top 10 players you rank lower than the community
                  </p>
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-2 scrollbar-thin">
                    {(() => {
                      const diffs = players.slice(0, 150).map((myPlayer) => {
                        const myRank = myPlayer.rank;
                        const communityRank = displayedCommunityPlayers.findIndex((p) => p.id === myPlayer.id) + 1;
                        return { player: myPlayer, myRank, communityRank, diff: communityRank - myRank };
                      });
                      return diffs
                        .filter((d) => d.diff < 0 && d.myRank <= 150 && d.communityRank <= 150)
                        .sort((a, b) => a.diff - b.diff)
                        .slice(0, 10)
                        .map(({ player, myRank, communityRank, diff }) => (
                          <div
                            key={player.id}
                            className="flex items-center justify-between bg-background/50 rounded-md p-3 cursor-pointer hover:bg-background/70 transition-colors"
                            onClick={() => handlePlayerClick(player)}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-red-400">{diff}</span>
                              <div>
                                <p className="font-medium">{player.name}</p>
                                <p className="text-xs text-muted-foreground">{displayTeamAbbrevOrFa(player.team, player.position, player.name)} • {player.position}</p>
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <p className="text-red-400">#{myRank} <span className="text-muted-foreground">vs</span> #{communityRank}</p>
                            </div>
                          </div>
                        ));
                    })()}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Quick Tips */}
        <div className="mt-8 glass-card p-6">
          <h3 className="font-display text-xl mb-4">Quick Tips</h3>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {isAllLeagues && (
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Use the league selector in the navbar to filter your mock drafts by league</span>
              </li>
            )}
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Drag and drop players in Rankings to create your custom big board</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Your rankings will be used to sort available players during mock drafts</span>
            </li>
          </ul>
        </div>

        {filteredPlayers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No players found matching your criteria
          </div>
        )}
      </main>

      <PlayerDetailDialog
        player={selectedPlayer}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        stats2025={selectedPlayer ? player2025Stats.get(selectedPlayer.id) : undefined}
      />
    </div>
  );
};

export { Rankings };
export default Rankings;
