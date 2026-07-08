import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import type { RankedPlayer } from '@/types/database';
import type { CommunityRankTrend } from '@/utils/communityRankTrend';
import { RankingsDragRow } from '@/components/rankings/RankingsDragRow';
import {
  RankingsCompareScrollList,
  buildOrderFromDropSlot,
  computeDropSlotFromDom,
  COMPARE_DROP_INDICATOR_PX,
  gapTopForDropSlot,
  getCompareDropTargetRows,
  orderPlayersByPreviewIds,
  sameIdOrder,
} from '@/components/rankings/RankingsCompareScrollList';
import { useRankingsEdgeScrollWhileDragging } from '@/hooks/useRankingsEdgeScrollWhileDragging';

type Player2025StatsEntry = {
  avgPointsPerGame: number | null;
  gamesPlayed?: number;
  totalFantasyPoints?: number;
};

export type RankingsCompareDragPanelProps = {
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  bindScrollContainer: (node: HTMLDivElement | null) => void;
  players: RankedPlayer[];
  getDisplayAdp: (playerId: string, fallback: number) => number;
  getPlayerRankCardMeta: (playerId: string) => {
    communityPosRank: number | null;
    myPosRank: number | null;
    communityTrend: CommunityRankTrend | null;
  };
  player2025Stats: Map<string, Player2025StatsEntry>;
  onPlayerClick: (player: RankedPlayer) => void;
  onCommitPreview: (preview: string[], baseline: string[], activeId: string) => void;
  scrollClassName?: string;
};

