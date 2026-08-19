import { memo, useState, useCallback, useEffect, type RefObject } from 'react';
import { useVirtualizer, defaultRangeExtractor, type VirtualItem } from '@tanstack/react-virtual';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { RankedPlayer } from '@/types/database';
import { RankingsDragRow } from '@/components/rankings/RankingsDragRow';
import type { CommunityRankTrend } from '@/utils/communityRankTrend';

/**
 * Fixed row heights (card + mb-2) — avoids dynamic measure churn while scrolling.
 * Desktop: Comm/Mine/tier sit inline. Phone: those controls stack under the name.
 * Tier-break rows get a little extra for the label bar above the card.
 */
export const RANKINGS_ROW_ESTIMATE_DESKTOP_PX = 78;
export const RANKINGS_ROW_ESTIMATE_MOBILE_PX = 110;
export const RANKINGS_TIER_BREAK_EXTRA_PX = 10;
/** @deprecated Prefer getRankingsRowSizePx — kept as desktop default. */
export const RANKINGS_ROW_ESTIMATE_PX = RANKINGS_ROW_ESTIMATE_DESKTOP_PX;

const RANKINGS_MOBILE_MQ = '(max-width: 639px)';

export function getRankingsRowSizePx(
  isMobileLayout: boolean,
  hasTierBreakBefore = false
): number {
  const base = isMobileLayout
    ? RANKINGS_ROW_ESTIMATE_MOBILE_PX
    : RANKINGS_ROW_ESTIMATE_DESKTOP_PX;
  return hasTierBreakBefore ? base + RANKINGS_TIER_BREAK_EXTRA_PX : base;
}

function useRankingsMobileLayout(): boolean {
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(RANKINGS_MOBILE_MQ).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(RANKINGS_MOBILE_MQ);
    const onChange = () => setIsMobileLayout(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobileLayout;
}

type Player2025StatsEntry = {
  avgPointsPerGame: number | null;
  gamesPlayed?: number;
  totalFantasyPoints?: number;
};

export type RankingsListItem =
  | { kind: 'player'; player: RankedPlayer }
  | { kind: 'gap' };

type VirtualSortableRowProps = {
  player: RankedPlayer;
  virtualRow: VirtualItem;
  displayAdp: number;
  communityPosRank?: number | null;
  myPosRank?: number | null;
  communityTrend?: CommunityRankTrend | null;
  tier?: number | null;
  canEditTierBreak?: boolean;
  hasTierCutAfter?: boolean;
  hasTierBreakBefore?: boolean;
  onToggleTierBreak?: (playerId: string) => void;
  stats2025?: Player2025StatsEntry;
  onPlayerClick: (player: RankedPlayer) => void;
  dragMode: 'edit' | 'compare';
};

const VirtualSortableRow = memo(function VirtualSortableRow({
  player,
  virtualRow,
  displayAdp,
  communityPosRank,
  myPosRank,
  communityTrend,
  tier,
  canEditTierBreak = false,
  hasTierCutAfter = false,
  hasTierBreakBefore = false,
  onToggleTierBreak,
  stats2025,
  onPlayerClick,
  dragMode,
}: VirtualSortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    isDragging,
  } = useSortable({
    id: player.id,
    index: virtualRow.index,
    animateLayoutChanges: () => false,
    transition: null,
  });

  const rowShell = (
    <RankingsDragRow
      player={player}
      rank={player.rank}
      displayAdp={displayAdp}
      communityPosRank={communityPosRank}
      myPosRank={myPosRank}
      communityTrend={communityTrend}
      tier={tier}
      canEditTierBreak={canEditTierBreak}
      hasTierCutAfter={hasTierCutAfter}
      hasTierBreakBefore={hasTierBreakBefore}
      onToggleTierBreak={
        onToggleTierBreak ? () => onToggleTierBreak(player.id) : undefined
      }
      stats2025={stats2025}
      onPlayerClick={onPlayerClick}
      isSourceHidden={dragMode === 'compare' && isDragging}
      dragHandleAttributes={attributes}
      dragHandleListeners={listeners}
      dragHandleRef={setActivatorNodeRef}
      className="mb-2"
    />
  );

  return (
    <div
      data-index={virtualRow.index}
      style={{
        position: 'absolute',
        top: virtualRow.start,
        left: 0,
        width: '100%',
        height: virtualRow.size,
        zIndex: isDragging ? 0 : 1,
      }}
    >
      {dragMode === 'compare' ? (
        <div
          ref={setNodeRef}
          style={{
            transform: CSS.Transform.toString(transform),
            transition: 'none',
          }}
        >
          {rowShell}
        </div>
      ) : (
        <div ref={setNodeRef}>{rowShell}</div>
      )}
    </div>
  );
});

