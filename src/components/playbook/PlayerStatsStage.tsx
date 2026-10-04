import { useEffect, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { prefersReducedMotion } from '@/components/landing/landingBoard';
import { useOnScreen } from '@/components/landing/useOnScreen';
import { cn } from '@/lib/utils';

type Pos = 'QB' | 'RB' | 'WR' | 'TE';
type Filter = 'All' | Pos;

type StatRow = {
  name: string;
  team: string;
  pos: Pos;
  rush: number;
  rec: number;
  recYds: number;
  tds: number;
  fpts: number;
  sos: number;
  passYds?: number;
  passTds?: number;
  rushYds?: number;
  rushTds?: number;
  int?: number;
  targets?: number;
  recTds?: number;
  ppg?: number;
};

type StatKey = keyof StatRow;

const ALL_ROWS: StatRow[] = [
  { name: 'Jahmyr Gibbs', team: 'DET', pos: 'RB', rush: 1412, rec: 58, recYds: 517, tds: 16, fpts: 312, sos: 12, rushYds: 1412, rushTds: 12 },
  { name: 'Bijan Robinson', team: 'ATL', pos: 'RB', rush: 1348, rec: 61, recYds: 484, tds: 14, fpts: 298, sos: 9, rushYds: 1348, rushTds: 11 },
  { name: "Ja'Marr Chase", team: 'CIN', pos: 'WR', rush: 32, rec: 117, recYds: 1534, tds: 15, fpts: 341, sos: 18, targets: 158, recTds: 14 },
  { name: 'Puka Nacua', team: 'LAR', pos: 'WR', rush: 18, rec: 106, recYds: 1292, tds: 9, fpts: 286, sos: 14, targets: 141, recTds: 8 },
  { name: 'Jaxon Smith-Njigba', team: 'SEA', pos: 'WR', rush: 12, rec: 98, recYds: 1216, tds: 8, fpts: 268, sos: 11, targets: 132, recTds: 7 },
  { name: 'Jonathan Taylor', team: 'IND', pos: 'RB', rush: 1502, rec: 36, recYds: 248, tds: 13, fpts: 274, sos: 7, rushYds: 1502, rushTds: 11 },
  { name: 'CeeDee Lamb', team: 'DAL', pos: 'WR', rush: 41, rec: 101, recYds: 1194, tds: 8, fpts: 271, sos: 16, targets: 136, recTds: 7 },
  { name: 'A.J. Brown', team: 'NE', pos: 'WR', rush: 8, rec: 84, recYds: 1188, tds: 9, fpts: 259, sos: 20, targets: 124, recTds: 8 },
  { name: 'Brock Bowers', team: 'LV', pos: 'TE', rush: 0, rec: 92, recYds: 1048, tds: 6, fpts: 232, sos: 22, targets: 118, recTds: 6 },
  { name: 'Josh Allen', team: 'BUF', pos: 'QB', rush: 486, rec: 0, recYds: 0, tds: 12, fpts: 368, sos: 8, passYds: 4102, passTds: 32, rushYds: 486, rushTds: 8, int: 7 },
  { name: 'Trey McBride', team: 'ARI', pos: 'TE', rush: 0, rec: 96, recYds: 1014, tds: 7, fpts: 228, sos: 15, targets: 121, recTds: 7 },
  { name: 'Drake Maye', team: 'NE', pos: 'QB', rush: 412, rec: 0, recYds: 0, tds: 6, fpts: 301, sos: 19, passYds: 3804, passTds: 28, rushYds: 412, rushTds: 6, int: 9 },
];

const EXTRA: Record<Pos, StatRow[]> = {
  QB: [
    { name: 'Lamar Jackson', team: 'BAL', pos: 'QB', rush: 714, rec: 0, recYds: 0, tds: 5, fpts: 344, sos: 10, passYds: 3672, passTds: 29, rushYds: 714, rushTds: 5, int: 6 },
    { name: 'Jalen Hurts', team: 'PHI', pos: 'QB', rush: 602, rec: 0, recYds: 0, tds: 12, fpts: 329, sos: 13, passYds: 3521, passTds: 26, rushYds: 602, rushTds: 12, int: 8 },
    { name: 'Joe Burrow', team: 'CIN', pos: 'QB', rush: 156, rec: 0, recYds: 0, tds: 2, fpts: 318, sos: 17, passYds: 3910, passTds: 34, rushYds: 156, rushTds: 2, int: 9 },
    { name: 'Patrick Mahomes', team: 'KC', pos: 'QB', rush: 341, rec: 0, recYds: 0, tds: 4, fpts: 312, sos: 6, passYds: 3888, passTds: 30, rushYds: 341, rushTds: 4, int: 11 },
    { name: 'Justin Herbert', team: 'LAC', pos: 'QB', rush: 248, rec: 0, recYds: 0, tds: 2, fpts: 296, sos: 14, passYds: 3644, passTds: 27, rushYds: 248, rushTds: 2, int: 8 },
    { name: 'Jayden Daniels', team: 'WAS', pos: 'QB', rush: 588, rec: 0, recYds: 0, tds: 6, fpts: 288, sos: 16, passYds: 3412, passTds: 24, rushYds: 588, rushTds: 6, int: 8 },
    { name: 'Caleb Williams', team: 'CHI', pos: 'QB', rush: 312, rec: 0, recYds: 0, tds: 3, fpts: 274, sos: 18, passYds: 3288, passTds: 22, rushYds: 312, rushTds: 3, int: 10 },
    { name: 'Baker Mayfield', team: 'TB', pos: 'QB', rush: 286, rec: 0, recYds: 0, tds: 3, fpts: 268, sos: 12, passYds: 3510, passTds: 28, rushYds: 286, rushTds: 3, int: 12 },
    { name: 'Bo Nix', team: 'DEN', pos: 'QB', rush: 402, rec: 0, recYds: 0, tds: 4, fpts: 262, sos: 15, passYds: 3186, passTds: 23, rushYds: 402, rushTds: 4, int: 11 },
    { name: 'Jordan Love', team: 'GB', pos: 'QB', rush: 224, rec: 0, recYds: 0, tds: 2, fpts: 254, sos: 9, passYds: 3364, passTds: 25, rushYds: 224, rushTds: 2, int: 11 },
  ],
  RB: [
    { name: 'Saquon Barkley', team: 'PHI', pos: 'RB', rush: 1488, rec: 42, recYds: 312, tds: 15, fpts: 306, sos: 8, rushYds: 1488, rushTds: 13 },
    { name: 'Derrick Henry', team: 'BAL', pos: 'RB', rush: 1320, rec: 18, recYds: 142, tds: 16, fpts: 268, sos: 11, rushYds: 1320, rushTds: 15 },
    { name: 'Christian McCaffrey', team: 'SF', pos: 'RB', rush: 1104, rec: 54, recYds: 428, tds: 11, fpts: 264, sos: 14, rushYds: 1104, rushTds: 8 },
    { name: 'Kyren Williams', team: 'LAR', pos: 'RB', rush: 1186, rec: 34, recYds: 246, tds: 12, fpts: 248, sos: 10, rushYds: 1186, rushTds: 11 },
    { name: 'Josh Jacobs', team: 'GB', pos: 'RB', rush: 1244, rec: 32, recYds: 228, tds: 12, fpts: 242, sos: 13, rushYds: 1244, rushTds: 10 },
    { name: "De'Von Achane", team: 'MIA', pos: 'RB', rush: 1088, rec: 48, recYds: 392, tds: 10, fpts: 236, sos: 17, rushYds: 1088, rushTds: 7 },
    { name: 'Breece Hall', team: 'NYJ', pos: 'RB', rush: 1024, rec: 44, recYds: 318, tds: 8, fpts: 218, sos: 19, rushYds: 1024, rushTds: 6 },
    { name: 'James Cook', team: 'BUF', pos: 'RB', rush: 1142, rec: 28, recYds: 196, tds: 14, fpts: 228, sos: 8, rushYds: 1142, rushTds: 12 },
    { name: 'Bucky Irving', team: 'TB', pos: 'RB', rush: 968, rec: 38, recYds: 274, tds: 7, fpts: 204, sos: 15, rushYds: 968, rushTds: 6 },
  ],
  WR: [
    { name: 'Amon-Ra St. Brown', team: 'DET', pos: 'WR', rush: 54, rec: 108, recYds: 1248, tds: 11, fpts: 292, sos: 9, targets: 146, recTds: 10 },
    { name: 'Nico Collins', team: 'HOU', pos: 'WR', rush: 22, rec: 96, recYds: 1164, tds: 8, fpts: 254, sos: 13, targets: 138, recTds: 7 },
    { name: 'Malik Nabers', team: 'NYG', pos: 'WR', rush: 16, rec: 94, recYds: 1128, tds: 7, fpts: 246, sos: 21, targets: 140, recTds: 7 },
    { name: 'Brian Thomas Jr.', team: 'JAX', pos: 'WR', rush: 28, rec: 88, recYds: 1086, tds: 8, fpts: 238, sos: 15, targets: 126, recTds: 8 },
    { name: 'Drake London', team: 'ATL', pos: 'WR', rush: 14, rec: 91, recYds: 1042, tds: 8, fpts: 231, sos: 12, targets: 134, recTds: 7 },
    { name: 'Garrett Wilson', team: 'NYJ', pos: 'WR', rush: 19, rec: 86, recYds: 998, tds: 6, fpts: 218, sos: 19, targets: 142, recTds: 6 },
    { name: 'Ladd McConkey', team: 'LAC', pos: 'WR', rush: 11, rec: 82, recYds: 964, tds: 7, fpts: 212, sos: 10, targets: 112, recTds: 7 },
  ],
  TE: [
    { name: 'George Kittle', team: 'SF', pos: 'TE', rush: 0, rec: 78, recYds: 912, tds: 8, fpts: 214, sos: 12, targets: 102, recTds: 8 },
    { name: 'Sam LaPorta', team: 'DET', pos: 'TE', rush: 0, rec: 74, recYds: 846, tds: 7, fpts: 198, sos: 10, targets: 98, recTds: 7 },
    { name: 'Mark Andrews', team: 'BAL', pos: 'TE', rush: 0, rec: 68, recYds: 792, tds: 6, fpts: 184, sos: 16, targets: 94, recTds: 6 },
    { name: 'T.J. Hockenson', team: 'MIN', pos: 'TE', rush: 0, rec: 71, recYds: 764, tds: 5, fpts: 176, sos: 18, targets: 96, recTds: 5 },
    { name: 'Travis Kelce', team: 'KC', pos: 'TE', rush: 0, rec: 82, recYds: 902, tds: 6, fpts: 208, sos: 8, targets: 108, recTds: 6 },
    { name: 'Dallas Goedert', team: 'PHI', pos: 'TE', rush: 0, rec: 64, recYds: 712, tds: 5, fpts: 164, sos: 14, targets: 86, recTds: 5 },
    { name: 'Tucker Kraft', team: 'GB', pos: 'TE', rush: 0, rec: 61, recYds: 684, tds: 6, fpts: 158, sos: 11, targets: 82, recTds: 6 },
    { name: 'Evan Engram', team: 'DEN', pos: 'TE', rush: 0, rec: 66, recYds: 658, tds: 4, fpts: 148, sos: 17, targets: 90, recTds: 4 },
    { name: 'Kyle Pitts', team: 'ATL', pos: 'TE', rush: 0, rec: 58, recYds: 612, tds: 4, fpts: 136, sos: 13, targets: 88, recTds: 4 },
    { name: 'David Njoku', team: 'CLE', pos: 'TE', rush: 0, rec: 55, recYds: 574, tds: 5, fpts: 132, sos: 20, targets: 84, recTds: 5 },
  ],
};

const FILTERS: Filter[] = ['All', 'QB', 'RB', 'WR', 'TE'];

const ALL_COLS: { key: StatKey; label: string; sort?: boolean }[] = [
  { key: 'rush', label: 'Rush' },
  { key: 'rec', label: 'Rec' },
  { key: 'recYds', label: 'Rec yds', sort: true },
  { key: 'tds', label: 'TD' },
  { key: 'fpts', label: 'FPts' },
  { key: 'sos', label: 'SOS' },
];

const SCORE_COLS: { key: StatKey; label: string }[] = [
  { key: 'fpts', label: 'FPts' },
  { key: 'ppg', label: 'PPG' },
];

const POS_COLS: Record<Pos, { key: StatKey; label: string; sort?: boolean }[]> = {
  QB: [
    { key: 'passYds', label: 'Pass yds', sort: true },
    { key: 'passTds', label: 'Pass TDs' },
    { key: 'rushYds', label: 'Rush yds' },
    { key: 'rushTds', label: 'Rush TDs' },
    { key: 'int', label: 'INT' },
    ...SCORE_COLS,
  ],
  RB: [
    { key: 'rushYds', label: 'Rush yds', sort: true },
    { key: 'rushTds', label: 'Rush TDs' },
    { key: 'rec', label: 'Rec' },
    { key: 'recYds', label: 'Rec yds' },
    ...SCORE_COLS,
  ],
  WR: [
    { key: 'recYds', label: 'Rec yds', sort: true },
    { key: 'rec', label: 'Rec' },
    { key: 'targets', label: 'Targets' },
    { key: 'recTds', label: 'Rec TDs' },
    ...SCORE_COLS,
  ],
  TE: [
    { key: 'recYds', label: 'Rec yds', sort: true },
    { key: 'rec', label: 'Rec' },
    { key: 'targets', label: 'Targets' },
    { key: 'recTds', label: 'Rec TDs' },
    ...SCORE_COLS,
  ],
};

const ALL_GRID = 'grid-cols-[minmax(0,1.4fr)_2.1rem_2rem_repeat(6,minmax(0,0.85fr))]';
const QB_GRID = 'grid-cols-[minmax(0,1.4fr)_2.1rem_repeat(7,minmax(0,0.85fr))]';
const SKILL_GRID = 'grid-cols-[minmax(0,1.4fr)_2.1rem_repeat(6,minmax(0,0.85fr))]';

function statText(row: StatRow, key: StatKey, filter: Filter): string {
  if (key === 'ppg') {
    const ppg = typeof row.ppg === 'number' ? row.ppg : row.fpts / 16;
    return ppg.toFixed(1);
  }
  const value = row[key];
  if (typeof value !== 'number') return '—';
  if (filter === 'All' && value === 0 && (key === 'rush' || key === 'rec' || key === 'recYds')) return '—';
  return String(value);
}

function nextFilter(current: Filter): Filter {
  const index = FILTERS.indexOf(current);
  return FILTERS[(index + 1) % FILTERS.length];
}

function positionGrid(filter: Pos): string {
  return filter === 'QB' ? QB_GRID : SKILL_GRID;
}

function pickIndex(count: number): number {
  if (count <= 1) return 0;
  return Math.floor(Math.random() * count);
}

function rowCount(filter: Filter): number {
  if (filter === 'All') return ALL_ROWS.length;
  return ALL_ROWS.filter((row) => row.pos === filter).length + EXTRA[filter].length;
}

/** A filled player-stats sheet. Loops All, then QB, RB, WR, and TE. */
export function PlayerStatsStage() {
  const { ref, onScreen } = useOnScreen<HTMLDivElement>();
  const [sheet, setSheet] = useState(() => ({
    filter: 'All' as Filter,
    highlight: pickIndex(ALL_ROWS.length),
  }));
  const { filter, highlight } = sheet;

  useEffect(() => {
    if (!onScreen || prefersReducedMotion()) return;
    const id = window.setInterval(() => {
      setSheet((current) => {
        const next = nextFilter(current.filter);
        return { filter: next, highlight: pickIndex(rowCount(next)) };
      });
    }, 2000);
    return () => window.clearInterval(id);
  }, [onScreen]);

  const cols = filter === 'All' ? ALL_COLS : POS_COLS[filter];
  const grid = filter === 'All' ? ALL_GRID : positionGrid(filter);
  const rows =
    filter === 'All'
      ? ALL_ROWS
      : [...ALL_ROWS, ...EXTRA[filter]]
          .filter((row) => row.pos === filter)
          .sort((a, b) => Number(b[cols[0].key] ?? 0) - Number(a[cols[0].key] ?? 0));

  return (
    <div ref={ref} className="flex h-full min-h-0 flex-col gap-2 p-3 sm:p-4" aria-hidden>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span className="rounded-md border border-border/70 bg-background/70 px-2.5 py-1.5 text-xs text-muted-foreground">
          Search players
        </span>
        <span className="rounded-md border border-border/70 bg-background/70 px-2.5 py-1.5 text-xs text-foreground">
          2025
        </span>
        <div className="flex gap-1">
          {FILTERS.map((item) => (
            <span
              key={item}
              className={
                item === filter
                  ? 'rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground'
                  : 'rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground'
              }
            >
              {item}
            </span>
          ))}
        </div>
      </div>
      <div
        key={filter}
        className="player-stats-flip flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border/60 bg-secondary/20"
      >
        <div className={cn('grid shrink-0 items-center gap-1.5 border-b border-border bg-secondary/50 px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground', grid)}>
          <span>Player</span>
          <span>Tm</span>
          {filter === 'All' ? <span>Pos</span> : null}
          {cols.map((col) =>
            col.sort ? (
              <span key={col.key} className="inline-flex items-center justify-end gap-0.5 text-foreground">
                {col.label} <ArrowDown className="h-3 w-3" aria-hidden />
              </span>
            ) : (
              <span key={col.key} className="text-right">
                {col.label}
              </span>
            )
          )}
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          {rows.map((row, index) => (
            <div
              key={row.name}
              className={cn(
                'grid min-h-0 flex-1 items-center gap-1.5 border-b border-border/40 px-2.5 text-xs last:border-b-0',
                grid,
                index === highlight && 'bg-primary/20 shadow-[inset_3px_0_0_hsl(var(--primary))]'
              )}
            >
              <span className="truncate font-medium">{row.name}</span>
              <span className="text-muted-foreground">{row.team}</span>
              {filter === 'All' ? (
                <span className="rank-shuffle-pos" data-pos={row.pos}>
                  {row.pos}
                </span>
              ) : null}
              {cols.map((col) => (
                <span
                  key={col.key}
                  className={cn(
                    'text-right tabular-nums',
                    (col.key === 'recYds' || col.key === 'fpts' || col.key === 'ppg' || col.key === 'passYds' || col.key === 'rushYds') &&
                      'font-medium',
                    col.key === 'sos' && 'text-muted-foreground'
                  )}
                >
                  {statText(row, col.key, filter)}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
