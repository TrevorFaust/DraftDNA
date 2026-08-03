import { useEffect, useRef, useCallback, type RefObject } from 'react';
import {
  type ScrollEdgeOptions,
  type EdgeScrollZone,
  edgeThresholdHeight,
  edgeScrollSpeed,
  edgeZoneDepthFactor,
  resolveEdgeScrollZone,
} from '@/hooks/useRampUpAutoScroll';

const INTERVAL_MS = 8;

/** Edge auto-scroll during custom (non-dnd-kit) rankings drags. */
export function useRankingsEdgeScrollWhileDragging(
  containerRef: RefObject<HTMLDivElement | null>,
  isDragging: boolean,
  pointerRef: RefObject<{ x: number; y: number } | null>,
  options?: ScrollEdgeOptions
) {
  const fast = options?.fast ?? false;
  const enteredZoneAtRef = useRef<number | null>(null);
  const lastZoneRef = useRef<EdgeScrollZone | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const pointer = pointerRef.current;
    if (!pointer) return;

    const rect = el.getBoundingClientRect();
    const thresholdHeight = edgeThresholdHeight(rect.height, fast);
    const zone = resolveEdgeScrollZone(pointer.x, pointer.y, rect, thresholdHeight);

    if (!zone) {
      enteredZoneAtRef.current = null;
      lastZoneRef.current = null;
      return;
    }

    if (lastZoneRef.current !== zone) {
      enteredZoneAtRef.current = null;
      lastZoneRef.current = zone;
    }

    const now = Date.now();
    if (enteredZoneAtRef.current === null) {
      enteredZoneAtRef.current = now;
    }
    const elapsed = now - enteredZoneAtRef.current;
    const depth = edgeZoneDepthFactor(pointer.y, rect, thresholdHeight, zone);
    const speed = edgeScrollSpeed(elapsed, depth, { fast });

    const canScrollUp = el.scrollTop > 0;
    const canScrollDown = el.scrollTop < el.scrollHeight - el.clientHeight - 1;

    if (zone === 'top' && canScrollUp) {
      el.scrollTop -= speed;
    } else if (zone === 'bottom' && canScrollDown) {
      el.scrollTop += speed;
    } else if (!canScrollUp || !canScrollDown) {
      enteredZoneAtRef.current = null;
    }
  }, [containerRef, fast, pointerRef]);

  useEffect(() => {
    if (!isDragging) {
      enteredZoneAtRef.current = null;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(scroll, INTERVAL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isDragging, scroll]);
}
