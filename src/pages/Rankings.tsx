import { useState, useEffect, useCallback, useRef, useMemo, startTransition } from 'react';
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
import { RotateCcw, Search, Users, User, Save, Edit, LayoutTemplate } from 'lucide-react';
import type { RankedPlayer } from '@/types/database';
import {
  tempRankingsStorage,
  tempSettingsStorage,
  getOrCreateGuestSessionId,
  allLeaguesBucketStorage,
  getRankingsDraftSessionStorageKey,
  rankingsDraftSessionStorage,
  rankingsPageSnapshotStorage,
} from '@/utils/temporaryStorage';
import { mergeLiveCommunity, mergeRankingsWithDraftOrder } from '@/utils/rankingsCommunityMerge';
import {
  computeStudsDuds,
  STUDS_DUDS_RANKINGS_WINDOW,
  type StudDudEntry,
} from '@/utils/studsDuds';
import { deduplicatePlayersByIdentity } from '@/utils/playerDeduplication';
import { fetchMergedPlayerPool } from '@/utils/playerPoolFetch';
import {
  buildDefenseRankFromList,
  buildPositionAdpRankMap,
  buildPositionRankFromList,
  resolvePositionAdpRankForDisplay,
} from '@/utils/positionAdpRank';
import { getCommunityRankTrend, recordCommunityRankSnapshot } from '@/utils/communityRankTrend';
import { BrandedLoader } from '@/components/BrandedLoader';
import {
  TEAM_ABBREV_TO_FULL_NAME,
  canonicalTeamAbbr,
  displayTeamAbbrevOrFa,
  resolveTeamAbbrForDisplay,
} from '@/utils/teamMapping';
import type { Active, CollisionDetection, DragMoveEvent, DragOverEvent } from '@dnd-kit/core';
import {
  DndContext,
  closestCorners,
  pointerWithin,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  MeasuringStrategy,
  MeasuringFrequency,
} from '@dnd-kit/core';
import {
  useRampUpAutoScroll,
} from '@/hooks/useRampUpAutoScroll';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { RankingsDragRow } from '@/components/rankings/RankingsDragRow';
import { RankingsVirtualSortableList, useRankingsScrollContainer, type RankingsListItem } from '@/components/rankings/RankingsVirtualSortableList';
import { RankingsCompareDragPanel } from '@/components/rankings/RankingsCompareDragPanel';
import { sameIdOrder } from '@/components/rankings/RankingsCompareScrollList';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { fetchRookiesRankings, filterPlayersToRookieIds } from '@/utils/rookiesFilter';
import {
  applyUserRankingsBucketMatch,
  userRankingBucketFromDisplayBucket,
  formatRankingBucketImportSubtitle,
  formatRankingBucketLabel,
  userRankingBucketsEqual,
  scanUserRankingsImportPoolByLeague,
  fetchUserRankingsPlayerIdsFlexibleForLeague,
  fetchUserRankingsPlayerIdsFlexibleForNullLeague,
  fetchUserRankingsPlayerIdsFlexibleAny,
  rankingImportPlayerPoolsMatch,
} from '@/utils/userRankingsBucket';
import type { UserRankingBucketDb } from '@/utils/userRankingsBucket';
import { RankingsSpreadsheetImportPanel } from '@/components/rankings/RankingsSpreadsheetImportPanel';
import { RankingsExportButtons } from '@/components/rankings/RankingsExportButtons';
import { RankingsColumnExportMenu } from '@/components/rankings/RankingsColumnExportMenu';
import type { FinalizedImportSummary } from '@/utils/rankingsSpreadsheet/matchPlayers';
import { useNflTeams } from '@/hooks/useNflTeams';
import { compareDefensesByFantasyRank, NFL_DEFENSE_TEAM_NAMES } from '@/constants/nflDefenses';
import {
  PLAYER_POOL_PRIOR_SEASON,
  PLAYER_POOL_CURRENT_SEASON,
} from '@/constants/playerPoolSeason';
import {
  buildOverallTierBreakBeforeIds,
  eligiblePositionTierCuts,
  getCutsForPosition,
  getTierNumber,
  hasTierBreakBefore,
  hasTierCutAfter,
  mergePositionTierCuts,
  positionTierCutsEqual,
  setCutsForPosition,
  toggleTierCut,
  type PositionTierCuts,
} from '@/utils/positionTiers';
import {
  getRankingTiersStorageKey,
  rankingTiersLocalStorage,
} from '@/utils/rankingTiersStorage';
import { fetchUserRankingTiers, upsertUserRankingTiers, fetchCommunityRankingTiers } from '@/utils/rankingTiersDb';
import {
  buildPoolRankMapFromSavedRows,
  buildPoolRankSamplesFromSavedRows,
  fetchAllRankRows,
} from '@/utils/applySavedRanksToPool';
import { userFacingErrorMessage } from '@/utils/userFacingError';
import { cn } from '@/lib/utils';

/** Disable dnd-kit built-in auto-scroll — rankings use custom fast edge scroll. */
const autoScrollConfig = false;

const rankingsMeasuringConfig = {
  draggable: {
    strategy: MeasuringStrategy.BeforeDragging,
  },
  droppable: {
    strategy: MeasuringStrategy.WhileDragging,
    frequency: MeasuringFrequency.Optimized,
  },
} as const;

/** Select value for players with no NFL team (label: Free Agents). */
const TEAM_SELECT_FA = 'FA' as const;

/** Select value meaning no position / team restriction. */
const FILTER_ALL = 'all' as const;

function readInitialRankingsPageState(): {
  players: RankedPlayer[];
  communityPlayers: RankedPlayer[];
  communityConsensusForStuds: RankedPlayer[];
  hasExistingRankings: boolean;
  isEditMode: boolean;
  loading: boolean;
} {
  const snapshot = rankingsPageSnapshotStorage.get();
  if (snapshot) {
    return {
      players: snapshot.players,
      communityPlayers: snapshot.communityPlayers,
      communityConsensusForStuds:
        snapshot.communityConsensusForStuds.length > 0
          ? snapshot.communityConsensusForStuds
          : snapshot.communityPlayers,
      hasExistingRankings: snapshot.hasExistingRankings,
      isEditMode: snapshot.isEditMode,
      loading: false,
    };
  }

  if (typeof window !== 'undefined') {
    const settings = tempSettingsStorage.get();
    const scoringFormat = (settings?.scoringFormat as string) || 'ppr';
    const leagueType = (settings?.leagueType as string) || 'season';
    const isSuperflex = Boolean(settings?.isSuperflex);
    const rookiesOnly = Boolean(settings?.rookiesOnly);
    const bucketKey = `${scoringFormat}/${leagueType}/${isSuperflex}/${rookiesOnly}`;
    const tempRankings = tempRankingsStorage.get(bucketKey);
    if (tempRankings && tempRankings.length > 0) {
      return {
        players: tempRankings,
        communityPlayers: tempRankings,
        communityConsensusForStuds: tempRankings,
        hasExistingRankings: true,
        isEditMode: false,
        loading: false,
      };
    }
  }

  return {
    players: [],
    communityPlayers: [],
    communityConsensusForStuds: [],
    hasExistingRankings: false,
    isEditMode: false,
    loading: true,
  };
}

const initialRankingsPageState = readInitialRankingsPageState();

const RANKINGS_TEAM_FILTER_OPTIONS: { value: string; label: string }[] = (() => {
  const byAbbr = new Map<string, string>();
  for (const [abbr, full] of Object.entries(TEAM_ABBREV_TO_FULL_NAME)) {
    const value = canonicalTeamAbbr(abbr) ?? abbr;
    if (!byAbbr.has(value)) byAbbr.set(value, full);
  }
  return Array.from(byAbbr.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
})();

type TeamFilterable = {
  team: string | null | undefined;
  position: string | null | undefined;
  name: string | null | undefined;
};

function playerIsFreeAgent(p: TeamFilterable): boolean {
  const raw = (p.team ?? '').trim();
  if (!raw) return true;
  const u = raw.toUpperCase();
  if (u === 'FA' || u === 'FREE AGENT' || u === 'FREE AGENTS') return true;
  const abbr = resolveTeamAbbrForDisplay(p.team, p.position, p.name);
  return abbr == null || abbr === 'FA';
}

function playerMatchesTeamSelection(p: TeamFilterable, selectedTeam: string): boolean {
  if (selectedTeam === FILTER_ALL || !selectedTeam) return true;
  if (selectedTeam === TEAM_SELECT_FA) return playerIsFreeAgent(p);
  const abbr = resolveTeamAbbrForDisplay(p.team, p.position, p.name);
  if (playerIsFreeAgent(p)) return false;
  return canonicalTeamAbbr(abbr) === canonicalTeamAbbr(selectedTeam);
}


/**
 * Prefer pointer hits on tall cards; fall back to corner distance in gaps.
 */
const rankingsListCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  return closestCorners(args);
};

type RowRect = { top: number; height: number };

function resolveEffectiveOverId(
  activeId: string,
  overId: string,
  collisions: { id: string | number }[] | null | undefined
): string | null {
  if (overId !== activeId) return overId;
  const fallback = (collisions ?? []).find((c) => String(c.id) !== activeId);
  return fallback ? String(fallback.id) : null;
}

/** Prefer the collision target's rect — `over.rect` is wrong when `over` is still the active row. */
function resolveOverRowRect(
  effectiveOverId: string,
  over: { id: string | number; rect: RowRect } | null,
  collisions: { id: string | number; data?: Record<string, unknown> }[] | null | undefined
): RowRect | null {
  for (const collision of collisions ?? []) {
    if (String(collision.id) !== effectiveOverId) continue;
    const container = collision.data?.droppableContainer as
      | { rect?: { current?: RowRect | null } }
      | undefined;
    const rect = container?.rect?.current;
    if (rect) return { top: rect.top, height: rect.height };
  }
  if (over && String(over.id) === effectiveOverId) {
    return { top: over.rect.top, height: over.rect.height };
  }
  return null;
}

/** Dragged-item center vs row center — matches what the sortable list preview shows. */
function computePlaceAfter(
  active: Active,
  overRect: RowRect | null,
  pointerY: number | null
): boolean {
  const translated = active.rect.current.translated;
  if (translated && overRect) {
    const activeCenterY = translated.top + translated.height / 2;
    const overMidY = overRect.top + overRect.height / 2;
    return activeCenterY > overMidY;
  }
  if (pointerY != null && overRect) {
    return pointerY > overRect.top + overRect.height / 2;
  }
  return false;
}

function applyDragPreviewStep(
  current: readonly string[],
  active: Active,
  over: { id: string | number; rect: RowRect },
  collisions: { id: string | number; data?: Record<string, unknown> }[] | null | undefined,
  pointerY: number | null
): string[] {
  const activeId = String(active.id);
  const effectiveOverId = resolveEffectiveOverId(activeId, String(over.id), collisions);
  if (!effectiveOverId) return [...current];

  const overRect = resolveOverRowRect(effectiveOverId, over, collisions);
  const placeAfter = computePlaceAfter(active, overRect, pointerY);
  return reorderIdsWithInsertHint(current, activeId, effectiveOverId, placeAfter);
}

function reorderIdsWithInsertHint(
  orderedIds: readonly string[],
  activeId: string,
  overId: string,
  placeAfter: boolean
): string[] {
  if (activeId === overId) return [...orderedIds];
  const without = orderedIds.filter((id) => id !== activeId);
  const overPosInWithout = without.indexOf(overId);
  if (overPosInWithout < 0) return [...orderedIds];

  let insertAt = placeAfter ? overPosInWithout + 1 : overPosInWithout;
  insertAt = Math.max(0, Math.min(without.length, insertAt));
  return [...without.slice(0, insertAt), activeId, ...without.slice(insertAt)];
}

