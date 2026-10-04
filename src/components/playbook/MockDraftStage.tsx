import { useEffect, useState, type CSSProperties } from 'react';
import { LANDING_BOARD, pickLabel, prefersReducedMotion, type LandingPlayer } from '@/components/landing/landingBoard';
import { useOnScreen } from '@/components/landing/useOnScreen';

const TEAMS = 12;
const USER_TEAM = 6;
const AVAILABLE_ROWS = 14;
const DRAFTED_ROWS = 14;
const USER_PICKS_DONE = 5;
const REACH = 5;

const DRAFT_FLASH_MS = 520;
const STEP_MS = 1200;
const FADE_MS = 650;

/** Names past the landing board so a mid-draft still has a full available list. */
const EXTRA: LandingPlayer[] = [
  { rank: 60, name: 'Amon-Ra St. Brown', pos: 'WR', team: 'DET' },
  { rank: 61, name: 'Brian Thomas Jr.', pos: 'WR', team: 'JAX' },
  { rank: 62, name: 'Marvin Harrison Jr.', pos: 'WR', team: 'ARI' },
  { rank: 63, name: 'Mike Evans', pos: 'WR', team: 'TB' },
  { rank: 64, name: 'Courtland Sutton', pos: 'WR', team: 'DEN' },
  { rank: 65, name: 'DK Metcalf', pos: 'WR', team: 'PIT' },
  { rank: 66, name: 'Rome Odunze', pos: 'WR', team: 'CHI' },
  { rank: 67, name: 'Xavier Worthy', pos: 'WR', team: 'KC' },
  { rank: 68, name: 'Ricky Pearsall', pos: 'WR', team: 'SF' },
  { rank: 69, name: 'Jakobi Meyers', pos: 'WR', team: 'LV' },
  { rank: 70, name: 'Josh Jacobs', pos: 'RB', team: 'GB' },
  { rank: 71, name: 'Alvin Kamara', pos: 'RB', team: 'NO' },
  { rank: 72, name: 'Aaron Jones', pos: 'RB', team: 'MIN' },
  { rank: 73, name: 'James Conner', pos: 'RB', team: 'ARI' },
  { rank: 74, name: 'Chuba Hubbard', pos: 'RB', team: 'CAR' },
  { rank: 75, name: 'Isiah Pacheco', pos: 'RB', team: 'KC' },
  { rank: 76, name: 'Sam LaPorta', pos: 'TE', team: 'DET' },
  { rank: 77, name: 'George Kittle', pos: 'TE', team: 'SF' },
  { rank: 78, name: 'Mark Andrews', pos: 'TE', team: 'BAL' },
  { rank: 79, name: 'Tucker Kraft', pos: 'TE', team: 'GB' },
  { rank: 80, name: 'Dalton Kincaid', pos: 'TE', team: 'BUF' },
  { rank: 81, name: 'Patrick Mahomes', pos: 'QB', team: 'KC' },
  { rank: 82, name: 'Justin Herbert', pos: 'QB', team: 'LAC' },
  { rank: 83, name: 'Bo Nix', pos: 'QB', team: 'DEN' },
  { rank: 84, name: 'Baker Mayfield', pos: 'QB', team: 'TB' },
  { rank: 85, name: 'Jordan Love', pos: 'QB', team: 'GB' },
  { rank: 86, name: 'C.J. Stroud', pos: 'QB', team: 'HOU' },
];

const POOL: LandingPlayer[] = [...LANDING_BOARD, ...EXTRA];

const STARTER_SLOTS: { label: string; positions: LandingPlayer['pos'][] }[] = [
  { label: 'QB', positions: ['QB'] },
  { label: 'RB1', positions: ['RB'] },
  { label: 'RB2', positions: ['RB'] },
  { label: 'WR1', positions: ['WR'] },
  { label: 'WR2', positions: ['WR'] },
  { label: 'TE', positions: ['TE'] },
  { label: 'FLEX', positions: ['RB', 'WR', 'TE'] },
  { label: 'FLEX', positions: ['RB', 'WR', 'TE'] },
  { label: 'DEF', positions: [] },
  { label: 'K', positions: [] },
];

type Taken = { player: number; pickIndex: number };

type Board = {
  queue: number[];
  drafting: number | null;
  /** Completed picks. The next pick is this index. */
  pick: number;
  phase: 'live' | 'resetting';
  taken: Taken[];
};

