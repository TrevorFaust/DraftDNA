import { useEffect, useRef, useCallback } from 'react';
import { useDndContext } from '@dnd-kit/core';

const RAMP_UP_MS = 500;
const BASE_SPEED = 2;
const MAX_SPEED = 45;
const INTERVAL_MS = 8;
const THRESHOLD_Y = 0.35;

/**
 * Custom auto-scroll with time-based ramp-up: starts slow when entering
 * the scroll zone, then accelerates to max speed if held in position.
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
    const thresholdHeight = rect.height * THRESHOLD_Y;
    const py = pointerRef.current.y;

    const inTopZone = py <= rect.top + thresholdHeight;
    const inBottomZone = py >= rect.bottom - thresholdHeight;

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
    const rampFactor = Math.min(1, elapsed / RAMP_UP_MS);
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
