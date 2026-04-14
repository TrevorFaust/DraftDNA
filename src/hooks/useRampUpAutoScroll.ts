import { useEffect, useRef, useCallback } from 'react';
import { useDndContext } from '@dnd-kit/core';

/** Time held in the edge zone before reaching {@link MAX_SPEED} (ms). */
const RAMP_UP_MS = 2000;
const BASE_SPEED = 1;
const MAX_SPEED = 45;
const INTERVAL_MS = 8;

/**
 * Auto-scroll only in a thin band at the top/bottom (~one player card), not a large
 * fraction of the viewport — avoids scrolling when nudging a row up/down by one slot.
 */
const EDGE_MIN_PX = 36;
const EDGE_MAX_PX = 72;
const EDGE_FRAC_CAP = 0.08;

function edgeThresholdHeight(containerHeight: number): number {
  const fromFrac = containerHeight * EDGE_FRAC_CAP;
  return Math.max(EDGE_MIN_PX, Math.min(EDGE_MAX_PX, fromFrac));
}

/**
 * Ease-in cubic: keeps scroll gentle for most of the ramp; only approaches
 * max speed near the end of {@link RAMP_UP_MS} so short edge hovers don't overshoot.
 */
function rampFactorForElapsed(elapsedMs: number): number {
  const t = Math.min(1, elapsedMs / RAMP_UP_MS);
  return t * t * t;
}

/**
 * Custom auto-scroll: only the top/bottom ~36–72px strip (and pointer over the list)
 * counts as the scroll zone; ramp-up stays slow then reaches max after ~2s held there.
 */
export function useRampUpAutoScroll(containerRef: React.RefObject<HTMLDivElement | null>) {
  const { active } = useDndContext();
  const pointerRef = useRef({ x: 0, y: 0 });
  const enteredZoneAtRef = useRef<number | null>(null);
  const lastZoneRef = useRef<'top' | 'bottom' | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || !active) return;

    const rect = el.getBoundingClientRect();
    const thresholdHeight = edgeThresholdHeight(rect.height);
    const { x: px, y: py } = pointerRef.current;
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
    const rampFactor = rampFactorForElapsed(elapsed);
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
  }, [active, containerRef]);

  useEffect(() => {
    if (!active) {
      enteredZoneAtRef.current = null;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const onPointerMove = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY };
    };

    document.addEventListener('pointermove', onPointerMove, { passive: true });
    intervalRef.current = setInterval(scroll, INTERVAL_MS);

    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active, scroll]);
}