/** 0-based overall pick → 1-based team in a 12-team snake. */
function teamOnClock(pickIndex: number) {
  const round = Math.floor(pickIndex / TEAMS);
  const index = pickIndex % TEAMS;
  return round % 2 === 0 ? index + 1 : TEAMS - index;
}

/** Pick indexes for team 6: 6th pick, then +13, +11, repeating. */
function userPickIndexes(count: number) {
  const picks: number[] = [];
  let pick = USER_TEAM - 1;
  while (picks.length < count) {
    picks.push(pick);
    const round = Math.floor(pick / TEAMS);
    pick += round % 2 === 0 ? 13 : 11;
  }
  return picks;
}

const OPENING_PICK = userPickIndexes(USER_PICKS_DONE).at(-1)! + 1;

function openingBoard(): Board {
  const queue = POOL.map((_, index) => index);
  const taken: Taken[] = [];
  for (let pick = 0; pick < OPENING_PICK; pick += 1) {
    const span = Math.min(REACH, queue.length);
    const at = Math.floor(Math.random() * span);
    const [player] = queue.splice(at, 1);
    taken.push({ player, pickIndex: pick });
  }
  return { queue, drafting: null, pick: OPENING_PICK, phase: 'live', taken };
}

function lineUp(mine: Taken[]) {
  const used = new Set<number>();
  return STARTER_SLOTS.map((slot) => {
    const pick = mine.find((candidate) => {
      if (used.has(candidate.pickIndex)) return false;
      return slot.positions.includes(POOL[candidate.player].pos);
    });
    if (pick) used.add(pick.pickIndex);
    return { slot, pick: pick ?? null };
  });
}

function PosChip({ pos }: { pos: string }) {
  return (
    <span className="draft-queue-pos" data-pos={pos}>
      {pos}
    </span>
  );
}

