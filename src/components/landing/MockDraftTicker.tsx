import { useEffect, useState, type CSSProperties } from 'react';
import { LANDING_BOARD, pickLabel, prefersReducedMotion } from './landingBoard';
import { useOnScreen } from './useOnScreen';

const TEAMS = 12;
const WINDOW = 7;
/** How far down the board a CPU team will reach for its pick. */
const REACH = 5;

const DRAFT_FLASH_MS = 620;
const STEP_MS = 1600;
const FADE_MS = 650;

type Board = {
  /** Board indexes still available, best first. */
  queue: number[];
  /** The board index currently being taken off the board. */
  drafting: number | null;
  /** Zero-based overall pick. */
  pick: number;
  phase: 'live' | 'resetting';
};

const freshBoard = (): Board => ({
  queue: LANDING_BOARD.map((_, i) => i),
  drafting: null,
  pick: 0,
  phase: 'live',
});

/**
 * Decorative draft board. Each pick takes someone from the top five available, strikes
 * them off, and the rows below slide up as a new name rises into the window. When the
 * board runs dry the panel fades out and comes back at the top.
 */
export function MockDraftTicker() {
  const { ref, onScreen } = useOnScreen<HTMLDivElement>();
  const [board, setBoard] = useState<Board>(freshBoard);

  useEffect(() => {
    if (!onScreen || prefersReducedMotion()) return;
    let flash: number | undefined;

    const step = window.setInterval(() => {
      const roll = Math.random();
      setBoard((prev) => {
        if (prev.queue.length <= WINDOW) return { ...prev, phase: 'resetting' };
        const at = Math.floor(roll * Math.min(REACH, prev.queue.length));
        return { ...prev, drafting: prev.queue[at] };
      });
      flash = window.setTimeout(() => {
        setBoard((prev) => {
          if (prev.drafting === null) return prev;
          return {
            queue: prev.queue.filter((player) => player !== prev.drafting),
            drafting: null,
            pick: prev.pick + 1,
            phase: 'live',
          };
        });
      }, DRAFT_FLASH_MS);
    }, STEP_MS);

    return () => {
      window.clearInterval(step);
      if (flash) window.clearTimeout(flash);
    };
  }, [onScreen]);

  // Hold the faded-out state long enough to read as a reset, then refill the board.
  useEffect(() => {
    if (board.phase !== 'resetting') return;
    const restart = window.setTimeout(() => setBoard(freshBoard()), FADE_MS + 250);
    return () => window.clearTimeout(restart);
  }, [board.phase]);

  const visible = board.queue.slice(0, WINDOW);

  return (
    <div ref={ref} className="landing-sim is-left" data-phase={board.phase} aria-hidden>
      <p className="landing-sim-label">
        <span className="landing-sim-dot" />
        On the clock
        <span className="landing-sim-pick">{pickLabel(board.pick, TEAMS)}</span>
      </p>
      <div className="draft-queue" style={{ '--rows': WINDOW } as CSSProperties}>
        {visible.map((player, position) => (
          <div
            key={player}
            className="draft-queue-row"
            data-drafted={player === board.drafting ? 'true' : undefined}
            style={{ '--pos': position } as CSSProperties}
          >
            <span className="draft-queue-cell">
              <span className="draft-queue-rank">{LANDING_BOARD[player].rank}</span>
              <span className="draft-queue-name">{LANDING_BOARD[player].name}</span>
              <span className="draft-queue-pos" data-pos={LANDING_BOARD[player].pos}>
                {LANDING_BOARD[player].pos}
              </span>
              <span className="draft-queue-stamp">Drafted</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
