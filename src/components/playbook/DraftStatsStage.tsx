import { useEffect, useState, type CSSProperties } from 'react';
import { prefersReducedMotion } from '@/components/landing/landingBoard';
import { getTeamJerseyImageUrl } from '@/constants/teamJerseyAssets';

const HOLD_MS = 3400;
const ROLL_MS = 620;

type BarPlayer = { name: string; full: string; pos: string; count: number; team?: string };

type BarsFrame = {
  title: string;
  note: string;
  round: string;
  position: string;
  tone: 'fave' | 'fade';
  players: BarPlayer[];
};

type FadeName = { name: string; full: string; team: string; pos: string };

const FAVES_ALL: BarsFrame = {
  title: 'Draft faves',
  note: '(most drafted players)',
  round: 'All rounds',
  position: 'All positions',
  tone: 'fave',
  players: [
    { name: 'Gibbs', full: 'Jahmyr Gibbs', team: 'DET', pos: 'RB', count: 9 },
    { name: 'Robinson', full: 'Bijan Robinson', team: 'ATL', pos: 'RB', count: 8 },
    { name: 'Chase', full: "Ja'Marr Chase", team: 'CIN', pos: 'WR', count: 7 },
    { name: 'Nacua', full: 'Puka Nacua', team: 'LAR', pos: 'WR', count: 6 },
    { name: 'Taylor', full: 'Jonathan Taylor', team: 'IND', pos: 'RB', count: 5 },
    { name: 'Lamb', full: 'CeeDee Lamb', team: 'DAL', pos: 'WR', count: 4 },
  ],
};

const FADE_POOL: FadeName[] = [
  { name: 'Collins', full: 'Nico Collins', team: 'HOU', pos: 'WR' },
  { name: 'Pickens', full: 'George Pickens', team: 'DAL', pos: 'WR' },
  { name: 'Achane', full: "De'Von Achane", team: 'MIA', pos: 'RB' },
  { name: 'Hampton', full: 'Omarion Hampton', team: 'LAC', pos: 'RB' },
  { name: 'Loveland', full: 'Colston Loveland', team: 'CHI', pos: 'TE' },
  { name: 'Egbuka', full: 'Emeka Egbuka', team: 'TB', pos: 'WR' },
  { name: 'McMillan', full: 'Tetairoa McMillan', team: 'CAR', pos: 'WR' },
  { name: 'Etienne', full: 'Travis Etienne Jr.', team: 'NO', pos: 'RB' },
  { name: 'Williams', full: 'Jameson Williams', team: 'DET', pos: 'WR' },
  { name: 'Waddle', full: 'Jaylen Waddle', team: 'DEN', pos: 'WR' },
  { name: 'Higgins', full: 'Tee Higgins', team: 'CIN', pos: 'WR' },
  { name: 'Maye', full: 'Drake Maye', team: 'NE', pos: 'QB' },
  { name: 'Burrow', full: 'Joe Burrow', team: 'CIN', pos: 'QB' },
  { name: 'Hurts', full: 'Jalen Hurts', team: 'PHI', pos: 'QB' },
  { name: 'Montgomery', full: 'David Montgomery', team: 'HOU', pos: 'RB' },
  { name: 'Judkins', full: 'Quinshon Judkins', team: 'CLE', pos: 'RB' },
  { name: 'Odunze', full: 'Rome Odunze', team: 'CHI', pos: 'WR' },
  { name: 'Price', full: 'Jadarian Price', team: 'SEA', pos: 'RB' },
  { name: 'Harrison', full: 'Marvin Harrison Jr.', team: 'ARI', pos: 'WR' },
  { name: 'Dowdle', full: 'Rico Dowdle', team: 'PIT', pos: 'RB' },
  { name: 'Tate', full: 'Carnell Tate', team: 'TEN', pos: 'WR' },
  { name: 'Dobbins', full: 'J.K. Dobbins', team: 'DEN', pos: 'RB' },
  { name: 'Johnston', full: 'Quentin Johnston', team: 'LAC', pos: 'WR' },
  { name: 'Pierce', full: 'Alec Pierce', team: 'IND', pos: 'WR' },
  { name: 'Brooks', full: 'Jonathon Brooks', team: 'CAR', pos: 'RB' },
  { name: 'Pitts', full: 'Kyle Pitts Sr.', team: 'ATL', pos: 'TE' },
  { name: 'Croskey-Merritt', full: 'Jacory Croskey-Merritt', team: 'WAS', pos: 'RB' },
];