function RampUpScrollHandler({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  useRampUpAutoScroll(containerRef, { fast: true });
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

function computeMidpointTargetRank(
  prevRank: number,
  nextRank: number,
  isFirst: boolean,
  isLast: boolean
): number {
  if (isLast) return prevRank + 1;
  if (isFirst) return Math.max(1, Math.round(nextRank / 2));
  if (nextRank - prevRank > 1) return Math.round((prevRank + nextRank) / 2);
  return prevRank + 1;
}

/** Remove one player, then insert at targetRank; everyone at/above target shifts +1. */
function applyRankInsert(
  allPlayers: RankedPlayer[],
  activeId: string,
  targetRank: number
): RankedPlayer[] {
  const active = allPlayers.find((p) => p.id === activeId);
  if (!active) return allPlayers;

  const oldRank = active.rank;
  if (oldRank === targetRank) return allPlayers;

  const afterRemove = allPlayers
    .filter((p) => p.id !== activeId)
    .map((p) => ({
      ...p,
      rank: p.rank > oldRank ? p.rank - 1 : p.rank,
    }));

  const inserted = afterRemove.map((p) => ({
    ...p,
    rank: p.rank >= targetRank ? p.rank + 1 : p.rank,
  }));

  inserted.push({ ...active, rank: targetRank });
  return inserted.sort((a, b) => a.rank - b.rank);
}

/**
 * Position-filter drag: land at the midpoint of neighboring same-position global ranks
 * (e.g. between QB #120 and QB #128 → rank 124), shifting other players as needed.
 */
function applyMidpointFromPreviewOrder(
  allPlayers: RankedPlayer[],
  previewOrderIds: readonly string[],
  activeId: string,
  baselineOrderIds: readonly string[]
): RankedPlayer[] {
  const newIndex = previewOrderIds.indexOf(activeId);
  if (newIndex < 0) return allPlayers;

  const byId = new Map(allPlayers.map((p) => [p.id, p]));
  const reorderedFiltered = previewOrderIds
    .map((id) => byId.get(id))
    .filter((p): p is RankedPlayer => p != null);

  const active = allPlayers.find((p) => p.id === activeId);
  if (!active) return allPlayers;

  const oldIndex = baselineOrderIds.indexOf(activeId);

  const prevRank = newIndex > 0 ? reorderedFiltered[newIndex - 1]!.rank : 0;
  const isLast = newIndex === reorderedFiltered.length - 1;
  const isFirst = newIndex === 0;
  const maxRank = allPlayers.reduce((m, p) => Math.max(m, p.rank), 0);
  const nextRank = isLast ? maxRank + 1 : reorderedFiltered[newIndex + 1]!.rank;

  let targetRank = computeMidpointTargetRank(prevRank, nextRank, isFirst, isLast);

  if (targetRank === active.rank && oldIndex >= 0 && oldIndex !== newIndex) {
    if (newIndex > oldIndex) {
      targetRank = nextRank - prevRank > 1 ? Math.max(prevRank + 1, targetRank + 1) : prevRank + 1;
    } else {
      targetRank = nextRank - prevRank > 1 ? Math.min(nextRank - 1, targetRank - 1) : Math.max(1, prevRank);
    }
  }

  return applyRankInsert(allPlayers, activeId, targetRank);
}

function applySlotFromPreviewOrder(
  allPlayers: RankedPlayer[],
  previewOrderIds: readonly string[]
): RankedPlayer[] {
  const byId = new Map(allPlayers.map((p) => [p.id, p]));
  const reorderedFiltered = previewOrderIds
    .map((id) => byId.get(id))
    .filter((p): p is RankedPlayer => p != null);
  return applySlotReorderAfterFilteredPermutation(allPlayers, reorderedFiltered);
}

function applyFullListFromPreviewOrder(
  allPlayers: RankedPlayer[],
  previewOrderIds: readonly string[]
): RankedPlayer[] {
  const byId = new Map(allPlayers.map((p) => [p.id, p]));
  return previewOrderIds
    .map((id, index) => {
      const player = byId.get(id);
      return player ? { ...player, rank: index + 1 } : null;
    })
    .filter((p): p is RankedPlayer => p != null);
}

/**
 * After reordering the filtered subset (team/search), reassign integer ranks so that
 * subset keeps the same multiset of global rank slots.
 */
function applySlotReorderAfterFilteredPermutation(
  allPlayers: RankedPlayer[],
  reorderedFiltered: RankedPlayer[]
): RankedPlayer[] {
  if (reorderedFiltered.length === 0) return allPlayers;
  const filteredSet = new Set(reorderedFiltered.map((p) => p.id));
  const fullOrder = [...allPlayers].sort((a, b) => a.rank - b.rank);
  const slots = fullOrder.filter((p) => filteredSet.has(p.id)).map((p) => p.rank);
  slots.sort((a, b) => a - b);
  if (slots.length !== reorderedFiltered.length) {
    console.warn(
      'Rankings: slot reorder length mismatch',
      slots.length,
      reorderedFiltered.length
    );
    return allPlayers;
  }
  const byId = new Map(allPlayers.map((p) => [p.id, { ...p }]));
  reorderedFiltered.forEach((p, i) => {
    const row = byId.get(p.id);
    if (row) row.rank = slots[i]!;
  });
  return Array.from(byId.values()).sort((a, b) => a.rank - b.rank);
}

function parseGuestRankingBucketKey(bucketKey: string): UserRankingBucketDb {
  const parts = bucketKey.split('/');
  return {
    scoring_format: parts[0] || 'ppr',
    league_type: parts[1] === 'dynasty' ? 'dynasty' : 'season',
    is_superflex: parts[2] === 'true',
    rookies_only: parts[3] === 'true',
  };
}

type RankingTemplateOption =
  | { kind: 'guest'; bucketKey: string; title: string; subtitle: string }
  | { kind: 'account-league-flex'; league_id: string; title: string; subtitle: string }
  | { kind: 'account-null-flex'; title: string; subtitle: string }
  | { kind: 'account-any-flex'; title: string; subtitle: string };

type ImportListEmptyKind = 'no-saves' | 'rookies-mismatch' | 'only-this-list';

const GUEST_IMPORT_DEVICE_LINE =
  'This device only · local board (not synced to your leagues until you finalize there)';

function guestRankingImportOptionFromKey(bucketKeyStr: string): RankingTemplateOption {
  const gk = parseGuestRankingBucketKey(bucketKeyStr);
  return {
    kind: 'guest',
    bucketKey: bucketKeyStr,
    title: formatRankingBucketImportSubtitle(gk),
    subtitle: GUEST_IMPORT_DEVICE_LINE,
  };
}

/** Same ordering as Settings → Your Leagues (`orderedLeagues`): display_order, then created_at fallback, then name. */
function sortLeagueRowsLikeYourLeaguesSettings<
  T extends { id: string; display_order?: number | null; created_at?: string | null; name?: string | null },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const orderA = a.display_order ?? (a.created_at ? new Date(a.created_at).getTime() : 0);
    const orderB = b.display_order ?? (b.created_at ? new Date(b.created_at).getTime() : 0);
    if (orderA !== orderB) return Number(orderA) - Number(orderB);
    return (a.name ?? '').localeCompare(b.name ?? '');
  });
}

function compareRankingTemplateOptions(
  a: RankingTemplateOption,
  b: RankingTemplateOption,
  leagueOrderIndex: Map<string, number>
): number {
  const rank = (o: RankingTemplateOption) =>
    o.kind === 'account-league-flex' ? 0 : o.kind === 'account-null-flex' ? 1 : o.kind === 'guest' ? 2 : 3;
  const d = rank(a) - rank(b);
  if (d !== 0) return d;
  if (a.kind === 'account-league-flex' && b.kind === 'account-league-flex') {
    const ia = leagueOrderIndex.get(a.league_id) ?? 1_000_000;
    const ib = leagueOrderIndex.get(b.league_id) ?? 1_000_000;
    if (ia !== ib) return ia - ib;
  }
  return a.title.localeCompare(b.title) || a.subtitle.localeCompare(b.subtitle);
}

