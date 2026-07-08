import { useEffect, useRef, useCallback } from 'react';
import { useDndContext } from '@dnd-kit/core';

const RAMP_UP_MS = 2000;
const FAST_RAMP_UP_MS = 180;
const BASE_SPEED = 1;
const FAST_BASE_SPEED = 14;
const MAX_SPEED = 45;
const FAST_MAX_SPEED = 80;
const INTERVAL_MS = 8;

const EDGE_MIN_PX = 36;
const EDGE_MAX_PX = 72;
const FAST_EDGE_MAX_PX = 100;
const EDGE_FRAC_CAP = 0.08;
const FAST_EDGE_FRAC_CAP = 0.14;

export type ScrollEdgeOptions = { fast?: boolean };

function edgeThresholdHeight(containerHeight: number, fast?: boolean): number {
  const maxPx = fast ? FAST_EDGE_MAX_PX : EDGE_MAX_PX;
  const fracCap = fast ? FAST_EDGE_FRAC_CAP : EDGE_FRAC_CAP;
  const fromFrac = containerHeight * fracCap;
  return Math.max(EDGE_MIN_PX, Math.min(maxPx, fromFrac));
}

/** True when pointer is in the top/bottom scroll band of a scroll container. */
export function isPointerInScrollEdgeZone(
  pointerX: number,
  pointerY: number,
  containerEl: HTMLElement | null,
  options?: ScrollEdgeOptions
): boolean {
  if (!containerEl) return false;
  const rect = containerEl.getBoundingClientRect();
  if (pointerX < rect.left || pointerX > rect.right) return false;
  const threshold = edgeThresholdHeight(rect.height, options?.fast);
  return pointerY <= rect.top + threshold || pointerY >= rect.bottom - threshold;
}

export function isPointerInAnyScrollEdgeZone(
  pointerX: number,
  pointerY: number,
  containers: readonly (HTMLElement | null)[],
  options?: ScrollEdgeOptions
): boolean {
  return containers.some((el) => isPointerInScrollEdgeZone(pointerX, pointerY, el, options));
}

function rampFactorForElapsed(elapsedMs: number, rampUpMs: number): number {
  const t = Math.min(1, elapsedMs / rampUpMs);
  return t * t;
}

/**
 * Custom auto-scroll in a thin top/bottom band. Use `fast` on long rankings lists so edge
 * holds ramp to full speed quickly instead of waiting ~2s.
 */
export function useRampUpAutoScroll(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options?: ScrollEdgeOptions
) {
  const fast = options?.fast ?? false;
  const rampUpMs = fast ? FAST_RAMP_UP_MS : RAMP_UP_MS;
  const baseSpeed = fast ? FAST_BASE_SPEED : BASE_SPEED;
  const maxSpeed = fast ? FAST_MAX_SPEED : MAX_SPEED;

  const { active } = useDndContext();
  const pointerRef = useRef({ x: 0, y: 0 });
  const enteredZoneAtRef = useRef<number | null>(null);
  const lastZoneRef = useRef<'top' | 'bottom' | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || !active) return;

    const rect = el.getBoundingClientRect();
    const thresholdHeight = edgeThresholdHeight(rect.height, fast);
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
    const rampFactor = rampFactorForElapsed(elapsed, rampUpMs);
    const speed = baseSpeed + (maxSpeed - baseSpeed) * rampFactor;

    const canScrollUp = el.scrollTop > 0;
    const canScrollDown = el.scrollTop < el.scrollHeight - el.clientHeight - 1;

    if (inTopZone && canScrollUp) {
      el.scrollTop -= speed;
    } else if (inBottomZone && canScrollDown) {
      el.scrollTop += speed;
    } else if (!canScrollUp || !canScrollDown) {
      enteredZoneAtRef.current = null;
    }
  }, [active, containerRef, baseSpeed, fast, maxSpeed, rampUpMs]);

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