type GapRowProps = {
  virtualRow: VirtualItem;
  isMobileLayout: boolean;
};

const GapRow = memo(function GapRow({ virtualRow, isMobileLayout }: GapRowProps) {
  const ghostMinH = isMobileLayout
    ? RANKINGS_ROW_ESTIMATE_MOBILE_PX - 8
    : RANKINGS_ROW_ESTIMATE_DESKTOP_PX - 8;

  return (
    <div
      data-index={virtualRow.index}
      aria-hidden
      style={{
        position: 'absolute',
        top: virtualRow.start,
        left: 0,
        width: '100%',
        height: virtualRow.size,
        zIndex: 1,
      }}
    >
      <div
        className="mb-2 rounded-lg border-2 border-dashed border-primary/60 bg-primary/5"
        style={{ minHeight: ghostMinH }}
      />
    </div>
  );
});

type PinnedActiveSortableProps = {
  player: RankedPlayer;
  topPx: number;
  displayAdp: number;
  communityPosRank?: number | null;
  myPosRank?: number | null;
  communityTrend?: CommunityRankTrend | null;
  tier?: number | null;
  stats2025?: Player2025StatsEntry;
};

/** Invisible sortable anchor at grab position — keeps DragOverlay aligned with the pointer. */
const PinnedActiveSortable = memo(function PinnedActiveSortable({
  player,
  topPx,
  displayAdp,
  communityPosRank,
  myPosRank,
  communityTrend,
  tier,
  stats2025,
}: PinnedActiveSortableProps) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners } = useSortable({
    id: player.id,
    animateLayoutChanges: () => false,
    transition: null,
  });

  return (
    <div
      style={{
        position: 'absolute',
        top: topPx,
        left: 0,
        width: '100%',
        zIndex: 0,
        opacity: 0,
        pointerEvents: 'none',
      }}
    >
      <div ref={setNodeRef}>
        <RankingsDragRow
          player={player}
          rank={player.rank}
          displayAdp={displayAdp}
          communityPosRank={communityPosRank}
          myPosRank={myPosRank}
          communityTrend={communityTrend}
          tier={tier}
          stats2025={stats2025}
          dragHandleAttributes={attributes}
          dragHandleListeners={listeners}
          dragHandleRef={setActivatorNodeRef}
          className="mb-2"
        />
      </div>
    </div>
  );
});

export type RankingsVirtualSortableListProps = {
  /** Legacy ref — kept for edge-scroll handlers on the parent container. */
  scrollRef?: RefObject<HTMLDivElement | null>;
  /** Connected scroll element — stateful so the virtualizer mounts rows on first paint. */
  scrollElement: HTMLDivElement | null;
  items: RankingsListItem[];
  activeDragId: string | null;
  dragMode: 'edit' | 'compare';
  pinnedActiveTopPx?: number | null;
  pinnedActivePlayer?: RankedPlayer | null;
  getDisplayAdp: (playerId: string, fallback: number) => number;
  getCommunityPosRank?: (playerId: string) => number | null | undefined;
  getMyPosRank?: (playerId: string) => number | null | undefined;
  getCommunityTrend?: (playerId: string, overallRank: number) => CommunityRankTrend | null | undefined;
  getTier?: (playerId: string) => number | null | undefined;
  canEditTierBreakForPlayer?: (playerId: string) => boolean;
  hasTierCutAfterPlayer?: (playerId: string) => boolean;
  hasTierBreakBeforePlayer?: (playerId: string) => boolean;
  onToggleTierBreak?: (playerId: string) => void;
  player2025Stats: Map<string, Player2025StatsEntry>;
  onPlayerClick: (player: RankedPlayer) => void;
};