const Rankings = () => {
  const { user, loading: authLoading } = useAuth();
  const { selectedLeague, setSelectedLeague, leagues, loading: leaguesLoading } = useLeagues();
  const [guestSettingsVersion, setGuestSettingsVersion] = useState(0);
  const bucket = useCommunityRankingsBucket(user ? undefined : guestSettingsVersion);
  const { teamNames: defenseTeamNames, teams: nflTeams } = useNflTeams();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<RankedPlayer[]>(initialRankingsPageState.players);
  const [communityPlayers, setCommunityPlayers] = useState<RankedPlayer[]>(
    initialRankingsPageState.communityPlayers
  );
  /** Pure RPC community order (excludes you) for studs/duds — same scale as Draft Stats. */
  const [communityConsensusForStuds, setCommunityConsensusForStuds] = useState<RankedPlayer[]>(
    initialRankingsPageState.communityConsensusForStuds
  );
  const [communityRawExcludingMe, setCommunityRawExcludingMe] = useState<{ player_id: string; avg_rank: number; sample_count: number }[] | null>(null);
  const allPlayersDataRef = useRef<any[]>([]);
  const [loading, setLoading] = useState(initialRankingsPageState.loading);
  const [saving, setSaving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<string>(FILTER_ALL);
  const [selectedTeam, setSelectedTeam] = useState<string>(FILTER_ALL);
  /** Per-position cut-after ranks for personal tiers (RB: [5,15] → T1=1-5, T2=6-15, T3=16+). */
  const [positionTierCuts, setPositionTierCuts] = useState<PositionTierCuts>({});
  /** Consensus cuts from all signed-in users in this rankings bucket. */
  const [communityTierCuts, setCommunityTierCuts] = useState<PositionTierCuts>({});
  const positionTierPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<RankedPlayer | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [hasExistingRankings, setHasExistingRankings] = useState(
    initialRankingsPageState.hasExistingRankings
  );
  const [isEditMode, setIsEditMode] = useState(initialRankingsPageState.isEditMode);
  /** Ref-only preview order during drag — avoids re-rendering the full list on every pointer move. */
  const dragListIdsRef = useRef<string[] | null>(null);
  const dragBaselineIdsRef = useRef<string[] | null>(null);
  const isRankingsDraggingRef = useRef(false);
  const rankingsDragPointerRef = useRef<{ x: number; y: number } | null>(null);
  const rankingsScrollContainersRef = useRef<(HTMLDivElement | null)[]>([]);
  const [dragOverlay, setDragOverlay] = useState<{
    player: RankedPlayer;
    displayAdp: number;
  } | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragPreviewIds, setDragPreviewIds] = useState<string[] | null>(null);
  const [showDropGap, setShowDropGap] = useState(false);
  const [dragOverlayWidth, setDragOverlayWidth] = useState<number | undefined>(undefined);
  const lastDragOverRef = useRef<{
    over: NonNullable<DragOverEvent['over']>;
    collisions: DragOverEvent['collisions'];
    active: Active;
  } | null>(null);
  const dragPinnedTopRef = useRef<number | null>(null);
  const dragUsesVirtualListRef = useRef(false);
  const dragPreviewRafRef = useRef<number | null>(null);
  const dragPreviewPendingRef = useRef<string[] | null>(null);
  const [pinnedActivePlayer, setPinnedActivePlayer] = useState<RankedPlayer | null>(null);
  const [hasCommunityConsensus, setHasCommunityConsensus] = useState(false);
  const [allLeaguesBucketScoring, setAllLeaguesBucketScoring] = useState<'standard' | 'ppr' | 'half_ppr'>('ppr');
  const [allLeaguesBucketLeagueType, setAllLeaguesBucketLeagueType] = useState<'season' | 'dynasty'>('season');
  const [allLeaguesBucketSuperflex, setAllLeaguesBucketSuperflex] = useState(false);
  const [allLeaguesBucketRookiesOnly, setAllLeaguesBucketRookiesOnly] = useState(false);
  const [allLeaguesSelectedMatchingLeagueId, setAllLeaguesSelectedMatchingLeagueId] = useState<string | null>(null);
  /** Phone: show one compare board at a time so the list can use most of the viewport. */
  const [mobileRankingsBoard, setMobileRankingsBoard] = useState<'community' | 'mine'>('mine');
  const compareBoardScrollClassName =
    'h-[min(70dvh,640px)] lg:h-[560px] overflow-y-auto pr-2 scrollbar-thin';
  const fetchInProgressRef = useRef(false);
  const myRankingsScrollRef1 = useRef<HTMLDivElement>(null);
  const myRankingsScrollRef2 = useRef<HTMLDivElement>(null);
  const myRankingsScrollRef3 = useRef<HTMLDivElement>(null);
  const [myRankingsScrollEl1, bindMyRankingsScroll1] = useRankingsScrollContainer(myRankingsScrollRef1);
  const [myRankingsScrollEl2, bindMyRankingsScroll2] = useRankingsScrollContainer(myRankingsScrollRef2);
  const [myRankingsScrollEl3, bindMyRankingsScroll3] = useRankingsScrollContainer(myRankingsScrollRef3);
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
  const hasRankingsOnScreenRef = useRef(initialRankingsPageState.players.length > 0);

  const [importTemplateDialogOpen, setImportTemplateDialogOpen] = useState(false);
  const [templateOptions, setTemplateOptions] = useState<RankingTemplateOption[]>([]);
  const [loadingTemplateOptions, setLoadingTemplateOptions] = useState(false);
  const [importListEmptyKind, setImportListEmptyKind] = useState<ImportListEmptyKind | null>(null);

  const handlePlayerClick = useCallback((player: RankedPlayer) => {
    setSelectedPlayer(player);
    setDetailDialogOpen(true);
  }, []);

  const isAllLeagues = !selectedLeague;

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 0 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 0, tolerance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  rankingsScrollContainersRef.current = [
    myRankingsScrollRef1.current,
    myRankingsScrollRef2.current,
    myRankingsScrollRef3.current,
  ];

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!isRankingsDraggingRef.current) return;
      rankingsDragPointerRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('pointermove', onPointerMove, { capture: true, passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove, { capture: true });
  }, []);

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
  const positionAdpRankMap = useMemo(() => {
    const byId = new Map<string, RankedPlayer>();
    for (const p of [...players, ...communityPlayers]) {
      if (!byId.has(p.id)) byId.set(p.id, p);
    }
    return buildPositionAdpRankMap([...byId.values()]);
  }, [players, communityPlayers]);
  const positionsAlphabetical = useMemo(() => {
    const base = displayBucket.rookiesOnly ? ['QB', 'RB', 'WR', 'TE'] : ['QB', 'RB', 'WR', 'TE', 'K', 'D/ST'];
    return [...base].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [displayBucket.rookiesOnly]);

  useEffect(() => {
    if (selectedPosition === FILTER_ALL) return;
    if (!positionsAlphabetical.includes(selectedPosition)) {
      setSelectedPosition(FILTER_ALL);
    }
  }, [positionsAlphabetical, selectedPosition]);
  const bucketKey = `${displayBucket.scoringFormat}/${displayBucket.leagueType}/${displayBucket.isSuperflex}/${displayBucket.rookiesOnly || false}`;
  bucketRef.current = bucketKey;

  /** Import control: edit mode only; signed-in needs a league (not All Leagues); guests use bucket temp saves. */
  const showImportRankingControl =
    isEditMode && (user ? !isAllLeagues && selectedLeague != null : true);
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

  const rankingTiersStorageKey = useMemo(
    () =>
      getRankingTiersStorageKey({
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

  const persistRankingsPageSnapshot = useCallback(
    (
      nextPlayers: RankedPlayer[],
      nextCommunity: RankedPlayer[],
      nextConsensus: RankedPlayer[],
      nextHasExisting: boolean,
      nextEditMode: boolean
    ) => {
      if (nextPlayers.length === 0) return;
      rankingsPageSnapshotStorage.save({
        v: 1,
        bucketKey,
        leagueId: selectedLeague?.id ?? null,
        players: nextPlayers,
        communityPlayers: nextCommunity,
        communityConsensusForStuds: nextConsensus,
        hasExistingRankings: nextHasExisting,
        isEditMode: nextEditMode,
      });
    },
    [bucketKey, selectedLeague?.id]
  );

  useEffect(() => {
    hasRankingsOnScreenRef.current = players.length > 0 || communityPlayers.length > 0;
  }, [players.length, communityPlayers.length]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      persistRankingsPageSnapshot(
        players,
        communityPlayers,
        communityConsensusForStuds,
        hasExistingRankings,
        isEditMode
      );
    }, 0);
    return () => window.clearTimeout(handle);
  }, [
    players,
    communityPlayers,
    communityConsensusForStuds,
    hasExistingRankings,
    isEditMode,
    persistRankingsPageSnapshot,
  ]);

  const loadTemplateOptions = useCallback(async () => {
    const debugBase = {
      signedIn: Boolean(user),
      showImportRankingControl,
      isAllLeagues,
      selectedLeagueId: selectedLeague?.id ?? null,
      bucketKey,
      destRookiesOnly: Boolean(displayBucket.rookiesOnly),
      displayBucket,
    };
    console.warn('[Import rankings] loadTemplateOptions start', debugBase);

    if (!showImportRankingControl) {
      setTemplateOptions([]);
      setImportListEmptyKind(null);
      console.warn('[Import rankings] Aborted: import control hidden for current page state', debugBase);
      return;
    }
    setLoadingTemplateOptions(true);
    setImportListEmptyKind(null);
    try {
      const destBucket = userRankingBucketFromDisplayBucket(displayBucket);
      const destRookiesOnly = Boolean(displayBucket.rookiesOnly);

      if (user) {
        const { data: leagueRows, error: leaguesFetchError } = await supabase
          .from('leagues')
          .select('id, name, display_order, created_at')
          .eq('user_id', user.id);
        console.warn('[Import rankings] leagues query result', {
          count: leagueRows?.length ?? 0,
          error: leaguesFetchError?.message ?? null,
        });
        if (leaguesFetchError) {
          console.error('[Import rankings] Could not load leagues:', leaguesFetchError);
        }
        const profileLeagueIds = new Set((leagueRows ?? []).map((r) => r.id as string));
        const leagueNameById = new Map((leagueRows ?? []).map((r) => [r.id as string, r.name as string]));

        const scan = await scanUserRankingsImportPoolByLeague(supabase, user.id, destRookiesOnly);
        console.warn('[Import rankings] scanUserRankingsImportPoolByLeague', {
          leagueCount: scan.leagueIds.length,
          nullLeagueRowCount: scan.nullLeagueRowCount,
          destRookiesOnly,
        });

        const guestKeysFiltered = tempRankingsStorage
          .listGuestRankingBucketKeysWithData()
          .filter((k) => k !== bucketKey)
          .filter((k) =>
            rankingImportPlayerPoolsMatch(destRookiesOnly, parseGuestRankingBucketKey(k).rookies_only)
          );

        const options: RankingTemplateOption[] = [];

        for (const lid of scan.leagueIds) {
          if (!profileLeagueIds.has(lid)) continue;
          const best = scan.bestBucketByLeagueId.get(lid);
          if (!best) continue;
          if (
            selectedLeague &&
            selectedLeague.id === lid &&
            userRankingBucketsEqual(best, destBucket)
          ) {
            continue;
          }
          const leagueName =
            leagueNameById.get(lid) ?? leagues.find((l) => l.id === lid)?.name ?? 'League';
          options.push({
            kind: 'account-league-flex',
            league_id: lid,
            title: leagueName,
            subtitle: formatRankingBucketImportSubtitle(best),
          });
        }

        if (scan.nullLeagueRowCount > 0 && scan.bestBucketNullLeague) {
          const nb = scan.bestBucketNullLeague;
          const skipNullAsCurrentList =
            isAllLeagues && userRankingBucketsEqual(nb, destBucket);
          if (!skipNullAsCurrentList) {
            options.push({
              kind: 'account-null-flex',
              title: 'All leagues (saved)',
              subtitle: formatRankingBucketImportSubtitle(nb),
            });
          }
        }

        for (const bucketKeyStr of guestKeysFiltered) {
          options.push(guestRankingImportOptionFromKey(bucketKeyStr));
        }

        if (options.length === 0) {
          const anyIds = await fetchUserRankingsPlayerIdsFlexibleAny(supabase, user.id);
          console.warn('[Import rankings] account-any-flex probe', {
            resolvedCount: anyIds?.length ?? 0,
          });
          if (anyIds?.length) {
            options.push({
              kind: 'account-any-flex',
              title: 'Largest saved list',
              subtitle: 'Across your account (same player pool)',
            });
          }
        }

        const leagueRowsForOrder =
          leagues.length > 0
            ? leagues.map((l) => ({
                id: l.id,
                name: l.name,
                display_order: l.display_order,
                created_at: l.created_at,
              }))
            : (leagueRows ?? []).map((r) => ({
                id: r.id as string,
                name: r.name as string,
                display_order: r.display_order as number | null | undefined,
                created_at: r.created_at as string | null | undefined,
              }));
        const leagueOrderIndex = new Map(
          sortLeagueRowsLikeYourLeaguesSettings(leagueRowsForOrder).map((l, i) => [l.id, i])
        );
        options.sort((a, b) => compareRankingTemplateOptions(a, b, leagueOrderIndex));
        setTemplateOptions(options);
        console.warn('[Import rankings] final signed-in options', {
          optionsCount: options.length,
          optionKinds: options.map((o) => o.kind),
        });

        if (options.length === 0) {
          const profileLeaguesWithScanData = scan.leagueIds.filter((id) => profileLeagueIds.has(id)).length;
          const accountSourcesInPool = profileLeaguesWithScanData + (scan.nullLeagueRowCount > 0 ? 1 : 0);
          if (accountSourcesInPool > 0) {
            setImportListEmptyKind('only-this-list');
          } else {
            const anyGuestKeys = tempRankingsStorage
              .listGuestRankingBucketKeysWithData()
              .filter((k) => k !== bucketKey);
            const scanHadRows = scan.leagueIds.length > 0 || scan.nullLeagueRowCount > 0;
            if (!scanHadRows && anyGuestKeys.length === 0) {
              console.error('[Import rankings] No user_rankings rows in this pool and no temp_rankings_* keys', {
                userId: user.id,
              });
              toast.info(
                'No saved lists found to import. Open the console (F12), set level to Verbose / All levels, click Import again — look for lines starting with [Import rankings].'
              );
              setImportListEmptyKind('no-saves');
            } else if (!scanHadRows) {
              console.warn('[Import rankings] Empty list due to pool mismatch', {
                guestKeysAnyPool: anyGuestKeys.length,
                destRookiesOnly,
              });
              setImportListEmptyKind('rookies-mismatch');
            } else {
              console.warn(
                '[Import rankings] Rows exist in this pool but none under your profile leagues (check league_id on saves).',
                { userId: user.id, scanLeagueIdCount: scan.leagueIds.length }
              );
              setImportListEmptyKind('no-saves');
            }
          }
        }
      } else {
        const keys = tempRankingsStorage
          .listGuestRankingBucketKeysWithData()
          .filter((k) => k !== bucketKey)
          .filter((k) =>
            rankingImportPlayerPoolsMatch(destRookiesOnly, parseGuestRankingBucketKey(k).rookies_only)
          );
        if (keys.length === 0) {
          const anyGuestKeys = tempRankingsStorage
            .listGuestRankingBucketKeysWithData()
            .filter((k) => k !== bucketKey);
          console.warn('[Import rankings] Guest empty options', {
            matchingPoolKeys: keys.length,
            anyPoolKeys: anyGuestKeys.length,
          });
          setTemplateOptions([]);
          setImportListEmptyKind(anyGuestKeys.length === 0 ? 'no-saves' : 'rookies-mismatch');
          return;
        }
        const options: RankingTemplateOption[] = keys.map((bucketKeyStr) =>
          guestRankingImportOptionFromKey(bucketKeyStr)
        );
        options.sort((a, b) => compareRankingTemplateOptions(a, b, new Map()));
        setTemplateOptions(options);
        console.warn('[Import rankings] final guest options', {
          optionsCount: options.length,
        });
      }
    } catch (e) {
      console.error('[Import rankings] loadTemplateOptions threw', e);
      toast.error('Could not load rankings to use as templates.');
      setTemplateOptions([]);
      setImportListEmptyKind('no-saves');
    } finally {
      setLoadingTemplateOptions(false);
    }
  }, [showImportRankingControl, user, displayBucket, selectedLeague, leagues, bucketKey, isAllLeagues]);

  // Always point at the latest loader without subscribing the dialog effect to this callback's identity.
  // (Including `loadTemplateOptions` in an effect deps caused an infinite loop: setTemplateOptions →
  // re-render → new callback → effect re-runs while the dialog stays open → heavy refetch storm.)
  const loadTemplateOptionsRef = useRef(loadTemplateOptions);
  loadTemplateOptionsRef.current = loadTemplateOptions;
  const importDialogLoadOnceRef = useRef(false);

  // Radix Dialog does not call onOpenChange(true) when open is toggled from outside (e.g. Import button),
  // so load once each time the dialog opens — not on every `loadTemplateOptions` identity change.
  useEffect(() => {
    if (!importTemplateDialogOpen) {
      importDialogLoadOnceRef.current = false;
      return;
    }
    if (!showImportRankingControl) return;
    if (importDialogLoadOnceRef.current) return;
    importDialogLoadOnceRef.current = true;
    void loadTemplateOptionsRef.current();
  }, [importTemplateDialogOpen, showImportRankingControl]);

  const applyRankingTemplate = useCallback(
    async (opt: RankingTemplateOption) => {
      try {
        let ids: string[];
        if (opt.kind === 'guest') {
          const list = tempRankingsStorage.get(opt.bucketKey);
          if (!list?.length) {
            toast.error('That ranking set is no longer available.');
            return;
          }
          ids = list.map((p) => p.id);
        } else if (opt.kind === 'account-league-flex') {
          if (!user) return;
          const resolved = await fetchUserRankingsPlayerIdsFlexibleForLeague(
            supabase,
            user.id,
            opt.league_id,
            Boolean(displayBucket.rookiesOnly)
          );
          if (!resolved?.length) {
            toast.error('No saved rankings found for that league (same rookie/full pool as this screen).');
            return;
          }
          ids = resolved;
        } else if (opt.kind === 'account-null-flex') {
          if (!user) return;
          const resolved = await fetchUserRankingsPlayerIdsFlexibleForNullLeague(
            supabase,
            user.id,
            Boolean(displayBucket.rookiesOnly)
          );
          if (!resolved?.length) {
            toast.error('No saved rankings found for that list (same rookie/full pool as this screen).');
            return;
          }
          ids = resolved;
        } else if (opt.kind === 'account-any-flex') {
          if (!user) return;
          const resolved = await fetchUserRankingsPlayerIdsFlexibleAny(
            supabase,
            user.id
          );
          if (!resolved?.length) {
            toast.error('No saved finalized rankings found in your account.');
            return;
          }
          ids = resolved;
        }
        const next = mergeRankingsWithDraftOrder(players, ids);
        setPlayers(next);
        setIsEditMode(true);
        persistRankingsSessionDraft(next, true);
        setImportTemplateDialogOpen(false);
        toast.success('Imported order from template. Adjust as needed, then finalize.');
      } catch (e) {
        console.error(e);
        toast.error('Could not import that template.');
      }
    },
    [user, players, persistRankingsSessionDraft, displayBucket.rookiesOnly]
  );

  const applySpreadsheetImport = useCallback(
    (orderedPlayerIds: string[], summary: FinalizedImportSummary) => {
      const next = mergeRankingsWithDraftOrder(players, orderedPlayerIds);
      setPlayers(next);
      setIsEditMode(true);
      persistRankingsSessionDraft(next, true);
      setImportTemplateDialogOpen(false);

      const importedCount = summary.matchedCount + summary.adjustedCount;
      const parts = [`${importedCount} player${importedCount === 1 ? '' : 's'} imported`];
      if (summary.adjustedCount > 0) parts.push(`${summary.adjustedCount} confirmed manually`);
      if (summary.excludedCount > 0) parts.push(`${summary.excludedCount} not in our database (excluded)`);
      if (summary.duplicateCount > 0) parts.push(`${summary.duplicateCount} duplicate rows skipped`);
      toast.success(`${parts.join(' · ')}. Adjust as needed, then finalize.`);
    },
    [players, persistRankingsSessionDraft]
  );

  const onImportTemplateDialogOpenChange = useCallback((open: boolean) => {
    setImportTemplateDialogOpen(open);
  }, []);

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

  // Live community overall rank (moves as the user drags when live-merge is on).
  const communityRankMap = useMemo(
    () => new Map(displayedCommunityPlayers.map((p, i) => [p.id, i + 1])),
    [displayedCommunityPlayers]
  );
  // Stable consensus ADP for row labels — frozen at fetch, does not follow drag / My RK.
  const stableCommunityAdpMap = useMemo(() => {
    const source =
      communityConsensusForStuds.length > 0 ? communityConsensusForStuds : communityPlayers;
    return new Map(
      source.map((p, i) => {
        const fromAdp = Number(p.adp);
        return [p.id, fromAdp > 0 ? fromAdp : i + 1] as const;
      })
    );
  }, [communityConsensusForStuds, communityPlayers]);
  const getDisplayAdp = useCallback(
    (playerId: string, fallback: number) => stableCommunityAdpMap.get(playerId) ?? fallback,
    [stableCommunityAdpMap]
  );
  const communityDefenseRankFromList = useMemo(
    () =>
      buildDefenseRankFromList(
        displayedCommunityPlayers.map((p, i) => ({
          id: p.id,
          position: p.position,
          rank: i + 1,
        }))
      ),
    [displayedCommunityPlayers]
  );
  const communityPosRankMap = useMemo(
    () =>
      buildPositionRankFromList(
        displayedCommunityPlayers.map((p, i) => ({
          id: p.id,
          position: p.position,
          rank: i + 1,
        }))
      ),
    [displayedCommunityPlayers]
  );
  const myPosRankMap = useMemo(
    () =>
      buildPositionRankFromList(
        players.map((p) => ({
          id: p.id,
          position: p.position,
          rank: p.rank,
        }))
      ),
    [players]
  );
  const getCommunityPosRank = useCallback(
    (playerId: string) => communityPosRankMap.get(playerId) ?? null,
    [communityPosRankMap]
  );
  const getMyPosRank = useCallback(
    (playerId: string) => myPosRankMap.get(playerId) ?? null,
    [myPosRankMap]
  );
  const getCommunityTrend = useCallback(
    (playerId: string, overallRank: number) =>
      getCommunityRankTrend(bucketKey, playerId, overallRank),
    [bucketKey]
  );

  const maxMyPosRankByPosition = useMemo(() => {
    const maxByPos = new Map<string, number>();
    for (const p of players) {
      const posRank = myPosRankMap.get(p.id);
      if (posRank == null) continue;
      const prev = maxByPos.get(p.position) ?? 0;
      if (posRank > prev) maxByPos.set(p.position, posRank);
    }
    return maxByPos;
  }, [players, myPosRankMap]);

  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const communityPlayersById = useMemo(
    () => new Map(displayedCommunityPlayers.map((p) => [p.id, p])),
    [displayedCommunityPlayers]
  );

  /**
   * Community consensus, with the viewer's eligible cuts filling any positions
   * the remote aggregate is missing (e.g. just saved locally, or sole submitter).
   * Only positions with ≥1 break count — untouched groups stay untiered.
   */
  const effectiveCommunityTierCuts = useMemo(
    () =>
      mergePositionTierCuts(
        communityTierCuts,
        eligiblePositionTierCuts(positionTierCuts)
      ),
    [communityTierCuts, positionTierCuts]
  );

  const getPlayerTier = useCallback(
    (playerId: string): number | null => {
      const player = playersById.get(playerId);
      if (!player) return null;
      const myPosRank = myPosRankMap.get(playerId);
      if (myPosRank == null) return null;
      const cuts = getCutsForPosition(positionTierCuts, player.position);
      // No badge until this position has at least one break (default is not Tier 1).
      if (cuts.length === 0) return null;
      return getTierNumber(myPosRank, cuts);
    },
    [playersById, myPosRankMap, positionTierCuts]
  );

  const getCommunityPlayerTier = useCallback(
    (playerId: string): number | null => {
      const player = communityPlayersById.get(playerId) ?? playersById.get(playerId);
      if (!player) return null;
      const communityPosRank = communityPosRankMap.get(playerId);
      if (communityPosRank == null) return null;
      const cuts = getCutsForPosition(effectiveCommunityTierCuts, player.position);
      if (cuts.length === 0) return null;
      return getTierNumber(communityPosRank, cuts);
    },
    [communityPlayersById, playersById, communityPosRankMap, effectiveCommunityTierCuts]
  );

  /** Scissors pressed state: cut stored after this player's positional rank. */
  const hasTierCutAfterPlayer = useCallback(
    (playerId: string): boolean => {
      const player = playersById.get(playerId);
      if (!player) return false;
      if (selectedPosition !== FILTER_ALL && player.position !== selectedPosition) return false;
      const myPosRank = myPosRankMap.get(playerId);
      if (myPosRank == null) return false;
      return hasTierCutAfter(getCutsForPosition(positionTierCuts, player.position), myPosRank);
    },
    [selectedPosition, playersById, myPosRankMap, positionTierCuts]
  );

  /**
   * All positions: one break per tier at the first overall player who enters that tier.
   * Filtered: a break at every positional tier boundary for that group.
   */
  const myOverallTierBreakBeforeIds = useMemo(() => {
    if (selectedPosition !== FILTER_ALL) return null;
    const ordered = [...players].sort((a, b) => a.rank - b.rank).map((p) => p.id);
    return buildOverallTierBreakBeforeIds(ordered, (id) => getPlayerTier(id));
  }, [selectedPosition, players, getPlayerTier]);

  const communityOverallTierBreakBeforeIds = useMemo(() => {
    if (selectedPosition !== FILTER_ALL) return null;
    const ordered = displayedCommunityPlayers.map((p) => p.id);
    return buildOverallTierBreakBeforeIds(ordered, (id) => getCommunityPlayerTier(id));
  }, [selectedPosition, displayedCommunityPlayers, getCommunityPlayerTier]);

  const hasTierBreakBeforePlayer = useCallback(
    (playerId: string): boolean => {
      if (myOverallTierBreakBeforeIds) {
        return myOverallTierBreakBeforeIds.has(playerId);
      }
      const player = playersById.get(playerId);
      if (!player) return false;
      if (player.position !== selectedPosition) return false;
      const myPosRank = myPosRankMap.get(playerId);
      if (myPosRank == null) return false;
      return hasTierBreakBefore(getCutsForPosition(positionTierCuts, player.position), myPosRank);
    },
    [
      myOverallTierBreakBeforeIds,
      selectedPosition,
      playersById,
      myPosRankMap,
      positionTierCuts,
    ]
  );

  const hasCommunityTierBreakBeforePlayer = useCallback(
    (playerId: string): boolean => {
      if (communityOverallTierBreakBeforeIds) {
        return communityOverallTierBreakBeforeIds.has(playerId);
      }
      const player = communityPlayersById.get(playerId) ?? playersById.get(playerId);
      if (!player) return false;
      if (player.position !== selectedPosition) return false;
      const communityPosRank = communityPosRankMap.get(playerId);
      if (communityPosRank == null) return false;
      return hasTierBreakBefore(
        getCutsForPosition(effectiveCommunityTierCuts, player.position),
        communityPosRank
      );
    },
    [
      communityOverallTierBreakBeforeIds,
      selectedPosition,
      communityPlayersById,
      playersById,
      communityPosRankMap,
      effectiveCommunityTierCuts,
    ]
  );

  const canEditTierBreakForPlayer = useCallback(
    (playerId: string): boolean => {
      if (selectedPosition === FILTER_ALL) return false;
      const player = playersById.get(playerId);
      if (!player || player.position !== selectedPosition) return false;
      const myPosRank = myPosRankMap.get(playerId);
      if (myPosRank == null) return false;
      const maxRank = maxMyPosRankByPosition.get(player.position) ?? 0;
      return myPosRank < maxRank;
    },
    [selectedPosition, playersById, myPosRankMap, maxMyPosRankByPosition]
  );

  const persistPositionTierCuts = useCallback(
    async (cuts: PositionTierCuts) => {
      rankingTiersLocalStorage.save(rankingTiersStorageKey, cuts);
      if (!user) return;
      try {
        await upsertUserRankingTiers({
          userId: user.id,
          leagueId: selectedLeague?.id ?? null,
          bucket: userRankingBucketFromDisplayBucket(displayBucket),
          cuts,
        });
        const community = await fetchCommunityRankingTiers(
          userRankingBucketFromDisplayBucket(displayBucket)
        );
        setCommunityTierCuts(community);
      } catch (err) {
        console.error('Failed to save ranking tiers:', err);
      }
    },
    [rankingTiersStorageKey, user, displayBucket, selectedLeague?.id]
  );

  const loadCommunityTierCuts = useCallback(async () => {
    try {
      const community = await fetchCommunityRankingTiers(
        userRankingBucketFromDisplayBucket(displayBucket)
      );
      setCommunityTierCuts(community);
    } catch (err) {
      console.error('Failed to load community ranking tiers:', err);
      setCommunityTierCuts({});
    }
  }, [
    displayBucket.scoringFormat,
    displayBucket.leagueType,
    displayBucket.isSuperflex,
    displayBucket.rookiesOnly,
  ]);

  useEffect(() => {
    // Wait until league selection is restored so we don't fetch the default
    // All-leagues PPR bucket (QB/RB only) and stick with a partial consensus.
    if (user && leaguesLoading) return;
    // Drop prior bucket's consensus immediately so dynasty/SF/PPR never flash
    // onto a redraft/standard board while the next fetch is in flight.
    setCommunityTierCuts({});
    void loadCommunityTierCuts();
  }, [loadCommunityTierCuts, user, leaguesLoading, bucketKey]);

  useEffect(() => {
    let cancelled = false;
    // Load cuts for this league + bucket only (storage key includes bucketKey).
    const local = eligiblePositionTierCuts(
      rankingTiersLocalStorage.get(rankingTiersStorageKey)
    );
    setPositionTierCuts(local);

    if (!user) return () => {
      cancelled = true;
    };
    if (leaguesLoading) return () => {
      cancelled = true;
    };

    void (async () => {
      try {
        const remote = await fetchUserRankingTiers({
          userId: user.id,
          leagueId: selectedLeague?.id ?? null,
          bucket: userRankingBucketFromDisplayBucket(displayBucket),
        });
        if (cancelled) return;
        // Remote wins per position; local fills gaps so a partial remote row
        // does not wipe other positions you already tiered this session.
        const next = mergePositionTierCuts(remote, local);
        setPositionTierCuts(next);
        rankingTiersLocalStorage.save(rankingTiersStorageKey, next);
        if (Object.keys(next).length > 0 && !positionTierCutsEqual(next, remote)) {
          void upsertUserRankingTiers({
            userId: user.id,
            leagueId: selectedLeague?.id ?? null,
            bucket: userRankingBucketFromDisplayBucket(displayBucket),
            cuts: next,
          }).then(() => {
            void loadCommunityTierCuts();
          });
        }
      } catch (err) {
        console.error('Failed to load ranking tiers:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    rankingTiersStorageKey,
    user?.id,
    selectedLeague?.id,
    displayBucket.scoringFormat,
    displayBucket.leagueType,
    displayBucket.isSuperflex,
    displayBucket.rookiesOnly,
    loadCommunityTierCuts,
    leaguesLoading,
  ]);

  const schedulePersistPositionTierCuts = useCallback(
    (cuts: PositionTierCuts) => {
      rankingTiersLocalStorage.save(rankingTiersStorageKey, cuts);
      if (positionTierPersistTimerRef.current) {
        clearTimeout(positionTierPersistTimerRef.current);
      }
      positionTierPersistTimerRef.current = setTimeout(() => {
        void persistPositionTierCuts(cuts);
      }, 400);
    },
    [rankingTiersStorageKey, persistPositionTierCuts]
  );

  const handleToggleTierBreak = useCallback(
    (playerId: string) => {
      const player = playersById.get(playerId);
      if (!player) return;
      const myPosRank = myPosRankMap.get(playerId);
      if (myPosRank == null) return;
      const maxRank = maxMyPosRankByPosition.get(player.position) ?? 0;
      if (myPosRank >= maxRank) return;
      setPositionTierCuts((prev) => {
        const current = getCutsForPosition(prev, player.position);
        const nextCuts = toggleTierCut(current, myPosRank);
        const next = setCutsForPosition(prev, player.position, nextCuts);
        schedulePersistPositionTierCuts(next);
        return next;
      });
    },
    [playersById, myPosRankMap, maxMyPosRankByPosition, schedulePersistPositionTierCuts]
  );

  const getPlayerRankCardMeta = useCallback(
    (playerId: string) => {
      const overallRank = communityRankMap.get(playerId);
      return {
        communityPosRank: getCommunityPosRank(playerId),
        myPosRank: getMyPosRank(playerId),
        communityTrend:
          overallRank != null ? getCommunityTrend(playerId, overallRank) ?? null : null,
        tier: getPlayerTier(playerId),
        communityTier: getCommunityPlayerTier(playerId),
        hasTierCutAfter: hasTierCutAfterPlayer(playerId),
        hasTierBreakBefore: hasTierBreakBeforePlayer(playerId),
        hasCommunityTierBreakBefore: hasCommunityTierBreakBeforePlayer(playerId),
      };
    },
    [
      communityRankMap,
      getCommunityPosRank,
      getMyPosRank,
      getCommunityTrend,
      getPlayerTier,
      getCommunityPlayerTier,
      hasTierCutAfterPlayer,
      hasTierBreakBeforePlayer,
      hasCommunityTierBreakBeforePlayer,
    ]
  );

  useEffect(() => {
    if (displayedCommunityPlayers.length === 0) return;
    recordCommunityRankSnapshot(bucketKey, communityRankMap);
  }, [bucketKey, communityRankMap, displayedCommunityPlayers.length]);
  const dialogPositionAdpRank = useCallback(
    (p: RankedPlayer) =>
      resolvePositionAdpRankForDisplay(
        p,
        positionAdpRankMap,
        communityDefenseRankFromList
      ),
    [positionAdpRankMap, communityDefenseRankFromList]
  );

  const studsDudsVsConsensus = useMemo(() => {
    if (!hasExistingRankings || players.length === 0 || communityConsensusForStuds.length === 0) {
      return { studsTop10: [] as StudDudEntry[], dudsTop10: [] as StudDudEntry[] };
    }
    const { studs, duds } = computeStudsDuds(players, communityConsensusForStuds, {
      compareMode: 'window',
      maxRankConsider: STUDS_DUDS_RANKINGS_WINDOW,
    });
    return { studsTop10: studs.slice(0, 10), dudsTop10: duds.slice(0, 10) };
  }, [hasExistingRankings, players, communityConsensusForStuds]);

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
      return;
    }

    // Use ref so we always have the latest bucket (avoids stale closure when refetching after bucket change)
    const effectiveBucket = { ...communityBucketRef.current };
    const rankingBucketCols = userRankingBucketFromDisplayBucket({
      scoringFormat: effectiveBucket.scoringFormat,
      leagueType: effectiveBucket.leagueType,
      isSuperflex: effectiveBucket.isSuperflex,
      rookiesOnly: effectiveBucket.rookiesOnly,
    });
    const effectiveBucketKey = `${effectiveBucket.scoringFormat}/${effectiveBucket.leagueType}/${effectiveBucket.isSuperflex}/${effectiveBucket.rookiesOnly || false}`;
    // Capture context so we can ignore this fetch's result if league/bucket changed before it completed (e.g. stale deferred fetch)
    fetchContextRef.current = { leagueId: selectedLeague?.id ?? null, bucketKey: effectiveBucketKey };

    fetchInProgressRef.current = true;
    try {
      // Shared cached player pool (narrow columns) — avoids re-paginating select('*') on every visit.
      let allPlayersData: any[] = await fetchMergedPlayerPool();

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
            season: PLAYER_POOL_PRIOR_SEASON,
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
      // Sort by fantasy D/ST rank order (HOU first … ARI last), not alphabetical
      defensePlayers = defensePlayers.sort((a, b) => compareDefensesByFantasyRank(a.name, b.name));
      defensePlayers = defensePlayers.map((defense, index) => {
        const adp = 150 + Math.floor((index / Math.max(defensePlayers.length, 1)) * 50);
        const normalizedTeam = defense.team && defense.team !== 'FA'
          ? defense.team
          : (defenseTeamAbbrByName.get(defense.name) ?? defense.team);
        return { ...defense, adp, team: normalizedTeam };
      });
      
      // Do not persist defense ADP updates - RLS blocks anon update on players; in-memory is enough

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

      if (updatedPlayersData.length === 0) {
        console.warn('Rankings: No players returned after merge.');
      }

      allPlayersData = updatedPlayersData;
      allPlayersDataRef.current = allPlayersData;

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
        if (!hasRankingsOnScreenRef.current) {
          setLoading(true);
        }
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

        // Set community rankings (bucket-based, or ADP for dynasty/empty)
        const guestCommunity = communityData.length > 0
          ? buildCommunityFromRpc(allPlayersData, communityData)
          : adpPlayers;
        setCommunityConsensusForStuds(guestCommunity);
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

        // Signed-in All Leagues: always use rankings from each league (average or selected league), never a single "All Leagues" saved list
        let allLeagueRankingsData: { player_id: string; rank: number }[] = [];
        if (leagueIdsToFetch.length > 0) {
          allLeagueRankingsData = await fetchAllRankRows<{ player_id: string; rank: number }>(
            (from, to) => {
              const q = applyUserRankingsBucketMatch(
                supabase
                  .from('user_rankings')
                  .select('player_id, rank')
                  .eq('user_id', user.id)
                  .not('league_id', 'is', null)
                  .in('league_id', leagueIdsToFetch),
                rankingBucketCols
              ) as ReturnType<typeof supabase.from>;
              return (q as any)
                .order('rank', { ascending: true })
                .order('player_id', { ascending: true })
                .range(from, to);
            }
          );
        }

        const playerRankingsMap = await buildPoolRankSamplesFromSavedRows(
          supabase,
          allLeagueRankingsData,
          allPlayersData
        );
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
        setHasExistingRankings(playerRankingsMap.size > 0);
        if (allLeaguesSessionDraft?.ids.length) setIsEditMode(allLeaguesSessionDraft.isEditMode);
        else setIsEditMode(false);

        // Community rankings: bucket-based from RPC, ADP fallback (dynasty shows ADP + "coming soon")
        const allLeaguesCommunity = communityData.length > 0
          ? buildCommunityFromRpc(allPlayersData, communityData)
          : allPlayersData.map((p, index) => ({ ...p, adp: bucketAdpMap.get(p.id) ?? Number(p.adp), rank: index + 1 }));
        setCommunityConsensusForStuds(allLeaguesCommunity);
        setCommunityPlayers(allLeaguesCommunity);
        setCommunityRawExcludingMe(null);
      } else {
        // Fetch league-specific rankings (paginated — boards often exceed 1000 rows)
        const rankingsData = await fetchAllRankRows<{ player_id: string; rank: number }>(
          (from, to) => {
            const q = applyUserRankingsBucketMatch(
              supabase
                .from('user_rankings')
                .select('player_id, rank')
                .eq('user_id', user.id)
                .eq('league_id', selectedLeague.id),
              rankingBucketCols
            ) as ReturnType<typeof supabase.from>;
            return (q as any)
              .order('rank', { ascending: true })
              .order('player_id', { ascending: true })
              .range(from, to);
          }
        );

        const hasRankings = rankingsData.length > 0;

        let rankedPlayers: RankedPlayer[];

        if (hasRankings) {
          // UUID + espn_id remap so cross-season player rows keep your saved rank
          const rankingsMap = await buildPoolRankMapFromSavedRows(
            supabase,
            rankingsData,
            allPlayersData
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
        const consensusForStuds =
          communityData.length > 0
            ? buildCommunityFromRpc(allPlayersData, communityData)
            : allPlayersData.map((p, index) => ({
                ...p,
                adp: bucketAdpMap.get(p.id) ?? Number(p.adp),
                rank: index + 1,
              }));
        setCommunityConsensusForStuds(consensusForStuds);
        setCommunityPlayers(leagueCommunity);
      }
    } catch (error: any) {
      console.error('Failed to load players:', error);
      
      // Check if it's a rate limit error
      if (error?.message?.includes('rate limit') || error?.code === 'PGRST116' || error?.status === 429) {
        toast.error('Rate limit exceeded. Please wait a moment and refresh the page. Your data is safe.');
        console.error('Supabase rate limit hit. Consider reducing query frequency.');
      } else {
        toast.error(
          userFacingErrorMessage(error, "Couldn't load players. Your data is safe. Try refreshing.")
        );
      }
      
      // DON'T clear existing data on error - keep what we have so user doesn't lose their view
      // Only set empty arrays if we truly have no data (first load)
      if (players.length === 0 && communityPlayers.length === 0) {
        setPlayers([]);
        setCommunityPlayers([]);
        setCommunityConsensusForStuds([]);
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
        isRefetchAfterBucketChangeRef.current = true;
        if (!hasRankingsOnScreenRef.current) {
          setLoading(true);
        }
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
      if (!hasRankingsOnScreenRef.current) {
        setLoading(true);
      }
      fetchPlayers();
      return;
    }

    // When logged in with leagues but selectedLeague still null, defer so selectedLeague
    // restoration from localStorage can commit (avoids fetching with wrong bucket then overwriting).
    if (user && leagues.length > 0 && selectedLeague === null) {
      if (!hasRankingsOnScreenRef.current) {
        setLoading(true);
      }
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

    if (!hasRankingsOnScreenRef.current) {
      setLoading(true);
    }
    fetchPlayers();
  }, [fetchPlayers, user, authLoading, leaguesLoading, isAllLeagues, leagues.length, selectedLeague, bucket.scoringFormat, bucket.leagueType, bucket.isSuperflex, bucket.rookiesOnly]);

  const saveRankings = useCallback(async (
    playersToSave: RankedPlayer[],
    leagueId: string | null,
    rankingBucket: ReturnType<typeof userRankingBucketFromDisplayBucket>,
    onSuccess?: () => void
  ) => {
    if (!user) return;
    setSaving(true);

    try {
      // Delete existing rankings first (only this league-settings bucket)
      let deleteError;
      if (leagueId) {
        const { error } = await applyUserRankingsBucketMatch(
          supabase
            .from('user_rankings')
            .delete()
            .eq('user_id', user.id)
            .eq('league_id', leagueId),
          rankingBucket
        );
        deleteError = error;
      } else {
        const { error } = await applyUserRankingsBucketMatch(
          supabase.from('user_rankings').delete().eq('user_id', user.id).is('league_id', null),
          rankingBucket
        );
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
        ...rankingBucket,
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
      toast.error(userFacingErrorMessage(error, "Couldn't save rankings. Please try again."));
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
        selectedPosition === FILTER_ALL || p.position === selectedPosition;

      const matchesTeam = playerMatchesTeamSelection(p, selectedTeam);

      return matchesSearch && matchesPosition && matchesTeam;
    });
  }, [players, searchTerm, selectedPosition, selectedTeam]);

  const sortedFilteredPlayers = useMemo(
    () => [...filteredPlayers].sort((a, b) => a.rank - b.rank),
    [filteredPlayers]
  );

  const sortedAllPlayers = useMemo(
    () => [...players].sort((a, b) => a.rank - b.rank),
    [players]
  );

  const positionFilterActive = selectedPosition !== FILTER_ALL;
  const otherFilterActive = selectedTeam !== FILTER_ALL || searchTerm.trim() !== '';

  const dragSourcePlayers = useMemo(
    () => (positionFilterActive || otherFilterActive ? sortedFilteredPlayers : sortedAllPlayers),
    [positionFilterActive, otherFilterActive, sortedFilteredPlayers, sortedAllPlayers]
  );

  const displayListItems = useMemo((): RankingsListItem[] => {
    const byId = new Map(dragSourcePlayers.map((p) => [p.id, p]));
    const orderIds = dragPreviewIds ?? dragSourcePlayers.map((p) => p.id);

    if (!activeDragId || !dragPreviewIds || !showDropGap) {
      if (!activeDragId || !dragPreviewIds) {
        return dragSourcePlayers.map((player) => ({ kind: 'player' as const, player }));
      }
      return orderIds
        .map((id) => {
          const player = byId.get(id);
          return player ? ({ kind: 'player' as const, player }) : null;
        })
        .filter((item): item is RankingsListItem => item != null);
    }

    return orderIds
      .map((id) => {
        if (id === activeDragId) return { kind: 'gap' as const };
        const player = byId.get(id);
        return player ? ({ kind: 'player' as const, player }) : null;
      })
      .filter((item): item is RankingsListItem => item != null);
  }, [activeDragId, dragPreviewIds, dragSourcePlayers, showDropGap]);

  const sortableItemIds = dragPreviewIds ?? dragSourcePlayers.map((p) => p.id);

  const clearDragListState = useCallback(() => {
    isRankingsDraggingRef.current = false;
    dragListIdsRef.current = null;
    dragBaselineIdsRef.current = null;
    lastDragOverRef.current = null;
    dragPinnedTopRef.current = null;
    dragUsesVirtualListRef.current = false;
    dragPreviewPendingRef.current = null;
    if (dragPreviewRafRef.current != null) {
      cancelAnimationFrame(dragPreviewRafRef.current);
      dragPreviewRafRef.current = null;
    }
    rankingsDragPointerRef.current = null;
    setDragPreviewIds(null);
    setShowDropGap(false);
    setPinnedActivePlayer(null);
    setDragOverlay(null);
    setActiveDragId(null);
    setDragOverlayWidth(undefined);
  }, []);

  const updateDragPreview = useCallback((event: DragOverEvent | DragMoveEvent) => {
    const current = dragListIdsRef.current;
    if (!current || !event.over) return;

    lastDragOverRef.current = {
      over: event.over,
      collisions: event.collisions,
      active: event.active,
    };

    const next = applyDragPreviewStep(
      current,
      event.active,
      event.over,
      event.collisions,
      rankingsDragPointerRef.current?.y ?? null
    );
    if (next.join('|') === current.join('|')) return;
    dragListIdsRef.current = next;
    if (!dragUsesVirtualListRef.current) return;

    dragPreviewPendingRef.current = next;
    if (dragPreviewRafRef.current != null) return;
    dragPreviewRafRef.current = requestAnimationFrame(() => {
      dragPreviewRafRef.current = null;
      const pending = dragPreviewPendingRef.current;
      if (pending) setDragPreviewIds(pending);
    });
  }, []);

  const commitRankingsPreview = useCallback(
    (preview: string[], baseline: string[], activeId: string) => {
      if (sameIdOrder(preview, baseline)) return;

      startTransition(() => {
        setPlayers((current) => {
          let updatedPlayers: RankedPlayer[];
          if (positionFilterActive) {
            updatedPlayers = applyMidpointFromPreviewOrder(current, preview, activeId, baseline);
          } else if (otherFilterActive) {
            updatedPlayers = applySlotFromPreviewOrder(current, preview);
          } else {
            updatedPlayers = applyFullListFromPreviewOrder(current, preview);
          }
          persistRankingsSessionDraft(updatedPlayers, isEditMode);
          return updatedPlayers;
        });
      });
    },
    [
      positionFilterActive,
      otherFilterActive,
      isEditMode,
      persistRankingsSessionDraft,
    ]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const baseline = dragBaselineIdsRef.current;
    let preview = dragListIdsRef.current;

    const over = event.over ?? lastDragOverRef.current?.over;
    const collisions = event.over ? event.collisions : lastDragOverRef.current?.collisions;

    if (preview && over) {
      preview = applyDragPreviewStep(
        preview,
        event.active,
        over,
        collisions ?? null,
        rankingsDragPointerRef.current?.y ?? null
      );
      dragListIdsRef.current = preview;
    }

    clearDragListState();

    if (!preview || !baseline || preview.join('|') === baseline.join('|')) {
      return;
    }

    commitRankingsPreview(preview, baseline, String(event.active.id));
  };

  const handleDragStart = (event: DragStartEvent) => {
    isRankingsDraggingRef.current = true;
    const ids = dragSourcePlayers.map((p) => p.id);
    dragBaselineIdsRef.current = ids;
    dragListIdsRef.current = ids;
    setActiveDragId(String(event.active.id));

    const ae = event.activatorEvent;
    let scrollContainer: HTMLDivElement | null = null;
    if (ae && 'clientX' in ae && 'clientY' in ae) {
      const pe = ae as PointerEvent;
      rankingsDragPointerRef.current = { x: pe.clientX, y: pe.clientY };
      const target = pe.target instanceof Node ? pe.target : null;
      scrollContainer =
        rankingsScrollContainersRef.current.find(
          (el) => el && target && el.contains(target)
        ) ?? null;
      if (scrollContainer) setDragOverlayWidth(scrollContainer.clientWidth);
    }

    const usesVirtualList = scrollContainer === myRankingsScrollRef2.current;
    dragUsesVirtualListRef.current = usesVirtualList;

    if (usesVirtualList) {
      setDragPreviewIds(ids);
      setShowDropGap(false);
      requestAnimationFrame(() => {
        setShowDropGap(true);
      });

      const initial = event.active.rect.current.initial;
      if (scrollContainer && initial) {
        const containerRect = scrollContainer.getBoundingClientRect();
        dragPinnedTopRef.current = initial.top - containerRect.top + scrollContainer.scrollTop;
      }
    }

    const dragged = dragSourcePlayers.find((p) => p.id === String(event.active.id));
    if (dragged) {
      if (usesVirtualList) setPinnedActivePlayer(dragged);
      setDragOverlay({
        player: dragged,
        displayAdp: getDisplayAdp(dragged.id, dragged.adp),
      });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    updateDragPreview(event);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    updateDragPreview(event);
  };

  const handleDragCancel = () => {
    clearDragListState();
  };

  const exportBucket = useMemo(
    () => userRankingBucketFromDisplayBucket(displayBucket),
    [displayBucket.scoringFormat, displayBucket.leagueType, displayBucket.isSuperflex, displayBucket.rookiesOnly]
  );

  /** Re-enter full-screen edit after finalize (including from All leagues compare view). */
  const enterEditRankings = useCallback(() => {
    if (user && isAllLeagues) {
      const targetId =
        allLeaguesSelectedMatchingLeagueId ??
        matchingLeaguesForBucket[0]?.id ??
        null;
      if (!targetId) {
        toast.info('Create or select a league for this scoring setup before editing.');
        return;
      }
      const league =
        matchingLeaguesForBucket.find((l) => l.id === targetId) ??
        leagues.find((l) => l.id === targetId) ??
        null;
      if (!league) {
        toast.error('Could not open that league for editing.');
        return;
      }
      persistRankingsSessionDraft(players, true);
      setSelectedLeague(league);
      setIsEditMode(true);
      return;
    }
    persistRankingsSessionDraft(players, true);
    setIsEditMode(true);
  }, [
    user,
    isAllLeagues,
    allLeaguesSelectedMatchingLeagueId,
    matchingLeaguesForBucket,
    leagues,
    players,
    persistRankingsSessionDraft,
    setSelectedLeague,
  ]);

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
      void persistPositionTierCuts(positionTierCuts);
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
      await saveRankings(players, selectedLeague.id, userRankingBucketFromDisplayBucket(displayBucket));
      await persistPositionTierCuts(positionTierCuts);
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
      void saveRankings(resetPlayers, null, userRankingBucketFromDisplayBucket(displayBucket)).then(() =>
        rankingsDraftSessionStorage.clear(rankingsSessionDraftKey)
      );
    } else {
      persistRankingsSessionDraft(resetPlayers, isEditMode);
    }
    toast.info('Rankings reset to community consensus');
  };

  const filteredCommunityPlayers = displayedCommunityPlayers.filter((p) => {
    // Improved search: search in full name (handles "Travis Hunter" when searching "hunter")
    const searchLower = searchTerm.toLowerCase().trim();
    const matchesSearch = searchLower === '' || 
      p.name.toLowerCase().includes(searchLower) ||
      p.team?.toLowerCase().includes(searchLower) ||
      // Also search by splitting name (handles "Travis Hunter" when searching "hunter")
      p.name.toLowerCase().split(' ').some(part => part.includes(searchLower));
    
    const matchesPosition =
      selectedPosition === FILTER_ALL || p.position === selectedPosition;
    const matchesTeam = playerMatchesTeamSelection(p, selectedTeam);
    return matchesSearch && matchesPosition && matchesTeam;
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="flex min-h-[70vh] items-center justify-center px-4">
          <BrandedLoader />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="max-w-screen-2xl mx-auto px-3 py-4 sm:px-6 sm:py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-3xl sm:text-4xl tracking-wide">
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
                    <SelectItem value="season">Redraft</SelectItem>
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
                    <SelectItem value="non-sf">1 QB</SelectItem>
                    <SelectItem value="sf">2QB</SelectItem>
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
                  {displayBucket.leagueType === 'dynasty' ? ' Dynasty' : ' Redraft'}
                  {displayBucket.isSuperflex ? ' 2QB' : ''}
                  {displayBucket.rookiesOnly ? ' Rookies only' : ''}
                  {displayBucket.leagueType === 'dynasty' && !hasCommunityConsensus ? ' — Community rankings coming soon' : ''}
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
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
            {showImportRankingControl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setImportTemplateDialogOpen(true)}
                className="h-auto min-h-9 flex-col gap-0.5 py-2 px-4 min-w-[13rem] border-border/80 justify-center"
                aria-label="Import or export rankings"
              >
                <span className="flex items-center justify-center gap-2">
                  <LayoutTemplate className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-medium leading-none">Import/Export rankings</span>
                </span>
                <span className="text-[10px] font-normal text-muted-foreground leading-tight text-center">
                  Upload a list or download yours
                </span>
              </Button>
            )}
            {((!user && isEditMode) || (!isAllLeagues && isEditMode)) && (
              <Button
                size="sm"
                onClick={finalizeRankings}
                disabled={isFinalizing}
                className="gap-2"
              >
                {isFinalizing ? <BrandedLoader size={22} /> : <Save className="w-4 h-4" />}
                Finalize Rankings
              </Button>
            )}
            {(!user || !isAllLeagues || matchingLeaguesForBucket.length > 0) && !isEditMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={enterEditRankings}
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

        <div className="flex flex-wrap gap-2 sm:gap-3 mb-3 sm:mb-6">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-secondary/50 border-border/50"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Select value={selectedPosition} onValueChange={setSelectedPosition}>
              <SelectTrigger className="w-[min(100vw-3rem,200px)] sm:w-[180px] h-10 bg-secondary/50 border-border/50">
                <SelectValue placeholder="All positions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>All positions</SelectItem>
                {positionsAlphabetical.map((pos) => (
                  <SelectItem key={pos} value={pos}>
                    {pos}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-[min(100vw-3rem,260px)] sm:w-[240px] h-10 bg-secondary/50 border-border/50">
                <SelectValue placeholder="All teams" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={FILTER_ALL}>All teams</SelectItem>
                {RANKINGS_TEAM_FILTER_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
                <SelectItem value={TEAM_SELECT_FA}>Free Agents</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {positionFilterActive ? (
          <>
            <p className="text-xs text-muted-foreground mb-3 sm:hidden">
              Scissors end a {selectedPosition} tier below that player.
            </p>
            <p className="hidden sm:block text-sm text-muted-foreground mb-4">
              Use the scissors on a player to end their tier below them. This {selectedPosition} board
              shows every tier boundary for the position. Community uses everyone&apos;s cuts the same
              way.
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3 sm:hidden">
              Filter by position to set tier cuts with the scissors.
            </p>
            <p className="hidden sm:block text-sm text-muted-foreground mb-4">
              Filter by position to set tier cuts. On All positions, one break appears per tier at the
              first player who enters that tier overall (later Tier 1 players at other spots can sit
              after a Tier 1 break). Community follows the same overall-break rule.
            </p>
          </>
        )}

        {((!user && !isEditMode) || (user && isAllLeagues && !isEditMode)) ? (
          <>
            <div
              role="tablist"
              aria-label="Rankings boards"
              className="lg:hidden grid grid-cols-2 gap-1 rounded-lg bg-secondary/60 p-1 border border-border/40 mb-3"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mobileRankingsBoard === 'community'}
                onClick={() => setMobileRankingsBoard('community')}
                className={cn(
                  'min-h-11 rounded-md text-sm font-medium transition-colors',
                  mobileRankingsBoard === 'community'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground'
                )}
              >
                Community
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mobileRankingsBoard === 'mine'}
                onClick={() => setMobileRankingsBoard('mine')}
                className={cn(
                  'min-h-11 rounded-md text-sm font-medium transition-colors',
                  mobileRankingsBoard === 'mine'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground'
                )}
              >
                My Rankings
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
              {/* Community Rankings Column */}
              <div
                className={cn(
                  'bg-secondary/30 rounded-lg border border-border/50 p-3 sm:p-5',
                  mobileRankingsBoard !== 'community' && 'hidden lg:block'
                )}
              >
                <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3 pb-2 border-b border-border">
                  <Users className="w-5 h-5 text-accent shrink-0" />
                  <h2 className="font-display text-lg sm:text-xl tracking-wide shrink-0">COMMUNITY RANKINGS</h2>
                  <div className="ml-auto">
                    <RankingsColumnExportMenu
                      players={filteredCommunityPlayers}
                      bucket={exportBucket}
                      boardLabel="Community"
                    />
                  </div>
                </div>
                <div className={compareBoardScrollClassName}>
                  <div className="space-y-1.5 sm:space-y-2">
                    {filteredCommunityPlayers.map((player) => {
                      const rankMeta = getPlayerRankCardMeta(player.id);
                      const stableAdp = getDisplayAdp(player.id, Number(player.adp) || 0);
                      return (
                      <PlayerCard
                        key={player.id}
                        player={stableAdp !== Number(player.adp) ? { ...player, adp: stableAdp } : player}
                        rank={displayedCommunityPlayers.findIndex((p) => p.id === player.id) + 1}
                        onClick={() => handlePlayerClick(player)}
                        positionColoredRank
                        compactStats
                        stats2025={player2025Stats.get(player.id)}
                        communityPosRank={rankMeta.communityPosRank}
                        myPosRank={rankMeta.myPosRank}
                        communityTrend={rankMeta.communityTrend}
                        tier={rankMeta.communityTier}
                        hasTierBreakBefore={rankMeta.hasCommunityTierBreakBefore}
                      />
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* My Rankings Column */}
              <div
                className={cn(
                  'bg-secondary/30 rounded-lg border border-border/50 p-3 sm:p-5',
                  mobileRankingsBoard !== 'mine' && 'hidden lg:block'
                )}
              >
                <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3 pb-2 border-b border-border">
                  <User className="w-5 h-5 text-primary shrink-0" />
                  <h2 className="font-display text-lg sm:text-xl tracking-wide shrink-0">MY RANKINGS</h2>
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
                  <div className="ml-auto">
                    <RankingsColumnExportMenu
                      players={dragSourcePlayers}
                      bucket={exportBucket}
                      boardLabel="My"
                    />
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3">
                  Drag to reorder your personal rankings
                </p>
                <RankingsCompareDragPanel
                  scrollContainerRef={myRankingsScrollRef1}
                  bindScrollContainer={bindMyRankingsScroll1}
                  players={dragSourcePlayers}
                  getDisplayAdp={getDisplayAdp}
                  getPlayerRankCardMeta={getPlayerRankCardMeta}
                  canEditTierBreakForPlayer={canEditTierBreakForPlayer}
                  onToggleTierBreak={handleToggleTierBreak}
                  player2025Stats={player2025Stats}
                  onPlayerClick={handlePlayerClick}
                  onCommitPreview={commitRankingsPreview}
                  scrollClassName={compareBoardScrollClassName}
                />
              </div>
            </div>

            {/* Differential Analysis Section */}
            {hasExistingRankings && players.length > 0 && communityConsensusForStuds.length > 0 && (
              <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Your Studs */}
                <div className="bg-green-500/10 rounded-lg border border-green-500/30 p-4">
                  <div className="flex items-center justify-center gap-2 mb-4 pb-2 border-b border-green-500/30">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <h2 className="font-display text-xl tracking-wide text-green-400">YOUR STUDS</h2>
                  </div>
                  <div className="mb-3 sm:mb-4 space-y-1 text-center text-xs sm:text-sm text-muted-foreground leading-snug">
                    <p className="sm:hidden">Top 10 vs community (both in top {STUDS_DUDS_RANKINGS_WINDOW}).</p>
                    <p className="hidden sm:block text-balance">Top 10 players you rank higher than community consensus.</p>
                    <p className="hidden sm:block">
                      (Only when both ranks are within the top {STUDS_DUDS_RANKINGS_WINDOW}.)
                    </p>
                    <p className="hidden sm:block">See all studs in the Draft Stats tab.</p>
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-2 scrollbar-thin">
                    {studsDudsVsConsensus.studsTop10.map(({ player, myRank, communityRank, diff }) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between bg-background/50 rounded-md p-3 cursor-pointer hover:bg-background/70 transition-colors"
                        onClick={() => handlePlayerClick(player)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-green-400">+{diff}</span>
                          <div>
                            <p className="font-medium">{player.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {displayTeamAbbrevOrFa(player.team, player.position, player.name)} • {player.position}
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <p className="text-green-400">
                            #{myRank} <span className="text-muted-foreground">vs</span> #{communityRank}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Your Duds */}
                <div className="bg-red-500/10 rounded-lg border border-red-500/30 p-4">
                  <div className="flex items-center justify-center gap-2 mb-4 pb-2 border-b border-red-500/30">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <h2 className="font-display text-xl tracking-wide text-red-400">YOUR DUDS</h2>
                  </div>
                  <div className="mb-3 sm:mb-4 space-y-1 text-center text-xs sm:text-sm text-muted-foreground leading-snug">
                    <p className="sm:hidden">Top 10 vs community (both in top {STUDS_DUDS_RANKINGS_WINDOW}).</p>
                    <p className="hidden sm:block text-balance">Top 10 players you rank lower than community consensus.</p>
                    <p className="hidden sm:block">
                      (Only when both ranks are within the top {STUDS_DUDS_RANKINGS_WINDOW}.)
                    </p>
                    <p className="hidden sm:block">See all duds in the Draft Stats tab.</p>
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-2 scrollbar-thin">
                    {studsDudsVsConsensus.dudsTop10.map(({ player, myRank, communityRank, diff }) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between bg-background/50 rounded-md p-3 cursor-pointer hover:bg-background/70 transition-colors"
                        onClick={() => handlePlayerClick(player)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-red-400">{diff}</span>
                          <div>
                            <p className="font-medium">{player.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {displayTeamAbbrevOrFa(player.team, player.position, player.name)} • {player.position}
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <p className="text-red-400">
                            #{myRank} <span className="text-muted-foreground">vs</span> #{communityRank}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (isEditMode || (!user && !hasExistingRankings)) ? (
          // Edit Mode - Drag and drop rankings (for logged-in users editing, or non-logged-in users who haven't finalized)
          <div ref={bindMyRankingsScroll2} className="h-[min(75dvh,720px)] min-h-[320px] sm:min-h-[500px] overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin" style={{ touchAction: 'pan-y' }}>
          <DndContext
            sensors={sensors}
            collisionDetection={rankingsListCollisionDetection}
            measuring={rankingsMeasuringConfig}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragMove={handleDragMove}
            onDragCancel={handleDragCancel}
            autoScroll={autoScrollConfig}
          >
            <RampUpScrollHandler containerRef={myRankingsScrollRef2} />
            <SortableContext
              items={sortableItemIds}
              strategy={verticalListSortingStrategy}
            >
              <RankingsVirtualSortableList
                scrollElement={myRankingsScrollEl2}
                items={displayListItems}
                activeDragId={activeDragId}
                dragMode="edit"
                pinnedActiveTopPx={showDropGap ? dragPinnedTopRef.current : null}
                pinnedActivePlayer={showDropGap ? pinnedActivePlayer : null}
                getDisplayAdp={getDisplayAdp}
                getCommunityPosRank={getCommunityPosRank}
                getMyPosRank={getMyPosRank}
                getCommunityTrend={getCommunityTrend}
                getTier={getPlayerTier}
                canEditTierBreakForPlayer={canEditTierBreakForPlayer}
                hasTierCutAfterPlayer={hasTierCutAfterPlayer}
                hasTierBreakBeforePlayer={hasTierBreakBeforePlayer}
                onToggleTierBreak={handleToggleTierBreak}
                player2025Stats={player2025Stats}
                onPlayerClick={handlePlayerClick}
              />
            </SortableContext>
            <DragOverlay adjustScale={false} dropAnimation={null} style={{ zIndex: 9999 }}>
              {dragOverlay ? (
                <div style={{ width: dragOverlayWidth, boxSizing: 'border-box' }}>
                  <RankingsDragRow
                    player={dragOverlay.player}
                    rank={dragOverlay.player.rank}
                    displayAdp={dragOverlay.displayAdp}
                    communityPosRank={getCommunityPosRank(dragOverlay.player.id)}
                    myPosRank={getMyPosRank(dragOverlay.player.id)}
                    communityTrend={getCommunityTrend(
                      dragOverlay.player.id,
                      dragOverlay.displayAdp
                    )}
                    tier={getPlayerTier(dragOverlay.player.id)}
                    stats2025={player2025Stats.get(dragOverlay.player.id)}
                    isOverlay
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
          </div>
        ) : (
          // Comparison View - Similar to All Leagues
          <>
            <div
              role="tablist"
              aria-label="Rankings boards"
              className="lg:hidden grid grid-cols-2 gap-1 rounded-lg bg-secondary/60 p-1 border border-border/40 mb-3"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mobileRankingsBoard === 'community'}
                onClick={() => setMobileRankingsBoard('community')}
                className={cn(
                  'min-h-11 rounded-md text-sm font-medium transition-colors',
                  mobileRankingsBoard === 'community'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground'
                )}
              >
                Community
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mobileRankingsBoard === 'mine'}
                onClick={() => setMobileRankingsBoard('mine')}
                className={cn(
                  'min-h-11 rounded-md text-sm font-medium transition-colors',
                  mobileRankingsBoard === 'mine'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground'
                )}
              >
                My Rankings
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
              {/* Community Rankings Column */}
              <div
                className={cn(
                  'bg-secondary/30 rounded-lg border border-border/50 p-3 sm:p-5',
                  mobileRankingsBoard !== 'community' && 'hidden lg:block'
                )}
              >
                <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3 pb-2 border-b border-border">
                  <Users className="w-5 h-5 text-accent shrink-0" />
                  <h2 className="font-display text-lg sm:text-xl tracking-wide shrink-0">COMMUNITY RANKINGS</h2>
                  <div className="ml-auto">
                    <RankingsColumnExportMenu
                      players={filteredCommunityPlayers}
                      bucket={exportBucket}
                      boardLabel="Community"
                    />
                  </div>
                </div>
                <div className={compareBoardScrollClassName}>
                  <div className="space-y-1.5 sm:space-y-2">
                    {filteredCommunityPlayers.map((player) => {
                      const rankMeta = getPlayerRankCardMeta(player.id);
                      const stableAdp = getDisplayAdp(player.id, Number(player.adp) || 0);
                      return (
                      <PlayerCard
                        key={player.id}
                        player={stableAdp !== Number(player.adp) ? { ...player, adp: stableAdp } : player}
                        rank={displayedCommunityPlayers.findIndex((p) => p.id === player.id) + 1}
                        onClick={() => handlePlayerClick(player)}
                        positionColoredRank
                        compactStats
                        stats2025={player2025Stats.get(player.id)}
                        communityPosRank={rankMeta.communityPosRank}
                        myPosRank={rankMeta.myPosRank}
                        communityTrend={rankMeta.communityTrend}
                        tier={rankMeta.communityTier}
                        hasTierBreakBefore={rankMeta.hasCommunityTierBreakBefore}
                      />
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* My Rankings Column */}
              <div
                className={cn(
                  'bg-secondary/30 rounded-lg border border-border/50 p-3 sm:p-5',
                  mobileRankingsBoard !== 'mine' && 'hidden lg:block'
                )}
              >
                <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3 pb-2 border-b border-border">
                  <User className="w-5 h-5 text-primary shrink-0" />
                  <h2 className="font-display text-lg sm:text-xl tracking-wide shrink-0">MY RANKINGS</h2>
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
                  <div className="ml-auto">
                    <RankingsColumnExportMenu
                      players={dragSourcePlayers}
                      bucket={exportBucket}
                      boardLabel="My"
                    />
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3">
                  Drag the handle to adjust rankings
                </p>
                <RankingsCompareDragPanel
                  scrollContainerRef={myRankingsScrollRef3}
                  bindScrollContainer={bindMyRankingsScroll3}
                  players={dragSourcePlayers}
                  getDisplayAdp={getDisplayAdp}
                  getPlayerRankCardMeta={getPlayerRankCardMeta}
                  canEditTierBreakForPlayer={canEditTierBreakForPlayer}
                  onToggleTierBreak={handleToggleTierBreak}
                  player2025Stats={player2025Stats}
                  onPlayerClick={handlePlayerClick}
                  onCommitPreview={commitRankingsPreview}
                  scrollClassName={compareBoardScrollClassName}
                />
              </div>
            </div>

            {/* Differential Analysis Section */}
            {hasExistingRankings && players.length > 0 && communityConsensusForStuds.length > 0 && (
              <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Your Studs */}
                <div className="bg-green-500/10 rounded-lg border border-green-500/30 p-4">
                  <div className="flex items-center justify-center gap-2 mb-4 pb-2 border-b border-green-500/30">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <h2 className="font-display text-xl tracking-wide text-green-400">YOUR STUDS</h2>
                  </div>
                  <div className="mb-3 sm:mb-4 space-y-1 text-center text-xs sm:text-sm text-muted-foreground leading-snug">
                    <p className="sm:hidden">Top 10 vs community (both in top {STUDS_DUDS_RANKINGS_WINDOW}).</p>
                    <p className="hidden sm:block text-balance">Top 10 players you rank higher than community consensus.</p>
                    <p className="hidden sm:block">
                      (Only when both ranks are within the top {STUDS_DUDS_RANKINGS_WINDOW}.)
                    </p>
                    <p className="hidden sm:block">See all studs in the Draft Stats tab.</p>
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-2 scrollbar-thin">
                    {studsDudsVsConsensus.studsTop10.map(({ player, myRank, communityRank, diff }) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between bg-background/50 rounded-md p-3 cursor-pointer hover:bg-background/70 transition-colors"
                        onClick={() => handlePlayerClick(player)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-green-400">+{diff}</span>
                          <div>
                            <p className="font-medium">{player.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {displayTeamAbbrevOrFa(player.team, player.position, player.name)} • {player.position}
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <p className="text-green-400">
                            #{myRank} <span className="text-muted-foreground">vs</span> #{communityRank}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Your Duds */}
                <div className="bg-red-500/10 rounded-lg border border-red-500/30 p-4">
                  <div className="flex items-center justify-center gap-2 mb-4 pb-2 border-b border-red-500/30">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <h2 className="font-display text-xl tracking-wide text-red-400">YOUR DUDS</h2>
                  </div>
                  <div className="mb-3 sm:mb-4 space-y-1 text-center text-xs sm:text-sm text-muted-foreground leading-snug">
                    <p className="sm:hidden">Top 10 vs community (both in top {STUDS_DUDS_RANKINGS_WINDOW}).</p>
                    <p className="hidden sm:block text-balance">Top 10 players you rank lower than community consensus.</p>
                    <p className="hidden sm:block">
                      (Only when both ranks are within the top {STUDS_DUDS_RANKINGS_WINDOW}.)
                    </p>
                    <p className="hidden sm:block">See all duds in the Draft Stats tab.</p>
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-2 scrollbar-thin">
                    {studsDudsVsConsensus.dudsTop10.map(({ player, myRank, communityRank, diff }) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between bg-background/50 rounded-md p-3 cursor-pointer hover:bg-background/70 transition-colors"
                        onClick={() => handlePlayerClick(player)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-red-400">{diff}</span>
                          <div>
                            <p className="font-medium">{player.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {displayTeamAbbrevOrFa(player.team, player.position, player.name)} • {player.position}
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <p className="text-red-400">
                            #{myRank} <span className="text-muted-foreground">vs</span> #{communityRank}
                          </p>
                        </div>
                      </div>
                    ))}
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

        {filteredPlayers.length === 0 && filteredCommunityPlayers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No players found matching your search, position, or team filters
          </div>
        )}

        <Dialog open={importTemplateDialogOpen} onOpenChange={onImportTemplateDialogOpenChange}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-center sm:text-left tracking-wide">Import &amp; export rankings</DialogTitle>
              <DialogDescription className="text-center sm:text-left">
                Upload a spreadsheet or PDF, copy order from another league, or download your current board.
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="upload">Upload file</TabsTrigger>
                <TabsTrigger value="template">From other league</TabsTrigger>
                <TabsTrigger value="export">Export</TabsTrigger>
              </TabsList>

              <TabsContent value="template" className="pt-3">
                {loadingTemplateOptions ? (
                  <div className="flex justify-center py-8">
                    <BrandedLoader size={44} />
                  </div>
                ) : templateOptions.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 space-y-3">
                    {importListEmptyKind === 'rookies-mismatch' ? (
                      <p>
                        There are no saved lists with the same player pool as this screen. Full rankings and rookie-only
                        use different pools — switch rookie mode or finalize a list in the matching pool first.
                      </p>
                    ) : importListEmptyKind === 'only-this-list' ? (
                      <p>
                        Your saved rankings for other formats are already this list. Import another league or scoring
                        type first, or use <span className="text-foreground">Reset to ADP</span> / drag to reorder.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <p>
                          No sources found: no other finalized league rankings in your account for this player pool, and
                          no other saved boards in this browser for that pool. Open Rankings under another
                          scoring/league type in this browser (your boards persist locally), finalize when ready, or use{' '}
                          <span className="text-foreground">Reset to ADP</span>.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          When sources exist, each row shows your league name with the format on a second line;
                          device-only boards show the format first, then a note that they are not saved to your account
                          yet. For diagnostic logs, open DevTools →{' '}
                          <span className="font-medium text-foreground">Console</span> (not Sources or Network), then
                          filter for <code className="text-xs">[Import rankings]</code> — that line only appears when
                          the import list is still empty after loading.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="max-h-[min(60vh,320px)] min-h-0 overflow-y-auto overflow-x-hidden space-y-2 pr-2 scrollbar-thin rounded-md bg-muted/30 py-1.5"
                    style={{ touchAction: 'pan-y' }}
                  >
                    {templateOptions.map((opt, idx) => (
                      <Button
                        key={
                          opt.kind === 'guest'
                            ? opt.bucketKey
                            : opt.kind === 'account-any-flex'
                              ? `any-flex-${idx}`
                              : opt.kind === 'account-null-flex'
                                ? `null-flex-${idx}`
                                : `flex-${opt.league_id}-${idx}`
                        }
                        variant="secondary"
                        className="w-full justify-start text-left h-auto py-3 px-3 whitespace-normal"
                        onClick={() => void applyRankingTemplate(opt)}
                      >
                        <span className="flex w-full min-w-0 flex-col items-start gap-0.5 text-left">
                          <span className="w-full truncate font-medium text-foreground">{opt.title}</span>
                          <span className="w-full text-xs font-normal text-muted-foreground">{opt.subtitle}</span>
                        </span>
                      </Button>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="upload" className="pt-3">
                <RankingsSpreadsheetImportPanel
                  pool={players}
                  onApply={applySpreadsheetImport}
                />
              </TabsContent>

              <TabsContent value="export" className="pt-3">
                <RankingsExportButtons
                  players={players}
                  bucket={userRankingBucketFromDisplayBucket(displayBucket)}
                  bucketLabel={formatRankingBucketLabel(userRankingBucketFromDisplayBucket(displayBucket))}
                />
              </TabsContent>
            </Tabs>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setImportTemplateDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>

      <PlayerDetailDialog
        player={selectedPlayer}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        stats2025={selectedPlayer ? player2025Stats.get(selectedPlayer.id) : undefined}
        allStats2025={player2025Stats}
        positionAdpRank={selectedPlayer ? dialogPositionAdpRank(selectedPlayer) : null}
      />
    </div>
  );
};

export { Rankings };
export default Rankings;