const AVOID = [78, 71, 64, 58, 51, 44];

const STUD_NAMES = [
  'Drake London',
  'Chase Brown',
  'Jameson Williams',
  'Trey McBride',
  'Rome Odunze',
  'Jaylen Waddle',
  'George Pickens',
  'Brock Bowers',
  'DJ Moore',
  'Zay Flowers',
];

const DUD_NAMES = [
  'Derrick Henry',
  'Saquon Barkley',
  'A.J. Brown',
  'Josh Allen',
  'Tee Higgins',
  'DK Metcalf',
  'Breece Hall',
  'Marvin Harrison Jr.',
  'Travis Kelce',
  'Kyren Williams',
];

type DiffRow = { name: string; diff: string; mine: number; crowd: number; gap: number };

/** 1 through 30. Both ranks stay inside the top 100. */
function gapWithinBoard(): number {
  return 1 + Math.floor(Math.random() * 30);
}

function buildStuds(): DiffRow[] {
  const rows = STUD_NAMES.map((name) => {
    const gap = gapWithinBoard();
    const crowd = gap + 1 + Math.floor(Math.random() * (100 - gap));
    return { name, diff: `+${gap}`, mine: crowd - gap, crowd, gap };
  });
  rows.sort((a, b) => b.gap - a.gap);
  return rows;
}