export function RankingsVirtualSortableList({
  scrollElement,
  items,
  activeDragId,
  dragMode,
  pinnedActiveTopPx = null,
  pinnedActivePlayer = null,
  getDisplayAdp,
  getCommunityPosRank,
  getMyPosRank,
  getCommunityTrend,
  getTier,
  canEditTierBreakForPlayer,
  hasTierCutAfterPlayer,
  hasTierBreakBeforePlayer,
  onToggleTierBreak,
  player2025Stats,
  onPlayerClick,
}: RankingsVirtualSortableListProps) {
  const isMobileLayout = useRankingsMobileLayout();

  const pinnedIndex =
    dragMode === 'edit' && activeDragId
      ? items.findIndex((item) => item.kind === 'gap')
      : activeDragId
        ? items.findIndex((item) => item.kind === 'player' && item.player.id === activeDragId)
        : -1;

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollElement,
    estimateSize: (index) => {
      const item = items[index];
      if (!item || item.kind === 'gap') {
        return getRankingsRowSizePx(isMobileLayout, false);
      }
      return getRankingsRowSizePx(
        isMobileLayout,
        hasTierBreakBeforePlayer?.(item.player.id) ?? false
      );
    },
    overscan: 6,
    enabled: scrollElement != null && items.length > 0,
    getItemKey: (index) => {
      const item = items[index];
      if (!item) return index;
      return item.kind === 'gap' ? `gap-${activeDragId}` : item.player.id;
    },
    rangeExtractor: (range) => {
      const next = new Set(defaultRangeExtractor(range));
      if (pinnedIndex >= 0) next.add(pinnedIndex);
      return [...next].sort((a, b) => a - b);
    },
  });

  // Remeasure when layout breakpoint or tier-break map changes (fixed estimates).
  useEffect(() => {
    virtualizer.measure();
  }, [virtualizer, isMobileLayout, hasTierBreakBeforePlayer, items.length]);

  const virtualItems = virtualizer.getVirtualItems();

  if (!scrollElement || items.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        height: virtualizer.getTotalSize(),
        width: '100%',
        position: 'relative',
      }}
    >
      {dragMode === 'edit' && pinnedActivePlayer != null && pinnedActiveTopPx != null ? (
        <PinnedActiveSortable
          player={pinnedActivePlayer}
          topPx={pinnedActiveTopPx}
          displayAdp={getDisplayAdp(pinnedActivePlayer.id, pinnedActivePlayer.adp)}
          communityPosRank={getCommunityPosRank?.(pinnedActivePlayer.id)}
          myPosRank={getMyPosRank?.(pinnedActivePlayer.id)}
          communityTrend={getCommunityTrend?.(
            pinnedActivePlayer.id,
            getDisplayAdp(pinnedActivePlayer.id, pinnedActivePlayer.adp)
          )}
          tier={getTier?.(pinnedActivePlayer.id)}
          stats2025={player2025Stats.get(pinnedActivePlayer.id)}
        />
      ) : null}
      {virtualItems.map((virtualRow) => {
        const item = items[virtualRow.index];
        if (!item) return null;
        if (item.kind === 'gap') {
          return (
            <GapRow
              key={`gap-${activeDragId}`}
              virtualRow={virtualRow}
              isMobileLayout={isMobileLayout}
            />
          );
        }
        const displayAdp = getDisplayAdp(item.player.id, item.player.adp);
        return (
          <VirtualSortableRow
            key={item.player.id}
            player={item.player}
            virtualRow={virtualRow}
            displayAdp={displayAdp}
            communityPosRank={getCommunityPosRank?.(item.player.id)}
            myPosRank={getMyPosRank?.(item.player.id)}
            communityTrend={getCommunityTrend?.(item.player.id, displayAdp)}
            tier={getTier?.(item.player.id)}
            canEditTierBreak={canEditTierBreakForPlayer?.(item.player.id) ?? false}
            hasTierCutAfter={hasTierCutAfterPlayer?.(item.player.id) ?? false}
            hasTierBreakBefore={hasTierBreakBeforePlayer?.(item.player.id) ?? false}
            onToggleTierBreak={onToggleTierBreak}
            stats2025={player2025Stats.get(item.player.id)}
            onPlayerClick={onPlayerClick}
            dragMode={dragMode}
          />
        );
      })}
    </div>
  );
}