/** Dropped into round 5 from pick 6. Starters, the board, and the draft log are already full. */
export function MockDraftStage() {
  const { ref, onScreen } = useOnScreen<HTMLDivElement>();
  const [board, setBoard] = useState<Board>(openingBoard);

  useEffect(() => {
    if (!onScreen || prefersReducedMotion()) return;
    let flash: number | undefined;

    const step = window.setInterval(() => {
      const roll = Math.random();
      setBoard((prev) => {
        if (prev.phase === 'resetting') return prev;
        if (prev.queue.length <= AVAILABLE_ROWS) {
          return { ...prev, phase: 'resetting' };
        }
        const at = Math.floor(roll * Math.min(REACH, prev.queue.length));
        return { ...prev, drafting: prev.queue[at] };
      });
      flash = window.setTimeout(() => {
        setBoard((prev) => {
          if (prev.drafting === null) return prev;
          const taken = [...prev.taken, { player: prev.drafting, pickIndex: prev.pick }];
          const pick = prev.pick + 1;
          return {
            queue: prev.queue.filter((player) => player !== prev.drafting),
            drafting: null,
            pick,
            phase: pick >= POOL.length || prev.queue.length - 1 <= AVAILABLE_ROWS ? 'resetting' : 'live',
            taken,
          };
        });
      }, DRAFT_FLASH_MS);
    }, STEP_MS);

    return () => {
      window.clearInterval(step);
      if (flash) window.clearTimeout(flash);
    };
  }, [onScreen]);

  useEffect(() => {
    if (board.phase !== 'resetting') return;
    const restart = window.setTimeout(() => setBoard(openingBoard()), FADE_MS + 250);
    return () => window.clearTimeout(restart);
  }, [board.phase]);

  const visible = board.queue.slice(0, AVAILABLE_ROWS);
  const mine = board.taken.filter((pick) => teamOnClock(pick.pickIndex) === USER_TEAM);
  const lineup = lineUp(mine);
  const placed = new Set(lineup.flatMap(({ pick }) => (pick ? [pick.pickIndex] : [])));
  const bench = mine.filter((pick) => !placed.has(pick.pickIndex));
  const recent = board.taken.slice(-DRAFTED_ROWS);
  const yours = teamOnClock(board.pick) === USER_TEAM;
  const newest = board.pick - 1;

  return (
    <div ref={ref} className="playbook-board playbook-mock flex h-full min-h-0 flex-col gap-2 p-3 sm:p-4" aria-hidden>
      <p className="flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
        <span className="landing-sim-dot" />
        On the clock
        <span className="ml-auto font-medium tabular-nums tracking-normal text-muted-foreground">
          {pickLabel(board.pick, TEAMS)}
          {yours ? <span className="ml-2 normal-case text-primary">You</span> : null}
        </span>
      </p>
      <div
        className="grid min-h-0 flex-1 grid-cols-3 gap-2"
        data-phase={board.phase}
        style={{ opacity: board.phase === 'resetting' ? 0 : 1, transition: 'opacity 650ms ease' }}
      >
        <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border/60 bg-secondary/30 px-2 py-2">
          <h4 className="shrink-0 border-b border-border pb-1.5 font-display text-sm tracking-wide">My team</h4>
          <p className="shrink-0 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Starters</p>
          <ul className="flex min-h-0 flex-1 flex-col">
            {lineup.map(({ slot, pick }, index) => {
              const player = pick ? POOL[pick.player] : null;
              const round = pick ? Math.floor(pick.pickIndex / TEAMS) + 1 : 0;
              return (
                <li
                  key={`${slot.label}-${index}`}
                  className="flex min-h-0 flex-1 items-center gap-1 border-b border-border/40 text-xs last:border-b-0"
                >
                  <span className="w-8 shrink-0 text-[11px] font-semibold uppercase text-muted-foreground">{slot.label}</span>
                  {player ? (
                    <>
                      <span className="min-w-0 flex-1 truncate font-medium">{player.name}</span>
                      <span className="shrink-0 rounded bg-primary/20 px-1 py-0.5 text-[10px] font-medium text-primary">
                        Rd {round}
                      </span>
                      <PosChip pos={player.pos} />
                      <span className="w-7 shrink-0 text-right text-[11px] text-muted-foreground">{player.team}</span>
                    </>
                  ) : (
                    <span className="italic text-muted-foreground/50">Empty</span>
                  )}
                </li>
              );
            })}
          </ul>
          {bench.length > 0 ? (
            <div className="shrink-0 border-t border-border/60 pt-1">
              <p className="py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Bench</p>
              <ul>
                {bench.map((pick) => {
                  const player = POOL[pick.player];
                  const round = Math.floor(pick.pickIndex / TEAMS) + 1;
                  return (
                    <li key={pick.pickIndex} className="flex items-center gap-1 py-0.5 text-xs">
                      <span className="w-8 shrink-0 text-[11px] font-semibold uppercase text-muted-foreground">BN</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{player.name}</span>
                      <span className="shrink-0 rounded bg-primary/20 px-1 py-0.5 text-[10px] font-medium text-primary">
                        Rd {round}
                      </span>
                      <PosChip pos={player.pos} />
                      <span className="w-7 shrink-0 text-right text-[11px] text-muted-foreground">{player.team}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border/60 bg-secondary/30 px-2 py-2">
          <h4 className="mb-1.5 shrink-0 border-b border-border pb-1.5 font-display text-sm tracking-wide">Available</h4>
          <div className="draft-queue" style={{ '--rows': AVAILABLE_ROWS } as CSSProperties}>
            {visible.map((player, position) => (
              <div
                key={player}
                className="draft-queue-row"
                data-drafted={player === board.drafting ? 'true' : undefined}
                style={{ '--pos': position } as CSSProperties}
              >
                <span className="draft-queue-cell">
                  <span className="draft-queue-rank">{POOL[player].rank}</span>
                  <span className="draft-queue-name">{POOL[player].name}</span>
                  <PosChip pos={POOL[player].pos} />
                  <span className="draft-queue-stamp">Drafted</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border/60 bg-secondary/30 px-2 py-2">
          <h4 className="mb-1.5 shrink-0 border-b border-border pb-1.5 font-display text-sm tracking-wide">Drafted</h4>
          <ul className="draft-log" style={{ '--rows': DRAFTED_ROWS } as CSSProperties}>
            {recent.map((pick) => {
              const player = POOL[pick.player];
              const team = teamOnClock(pick.pickIndex);
              const isYou = team === USER_TEAM;
              return (
                <li
                  key={pick.pickIndex}
                  data-fresh={pick.pickIndex === newest ? 'true' : undefined}
                  className={
                    isYou
                      ? 'draft-log-row gap-1 rounded-sm bg-primary/10 px-1 text-xs'
                      : 'draft-log-row gap-1 px-1 text-xs'
                  }
                >
                  <span className="w-8 shrink-0 tabular-nums text-muted-foreground">
                    {pickLabel(pick.pickIndex, TEAMS)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {isYou ? <span className="mr-1 text-[10px] font-semibold uppercase text-primary">You</span> : null}
                    {player.name}
                  </span>
                  <PosChip pos={player.pos} />
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