function buildDuds(): DiffRow[] {
  const rows = DUD_NAMES.map((name) => {
    const gap = gapWithinBoard();
    const crowd = 1 + Math.floor(Math.random() * (100 - gap));
    return { name, diff: `−${gap}`, mine: crowd + gap, crowd, gap };
  });
  rows.sort((a, b) => b.gap - a.gap);
  return rows;
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function fadeFrame(names: FadeName[], position: string): BarsFrame {
  return {
    title: 'Draft fades',
    note: 'Avoidance %',
    round: 'All rounds',
    position,
    tone: 'fade',
    players: names.map((player, index) => ({
      ...player,
      count: AVOID[index] ?? 40,
    })),
  };
}

function openingFade(): BarsFrame {
  return fadeFrame(shuffle(FADE_POOL).slice(0, 6), 'All positions');
}

function FilterChip({ children }: { children: string }) {
  return (
    <span className="rounded-md border border-border/70 bg-background/60 px-2 py-1 text-xs text-foreground">
      {children}
    </span>
  );
}

function Bars({ frame }: { frame: BarsFrame }) {
  const max = Math.max(...frame.players.map((player) => player.count), 1);
  const fade = frame.tone === 'fade';
  return (
    <div className="flex h-full min-h-0 flex-col rounded-md border border-border/60 bg-secondary/30 px-3 py-3 sm:px-4">
      <div className="mb-2 flex shrink-0 flex-wrap items-end justify-between gap-2 border-b border-border pb-2">
        <div>
          <h4 className="font-display text-lg tracking-wide text-foreground">{frame.title}</h4>
          <p className={fade ? 'text-xs text-red-400' : 'text-xs text-muted-foreground'}>{frame.note}</p>
        </div>
        <div className="flex gap-1.5">
          <FilterChip>{frame.round}</FilterChip>
          <FilterChip>{frame.position}</FilterChip>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-end justify-around gap-2">
        {frame.players.map((player) => (
          <div key={player.full} className="flex h-full min-w-0 flex-1 flex-col items-center">
            {player.team ? (
              <img
                src={getTeamJerseyImageUrl(player.team)}
                alt=""
                className="mb-1 h-12 w-9 shrink-0 object-contain opacity-90"
                draggable={false}
              />
            ) : null}
            <p className="w-full truncate text-center text-xs font-medium" title={player.full}>
              {player.name}
            </p>
            <p className={fade ? 'mt-0.5 text-sm font-semibold tabular-nums text-red-400' : 'mt-0.5 text-sm font-semibold tabular-nums'}>
              {fade ? `${player.count}%` : player.count}
            </p>
            <div className="flex w-full flex-1 items-end justify-center pt-2">
              <div
                className={fade ? 'w-full max-w-[3.25rem] rounded-t bg-red-500/45' : 'w-full max-w-[3.25rem] rounded-t bg-primary/70'}
                style={{ height: `${Math.round((player.count / max) * 100)}%`, minHeight: 12 }}
              />
            </div>
            <span className="rank-shuffle-pos mt-2" data-pos={player.pos}>
              {player.pos}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DiffList({
  title,
  tone,
  rows,
}: {
  title: string;
  tone: 'stud' | 'dud';
  rows: { name: string; diff: string; mine: number; crowd: number }[];
}) {
  const stud = tone === 'stud';
  return (
    <section
      className={
        stud
          ? 'flex h-full min-h-0 min-w-0 flex-col rounded-md border border-green-500/30 bg-green-500/10 px-2.5 py-2'
          : 'flex h-full min-h-0 min-w-0 flex-col rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-2'
      }
    >
      <h4
        className={
          stud
            ? 'mb-1.5 shrink-0 border-b border-green-500/30 pb-1.5 text-center font-display text-sm tracking-wide text-green-400'
            : 'mb-1.5 shrink-0 border-b border-red-500/30 pb-1.5 text-center font-display text-sm tracking-wide text-red-400'
        }
      >
        {title}
      </h4>
      <ul className="grid min-h-0 flex-1 grid-cols-[2.75rem_minmax(0,1fr)_auto] content-between gap-x-2 text-sm leading-snug">
        {rows.map((row) => (
          <li key={row.name} className="contents">
            <span className={stud ? 'py-1 font-semibold tabular-nums text-green-400' : 'py-1 font-semibold tabular-nums text-red-400'}>
              {row.diff}
            </span>
            <span className="min-w-0 truncate py-1">{row.name}</span>
            <span className="py-1 text-right tabular-nums text-muted-foreground">
              #{row.mine} vs #{row.crowd}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StudsPanel({
  studs,
  duds,
}: {
  studs: DiffRow[];
  duds: DiffRow[];
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 rounded-md border border-border/60 bg-secondary/30 px-3 py-3">
      <div className="shrink-0 border-b border-border pb-2 text-center">
        <h4 className="font-display text-lg tracking-wide text-foreground">Studs and duds</h4>
        <p className="text-xs text-muted-foreground">Your rankings vs. consensus. Plus is spots higher. Minus is spots lower.</p>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
        <DiffList title="Your studs" tone="stud" rows={studs} />
        <DiffList title="Your duds" tone="dud" rows={duds} />
      </div>
    </div>
  );
}

const SLIDE_COUNT = 3;

function SlideView({
  index,
  fade,
  studs,
  duds,
}: {
  index: number;
  fade: BarsFrame;
  studs: DiffRow[];
  duds: DiffRow[];
}) {
  const kind = index % SLIDE_COUNT;
  if (kind === 1) return <Bars frame={fade} />;
  if (kind === 2) return <StudsPanel studs={studs} duds={duds} />;
  return <Bars frame={FAVES_ALL} />;
}

/** Faves, fades, then studs. Each board rolls in from the right while this sheet is open. */
export function DraftStatsStage() {
  const [fade] = useState(openingFade);
  const [boards, setBoards] = useState(() => ({ studs: buildStuds(), duds: buildDuds() }));
  const [at, setAt] = useState(0);
  const [rolling, setRolling] = useState(true);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timer = window.setInterval(() => setAt((prev) => prev + 1), HOLD_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (at < SLIDE_COUNT) return;
    setBoards({ studs: buildStuds(), duds: buildDuds() });
    const snap = window.setTimeout(() => {
      setRolling(false);
      setAt(0);
      window.requestAnimationFrame(() => setRolling(true));
    }, ROLL_MS + 90);
    return () => window.clearTimeout(snap);
  }, [at]);

  return (
    <div className="playbook-stats-window pick-slip-window h-full min-w-0" aria-hidden>
      <div
        className="pick-slip-track h-full"
        style={{ '--at': at, '--rolling': rolling ? 1 : 0 } as CSSProperties}
      >
        {Array.from({ length: SLIDE_COUNT + 1 }, (_, index) => (
          <div key={index} className="pick-slip-panel h-full p-3 sm:p-4">
            <SlideView index={index} fade={fade} studs={boards.studs} duds={boards.duds} />
          </div>
        ))}
      </div>
    </div>
  );
}
