import { useEffect, useRef, useCallback, type RefObject } from 'react';
import { type ScrollEdgeOptions, edgeThresholdHeight } from '@/hooks/useRampUpAutoScroll';

const RAMP_UP_MS = 180;
const BASE_SPEED = 14;
const MAX_SPEED = 80;
const INTERVAL_MS = 8;

function rampFactorForElapsed(elapsedMs: number, rampUpMs: number): number {
  const t = Math.min(1, elapsedMs / rampUpMs);
  return t * t;
}

/** Edge auto-scroll during custom (non-dnd-kit) rankings drags. */
export function useRankingsEdgeScrollWhileDragging(
  containerRef: RefObject<HTMLDivElement | null>,
  isDragging: boolean,
  pointerRef: RefObject<{ x: number; y: number } | null>,
  options?: ScrollEdgeOptions
) {
  const fast = options?.fast ?? false;
  const enteredZoneAtRef = useRef<number | null>(null);
  const lastZoneRef = useRef<'top' | 'bottom' | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const pointer = pointerRef.current;
    if (!pointer) return;

    const rect = el.getBoundingClientRect();
    const thresholdHeight = edgeThresholdHeight(rect.height, fast);
    const { x: px, y: py } = pointer;
    const overColumn = px >= rect.left && px <= rect.right;

    const inTopZone = overColumn && py <= rect.top + thresholdHeight;
    const inBottomZone = overColumn && py >= rect.bottom - thresholdHeight;

    if (!inTopZone && !inBottomZone) {
      enteredZoneAtRef.current = null;
      lastZoneRef.current = null;
      return;
    }

    const currentZone: 'top' | 'bottom' = inTopZone ? 'top' : 'bottom';
    if (lastZoneRef.current !== currentZone) {
      enteredZoneAtRef.current = null;
      lastZoneRef.current = currentZone;
    }

    const now = Date.now();
    if (enteredZoneAtRef.current === null) {
      enteredZoneAtRef.current = now;
    }
    const elapsed = now - enteredZoneAtRef.current;
    const rampFactor = rampFactorForElapsed(elapsed, RAMP_UP_MS);
    const speed = BASE_SPEED + (MAX_SPEED - BASE_SPEED) * rampFactor;

    const canScrollUp = el.scrollTop > 0;
    const canScrollDown = el.scrollTop < el.scrollHeight - el.clientHeight - 1;

    if (inTopZone && canScrollUp) {
      el.scrollTop -= speed;
    } else if (inBottomZone && canScrollDown) {
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
