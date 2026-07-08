import { memo, useCallback, type RefObject } from 'react';
import { useVirtualizer, defaultRangeExtractor, type VirtualItem } from '@tanstack/react-virtual';
import { useSortable } from '@dnd-kit/sortable';
import type { RankedPlayer } from '@/types/database';
import { RankingsDragRow } from '@/components/rankings/RankingsDragRow';

/** Row height + gap — virtualizer estimate; remeasured after mount. */
export const RANKINGS_ROW_ESTIMATE_PX = 92;

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
  stats2025?: Player2025StatsEntry;
  onPlayerClick: (player: RankedPlayer) => void;
  measureElement: (element: Element | null) => void;
};

const VirtualSortableRow = memo(function VirtualSortableRow({
  player,
  virtualRow,
  displayAdp,
  stats2025,
  onPlayerClick,
  measureElement,
}: VirtualSortableRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef } = useSortable({
    id: player.id,
    index: virtualRow.index,
    animateLayoutChanges: () => false,
    transition: null,
  });

  const setOuterRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) measureElement(node);
    },
    [measureElement]
  );

  return (
    <div
      ref={setOuterRef}
      data-index={virtualRow.index}
      style={{
        position: 'absolute',
        top: virtualRow.start,
        left: 0,
        width: '100%',
        zIndex: 1,
      }}
    >
      <div ref={setNodeRef}>
        <RankingsDragRow
          player={player}
          rank={player.rank}
          displayAdp={displayAdp}
          stats2025={stats2025}
          onPlayerClick={onPlayerClick}
          dragHandleAttributes={attributes}
          dragHandleListeners={listeners}
          dragHandleRef={setActivatorNodeRef}
          className="mb-2"
        />
      </div>
    </div>
  );
});

type GapRowProps = {
  virtualRow: VirtualItem;
  measureElement: (element: Element | null) => void;
};

const GapRow = memo(function GapRow({ virtualRow, measureElement }: GapRowProps) {
  const setOuterRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) measureElement(node);
    },
    [measureElement]
  );

  return (
    <div
      ref={setOuterRef}
      data-index={virtualRow.index}
      aria-hidden
      style={{
        position: 'absolute',
        top: virtualRow.start,
        left: 0,
        width: '100%',
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
  stats2025?: Player2025StatsEntry;
};

/** Invisible sortable anchor at grab position — keeps DragOverlay aligned with the pointer. */
const PinnedActiveSortable = memo(function PinnedActiveSortable({
  player,
  topPx,
  displayAdp,
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
  scrollRef: RefObject<HTMLDivElement | null>;
  items: RankingsListItem[];
  activeDragId: string | null;
  pinnedActiveTopPx: number | null;
  pinnedActivePlayer: RankedPlayer | null;
  getDisplayAdp: (playerId: string, fallback: number) => number;
  player2025Stats: Map<string, Player2025StatsEntry>;
  onPlayerClick: (player: RankedPlayer) => void;
};

export function RankingsVirtualSortableList({
  scrollRef,
  items,
  activeDragId,
  pinnedActiveTopPx,
  pinnedActivePlayer,
  getDisplayAdp,
  player2025Stats,
  onPlayerClick,
}: RankingsVirtualSortableListProps) {
  const gapIndex = activeDragId ? items.findIndex((item) => item.kind === 'gap') : -1;

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => RANKINGS_ROW_ESTIMATE_PX,
    overscan: 14,
    getItemKey: (index) => {
      const item = items[index];
      if (!item) return index;
      return item.kind === 'gap' ? `gap-${activeDragId}` : item.player.id;
    },
    rangeExtractor: (range) => {
      const next = new Set(defaultRangeExtractor(range));
      if (gapIndex >= 0) next.add(gapIndex);
      return [...next].sort((a, b) => a - b);
    },
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      style={{
        height: virtualizer.getTotalSize(),
        width: '100%',
        position: 'relative',
      }}
    >
      {pinnedActivePlayer != null && pinnedActiveTopPx != null ? (
        <PinnedActiveSortable
          player={pinnedActivePlayer}
          topPx={pinnedActiveTopPx}
          displayAdp={getDisplayAdp(pinnedActivePlayer.id, pinnedActivePlayer.adp)}
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
              measureElement={virtualizer.measureElement}
            />
          );
        }
        return (
          <VirtualSortableRow
            key={item.player.id}
            player={item.player}
            virtualRow={virtualRow}
            displayAdp={getDisplayAdp(item.player.id, item.player.adp)}
            stats2025={player2025Stats.get(item.player.id)}
            onPlayerClick={onPlayerClick}
            measureElement={virtualizer.measureElement}
          />
        );
      })}
    </div>
  );
}