/** Native-scroll list + lightweight pointer drag (no dnd-kit, no list reorder during drag). */
export function RankingsCompareDragPanel({
  scrollContainerRef,
  bindScrollContainer,
  players,
  getDisplayAdp,
  getPlayerRankCardMeta,
  player2025Stats,
  onPlayerClick,
  onCommitPreview,
  scrollClassName,
}: RankingsCompareDragPanelProps) {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overlayPlayer, setOverlayPlayer] = useState<RankedPlayer | null>(null);
  const [optimisticPreviewIds, setOptimisticPreviewIds] = useState<string[] | null>(null);

  const activeDragIdRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);
  const baselineRef = useRef<string[] | null>(null);
  const dropSlotRef = useRef(0);
  const originSlotRef = useRef(0);
  const lastDropSlotRef = useRef(-1);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const overlayOffsetRef = useRef({ x: 0, y: 0 });
  const overlayWidthRef = useRef<number | undefined>(undefined);
  const listRootRef = useRef<HTMLDivElement>(null);
  const gapRef = useRef<HTMLDivElement>(null);

  useRankingsEdgeScrollWhileDragging(scrollContainerRef, activeDragId != null, pointerRef, {
    fast: true,
  });

  useEffect(() => {
    activeDragIdRef.current = activeDragId;
  }, [activeDragId]);

  useEffect(() => {
    if (!optimisticPreviewIds) return;
    const sortedIds = [...players].sort((a, b) => a.rank - b.rank).map((p) => p.id);
    if (sameIdOrder(sortedIds, optimisticPreviewIds)) {
      setOptimisticPreviewIds(null);
    }
  }, [players, optimisticPreviewIds]);

  const displayPlayers = useMemo(() => {
    if (!optimisticPreviewIds) return players;
    return orderPlayersByPreviewIds(players, optimisticPreviewIds);
  }, [optimisticPreviewIds, players]);

  const getOverlayCenterY = useCallback((): number | null => {
    const overlay = overlayRef.current;
    if (!overlay) return pointerRef.current?.y ?? null;
    const rect = overlay.getBoundingClientRect();
    return rect.top + rect.height / 2;
  }, []);

  const updateGapIndicator = useCallback((slot: number) => {
    const listRoot = listRootRef.current;
    const gapEl = gapRef.current;
    if (!listRoot || !gapEl) return;

    if (slot === originSlotRef.current) {
      gapEl.style.opacity = '0';
      return;
    }

    const rowEls = getCompareDropTargetRows(listRoot);
    const top = gapTopForDropSlot(rowEls, listRoot, slot, COMPARE_DROP_INDICATOR_PX);

    gapEl.style.opacity = '1';
    gapEl.style.transform = `translate3d(0, ${top}px, 0)`;
  }, []);

  const applyDropSlot = useCallback(
    (slot: number) => {
      if (slot === lastDropSlotRef.current) return;
      lastDropSlotRef.current = slot;
      dropSlotRef.current = slot;
      updateGapIndicator(slot);
    },
    [updateGapIndicator]
  );

  const syncDropSlotFromPointer = useCallback(() => {
    const listRoot = listRootRef.current;
    const dropCenterY = getOverlayCenterY();
    if (!listRoot || dropCenterY == null) return;
    applyDropSlot(computeDropSlotFromDom(listRoot, dropCenterY));
  }, [applyDropSlot, getOverlayCenterY]);

  const positionOverlay = useCallback((clientX: number, clientY: number) => {
    const el = overlayRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${clientX - overlayOffsetRef.current.x}px, ${clientY - overlayOffsetRef.current.y}px, 0)`;
  }, []);

  const hideGapIndicator = useCallback(() => {
    const gapEl = gapRef.current;
    if (!gapEl) return;
    gapEl.style.opacity = '0';
  }, []);

  const clearDrag = useCallback(() => {
    isDraggingRef.current = false;
    baselineRef.current = null;
    dropSlotRef.current = 0;
    originSlotRef.current = 0;
    lastDropSlotRef.current = -1;
    pointerRef.current = null;
    hideGapIndicator();
    setActiveDragId(null);
    setOverlayPlayer(null);
  }, [hideGapIndicator]);

  const handleHandlePointerDown = useCallback(
    (player: RankedPlayer, event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      const scrollEl = scrollContainerRef.current;
      if (!scrollEl) return;

      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);

      const rowEl = handle.closest('[data-rankings-drag-row]') as HTMLElement | null;
      const rowRect = rowEl?.getBoundingClientRect();
      if (!rowRect) return;

      const ids = players.map((p) => p.id);
      const startSlot = ids.indexOf(player.id);

      isDraggingRef.current = true;
      baselineRef.current = ids;
      originSlotRef.current = Math.max(0, startSlot);
      dropSlotRef.current = originSlotRef.current;
      lastDropSlotRef.current = -1;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      overlayWidthRef.current = rowRect.width;
      overlayOffsetRef.current = {
        x: event.clientX - rowRect.left,
        y: event.clientY - rowRect.top,
      };

      setOverlayPlayer(player);
      setActiveDragId(player.id);

      requestAnimationFrame(() => {
        positionOverlay(event.clientX, event.clientY);
        syncDropSlotFromPointer();
      });
    },
    [players, positionOverlay, scrollContainerRef, syncDropSlotFromPointer]
  );

  useEffect(() => {
    if (!overlayPlayer) return;
    const pointer = pointerRef.current;
    if (pointer) positionOverlay(pointer.x, pointer.y);
  }, [overlayPlayer, positionOverlay]);

  useEffect(() => {
    if (!activeDragId) return;

    let rafId: number | null = null;

    const flushPointerFrame = () => {
      rafId = null;
      syncDropSlotFromPointer();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isDraggingRef.current) return;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      positionOverlay(event.clientX, event.clientY);
      if (rafId == null) {
        rafId = requestAnimationFrame(flushPointerFrame);
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!isDraggingRef.current) return;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      positionOverlay(event.clientX, event.clientY);
      syncDropSlotFromPointer();

      const draggedId = activeDragIdRef.current;
      const baseline = baselineRef.current;
      const preview = baseline && draggedId
        ? buildOrderFromDropSlot(baseline, draggedId, dropSlotRef.current)
        : null;

      if (preview && baseline && draggedId && !sameIdOrder(preview, baseline)) {
        flushSync(() => {
          setOptimisticPreviewIds(preview);
          isDraggingRef.current = false;
          baselineRef.current = null;
          dropSlotRef.current = 0;
          originSlotRef.current = 0;
          lastDropSlotRef.current = -1;
          pointerRef.current = null;
          hideGapIndicator();
          setActiveDragId(null);
          setOverlayPlayer(null);
        });
        queueMicrotask(() => onCommitPreview(preview, baseline, draggedId));
        return;
      }

      clearDrag();
    };

    const scrollEl = scrollContainerRef.current;

    const onScroll = () => {
      if (!isDraggingRef.current) return;
      syncDropSlotFromPointer();
    };

    if (scrollEl) {
      scrollEl.addEventListener('scroll', onScroll, { passive: true });
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      if (scrollEl) scrollEl.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [
    activeDragId,
    clearDrag,
    hideGapIndicator,
    onCommitPreview,
    positionOverlay,
    syncDropSlotFromPointer,
    scrollContainerRef,
  ]);

  return (
    <>
      <div
        ref={bindScrollContainer}
        className={scrollClassName}
        style={{ touchAction: 'pan-y' }}
      >
        <div ref={listRootRef} className="relative" data-rankings-compare-list>
          <RankingsCompareScrollList
            players={displayPlayers}
            activeDragId={activeDragId}
            getDisplayAdp={getDisplayAdp}
            getPlayerRankCardMeta={getPlayerRankCardMeta}
            player2025Stats={player2025Stats}
            onPlayerClick={onPlayerClick}
            onHandlePointerDown={handleHandlePointerDown}
          />
          <div
            ref={gapRef}
            aria-hidden
            className="absolute left-0 right-0 top-0 z-[2] pointer-events-none opacity-0 will-change-transform px-2"
          >
            <div
              className="rounded-full border-2 border-dashed border-primary bg-primary/25 shadow-[0_0_8px_rgba(var(--primary),0.35)]"
              style={{ height: COMPARE_DROP_INDICATOR_PX }}
            />
          </div>
        </div>
      </div>
      {overlayPlayer ? (
        <div
          ref={overlayRef}
          className="fixed left-0 top-0 z-[9999] pointer-events-none will-change-transform"
          style={{
            width: overlayWidthRef.current,
            boxSizing: 'border-box',
          }}
        >
          <RankingsDragRow
            player={overlayPlayer}
            rank={overlayPlayer.rank}
            displayAdp={getDisplayAdp(overlayPlayer.id, overlayPlayer.adp)}
            {...getPlayerRankCardMeta(overlayPlayer.id)}
            stats2025={player2025Stats.get(overlayPlayer.id)}
            isOverlay
          />
        </div>
      ) : null}
    </>
  );
}
