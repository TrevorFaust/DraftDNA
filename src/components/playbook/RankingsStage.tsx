import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { landingBoardSlice, type LandingPlayer, prefersReducedMotion } from '@/components/landing/landingBoard';
import { useOnScreen } from '@/components/landing/useOnScreen';

const ROWS = 14;
const SLICE = landingBoardSlice(1, ROWS);
const SLOTS = SLICE.map((player) => player.rank);

type Move = [from: number, to: number];

function shuffleIds(ids: number[]) {
  const next = [...ids];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

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

function BoardColumn({
  title,
  live,
  children,
}: {
  title: string;
  live?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col rounded-md border border-border/60 bg-secondary/30 px-2.5 py-2.5 sm:px-3">
      <h4 className="mb-2 flex shrink-0 items-center gap-2 border-b border-border pb-2 font-display text-sm tracking-wide text-foreground sm:text-base">
        {live ? <span className="landing-sim-dot" /> : null}
        {title}
      </h4>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

function PlayerRow({
  player,
  position,
  held,
  phase,
  adp,
}: {
  player: LandingPlayer;
  position: number;
  held?: boolean;
  phase?: Phase;
  adp?: boolean;
}) {
  return (
    <div
      className="rank-shuffle-row"
      data-hold={held ? phase : undefined}
      style={{ '--pos': position } as CSSProperties}
    >
      <span className="rank-shuffle-rank">{SLOTS[position]}</span>
      <span className="rank-shuffle-name">{player.name}</span>
      <span className="rank-shuffle-pos" data-pos={player.pos}>
        {player.pos}
      </span>
      {adp ? (
        <span className="rank-shuffle-team">ADP {player.rank}</span>
      ) : (
        <span className="rank-shuffle-team">{player.team}</span>
      )}
    </div>
  );
}

/** Consensus stays put. Your side picks a name up and drops it, then walks the moves back. */
export function RankingsStage() {
  const { ref, onScreen } = useOnScreen<HTMLDivElement>();
  const [{ order, held, phase }, setBoard] = useState({
    order: SLICE.map((_, i) => i),
    held: -1,
    phase: 'idle' as Phase,
  });

  useEffect(() => {
    if (!onScreen || prefersReducedMotion()) return;
    let cancelled = false;
    let pending: number[] = [];
    let move: Move = [0, 1];
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));

    const run = () => {
      if (cancelled) return;
      if (pending.length === 0) pending = shuffleIds(SLICE.map((_, index) => index));
      const player = pending.shift() ?? 0;

      setBoard((prev) => {
        const from = prev.order.indexOf(player);
        let to = Math.floor(Math.random() * (prev.order.length - 1));
        if (to >= from) to += 1;
        move = [from, to];
        return { ...prev, held: player, phase: 'lift' };
      });
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
    <div ref={ref} className="playbook-board playbook-rankings grid h-full min-h-0 content-stretch gap-3 overflow-hidden p-3 sm:grid-cols-2 sm:p-4" aria-hidden>
      <BoardColumn title="Consensus rankings">
        <div className="rank-shuffle h-full" style={{ '--rows': ROWS } as CSSProperties}>
          {SLICE.map((player, index) => (
            <PlayerRow key={player.name} player={player} position={index} />
          ))}
        </div>
      </BoardColumn>
      <BoardColumn title="My rankings" live>
        <div
          className="rank-shuffle h-full"
          data-busy={phase === 'idle' ? undefined : 'true'}
          style={{ '--rows': ROWS } as CSSProperties}
        >
          {SLICE.map((player, playerIndex) => (
            <PlayerRow
              key={player.name}
              player={player}
              position={order.indexOf(playerIndex)}
              held={playerIndex === held}
              phase={phase}
              adp
            />
          ))}
        </div>
      </BoardColumn>
    </div>
  );
}
