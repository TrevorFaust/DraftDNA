import { useEffect, useRef, useCallback } from 'react';
import { useDndContext } from '@dnd-kit/core';

const RAMP_UP_MS = 2000;
/** Hold near the edge ~1s before reaching full speed on long rankings lists. */
const FAST_RAMP_UP_MS = 1100;
const BASE_SPEED = 1;
const FAST_BASE_SPEED = 3;
const MAX_SPEED = 45;
const FAST_MAX_SPEED = 80;
const INTERVAL_MS = 8;

const EDGE_MIN_PX = 36;
const EDGE_MAX_PX = 72;
const FAST_EDGE_MAX_PX = 100;
const EDGE_FRAC_CAP = 0.08;
const FAST_EDGE_FRAC_CAP = 0.14;

/**
 * Inside the edge band (not past the container edge), depth never exceeds this —
 * enough to move ~20 spots quickly, not enough to zoom past a nearby target.
 */
const IN_BAND_DEPTH_CAP = 0.48;

export type ScrollEdgeOptions = { fast?: boolean };

export function edgeThresholdHeight(containerHeight: number, fast?: boolean): number {
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
  // Ease-in cubic: stays slow early, then accelerates toward the end of the hold.
  return t * t * t;
}

/**
 * How hard the user is pushing into the edge (0–1).
 * Past the container top/bottom line → 1 (full speed eligible).
 * Inside the band → ramps up with depth but caps below full speed.
 */
export function edgeZoneDepthFactor(
  pointerY: number,
  rect: { top: number; bottom: number },
  threshold: number,
  zone: 'top' | 'bottom'
): number {
  if (zone === 'bottom') {
    if (pointerY >= rect.bottom) return 1;
    const intoZone = (pointerY - (rect.bottom - threshold)) / threshold;
    const t = Math.max(0, Math.min(1, intoZone));
    return IN_BAND_DEPTH_CAP * t * t;
  }

  if (pointerY <= rect.top) return 1;
  const intoZone = (rect.top + threshold - pointerY) / threshold;
  const t = Math.max(0, Math.min(1, intoZone));
  return IN_BAND_DEPTH_CAP * t * t;
}

export function edgeScrollSpeed(
  elapsedMs: number,
  depthFactor: number,
  options?: ScrollEdgeOptions
): number {
  const fast = options?.fast ?? false;
  const rampUpMs = fast ? FAST_RAMP_UP_MS : RAMP_UP_MS;
  const baseSpeed = fast ? FAST_BASE_SPEED : BASE_SPEED;
  const maxSpeed = fast ? FAST_MAX_SPEED : MAX_SPEED;
  const timeFactor = rampFactorForElapsed(elapsedMs, rampUpMs);
  const depth = Math.max(0, Math.min(1, depthFactor));
  return baseSpeed + (maxSpeed - baseSpeed) * timeFactor * depth;
}

export type EdgeScrollZone = 'top' | 'bottom';

export function resolveEdgeScrollZone(
  pointerX: number,
  pointerY: number,
  rect: DOMRect,
  threshold: number
): EdgeScrollZone | null {
  const overColumn = pointerX >= rect.left && pointerX <= rect.right;
  if (!overColumn) return null;
  if (pointerY <= rect.top + threshold) return 'top';
  if (pointerY >= rect.bottom - threshold) return 'bottom';
  return null;
}

/**
 * Custom auto-scroll in a thin top/bottom band. Use `fast` on long rankings lists so edge
 * holds reach a higher top speed after ~1s instead of the default ~2s ramp.
 * Speed also scales with how far past the edge the pointer is.
 */
export function useRampUpAutoScroll(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options?: ScrollEdgeOptions
) {
  const fast = options?.fast ?? false;

  const { active } = useDndContext();
  const pointerRef = useRef({ x: 0, y: 0 });
  const enteredZoneAtRef = useRef<number | null>(null);
  const lastZoneRef = useRef<EdgeScrollZone | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || !active) return;

    const rect = el.getBoundingClientRect();
    const thresholdHeight = edgeThresholdHeight(rect.height, fast);
    const { x: px, y: py } = pointerRef.current;
    const zone = resolveEdgeScrollZone(px, py, rect, thresholdHeight);

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
    const depth = edgeZoneDepthFactor(py, rect, thresholdHeight, zone);
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
  }, [active, containerRef, fast]);

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
