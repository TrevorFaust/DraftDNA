import { memo, useState, useCallback, type RefObject } from 'react';
import { useVirtualizer, defaultRangeExtractor, type VirtualItem } from '@tanstack/react-virtual';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { RankedPlayer } from '@/types/database';
import { RankingsDragRow } from '@/components/rankings/RankingsDragRow';
import type { CommunityRankTrend } from '@/utils/communityRankTrend';

/** Fixed row height (card + mb-2 gap) — avoids dynamic measure churn while scrolling. */
export const RANKINGS_ROW_ESTIMATE_PX = 96;

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
  hasTierBreakAfter?: boolean;
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
  hasTierBreakAfter = false,
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
      hasTierBreakAfter={hasTierBreakAfter}
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
        height: RANKINGS_ROW_ESTIMATE_PX,
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
};

const GapRow = memo(function GapRow({ virtualRow }: GapRowProps) {
  return (
    <div
      data-index={virtualRow.index}
      aria-hidden
      style={{
        position: 'absolute',
        top: virtualRow.start,
        left: 0,
        width: '100%',
        height: RANKINGS_ROW_ESTIMATE_PX,
        zIndex: 1,
      }}
    >
      <div className="mb-2 min-h-[84px] rounded-lg border-2 border-dashed border-primary/60 bg-primary/5" />
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
  hasTierBreakAfterPlayer?: (playerId: string) => boolean;
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
  hasTierBreakAfterPlayer,
  onToggleTierBreak,
  player2025Stats,
  onPlayerClick,
}: RankingsVirtualSortableListProps) {
  const pinnedIndex =
    dragMode === 'edit' && activeDragId
      ? items.findIndex((item) => item.kind === 'gap')
      : activeDragId
        ? items.findIndex((item) => item.kind === 'player' && item.player.id === activeDragId)
        : -1;

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => RANKINGS_ROW_ESTIMATE_PX,
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
          return <GapRow key={`gap-${activeDragId}`} virtualRow={virtualRow} />;
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
            hasTierBreakAfter={hasTierBreakAfterPlayer?.(item.player.id) ?? false}
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
