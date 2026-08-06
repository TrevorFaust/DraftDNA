import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Distance from the bottom that still counts as "pinned".
 * Sized above a couple of draft-board pick rows so a new pick growing the
 * list does not unpin before the follow-scroll runs.
 */
export const DRAFT_BOARD_STICK_BOTTOM_PX = 160;

/**
 * Keep a scroll container pinned to the bottom while the user is near the end.
 * New items (via `itemCount`) scroll into view only when still stuck.
 */
export function useStickScrollToBottom(itemCount: number) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);
  const programmaticScrollRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [scrolledUp, setScrolledUp] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || itemCount === 0) return;
    if (!stickRef.current) return;

    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }

    programmaticScrollRef.current = true;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        const el = containerRef.current;
        if (!el || !stickRef.current) {
          programmaticScrollRef.current = false;
          rafRef.current = null;
          return;
        }
        el.scrollTop = el.scrollHeight;
        setScrolledUp(false);
        // Release after layout/scroll events from this write settle.
        requestAnimationFrame(() => {
          programmaticScrollRef.current = false;
        });
        rafRef.current = null;
      });
    });

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      programmaticScrollRef.current = false;
    };
  }, [itemCount]);

  const onScroll = useCallback(() => {
    if (programmaticScrollRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const isNearBottom = distanceFromBottom <= DRAFT_BOARD_STICK_BOTTOM_PX;
    stickRef.current = isNearBottom;
    setScrolledUp(!isNearBottom);
  }, []);

  return { containerRef, onScroll, scrolledUp };
}
