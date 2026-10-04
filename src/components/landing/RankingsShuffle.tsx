import { useEffect, useState, type CSSProperties } from 'react';
import { landingBoardSlice, prefersReducedMotion } from './landingBoard';
import { useOnScreen } from './useOnScreen';

const FIRST_RANK = 35;
const ROWS = 10;
const SLICE = landingBoardSlice(FIRST_RANK, ROWS);
/** Rank labels stay with the slot, so a player's number changes when they move. */
const SLOTS = SLICE.map((player) => player.rank);

/** Lift the player at `from` and drop them in at `to`, the way a drag re-rank lands. */
type Move = [from: number, to: number];

const FORWARD: Move[] = [
  [0, 2],
  [5, 3],
  [8, 6],
  [1, 4],
  [9, 7],
  [3, 0],
  [6, 9],
  [2, 5],
  [7, 4],
];

/**
 * The forward moves, then each one undone in reverse. Every player gets moved, no move
 * repeats inside a cycle, and the board is back in its starting order at the end — so
 * the loop runs forever without a jump.
 */
const MOVES: Move[] = [
  ...FORWARD,
  ...[...FORWARD].reverse().map(([from, to]): Move => [to, from]),
];

/** One move reads as pick up, carry, set down, pause. */
const LIFT_MS = 560;
const TRAVEL_MS = 900;
const DROP_MS = 380;
const PAUSE_MS = 560;

type Phase = 'idle' | 'lift' | 'travel' | 'drop';

function applyMove(order: number[], [from, to]: Move): number[] {
  const next = [...order];
  const [lifted] = next.splice(from, 1);
  next.splice(to, 0, lifted);
  return next;
}

/** Decorative rankings board: one player at a time is picked up and dropped in. */
export function RankingsShuffle() {
  const { ref, onScreen } = useOnScreen<HTMLDivElement>();
  const [{ order, held, phase }, setBoard] = useState({
    order: SLICE.map((_, i) => i),
    held: -1,
    phase: 'idle' as Phase,
  });

  useEffect(() => {
    if (!onScreen || prefersReducedMotion()) return;
    let step = 0;
    let cancelled = false;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));

    const run = () => {
      if (cancelled) return;
      const move = MOVES[step % MOVES.length];
      step += 1;

      setBoard((prev) => ({ ...prev, held: prev.order[move[0]], phase: 'lift' }));
      later(() => {
        setBoard((prev) => ({ ...prev, order: applyMove(prev.order, move), phase: 'travel' }));
        later(() => {
          setBoard((prev) => ({ ...prev, phase: 'drop' }));
          later(() => {
            setBoard((prev) => ({ ...prev, held: -1, phase: 'idle' }));
            later(run, PAUSE_MS);
          }, DROP_MS);
        }, TRAVEL_MS);
      }, LIFT_MS);
    };

    run();
    return () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
    };
  }, [onScreen]);

  return (
    <div ref={ref} className="landing-sim is-right" aria-hidden>
      <p className="landing-sim-label">
        <span className="landing-sim-dot" />
        Personal rankings
      </p>
      <div
        className="rank-shuffle"
        data-busy={phase === 'idle' ? undefined : 'true'}
        style={{ '--rows': ROWS } as CSSProperties}
      >
        {/*
          Rows render in a fixed order and only their --pos changes. Reordering the DOM
          instead would make React move the node, which cancels the transform transition
          and snaps the row into place.
        */}
        {SLICE.map((player, playerIndex) => {
          const position = order.indexOf(playerIndex);
          return (
            <div
              key={player.name}
              className="rank-shuffle-row"
              data-hold={playerIndex === held ? phase : undefined}
              style={{ '--pos': position } as CSSProperties}
            >
              <span className="rank-shuffle-rank">{SLOTS[position]}</span>
              <span className="rank-shuffle-name">{player.name}</span>
              <span className="rank-shuffle-team">{player.team}</span>
              <span className="rank-shuffle-pos" data-pos={player.pos}>
                {player.pos}
              </span>
              <span className="rank-shuffle-grip" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