export type RankingsReadOnlyVirtualListProps = {
  scrollElement: HTMLDivElement | null;
  players: RankedPlayer[];
  getRank: (playerId: string) => number;
  getDisplayAdp: (playerId: string, fallback: number) => number;
  getCommunityPosRank?: (playerId: string) => number | null | undefined;
  getMyPosRank?: (playerId: string) => number | null | undefined;
  getCommunityTrend?: (playerId: string, overallRank: number) => CommunityRankTrend | null | undefined;
  getTier?: (playerId: string) => number | null | undefined;
  hasTierBreakBeforePlayer?: (playerId: string) => boolean;
  player2025Stats: Map<string, Player2025StatsEntry>;
  onPlayerClick: (player: RankedPlayer) => void;
};

const ReadOnlyVirtualRow = memo(function ReadOnlyVirtualRow({
  player,
  virtualRow,
  rank,
  displayAdp,
  communityPosRank,
  myPosRank,
  communityTrend,
  tier,
  hasTierBreakBefore,
  stats2025,
  onPlayerClick,
}: {
  player: RankedPlayer;
  virtualRow: VirtualItem;
  rank: number;
  displayAdp: number;
  communityPosRank?: number | null;
  myPosRank?: number | null;
  communityTrend?: CommunityRankTrend | null;
  tier?: number | null;
  hasTierBreakBefore?: boolean;
  stats2025?: Player2025StatsEntry;
  onPlayerClick: (player: RankedPlayer) => void;
}) {
  return (
    <div
      data-index={virtualRow.index}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        transform: `translateY(${virtualRow.start}px)`,
      }}
      className="mb-2"
    >
      <RankingsDragRow
        player={player}
        rank={rank}
        displayAdp={displayAdp}
        communityPosRank={communityPosRank}
        myPosRank={myPosRank}
        communityTrend={communityTrend}
        tier={tier}
        hasTierBreakBefore={hasTierBreakBefore}
        stats2025={stats2025}
        onPlayerClick={onPlayerClick}
      />
    </div>
  );
});

/** Read-only virtual board (community / site ADP) — no dnd-kit, no jersey cards. */
export function RankingsReadOnlyVirtualList({
  scrollElement,
  players,
  getRank,
  getDisplayAdp,
  getCommunityPosRank,
  getMyPosRank,
  getCommunityTrend,
  getTier,
  hasTierBreakBeforePlayer,
  player2025Stats,
  onPlayerClick,
}: RankingsReadOnlyVirtualListProps) {
  const isMobileLayout = useRankingsMobileLayout();

  const virtualizer = useVirtualizer({
    count: players.length,
    getScrollElement: () => scrollElement,
    estimateSize: (index) => {
      const player = players[index];
      return getRankingsRowSizePx(
        isMobileLayout,
        player ? hasTierBreakBeforePlayer?.(player.id) ?? false : false
      );
    },
    overscan: 8,
    enabled: scrollElement != null && players.length > 0,
    getItemKey: (index) => players[index]?.id ?? index,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [virtualizer, isMobileLayout, hasTierBreakBeforePlayer, players.length]);

  if (!scrollElement || players.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        height: virtualizer.getTotalSize(),
        width: '100%',
        position: 'relative',
      }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const player = players[virtualRow.index];
        if (!player) return null;
        const rank = getRank(player.id);
        return (
          <ReadOnlyVirtualRow
            key={player.id}
            player={player}
            virtualRow={virtualRow}
            rank={rank}
            displayAdp={getDisplayAdp(player.id, Number(player.adp) || 0)}
            communityPosRank={getCommunityPosRank?.(player.id)}
            myPosRank={getMyPosRank?.(player.id)}
            communityTrend={getCommunityTrend?.(player.id, rank)}
            tier={getTier?.(player.id)}
            hasTierBreakBefore={hasTierBreakBeforePlayer?.(player.id)}
            stats2025={player2025Stats.get(player.id)}
            onPlayerClick={onPlayerClick}
          />
        );
      })}
    </div>
  );
}

/** Binds parent scroll ref + state setter so virtual lists mount when the container attaches. */
export function useRankingsScrollContainer(
  legacyRef: RefObject<HTMLDivElement | null>
): [HTMLDivElement | null, (node: HTMLDivElement | null) => void] {
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);

  const bindScrollContainer = useCallback(
    (node: HTMLDivElement | null) => {
      legacyRef.current = node;
      setScrollElement(node);
    },
    [legacyRef]
  );

  return [scrollElement, bindScrollContainer];
}
