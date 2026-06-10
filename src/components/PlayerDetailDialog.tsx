import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useScoringFormat } from '@/hooks/useScoringFormat';
import {
  getFantasyPointsBreakdown,
  getSkillWeeklyFantasyPoints,
  type FantasyBreakdownInput,
  type FantasyPointsBreakdownItem,
} from '@/utils/fantasyPoints';
import {
  aggregateKickerCountingStatsFromWeeklyRows,
  getKickerFantasyBreakdownItems,
  KICKER_WEEKLY_PASSTHROUGH_KEYS,
  syntheticKickerRowFromAggregates,
} from '@/utils/kickerFantasyPoints';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { PositionBadge } from './PositionBadge';
import { supabase } from '@/integrations/supabase/client';
import { PlayerJerseyWithNumber } from '@/components/PlayerJerseyWithNumber';
import { Input } from '@/components/ui/input';
import { lookupJerseyNumberFill, useNflTeamJerseyColors } from '@/hooks/useNflTeamJerseyColors';
import { GitCompareArrows, BarChart3 } from 'lucide-react';
import { BrandedLoader } from '@/components/BrandedLoader';
import type { Player } from '@/types/database';
import type { Player2025Stats } from '@/hooks/usePlayer2025Stats';
import type { ScoringFormat } from '@/utils/fantasyPoints';
import { getAgeFromBirthDate } from '@/utils/playerAge';
import {
  canonicalTeamAbbr,
  displayTeamAbbrevOrFa,
  getFullTeamName,
  resolveTeamAbbrForDisplay,
} from '@/utils/teamMapping';
import { useNflTeamContext } from '@/contexts/NflTeamContext';
import type { TeamRankMetric } from '@/types/nflTeamContext2025';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mergePlayerPoolAcrossSeasons } from '@/utils/playerDeduplication';
import { PLAYER_POOL_CURRENT_SEASON, PLAYER_POOL_PRIOR_SEASON } from '@/constants/playerPoolSeason';
import {
  formatOpponentWinPctDisplay,
  formatSosCellDisplay,
  NFL_2026_SOS_HELP_TEXT,
  sosOrdinal,
} from '@/constants/nfl2026StrengthOfSchedule';
import { OlineTeamRankStatTrigger } from '@/components/OlineComparisonMetricPanel';
import { cn } from '@/lib/utils';
import { PlayerHeaderStatsLine } from '@/components/PlayerHeaderStatsLine';

/** Winner pill in player comparison — matches PositionBadge / `index.css` position colors */
/** Full NFL club name for team-ranks comparison subtitle (e.g. Cincinnati Bengals). */
function nflTeamSubtitleFullName(
  team: string | null | undefined,
  position: string | null | undefined,
  name: string | null | undefined
): string {
  const abbr = resolveTeamAbbrForDisplay(team, position, name);
  if (!abbr || abbr === 'FA') {
    return displayTeamAbbrevOrFa(team, position, name, { faLabel: 'Free Agent' });
  }
  return getFullTeamName(abbr) ?? abbr;
}

function positionComparisonHighlightClass(position: string | null | undefined): string {
  const p = (position || '').trim().toUpperCase();
  switch (p) {
    case 'QB':
      return 'position-qb';
    case 'RB':
    case 'FB':
      return 'position-rb';
    case 'WR':
      return 'position-wr';
    case 'TE':
      return 'position-te';
    case 'K':
      return 'position-k';
    case 'DEF':
    case 'DST':
    case 'D/ST':
      return 'position-def';
    default:
      return 'border border-primary/30 bg-primary/10 text-primary';
  }
}

function FantasyPointsWithBreakdown({
  displayValue,
  stats,
  scoringFormat,
  breakdownOverride,
}: {
  displayValue: string;
  stats: FantasyBreakdownInput;
  scoringFormat: ScoringFormat;
  /** When set (e.g. kickers), replaces offense-only breakdown from `stats`. */
  breakdownOverride?: FantasyPointsBreakdownItem[] | null;
}) {
  const breakdown =
    breakdownOverride != null && breakdownOverride.length > 0
      ? breakdownOverride
      : getFantasyPointsBreakdown(stats, scoringFormat);
  if (breakdown.length === 0) {
    return <span className="font-semibold text-primary">{displayValue}</span>;
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="font-semibold text-primary hover:underline cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary rounded"
        >
          {displayValue}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto max-w-xs p-3">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Points breakdown</p>
        <div className="space-y-1.5 text-sm">
          {breakdown.map((item, i) => (
            <div key={i} className="flex justify-between gap-6 items-baseline">
              <span className="font-medium tabular-nums">
                {item.points >= 0 ? '+' : ''}{item.points.toFixed(1)} pts
              </span>
              <span className="text-muted-foreground">
                {item.statValue} {item.label}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface PlayerDetailDialogProps {
  player: Player | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 2025 season fantasy points and position rank (e.g. QB1, RB9) - shown next to name in header */
  stats2025?: Player2025Stats | null;
  allStats2025?: Map<string, Player2025Stats>;
  /** Overall ADP rank at position (e.g. 8 = WR8) */
  positionAdpRank?: number | null;
}

interface WeeklyStats {
  week: number;
  opponent_team: string | null;
  fantasy_points: number | null;
  fantasy_points_ppr: number | null;
  // Passing stats
  passing_yards: number | null;
  passing_tds: number | null;
  passing_interceptions: number | null;
  // Rushing stats
  rushing_yards: number | null;
  rushing_tds: number | null;
  carries: number | null;
  // Receiving stats
  receptions: number | null;
  receiving_yards: number | null;
  receiving_tds: number | null;
  targets: number | null;
  // Kicker stats
  fg_made: number | null;
  fg_att: number | null;
  pat_made: number | null;
  pat_att: number | null;
  /** Weekly distance lists from `weekly_stats_2025` (text, JSON array, or jsonb). */
  fg_made_list?: unknown;
  fg_missed_list?: unknown;
  // Defense stats
  def_pa: number | null;
  def_total_yards: number | null;
  /** INT / pick-six return TDs — from `team_stats_2025.def_tds` (not fumble-recovery TDs). */
  def_tds: number | null;
  /** Fumble recovery / scoop-and-score TDs — from `team_stats_2025.fumble_recovery_tds`. */
  def_fumble_recovery_tds: number | null;
  /** Kick/punt/block return TDs etc. — from `team_stats_2025.special_teams_tds` (defense row). */
  def_special_teams_tds: number | null;
  def_interceptions: number | null;
  def_fumbles: number | null;
  def_sacks: number | null;
  /** Opponent `sack_fumble_lost` for that week — credits FR to this defense. */
  opponent_sack_fumble_lost: number | null;
  /** Blocked FG/PAT credited to this defense = opponent `fg_blocked` + opponent `pat_blocked` that week (BLKK). */
  def_blocked_kicks: number | null;
  def_safeties: number | null;
  /** Resolved defense team abbr (for one-off scoring tweaks). */
  defense_team_abbr: string | null;
  // Fumbles (for QB Int/Fum display)
  fumbles: number | null;
  receiving_fumbles: number | null;
  rushing_fumbles: number | null;
  sack_fumbles: number | null;
  fumble_recovery_opp: number | null;
  [key: string]: any;
}

/** Turn `fg_made_list` / `fg_missed_list` (string, JSON text, array, object) into tooltip body text. */
function fgDistanceListTooltipText(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return null;
    if ((t.startsWith('[') && t.endsWith(']')) || (t.startsWith('{') && t.endsWith('}'))) {
      try {
        return fgDistanceListTooltipText(JSON.parse(t));
      } catch {
        return t;
      }
    }
    return t;
  }
  if (Array.isArray(raw)) {
    const parts = raw
      .map((item) => {
        if (item == null) return '';
        if (typeof item === 'object') return JSON.stringify(item);
        return String(item);
      })
      .filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }
  if (typeof raw === 'object') {
    return JSON.stringify(raw);
  }
  return String(raw);
}

/** Max plausible FG distance (yards) parsed from `fg_made_list` text for a single week row. */
function maxFgYardsFromMadeListRaw(raw: unknown): number | null {
  const text = fgDistanceListTooltipText(raw);
  if (!text) return null;
  const nums =
    text
      .match(/\d+/g)
      ?.map((x) => Number.parseInt(x, 10))
      .filter((n) => Number.isFinite(n)) ?? [];
  if (nums.length === 0) return null;
  const plausible = nums.filter((n) => n >= 18 && n <= 66);
  const pool = plausible.length > 0 ? plausible : nums;
  return Math.max(...pool);
}

type ComparisonWeeklyExtras = {
  rushAttempts: number | null;
  passAttempts: number | null;
  fumbles: number | null;
  longestFgYards: number | null;
};

async function fetchWeeklyComparisonExtras(player: Player): Promise<ComparisonWeeklyExtras> {
  const empty: ComparisonWeeklyExtras = {
    rushAttempts: null,
    passAttempts: null,
    fumbles: null,
    longestFgYards: null,
  };
  if (!player.espn_id) return empty;

  let gsisId: string | null = null;
  const { data: dc } = await supabase
    .from('depth_charts_2025')
    .select('gsis_id')
    .eq('espn_id', player.espn_id)
    .limit(1)
    .maybeSingle();
  if (dc?.gsis_id) gsisId = dc.gsis_id;
  else {
    const { data: r } = await supabase
      .from('rosters_2025')
      .select('gsis_id')
      .eq('espn_id', player.espn_id)
      .limit(1)
      .maybeSingle();
    if (r?.gsis_id) gsisId = r.gsis_id;
  }

  const statsId = gsisId || String(player.espn_id);
  const { data: rows, error } = await supabase
    .from('weekly_stats_2025')
    .select('*')
    .eq('player_id', statsId)
    .lte('week', 18);

  if (error || !rows?.length) return empty;

  let rushAttempts = 0;
  let passAttempts = 0;
  let fumbles = 0;
  let longestFg = 0;
  const pos = (player.position || '').trim().toUpperCase();

  for (const row of rows as Record<string, unknown>[]) {
    rushAttempts += Number(row.carries ?? 0) || 0;
    const pa = row.passing_attempts ?? row.pass_attempts ?? row.attempts;
    if (pa != null && Number(pa) > 0) passAttempts += Number(pa) || 0;
    fumbles +=
      (Number(row.receiving_fumbles ?? 0) || 0) +
      (Number(row.rushing_fumbles ?? 0) || 0) +
      (Number(row.sack_fumbles ?? 0) || 0);

    if (pos === 'K') {
      const wkMax = maxFgYardsFromMadeListRaw(row.fg_made_list ?? row.fgMadeList);
      if (wkMax != null && wkMax > longestFg) longestFg = wkMax;
    }
  }

  const played = rows.length > 0;
  return {
    rushAttempts: played ? rushAttempts : null,
    passAttempts: played ? passAttempts : null,
    fumbles: played ? fumbles : null,
    longestFgYards: longestFg > 0 ? longestFg : null,
  };
}

function KickerFgHoverBox({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-1.5 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="text-sm font-medium tabular-nums whitespace-pre-wrap leading-snug">{body}</p>
    </div>
  );
}

/** Weekly Game Log: hover FGM → made distances; hover FGA → missed distances only if FGA &gt; FGM that week. */
function kickerWeeklyFgStatCell(
  game: WeeklyStats,
  statKey: 'fg_made' | 'fg_att',
  displayValue: ReactNode
): ReactNode {
  if (game.opponent_team === 'BYE') return displayValue;

  const fgm = toFiniteNumber(game.fg_made);
  const fga = toFiniteNumber(game.fg_att);

  if (statKey === 'fg_made') {
    const listText = fgDistanceListTooltipText(game.fg_made_list);
    if (!listText) return displayValue;
    return (
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-dotted border-muted-foreground/60">
            {displayValue}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[min(22rem,calc(100vw-2rem))] px-3 py-2">
          <KickerFgHoverBox title="Field goals made" body={listText} />
        </TooltipContent>
      </Tooltip>
    );
  }

  // FGA: only after a miss (FGA &gt; FGM); show missed distances when the list exists.
  if (fga == null || fgm == null || fga <= fgm) {
    return displayValue;
  }
  const listText = fgDistanceListTooltipText(game.fg_missed_list);
  if (!listText) return displayValue;
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span className="cursor-help border-b border-dotted border-muted-foreground/60">
          {displayValue}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[min(22rem,calc(100vw-2rem))] px-3 py-2">
        <KickerFgHoverBox title="Field goals missed" body={listText} />
      </TooltipContent>
    </Tooltip>
  );
}

function isDefensePosition(position: string | null | undefined): boolean {
  if (!position?.trim()) return false;
  const p = position.trim().toUpperCase();
  return p === 'D/ST' || p === 'DEF' || p === 'DST';
}

function defenseScheduleAliases(teamAbbr: string | null | undefined): string[] {
  if (!teamAbbr) return [];
  const canonical = canonicalTeamAbbr(teamAbbr) ?? teamAbbr;
  if (canonical === 'LAR') return ['LAR', 'LA'];
  return [canonical];
}

/** Coerce DB/JSON values (number, numeric string, bigint) to a finite number. */
function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const t = value.trim();
    if (t === '' || t.toLowerCase() === 'null') return null;
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickNumber(row: Record<string, any>, keys: string[]): number | null {
  for (const key of keys) {
    const n = toFiniteNumber(row[key]);
    if (n !== null) return n;
  }
  return null;
}

/** Interception return TDs — `def_tds` in DB is this bucket (not fumble-recovery TDs). */
function pickInterceptionReturnTds(row: Record<string, any>): number | null {
  return pickNumber(row, [
    'def_tds',
    'def_td',
    'interception_return_tds',
    'interception_return_td',
    'int_return_tds',
    'int_return_td',
    'pick_sixes',
    'pick_six',
  ]);
}

function pickFumbleRecoveryReturnTds(row: Record<string, any>): number | null {
  return pickNumber(row, [
    'fumble_recovery_tds',
    'fumble_recovery_td',
    'fumble_return_tds',
    'fumble_return_td',
    'defensive_fumble_recovery_tds',
  ]);
}

/** KR/PR/block-FG return TDs — main column or sum of parts in `team_stats_2025`. */
function pickSpecialTeamsTds(row: Record<string, any>): number | null {
  const direct = pickNumber(row, [
    'special_teams_tds',
    'special_teams_td',
    'special_team_tds',
    'st_tds',
    'st_td',
  ]);
  if (direct !== null) return direct;

  const kr = pickNumber(row, ['kickoff_return_tds', 'kick_return_tds', 'kick_return_td', 'krtd']);
  const pr = pickNumber(row, ['punt_return_tds', 'punt_return_td', 'prtd']);
  const blkRet = pickNumber(row, [
    'blocked_field_goal_return_tds',
    'blocked_fg_return_tds',
    'blocked_kick_return_tds',
    'blkkrtd',
  ]);
  if (kr === null && pr === null && blkRet === null) return null;
  return (kr ?? 0) + (pr ?? 0) + (blkRet ?? 0);
}

function sumNumbers(values: Array<number | null>): number | null {
  if (values.some((v) => v === null || v === undefined || Number.isNaN(v))) return null;
  return values.reduce((acc, v) => acc + (v ?? 0), 0);
}

function pointsForPaTier(pa: number | null): number {
  if (pa == null) return 0;
  if (pa === 0) return 5;
  if (pa <= 6) return 4;
  if (pa <= 13) return 3;
  if (pa <= 17) return 1;
  if (pa <= 27) return 0;
  if (pa <= 34) return -1;
  if (pa <= 45) return -3;
  return -5;
}

function pointsForYardsTier(yards: number | null): number {
  if (yards == null) return 0;
  if (yards < 100) return 5;
  if (yards <= 199) return 3;
  if (yards <= 299) return 2;
  if (yards <= 349) return 0;
  if (yards <= 399) return -1;
  if (yards <= 449) return -3;
  if (yards <= 499) return -5;
  if (yards <= 549) return -6;
  return -7;
}

function calculateDefenseFantasyPoints(game: WeeklyStats): number | null {
  if (game.opponent_team === 'BYE') return null;

  const sacks = game.def_sacks ?? 0;
  const interceptions = game.def_interceptions ?? 0;
  /** `fumble_recovery_opp` is pre-merged (own recoveries + opponent `sack_fumble_lost`) when we have a defense row. */
  const fumbleRecoveries =
    game.fumble_recovery_opp != null
      ? game.fumble_recovery_opp
      : (game.def_fumbles ?? 0) + (game.opponent_sack_fumble_lost ?? 0);

  const intRetTds = game.def_tds ?? 0;
  const fumRecTds = game.def_fumble_recovery_tds ?? 0;
  const stTds = game.def_special_teams_tds ?? 0;
  /** INT-return, fumble-recovery return, and ST return TDs — each +6; three separate DB columns. */
  const tdPoints = (intRetTds + fumRecTds + stTds) * 6;

  const blockedKicks = game.def_blocked_kicks ?? 0;
  const safeties = game.def_safeties ?? 0;

  const paTier = pointsForPaTier(game.def_pa);
  const yardsTier = pointsForYardsTier(game.def_total_yards);

  /** Only 2025 defensive 2-pt return in DB — Cowboys @ Packers week 4. */
  let defensiveTwoPointReturns = 0;
  if (game.defense_team_abbr === 'DAL' && game.week === 4) {
    defensiveTwoPointReturns = 1;
  }

  return (
    sacks * 1 +
    interceptions * 2 +
    fumbleRecoveries * 2 +
    tdPoints +
    defensiveTwoPointReturns * 2 +
    blockedKicks * 2 +
    safeties * 2 +
    paTier +
    yardsTier
  );
}

async function fetchPlayerAgeFromEspn(espnId: string | null | undefined): Promise<number | null> {
  if (!espnId) return null;
  const id = String(espnId);
  let birthDateFound: string | null = null;
  const { data: nflHist } = await supabase
    .from('nfl_players_historical')
    .select('birth_date')
    .eq('espn_id', id)
    .not('birth_date', 'is', null)
    .order('season', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (nflHist?.birth_date) birthDateFound = nflHist.birth_date;
  if (!birthDateFound) {
    const { data: pi } = await (supabase as any)
      .from('players_info')
      .select('birth_date')
      .eq('espn_id', id)
      .not('birth_date', 'is', null)
      .limit(1)
      .maybeSingle();
    if (pi?.birth_date) birthDateFound = pi.birth_date;
  }
  if (!birthDateFound) {
    const { data: pc } = await (supabase as any)
      .from('players_clean')
      .select('birth_date')
      .eq('espn_id', id)
      .not('birth_date', 'is', null)
      .limit(1)
      .maybeSingle();
    if (pc?.birth_date) birthDateFound = pc.birth_date;
  }
  if (!birthDateFound) return null;
  return getAgeFromBirthDate(birthDateFound);
}

function kickerFgPctNumber(made: number | undefined, att: number | undefined): number | null {
  const m = made ?? 0;
  const a = att ?? 0;
  if (a <= 0) return null;
  return (m / a) * 100;
}

export const PlayerDetailDialog = ({
  player,
  open,
  onOpenChange,
  stats2025,
  allStats2025,
  positionAdpRank,
}: PlayerDetailDialogProps) => {
  const scoringFormat = useScoringFormat();
  const [stats, setStats] = useState<WeeklyStats[]>([]);
  const [comparisonPlayer, setComparisonPlayer] = useState<Player | null>(null);
  const [comparisonQuery, setComparisonQuery] = useState('');
  const [comparisonResults, setComparisonResults] = useState<Player[]>([]);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonWeeklyExtras, setComparisonWeeklyExtras] = useState<{
    left: ComparisonWeeklyExtras | null;
    right: ComparisonWeeklyExtras | null;
  } | null>(null);
  const [playerAge, setPlayerAge] = useState<number | null>(null);
  const [comparisonPlayerAge, setComparisonPlayerAge] = useState<number | null>(null);
  const [comparisonStatSource, setComparisonStatSource] = useState<'player' | 'team'>('player');
  const [loading, setLoading] = useState(false);
  const selectedSeason: 2025 = 2025;
  // For RBs/WRs: 'rushing' or 'receiving', for QBs: 'passing' or 'rushing'
  const [statView, setStatView] = useState<'rushing' | 'receiving' | 'passing'>('rushing');
  const { data: jerseyColorsByAbbr } = useNflTeamJerseyColors();

  const seasonHeaderOffenseInput = useMemo((): FantasyBreakdownInput => {
    if (!stats2025 || !player) return {};
    return {
      passing_yards: stats2025.totalPassYards,
      passing_tds: stats2025.totalPassTds,
      passing_interceptions: stats2025.totalInterceptions,
      rushing_yards: stats2025.totalRushYards,
      rushing_tds: stats2025.totalRushTds,
      receptions: stats2025.totalReceptions,
      receiving_yards: stats2025.totalRecYards,
      receiving_tds: stats2025.totalRecTds,
    };
  }, [stats2025, player]);

  const seasonKickerHeaderBreakdownOverride = useMemo((): FantasyPointsBreakdownItem[] | null => {
    if (!stats2025 || !player || player.position !== 'K' || stats.length === 0) return null;
    const base: FantasyBreakdownInput = {
      passing_yards: stats2025.totalPassYards,
      passing_tds: stats2025.totalPassTds,
      passing_interceptions: stats2025.totalInterceptions,
      rushing_yards: stats2025.totalRushYards,
      rushing_tds: stats2025.totalRushTds,
      receptions: stats2025.totalReceptions,
      receiving_yards: stats2025.totalRecYards,
      receiving_tds: stats2025.totalRecTds,
    };
    const agg = aggregateKickerCountingStatsFromWeeklyRows(stats, (r) => r.opponent_team === 'BYE');
    const kick = getKickerFantasyBreakdownItems(syntheticKickerRowFromAggregates(agg));
    return [...getFantasyPointsBreakdown(base, scoringFormat), ...kick] as FantasyPointsBreakdownItem[];
  }, [stats2025, stats, player, scoringFormat]);

  useEffect(() => {
    if (player && open) {
      setComparisonPlayer(null);
      setComparisonPlayerAge(null);
      setComparisonWeeklyExtras(null);
      setComparisonQuery('');
      setComparisonResults([]);
      setComparisonStatSource('player');
      // Set default stat view based on position
      if (player.position === 'WR' || player.position === 'TE') {
        setStatView('receiving');
      } else if (player.position === 'QB') {
        setStatView('passing');
      } else {
        setStatView('rushing');
      }
      fetchPlayerData();
    }
  }, [player, open, selectedSeason]);

  const fetchPlayerData = async () => {
    if (!player) return;
    setLoading(true);
    setPlayerAge(null);
    const resolvedTeamAbbr = resolveTeamAbbrForDisplay(player.team, player.position, player.name);
    const isDefense = isDefensePosition(player.position);

    try {
      // Fetch birth_date to calculate age (from nfl_players_historical or players_info)
      const espnId = player.espn_id != null ? String(player.espn_id) : null;
      if (espnId) {
        const age = await fetchPlayerAgeFromEspn(espnId);
        if (age != null) setPlayerAge(age);
      }
      if (selectedSeason === 2025) {
        if (isDefense) {
          const scheduleTeam = resolvedTeamAbbr;
          const scheduleTeamAliases = defenseScheduleAliases(scheduleTeam);
          const scheduleTeamSet = new Set(scheduleTeamAliases);
          let statsData: any[] = [];

          if (scheduleTeamAliases.length > 0) {
            const { data, error } = await (supabase as any)
              .from('team_stats_2025')
              .select('*')
              .in('team', scheduleTeamAliases)
              .lte('week', 18)
              .order('week', { ascending: true });
            if (error) {
              console.error('Failed to fetch team_stats_2025 for defense:', error);
            } else {
              statsData = data ?? [];
            }
          }

          // Build opponent schedule from games_2025 using defense team abbreviation.
          const teamGames = new Map<number, { opponent: string; gameday: string | null; pointsAllowed: number | null }>();
          if (scheduleTeamAliases.length > 0) {
            const gamesOr = scheduleTeamAliases
              .flatMap((t) => [`home_team.eq.${t}`, `away_team.eq.${t}`])
              .join(',');
            const { data: games } = await supabase
              .from('games_2025')
              .select('week, home_team, away_team, home_score, away_score, gameday')
              .eq('season', 2025)
              .eq('game_type', 'REG')
              .lte('week', 18)
              .or(gamesOr);
            if (games) {
              for (const g of games) {
                const isHome = !!g.home_team && scheduleTeamSet.has(g.home_team);
                const isAway = !!g.away_team && scheduleTeamSet.has(g.away_team);
                if (!isHome && !isAway) continue;
                const opponent = isHome ? g.away_team : g.home_team;
                const pointsAllowed = isHome ? toFiniteNumber(g.away_score) : toFiniteNumber(g.home_score);
                teamGames.set(g.week!, { opponent: opponent ?? '', gameday: g.gameday ?? null, pointsAllowed });
              }
            }
          }

          const statsByWeek = new Map(
            statsData
              .filter((s: any) => typeof s.week === 'number')
              .map((s: any) => [s.week, s])
          );

          // Fetch opponents' weekly totals so each defense week shows opponent total yards.
          const opponentTeams = [...new Set(Array.from(teamGames.values()).map((g) => g.opponent).filter(Boolean))];
          const opponentStatsByTeamWeek = new Map<string, any>();
          if (opponentTeams.length > 0) {
            const { data: opponentStats, error: opponentStatsError } = await (supabase as any)
              .from('team_stats_2025')
              .select('*')
              .in('team', opponentTeams)
              .lte('week', 18);
            if (opponentStatsError) {
              console.error('Failed to fetch opponent team_stats_2025 for defense:', opponentStatsError);
            } else {
              for (const row of opponentStats ?? []) {
                if (!row?.team || typeof row?.week !== 'number') continue;
                opponentStatsByTeamWeek.set(`${row.team}__${row.week}`, row);
              }
            }
          }

          const allWeeks: WeeklyStats[] = [];
          for (let week = 1; week <= 18; week++) {
            const game = teamGames.get(week);
            const opponent = game?.opponent || null;
            const pointsAllowed = game?.pointsAllowed ?? null;
            const isByeWeek = !opponent || opponent === '';
            const s = statsByWeek.get(week);
            const opponentStats = opponent ? opponentStatsByTeamWeek.get(`${opponent}__${week}`) : null;
            const ownFrRaw = pickNumber(s ?? {}, ['fumble_recovery_opp', 'fumble_recoveries', 'def_fumbles']);
            const oppSflRaw = pickNumber(opponentStats ?? {}, ['sack_fumble_lost']);
            const fumbleRecTotal =
              ownFrRaw == null && oppSflRaw == null
                ? null
                : (ownFrRaw ?? 0) + (oppSflRaw ?? 0);

            /**
             * BLKK: only the **opponent** row. `fg_blocked` / `pat_blocked` there = that team had kicks blocked
             * (e.g. SEA fg_blocked=1 vs HOU → credit HOU defense), not our own row.
             */
            const oppFgBlocked = pickNumber(opponentStats ?? {}, ['fg_blocked', 'field_goals_blocked']);
            const oppPatBlocked = pickNumber(opponentStats ?? {}, [
              'pat_blocked',
              'xp_blocked',
              'extra_point_blocked',
              'extra_points_blocked',
            ]);
            const blockedKicksTotal =
              oppFgBlocked == null && oppPatBlocked == null ? null : (oppFgBlocked ?? 0) + (oppPatBlocked ?? 0);

            /** Fantasy PA: full opponent score minus TDs scored by opponent defense (INT / fumble return). */
            const rawOpponentScore = pointsAllowed;
            const oppDefTdCount =
              opponentStats != null
                ? (pickInterceptionReturnTds(opponentStats) ?? 0) + (pickFumbleRecoveryReturnTds(opponentStats) ?? 0)
                : 0;
            const fantasyPa =
              rawOpponentScore != null && opponentStats != null
                ? Math.max(0, rawOpponentScore - 6 * oppDefTdCount)
                : rawOpponentScore != null
                  ? rawOpponentScore
                  : null;

            if (s) {
              allWeeks.push({
                week,
                opponent_team: opponent || null,
                fantasy_points: pickNumber(s, ['fantasy_points', 'fantasy_pts']),
                fantasy_points_ppr: pickNumber(s, ['fantasy_points_ppr', 'fantasy_points']),
                passing_yards: null,
                passing_tds: null,
                passing_interceptions: null,
                rushing_yards: null,
                rushing_tds: null,
                carries: null,
                receptions: null,
                receiving_yards: null,
                receiving_tds: null,
                targets: null,
                fg_made: null,
                fg_att: null,
                pat_made: null,
                def_pa:
                  fantasyPa ??
                  pickNumber(s, ['def_pa', 'points_allowed', 'pts_allowed', 'points_against', 'pa']),
                def_total_yards:
                  pickNumber(opponentStats ?? {}, ['total_yards', 'total_yards_allowed']) ??
                  sumNumbers([
                    pickNumber(opponentStats ?? {}, ['rushing_yards']),
                    pickNumber(opponentStats ?? {}, ['passing_yards']),
                    pickNumber(opponentStats ?? {}, ['sack_yards_lost']),
                  ]),
                def_tds: pickInterceptionReturnTds(s),
                def_fumble_recovery_tds: pickFumbleRecoveryReturnTds(s),
                def_special_teams_tds: pickSpecialTeamsTds(s),
                def_interceptions: pickNumber(s, ['def_interceptions', 'def_int', 'interceptions']),
                def_fumbles: pickNumber(s, ['def_fumbles', 'fumble_recoveries', 'fumble_recovery_opp']),
                def_sacks: pickNumber(s, ['def_sacks', 'defensive_sacks', 'sacks']),
                opponent_sack_fumble_lost: oppSflRaw,
                def_blocked_kicks: blockedKicksTotal,
                def_safeties: pickNumber(s, ['def_safties', 'def_safeties', 'safeties', 'sf']),
                defense_team_abbr: scheduleTeam ?? null,
                fumbles: null,
                receiving_fumbles: null,
                rushing_fumbles: null,
                sack_fumbles: null,
                fumble_recovery_opp: fumbleRecTotal,
              });
            } else if (isByeWeek) {
              allWeeks.push({
                week,
                opponent_team: 'BYE',
                fantasy_points: null,
                fantasy_points_ppr: null,
                passing_yards: null,
                passing_tds: null,
                passing_interceptions: null,
                rushing_yards: null,
                rushing_tds: null,
                carries: null,
                receptions: null,
                receiving_yards: null,
                receiving_tds: null,
                targets: null,
                fg_made: null,
                fg_att: null,
                pat_made: null,
                def_pa: null,
                def_total_yards: null,
                def_tds: null,
                def_fumble_recovery_tds: null,
                def_interceptions: null,
                def_fumbles: null,
                def_sacks: null,
                def_special_teams_tds: null,
                opponent_sack_fumble_lost: null,
                def_blocked_kicks: null,
                def_safeties: null,
                defense_team_abbr: scheduleTeam ?? null,
                fumbles: null,
                receiving_fumbles: null,
                rushing_fumbles: null,
                sack_fumbles: null,
                fumble_recovery_opp: null,
              });
            } else {
              allWeeks.push({
                week,
                opponent_team: opponent,
                fantasy_points: null,
                fantasy_points_ppr: null,
                passing_yards: null,
                passing_tds: null,
                passing_interceptions: null,
                rushing_yards: null,
                rushing_tds: null,
                carries: null,
                receptions: null,
                receiving_yards: null,
                receiving_tds: null,
                targets: null,
                fg_made: null,
                fg_att: null,
                pat_made: null,
                def_pa: null,
                def_total_yards: null,
                def_tds: null,
                def_fumble_recovery_tds: null,
                def_special_teams_tds: null,
                def_interceptions: null,
                def_fumbles: null,
                def_sacks: null,
                opponent_sack_fumble_lost: null,
                def_blocked_kicks: null,
                def_safeties: null,
                defense_team_abbr: scheduleTeam ?? null,
                fumbles: null,
                receiving_fumbles: null,
                rushing_fumbles: null,
                sack_fumbles: null,
                fumble_recovery_opp: null,
              });
            }
          }

          setStats(allWeeks);
          return;
        }

        // 1. Resolve gsis_id (weekly_stats uses GSIS format, not espn_id)
        let gsisId: string | null = null;
        if (player.espn_id) {
          const { data: dc } = await supabase
            .from('depth_charts_2025')
            .select('gsis_id')
            .eq('espn_id', player.espn_id)
            .limit(1)
            .maybeSingle();
          if (dc?.gsis_id) gsisId = dc.gsis_id;
          else {
            const { data: r } = await supabase
              .from('rosters_2025')
              .select('gsis_id')
              .eq('espn_id', player.espn_id)
              .limit(1)
              .maybeSingle();
            if (r?.gsis_id) gsisId = r.gsis_id;
          }
        }

        // 2. Get team for schedule: rosters_2025 (current team) or player.team
        let scheduleTeam: string | null = player.team ?? null;
        if (player.espn_id) {
          const { data: roster } = await supabase
            .from('rosters_2025')
            .select('team')
            .eq('espn_id', player.espn_id)
            .order('week', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (roster?.team) scheduleTeam = roster.team;
        }

        // 3. Fetch weekly_stats by gsis_id (or espn_id fallback)
        const statsId = gsisId || player.espn_id;
        let statsData: any[] = [];
        if (statsId) {
          const { data } = await supabase
            .from('weekly_stats_2025')
            .select('*')
            .eq('player_id', statsId)
            .lte('week', 18)
            .order('week', { ascending: true });
          statsData = data ?? [];
        }
        if (statsData.length === 0 && player.espn_id) {
          const { data } = await supabase
            .from('weekly_stats_2025')
            .select('*')
            .eq('player_id', player.espn_id)
            .lte('week', 18)
            .order('week', { ascending: true });
          statsData = data ?? [];
        }
        if (statsData.length === 0) {
          const lastName = player.name.split(' ').pop() || '';
          let query = supabase
            .from('weekly_stats_2025')
            .select('*')
            .ilike('player_name', `%${lastName}%`)
            .lte('week', 18);
          if (player.team) query = query.eq('team', player.team);
          const { data } = await query.order('week', { ascending: true });
          statsData = data ?? [];
        }

        // 4. Build per-week team map for traded players (use team from weekly_stats when available)
        const teamByWeek = new Map<number, string>();
        let lastTeam = scheduleTeam;
        for (let w = 1; w <= 18; w++) {
          const s = statsData.find((x: any) => x.week === w);
          if (s?.team) {
            lastTeam = s.team;
            teamByWeek.set(w, s.team);
          } else if (lastTeam) {
            teamByWeek.set(w, lastTeam);
          } else if (scheduleTeam) {
            teamByWeek.set(w, scheduleTeam);
            lastTeam = scheduleTeam;
          }
        }
        const teams = [...new Set(teamByWeek.values())].filter(Boolean);
        const teamsToFetch = teams.length > 0 ? teams : (scheduleTeam ? [scheduleTeam] : []);

        // 5. Fetch games from games_2025 for the player's team(s)
        const teamGames = new Map<number, { opponent: string; gameday: string | null }>();
        if (teamsToFetch.length > 0) {
          const { data: games } = await supabase
            .from('games_2025')
            .select('week, home_team, away_team, gameday')
            .eq('season', 2025)
            .eq('game_type', 'REG')
            .lte('week', 18)
            .or(teamsToFetch.map(t => `home_team.eq.${t},away_team.eq.${t}`).join(','));
          if (games) {
            for (const g of games) {
              const team = teamByWeek.get(g.week!) || scheduleTeam;
              const home = g.home_team === team;
              const away = g.away_team === team;
              if (home || away) {
                const opponent = home ? g.away_team : g.home_team;
                teamGames.set(g.week!, { opponent: opponent ?? '', gameday: g.gameday ?? null });
              }
            }
          }
        }

        // 6. Merge: build allWeeks from team games + stats
        const statsByWeek = new Map(statsData.map((s: any) => [s.week, s]));
        const allWeeks: WeeklyStats[] = [];
        for (let week = 1; week <= 18; week++) {
          const game = teamGames.get(week);
          const opponent = game?.opponent || null;
          const isByeWeek = !opponent || opponent === '';
          const weekStat = statsByWeek.get(week);

          const mapStat = (s: any) => {
            const kickingPassthrough: Record<string, unknown> = {};
            for (const k of KICKER_WEEKLY_PASSTHROUGH_KEYS) {
              if (Object.prototype.hasOwnProperty.call(s, k) && s[k] !== undefined) {
                kickingPassthrough[k] = s[k];
              }
            }
            return {
            week,
            opponent_team: s.opponent_team || opponent || (isByeWeek ? 'BYE' : null),
            fantasy_points: s.fantasy_points,
            fantasy_points_ppr: s.fantasy_points_ppr,
            passing_yards: s.passing_yards,
            passing_tds: s.passing_tds,
            passing_interceptions: s.passing_interceptions,
            rushing_yards: s.rushing_yards,
            rushing_tds: s.rushing_tds,
            carries: s.carries,
            receptions: s.receptions,
            receiving_yards: s.receiving_yards,
            receiving_tds: s.receiving_tds,
            targets: s.targets,
            fg_made: s.fg_made,
            fg_att: s.fg_att,
            pat_made: s.pat_made,
            pat_att: s.pat_att ?? s.xpa ?? null,
            ...kickingPassthrough,
            def_pa: null,
            def_total_yards: null,
            def_tds: s.def_tds,
            def_fumble_recovery_tds: null,
            def_special_teams_tds: null,
            def_interceptions: s.def_interceptions,
            def_fumbles: s.def_fumbles,
            def_sacks: s.def_sacks,
            opponent_sack_fumble_lost: null,
            def_blocked_kicks: null,
            def_safeties: null,
            defense_team_abbr: null,
            fumbles: ((s.receiving_fumbles || 0) + (s.rushing_fumbles || 0) + (s.sack_fumbles || 0)),
            receiving_fumbles: s.receiving_fumbles,
            rushing_fumbles: s.rushing_fumbles,
            sack_fumbles: s.sack_fumbles,
            fumble_recovery_opp: s.fumble_recovery_opp,
            // Distance lists for kicker hover (weekly row; snake_case or camelCase from API).
            fg_made_list: s.fg_made_list ?? s.fgMadeList,
            fg_missed_list: s.fg_missed_list ?? s.fgMissedList,
          };
          };

          if (weekStat) {
            allWeeks.push(mapStat(weekStat));
          } else if (isByeWeek) {
            allWeeks.push({
              week,
              opponent_team: 'BYE',
              fantasy_points: null,
              fantasy_points_ppr: null,
              passing_yards: null,
              passing_tds: null,
              passing_interceptions: null,
              rushing_yards: null,
              rushing_tds: null,
              carries: null,
              receptions: null,
              receiving_yards: null,
              receiving_tds: null,
              targets: null,
              fg_made: null,
              fg_att: null,
              pat_made: null,
              pat_att: null,
              def_pa: null,
              def_total_yards: null,
              def_tds: null,
              def_fumble_recovery_tds: null,
              def_special_teams_tds: null,
              def_interceptions: null,
              def_fumbles: null,
              def_sacks: null,
              opponent_sack_fumble_lost: null,
              def_blocked_kicks: null,
              def_safeties: null,
              defense_team_abbr: null,
              fumbles: null,
              receiving_fumbles: null,
              rushing_fumbles: null,
              sack_fumbles: null,
              fumble_recovery_opp: null,
            });
          } else {
            allWeeks.push({
              week,
              opponent_team: opponent,
              fantasy_points: null,
              fantasy_points_ppr: null,
              passing_yards: null,
              passing_tds: null,
              passing_interceptions: null,
              rushing_yards: null,
              rushing_tds: null,
              carries: null,
              receptions: null,
              receiving_yards: null,
              receiving_tds: null,
              targets: null,
              fg_made: null,
              fg_att: null,
              pat_made: null,
              pat_att: null,
              def_pa: null,
              def_total_yards: null,
              def_tds: null,
              def_fumble_recovery_tds: null,
              def_special_teams_tds: null,
              def_interceptions: null,
              def_fumbles: null,
              def_sacks: null,
              opponent_sack_fumble_lost: null,
              def_blocked_kicks: null,
              def_safeties: null,
              defense_team_abbr: null,
              fumbles: null,
              receiving_fumbles: null,
              rushing_fumbles: null,
              sack_fumbles: null,
              fumble_recovery_opp: null,
            });
          }
        }

        setStats(allWeeks);
      }
    } catch (error) {
      console.error('Failed to fetch player data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatsForView = (position: string, view: string) => {
    if (position === 'QB') {
      if (view === 'passing') {
        return [
          { key: 'passing_yards', label: 'Yds' },
          { key: 'passing_tds', label: 'TDs' },
          { key: 'int_fum', label: 'Int/Fum' }, // Combined stat
        ];
      } else {
        return [
          { key: 'rushing_yards', label: 'Yds' },
          { key: 'rushing_tds', label: 'TDs' },
        ];
      }
    } else if (position === 'RB' || position === 'FB') {
      if (view === 'rushing') {
        return [
          { key: 'carries', label: 'Att' },
          { key: 'rushing_yards', label: 'Yds' },
          { key: 'rushing_tds', label: 'TDs' },
        ];
      } else {
        return [
          { key: 'receptions', label: 'Rec' },
          { key: 'receiving_yards', label: 'Yds' },
          { key: 'receiving_tds', label: 'TDs' },
        ];
      }
    } else if (position === 'WR' || position === 'TE') {
      if (view === 'receiving') {
        return [
          { key: 'receptions', label: 'Rec' },
          { key: 'targets', label: 'Tgt' },
          { key: 'receiving_yards', label: 'Yds' },
          { key: 'receiving_tds', label: 'TDs' },
        ];
      } else {
        return [
          { key: 'carries', label: 'Att' },
          { key: 'rushing_yards', label: 'Yds' },
          { key: 'rushing_tds', label: 'TDs' },
        ];
      }
    } else if (position === 'K') {
      return [
        { key: 'pat_att', label: 'XPA' },
        { key: 'pat_made', label: 'XPM' },
        { key: 'fg_made', label: 'FGM' },
        { key: 'fg_att', label: 'FGA' },
      ];
    } else if (position === 'D/ST') {
      return [
        { key: 'def_pa', label: 'PA' }, // Points allowed - placeholder for now
        { key: 'def_total_yards', label: 'Yds' },
        { key: 'def_interceptions', label: 'INT' },
        { key: 'fumble_recovery_opp', label: 'FR' },
        { key: 'def_sacks', label: 'Sck' },
        { key: 'def_blocked_kicks', label: 'Blk' },
        { key: 'def_tds', label: 'TD' },
      ];
    }
    return [];
  };

  const getStatValue = (game: WeeklyStats, statKey: string) => {
    if (game.opponent_team === 'BYE') return '-';
    
    if (statKey === 'int_fum') {
      const ints = game.passing_interceptions || 0;
      const fums = game.fumbles || 0;
      if (ints === 0 && fums === 0) return '0/0';
      return `${ints}/${fums}`;
    }
    
    if (statKey === 'def_pa') {
      return game.def_pa !== null && game.def_pa !== undefined ? game.def_pa : '-';
    }

    if (statKey === 'def_blocked_kicks') {
      return game.def_blocked_kicks != null && game.def_blocked_kicks !== undefined ? game.def_blocked_kicks : '-';
    }

    if (statKey === 'pat_att') {
      const v = game.pat_att ?? (game as WeeklyStats & { xpa?: number | null }).xpa;
      return v !== null && v !== undefined ? v : '-';
    }

    /** TD column: INT-return + fumble-recovery return + ST return TDs (+6 each in scoring). */
    if (statKey === 'def_tds') {
      const a = game.def_tds;
      const b = game.def_fumble_recovery_tds;
      const c = game.def_special_teams_tds;
      if (a == null && b == null && c == null) return '-';
      return (a ?? 0) + (b ?? 0) + (c ?? 0);
    }

    const value = game[statKey];
    return value !== null && value !== undefined ? value : '-';
  };

  /** Must run before any early return — comparison search depends on current `player`. */
  const comparisonPositionFilter = player
    ? isDefensePosition(player.position)
      ? 'D/ST'
      : (player.position || '').toUpperCase() === 'K'
        ? 'K'
        : undefined
    : undefined;
  const comparisonExcludedPositions =
    player && comparisonPositionFilter == null ? ['K', 'D/ST', 'DEF', 'DST'] : [];
  const comparisonExcludedPositionsKey = comparisonExcludedPositions.join('|');

  useEffect(() => {
    if (!open || !player) return;
    const q = comparisonQuery.trim();
    if (!q) {
      setComparisonResults([]);
      setComparisonLoading(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setComparisonLoading(true);
      const normalizedQ = q.toLowerCase();
      let queryBuilder = supabase
        .from('players')
        .select('*')
        .in('season', [PLAYER_POOL_PRIOR_SEASON, PLAYER_POOL_CURRENT_SEASON])
        .or(`name.ilike.%${normalizedQ}%,team.ilike.%${normalizedQ}%`)
        .order('adp', { ascending: true })
        .limit(60);

      if (comparisonPositionFilter) {
        queryBuilder = queryBuilder.eq('position', comparisonPositionFilter);
      } else {
        queryBuilder = queryBuilder.in('position', ['QB', 'RB', 'WR', 'TE']);
      }

      const { data, error } = await queryBuilder;
      if (error) {
        console.error('Failed player comparison search:', error);
        setComparisonResults([]);
        setComparisonLoading(false);
        return;
      }

      const merged = mergePlayerPoolAcrossSeasons(
        data ?? [],
        PLAYER_POOL_PRIOR_SEASON,
        PLAYER_POOL_CURRENT_SEASON
      );

      const normalizePosition = (position: string) => {
        const p = (position || '').toUpperCase();
        if (p === 'DEF' || p === 'DST') return 'D/ST';
        return p;
      };
      const excludedPositionsSet = new Set(
        comparisonExcludedPositionsKey.split('|').filter(Boolean).map((p) => normalizePosition(p))
      );
      const filtered = merged.filter((p) => {
        if (p.id === player.id) return false;
        if (excludedPositionsSet.size > 0 && excludedPositionsSet.has(normalizePosition(p.position))) return false;
        return true;
      });
      setComparisonResults(filtered.slice(0, 20));
      setComparisonLoading(false);
    }, 200);

    return () => clearTimeout(timeout);
  }, [comparisonQuery, open, player, comparisonPositionFilter, comparisonExcludedPositionsKey]);

  useEffect(() => {
    if (!open || !player || !comparisonPlayer) {
      setComparisonWeeklyExtras(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [left, right] = await Promise.all([
        fetchWeeklyComparisonExtras(player),
        fetchWeeklyComparisonExtras(comparisonPlayer),
      ]);
      if (!cancelled) setComparisonWeeklyExtras({ left, right });
    })();
    return () => {
      cancelled = true;
    };
  }, [open, player, comparisonPlayer]);

  useEffect(() => {
    if (!comparisonPlayer) {
      setComparisonPlayerAge(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const age = await fetchPlayerAgeFromEspn(comparisonPlayer.espn_id);
      if (!cancelled) setComparisonPlayerAge(age);
    })();
    return () => {
      cancelled = true;
    };
  }, [comparisonPlayer]);

  const teamContext = useNflTeamContext();

  const teamComparisonRows = useMemo(() => {
    if (!player || !comparisonPlayer) return [];
    const cs = allStats2025?.get(comparisonPlayer.id);
    if (!cs) return [];
    const tl = resolveTeamAbbrForDisplay(player.team, player.position, player.name);
    const tr = resolveTeamAbbrForDisplay(comparisonPlayer.team, comparisonPlayer.position, comparisonPlayer.name);
    const defs: { label: string; metric: TeamRankMetric }[] = [
      { label: 'Off PPG', metric: 'offPpg' },
      { label: 'Off Pass YPG', metric: 'offPassYpg' },
      { label: 'Off Rush YPG', metric: 'offRushYpg' },
      { label: 'Def YPG allowed', metric: 'defYpg' },
      { label: 'Def PPG allowed', metric: 'defPpg' },
    ];
    const fromRanks = defs.map(({ label, metric }) => {
      const lr = teamContext.getRank(tl, metric);
      const rr = teamContext.getRank(tr, metric);
      return {
        label,
        left: lr != null ? String(lr) : '—',
        right: rr != null ? String(rr) : '—',
        compareLeft: lr,
        compareRight: rr,
        lowerRankWins: true,
      };
    });
    const offEnd = 3;
    const leftCtx = teamContext.getForTeam(tl);
    const rightCtx = teamContext.getForTeam(tr);
    const olineOverallL = leftCtx?.oline_unit_rank ?? null;
    const olineOverallR = rightCtx?.oline_unit_rank ?? null;
    const olinePassL = leftCtx?.oline_pass_rank ?? null;
    const olinePassR = rightCtx?.oline_pass_rank ?? null;
    const olineRunL = leftCtx?.oline_run_rank ?? null;
    const olineRunR = rightCtx?.oline_run_rank ?? null;
    const olineRows: typeof fromRanks = [
      {
        label: 'O-line overall rank',
        left: olineOverallL != null ? String(olineOverallL) : '—',
        right: olineOverallR != null ? String(olineOverallR) : '—',
        compareLeft: olineOverallL,
        compareRight: olineOverallR,
        lowerRankWins: true,
      },
      {
        label: 'O-line pass rank',
        left: olinePassL != null ? String(olinePassL) : '—',
        right: olinePassR != null ? String(olinePassR) : '—',
        compareLeft: olinePassL,
        compareRight: olinePassR,
        lowerRankWins: true,
      },
      {
        label: 'O-line run rank',
        left: olineRunL != null ? String(olineRunL) : '—',
        right: olineRunR != null ? String(olineRunR) : '—',
        compareLeft: olineRunL,
        compareRight: olineRunR,
        lowerRankWins: true,
      },
    ];
    const mergedTeamRows = [...fromRanks.slice(0, offEnd), ...olineRows, ...fromRanks.slice(offEnd)];
    const sosLp = teamContext.getSosOppWinPct(tl);
    const sosLr = teamContext.getSosRank(tl);
    const sosRp = teamContext.getSosOppWinPct(tr);
    const sosRr = teamContext.getSosRank(tr);
    return [
      ...mergedTeamRows,
      {
        label: '2026 SOS',
        left:
          sosLp != null && sosLr != null ? formatSosCellDisplay(sosLp, sosLr) : '—',
        right:
          sosRp != null && sosRr != null ? formatSosCellDisplay(sosRp, sosRr) : '—',
        compareLeft: sosLr,
        compareRight: sosRr,
        higherWins: true,
        sosCells: {
          leftPct: sosLp,
          leftRank: sosLr,
          rightPct: sosRp,
          rightRank: sosRr,
        },
      },
    ];
  }, [player, comparisonPlayer, allStats2025, teamContext]);

  if (!player) return null;

  const comparisonStats = comparisonPlayer ? allStats2025?.get(comparisonPlayer.id) ?? null : null;
  const hasComparison = !!comparisonPlayer && !!comparisonStats;

  const formatStat = (value: number | null | undefined, digits = 1) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '-';
    return digits === 0 ? Math.round(value).toLocaleString() : value.toFixed(digits);
  };

  const formatPosRank = (rank: string | null | undefined) => {
    if (!rank) return '-';
    const numericPart = rank.match(/\d+$/)?.[0];
    return numericPart ?? rank;
  };

  function parseRankNumber(rank: string | null | undefined): number | null {
    if (!rank) return null;
    const m = rank.match(/(\d+)\s*$/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeSkillPos(position: string | null | undefined): string | null {
    const p = (position || '').trim().toUpperCase();
    if (p === 'FB') return 'RB';
    if (p === 'DEF' || p === 'DST') return 'D/ST';
    if (p === 'QB' || p === 'RB' || p === 'WR' || p === 'TE' || p === 'K' || p === 'D/ST') return p;
    return null;
  }

  type ComparisonRow = {
    label: string;
    left: string;
    right: string;
    compareLeft?: number | null;
    compareRight?: number | null;
    /** Higher numeric value is better (default). */
    higherWins?: boolean;
    /** Lower rank number is better (QB1 vs QB12). */
    lowerRankWins?: boolean;
    /** Lower numeric value is better (e.g. interceptions). */
    lowerIsBetter?: boolean;
    /** Do not highlight a winner (e.g. Age). */
    skipBold?: boolean;
    /** 2026 SOS: pill highlights opponent win % only; rank follows in parentheses */
    sosCells?: {
      leftPct: number | null;
      leftRank: number | null;
      rightPct: number | null;
      rightRank: number | null;
    };
  };

  function pickBoldSide(row: ComparisonRow): 'left' | 'right' | null {
    if (row.skipBold) return null;
    const leftNum = row.compareLeft;
    const rightNum = row.compareRight;
    if (leftNum === undefined || rightNum === undefined) return null;
    if (leftNum === null || rightNum === null) return null;
    if (typeof leftNum !== 'number' || typeof rightNum !== 'number') return null;
    if (Number.isNaN(leftNum) || Number.isNaN(rightNum)) return null;
    if (leftNum === rightNum) return null;
    if (row.lowerRankWins || row.lowerIsBetter) {
      return leftNum < rightNum ? 'left' : 'right';
    }
    return leftNum > rightNum ? 'left' : 'right';
  }

  const offenseTotalTds = (s: Player2025Stats | null | undefined) =>
    s ? s.totalPassTds + s.totalRushTds + s.totalRecTds : null;

  const passYpg = (s: Player2025Stats | null | undefined): number | null =>
    s && s.gamesPlayed > 0 ? s.totalPassYards / s.gamesPlayed : null;

  const buildComparisonRows = (
    posA: string,
    posB: string,
    a: Player2025Stats | null | undefined,
    b: Player2025Stats | null | undefined,
    exA: ComparisonWeeklyExtras | null | undefined,
    exB: ComparisonWeeklyExtras | null | undefined,
    ageA: number | null,
    ageB: number | null
  ): ComparisonRow[] => {
    const ppgAndPosRankHead = (): ComparisonRow[] => [
      {
        label: 'PPG',
        left: formatStat(a?.avgPointsPerGame, 2),
        right: formatStat(b?.avgPointsPerGame, 2),
        compareLeft: a?.avgPointsPerGame ?? null,
        compareRight: b?.avgPointsPerGame ?? null,
        higherWins: true,
      },
      {
        label: 'Pos Rank',
        left: formatPosRank(a?.positionRank),
        right: formatPosRank(b?.positionRank),
        compareLeft: parseRankNumber(a?.positionRank),
        compareRight: parseRankNumber(b?.positionRank),
        lowerRankWins: true,
      },
    ];

    const headRows = (): ComparisonRow[] => [
      ...ppgAndPosRankHead(),
      {
        label: 'Age',
        left: ageA != null ? String(ageA) : '-',
        right: ageB != null ? String(ageB) : '-',
        skipBold: true,
      },
    ];

    const gamesPlayedRow: ComparisonRow = {
      label: 'Games Played',
      left: formatStat(a?.gamesPlayed, 0),
      right: formatStat(b?.gamesPlayed, 0),
      compareLeft: a?.gamesPlayed ?? null,
      compareRight: b?.gamesPlayed ?? null,
      higherWins: true,
    };

    if (isDefensePosition(posA) && isDefensePosition(posB)) {
      return [
        ...ppgAndPosRankHead(),
        {
          label: 'Sacks',
          left: formatStat(a?.totalDefSacks, 0),
          right: formatStat(b?.totalDefSacks, 0),
          compareLeft: a?.totalDefSacks ?? null,
          compareRight: b?.totalDefSacks ?? null,
          higherWins: true,
        },
        {
          label: 'Interceptions',
          left: formatStat(a?.totalDefInterceptions, 0),
          right: formatStat(b?.totalDefInterceptions, 0),
          compareLeft: a?.totalDefInterceptions ?? null,
          compareRight: b?.totalDefInterceptions ?? null,
          higherWins: true,
        },
        {
          label: 'Fumble Recoveries',
          left: formatStat(a?.totalDefFumbleRecoveries, 0),
          right: formatStat(b?.totalDefFumbleRecoveries, 0),
          compareLeft: a?.totalDefFumbleRecoveries ?? null,
          compareRight: b?.totalDefFumbleRecoveries ?? null,
          higherWins: true,
        },
        {
          label: 'Total TDs',
          left: formatStat(a?.totalDefTds, 0),
          right: formatStat(b?.totalDefTds, 0),
          compareLeft: a?.totalDefTds ?? null,
          compareRight: b?.totalDefTds ?? null,
          higherWins: true,
        },
      ];
    }

    if (posA === 'K' && posB === 'K') {
      const fgPctL = kickerFgPctNumber(a?.kickerSeason?.fgMade, a?.kickerSeason?.fgAtt);
      const fgPctR = kickerFgPctNumber(b?.kickerSeason?.fgMade, b?.kickerSeason?.fgAtt);
      return [
        ...headRows(),
        {
          label: 'XPM',
          left: formatStat(a?.kickerSeason?.patMade, 0),
          right: formatStat(b?.kickerSeason?.patMade, 0),
          compareLeft: a?.kickerSeason?.patMade ?? null,
          compareRight: b?.kickerSeason?.patMade ?? null,
          higherWins: true,
        },
        {
          label: 'XPA',
          left: formatStat(a?.kickerSeason?.patAtt, 0),
          right: formatStat(b?.kickerSeason?.patAtt, 0),
          compareLeft: a?.kickerSeason?.patAtt ?? null,
          compareRight: b?.kickerSeason?.patAtt ?? null,
          higherWins: true,
        },
        {
          label: 'FG Made',
          left: formatStat(a?.kickerSeason?.fgMade, 0),
          right: formatStat(b?.kickerSeason?.fgMade, 0),
          compareLeft: a?.kickerSeason?.fgMade ?? null,
          compareRight: b?.kickerSeason?.fgMade ?? null,
          higherWins: true,
        },
        {
          label: 'FG Att',
          left: formatStat(a?.kickerSeason?.fgAtt, 0),
          right: formatStat(b?.kickerSeason?.fgAtt, 0),
          compareLeft: a?.kickerSeason?.fgAtt ?? null,
          compareRight: b?.kickerSeason?.fgAtt ?? null,
          higherWins: true,
        },
        {
          label: 'FG%',
          left: fgPctL != null ? `${fgPctL.toFixed(1)}%` : '-',
          right: fgPctR != null ? `${fgPctR.toFixed(1)}%` : '-',
          compareLeft: fgPctL,
          compareRight: fgPctR,
          higherWins: true,
        },
        {
          label: 'FG Long',
          left: formatStat(exA?.longestFgYards ?? null, 0),
          right: formatStat(exB?.longestFgYards ?? null, 0),
          compareLeft: exA?.longestFgYards ?? null,
          compareRight: exB?.longestFgYards ?? null,
          higherWins: true,
        },
        gamesPlayedRow,
      ];
    }

    const skillA = normalizeSkillPos(posA);
    const skillB = normalizeSkillPos(posB);
    const sameSkillClass =
      skillA != null &&
      skillB != null &&
      skillA === skillB &&
      ['QB', 'RB', 'WR', 'TE'].includes(skillA);

    const crossSkillOverlap = (): ComparisonRow[] => {
      const rows: ComparisonRow[] = [...headRows()];
      const ca = normalizeSkillPos(posA);
      const cb = normalizeSkillPos(posB);
      const isQbRbPair =
        (ca === 'QB' && cb === 'RB') || (ca === 'RB' && cb === 'QB');
      rows.push({
        label: 'Total TDs',
        left: formatStat(offenseTotalTds(a), 0),
        right: formatStat(offenseTotalTds(b), 0),
        compareLeft: offenseTotalTds(a),
        compareRight: offenseTotalTds(b),
        higherWins: true,
      });
      const showReceivingCross =
        !isQbRbPair &&
        (ca === 'WR' ||
          ca === 'TE' ||
          cb === 'WR' ||
          cb === 'TE' ||
          ca === 'RB' ||
          cb === 'RB');
      if (showReceivingCross) {
        rows.push(
          {
            label: 'Rec Yards',
            left: formatStat(a?.totalRecYards, 0),
            right: formatStat(b?.totalRecYards, 0),
            compareLeft: a?.totalRecYards ?? null,
            compareRight: b?.totalRecYards ?? null,
            higherWins: true,
          },
          {
            label: 'Rec TDs',
            left: formatStat(a?.totalRecTds, 0),
            right: formatStat(b?.totalRecTds, 0),
            compareLeft: a?.totalRecTds ?? null,
            compareRight: b?.totalRecTds ?? null,
            higherWins: true,
          },
          {
            label: 'Receptions',
            left: formatStat(a?.totalReceptions, 0),
            right: formatStat(b?.totalReceptions, 0),
            compareLeft: a?.totalReceptions ?? null,
            compareRight: b?.totalReceptions ?? null,
            higherWins: true,
          },
          {
            label: 'Targets',
            left: formatStat(a?.totalTargets, 0),
            right: formatStat(b?.totalTargets, 0),
            compareLeft: a?.totalTargets ?? null,
            compareRight: b?.totalTargets ?? null,
            higherWins: true,
          }
        );
      }
      rows.push(
        {
          label: 'Rush Yards',
          left: formatStat(a?.totalRushYards, 0),
          right: formatStat(b?.totalRushYards, 0),
          compareLeft: a?.totalRushYards ?? null,
          compareRight: b?.totalRushYards ?? null,
          higherWins: true,
        },
        {
          label: 'Rush TDs',
          left: formatStat(a?.totalRushTds, 0),
          right: formatStat(b?.totalRushTds, 0),
          compareLeft: a?.totalRushTds ?? null,
          compareRight: b?.totalRushTds ?? null,
          higherWins: true,
        }
      );
      rows.push(gamesPlayedRow);
      return rows;
    };

    if (!sameSkillClass) {
      return crossSkillOverlap();
    }

    const p = posA;
    if (p === 'QB') {
      return [
        ...headRows(),
        {
          label: 'Pass Yards',
          left: formatStat(a?.totalPassYards, 0),
          right: formatStat(b?.totalPassYards, 0),
          compareLeft: a?.totalPassYards ?? null,
          compareRight: b?.totalPassYards ?? null,
          higherWins: true,
        },
        {
          label: 'YPG',
          left: formatStat(passYpg(a), 1),
          right: formatStat(passYpg(b), 1),
          compareLeft: passYpg(a),
          compareRight: passYpg(b),
          higherWins: true,
        },
        {
          label: 'Pass Att',
          left: formatStat(exA?.passAttempts ?? null, 0),
          right: formatStat(exB?.passAttempts ?? null, 0),
          compareLeft: exA?.passAttempts ?? null,
          compareRight: exB?.passAttempts ?? null,
          higherWins: true,
        },
        {
          label: 'Pass TDs',
          left: formatStat(a?.totalPassTds, 0),
          right: formatStat(b?.totalPassTds, 0),
          compareLeft: a?.totalPassTds ?? null,
          compareRight: b?.totalPassTds ?? null,
          higherWins: true,
        },
        {
          label: 'Interceptions',
          left: formatStat(a?.totalInterceptions, 0),
          right: formatStat(b?.totalInterceptions, 0),
          compareLeft: a?.totalInterceptions ?? null,
          compareRight: b?.totalInterceptions ?? null,
          lowerIsBetter: true,
        },
        {
          label: 'Rush Yards',
          left: formatStat(a?.totalRushYards, 0),
          right: formatStat(b?.totalRushYards, 0),
          compareLeft: a?.totalRushYards ?? null,
          compareRight: b?.totalRushYards ?? null,
          higherWins: true,
        },
        {
          label: 'Fumbles',
          left: formatStat(exA?.fumbles ?? null, 0),
          right: formatStat(exB?.fumbles ?? null, 0),
          compareLeft: exA?.fumbles ?? null,
          compareRight: exB?.fumbles ?? null,
          lowerIsBetter: true,
        },
        {
          label: 'Rush TDs',
          left: formatStat(a?.totalRushTds, 0),
          right: formatStat(b?.totalRushTds, 0),
          compareLeft: a?.totalRushTds ?? null,
          compareRight: b?.totalRushTds ?? null,
          higherWins: true,
        },
        {
          label: 'Total TDs',
          left: formatStat(offenseTotalTds(a), 0),
          right: formatStat(offenseTotalTds(b), 0),
          compareLeft: offenseTotalTds(a),
          compareRight: offenseTotalTds(b),
          higherWins: true,
        },
        gamesPlayedRow,
      ];
    }

    if (p === 'RB' || p === 'FB') {
      return [
        ...headRows(),
        {
          label: 'Attempts',
          left: formatStat(exA?.rushAttempts ?? null, 0),
          right: formatStat(exB?.rushAttempts ?? null, 0),
          compareLeft: exA?.rushAttempts ?? null,
          compareRight: exB?.rushAttempts ?? null,
          higherWins: true,
        },
        {
          label: 'Rush Yards',
          left: formatStat(a?.totalRushYards, 0),
          right: formatStat(b?.totalRushYards, 0),
          compareLeft: a?.totalRushYards ?? null,
          compareRight: b?.totalRushYards ?? null,
          higherWins: true,
        },
        {
          label: 'Rush TDs',
          left: formatStat(a?.totalRushTds, 0),
          right: formatStat(b?.totalRushTds, 0),
          compareLeft: a?.totalRushTds ?? null,
          compareRight: b?.totalRushTds ?? null,
          higherWins: true,
        },
        {
          label: 'Receptions',
          left: formatStat(a?.totalReceptions, 0),
          right: formatStat(b?.totalReceptions, 0),
          compareLeft: a?.totalReceptions ?? null,
          compareRight: b?.totalReceptions ?? null,
          higherWins: true,
        },
        {
          label: 'Targets',
          left: formatStat(a?.totalTargets, 0),
          right: formatStat(b?.totalTargets, 0),
          compareLeft: a?.totalTargets ?? null,
          compareRight: b?.totalTargets ?? null,
          higherWins: true,
        },
        {
          label: 'Rec Yards',
          left: formatStat(a?.totalRecYards, 0),
          right: formatStat(b?.totalRecYards, 0),
          compareLeft: a?.totalRecYards ?? null,
          compareRight: b?.totalRecYards ?? null,
          higherWins: true,
        },
        {
          label: 'Rec TDs',
          left: formatStat(a?.totalRecTds, 0),
          right: formatStat(b?.totalRecTds, 0),
          compareLeft: a?.totalRecTds ?? null,
          compareRight: b?.totalRecTds ?? null,
          higherWins: true,
        },
        {
          label: 'Fumbles',
          left: formatStat(exA?.fumbles ?? null, 0),
          right: formatStat(exB?.fumbles ?? null, 0),
          compareLeft: exA?.fumbles ?? null,
          compareRight: exB?.fumbles ?? null,
          lowerIsBetter: true,
        },
        {
          label: 'Total TDs',
          left: formatStat(offenseTotalTds(a), 0),
          right: formatStat(offenseTotalTds(b), 0),
          compareLeft: offenseTotalTds(a),
          compareRight: offenseTotalTds(b),
          higherWins: true,
        },
        gamesPlayedRow,
      ];
    }

    if (p === 'WR' || p === 'TE') {
      return [
        ...headRows(),
        {
          label: 'Targets',
          left: formatStat(a?.totalTargets, 0),
          right: formatStat(b?.totalTargets, 0),
          compareLeft: a?.totalTargets ?? null,
          compareRight: b?.totalTargets ?? null,
          higherWins: true,
        },
        {
          label: 'Receptions',
          left: formatStat(a?.totalReceptions, 0),
          right: formatStat(b?.totalReceptions, 0),
          compareLeft: a?.totalReceptions ?? null,
          compareRight: b?.totalReceptions ?? null,
          higherWins: true,
        },
        {
          label: 'Rec Yards',
          left: formatStat(a?.totalRecYards, 0),
          right: formatStat(b?.totalRecYards, 0),
          compareLeft: a?.totalRecYards ?? null,
          compareRight: b?.totalRecYards ?? null,
          higherWins: true,
        },
        {
          label: 'Rec TDs',
          left: formatStat(a?.totalRecTds, 0),
          right: formatStat(b?.totalRecTds, 0),
          compareLeft: a?.totalRecTds ?? null,
          compareRight: b?.totalRecTds ?? null,
          higherWins: true,
        },
        {
          label: 'Rush Yards',
          left: formatStat(a?.totalRushYards, 0),
          right: formatStat(b?.totalRushYards, 0),
          compareLeft: a?.totalRushYards ?? null,
          compareRight: b?.totalRushYards ?? null,
          higherWins: true,
        },
        {
          label: 'Rush TDs',
          left: formatStat(a?.totalRushTds, 0),
          right: formatStat(b?.totalRushTds, 0),
          compareLeft: a?.totalRushTds ?? null,
          compareRight: b?.totalRushTds ?? null,
          higherWins: true,
        },
        {
          label: 'Total TDs',
          left: formatStat(offenseTotalTds(a), 0),
          right: formatStat(offenseTotalTds(b), 0),
          compareLeft: offenseTotalTds(a),
          compareRight: offenseTotalTds(b),
          higherWins: true,
        },
        gamesPlayedRow,
      ];
    }

    return crossSkillOverlap();
  };

  const comparisonRows =
    comparisonPlayer && comparisonStats
      ? buildComparisonRows(
          player.position,
          comparisonPlayer.position,
          stats2025 ?? null,
          comparisonStats,
          comparisonWeeklyExtras?.left ?? null,
          comparisonWeeklyExtras?.right ?? null,
          playerAge,
          comparisonPlayerAge
        )
      : [];

  const activeComparisonRows =
    comparisonStatSource === 'team' ? teamComparisonRows : comparisonRows;

  const statsForView = getStatsForView(player.position, statView);
  const teamRankSubtitleLeft = nflTeamSubtitleFullName(player.team, player.position, player.name);
  const teamRankSubtitleRight = comparisonPlayer
    ? nflTeamSubtitleFullName(comparisonPlayer.team, comparisonPlayer.position, comparisonPlayer.name)
    : '';
  /** D/ST names already include the club; avoid duplicating the full team line under each name */
  const showTeamRankHeaderSubtitle =
    comparisonStatSource === 'team' &&
    !(isDefensePosition(player.position) && comparisonPlayer && isDefensePosition(comparisonPlayer.position));
  const showStatTabs = (player.position === 'QB' || player.position === 'RB' || player.position === 'FB' || player.position === 'WR' || player.position === 'TE');
  const jerseyTeamAbbr = resolveTeamAbbrForDisplay(player.team, player.position, player.name);
  const numberFill = lookupJerseyNumberFill(jerseyColorsByAbbr, jerseyTeamAbbr);
  const displayPosRank = stats2025?.positionRank ? (stats2025.positionRank.match(/\d+$/)?.[0] ?? stats2025.positionRank) : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" aria-describedby={undefined}>
        <DialogHeader className="relative pb-2">
          <div className="flex items-stretch justify-between gap-4">
            <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
              <DialogTitle className="flex items-center gap-3 flex-wrap">
                <PlayerJerseyWithNumber
                  team={jerseyTeamAbbr}
                  jerseyNumber={player.jersey_number ?? 0}
                  numberFillColor={numberFill}
                  size="dialog"
                  position={player.position}
                />
                <span className="font-display text-2xl">{player.name}</span>
                <PositionBadge position={player.position} />
              </DialogTitle>
              <PlayerHeaderStatsLine
                position={player.position}
                team={player.team}
                playerName={player.name}
                adp={player.adp}
                byeWeek={player.bye_week}
                age={playerAge}
                positionAdpRank={positionAdpRank}
                className="mt-0 mb-0"
              />
            </div>
            {stats2025 && (
              <div className="shrink-0 rounded-lg border-2 border-primary/30 bg-primary/5 px-5 py-4 min-w-[200px]">
                <p className="text-sm font-semibold text-foreground mb-3">2025 Stats</p>
                <div className="flex items-center justify-between gap-6 text-base mb-3">
                  <span><span className="text-muted-foreground">Pos Rk:</span> <span className="font-semibold">{displayPosRank}</span></span>
                  <span>
                    <span className="text-muted-foreground">Pts:</span>{' '}
                    {isDefensePosition(player.position) ? (
                      <span className="font-semibold text-primary">{stats2025.totalFantasyPoints.toFixed(1)}</span>
                    ) : (
                      <FantasyPointsWithBreakdown
                        displayValue={stats2025.totalFantasyPoints.toFixed(1)}
                        stats={seasonHeaderOffenseInput}
                        breakdownOverride={
                          player.position === 'K' ? seasonKickerHeaderBreakdownOverride ?? undefined : undefined
                        }
                        scoringFormat={scoringFormat}
                      />
                    )}
                  </span>
                </div>
                <div className="pt-2 border-t border-border/50 space-y-1.5 text-sm">
                  {isDefensePosition(player.position) && (
                    <>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Sacks</span>
                        <span className="font-medium">{stats2025.totalDefSacks.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Interceptions</span>
                        <span className="font-medium">{stats2025.totalDefInterceptions.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Fumble Recoveries</span>
                        <span className="font-medium">{stats2025.totalDefFumbleRecoveries.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between gap-4 pt-1">
                        <span className="text-muted-foreground">Total TDs</span>
                        <span className="font-medium">{stats2025.totalDefTds.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                  {(player.position === 'QB') && (
                    <>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Pass Yds</span>
                        <span className="font-medium">{stats2025.totalPassYards.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Rush Yds</span>
                        <span className="font-medium">{stats2025.totalRushYards.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">INT</span>
                        <span className="font-medium">{stats2025.totalInterceptions.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                  {(player.position === 'WR' || player.position === 'TE') && (
                    <>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Rec Yds</span>
                        <span className="font-medium">{stats2025.totalRecYards.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Targets</span>
                        <span className="font-medium">{stats2025.totalTargets.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Receptions</span>
                        <span className="font-medium">{stats2025.totalReceptions.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                  {(player.position === 'RB' || player.position === 'FB') && (
                    <>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Rush Yds</span>
                        <span className="font-medium">{stats2025.totalRushYards.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Rec Yds</span>
                        <span className="font-medium">{stats2025.totalRecYards.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                  {(player.position === 'QB' || player.position === 'RB' || player.position === 'FB' || player.position === 'WR' || player.position === 'TE') && (
                    <div className="flex justify-between gap-4 pt-1">
                      <span className="text-muted-foreground">Total TDs</span>
                      <span className="font-medium">
                        {(stats2025.totalPassTds + stats2025.totalRushTds + stats2025.totalRecTds).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <BrandedLoader size={44} />
          </div>
        ) : (
          <Tabs defaultValue="stats" className="-mt-1 flex min-h-0 flex-1 flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="stats" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                Game Stats
              </TabsTrigger>
              <TabsTrigger value="comparison" className="gap-2">
                <GitCompareArrows className="w-4 h-4" />
                Player Comparison
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stats" className="flex-1 min-h-0 overflow-auto mt-4 scrollbar-thin">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Season Stats</h3>
                <Button
                  variant="default"
                  size="sm"
                  aria-pressed="true"
                  className="mr-2 cursor-default pointer-events-none bg-primary text-primary-foreground opacity-100"
                >
                  2025
                </Button>
              </div>
              
              {showStatTabs && (
                <div className="flex gap-2 mb-4">
                  {player.position === 'QB' && (
                    <>
                      <Button
                        variant={statView === 'passing' ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStatView('passing')}
                      >
                        Passing
                      </Button>
                      <Button
                        variant={statView === 'rushing' ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStatView('rushing')}
                      >
                        Rushing
                      </Button>
                    </>
                  )}
                  {(player.position === 'RB' || player.position === 'FB') && (
                    <>
                      <Button
                        variant={statView === 'rushing' ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStatView('rushing')}
                      >
                        Rushing
                      </Button>
                      <Button
                        variant={statView === 'receiving' ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStatView('receiving')}
                      >
                        Receiving
                      </Button>
                    </>
                  )}
                  {(player.position === 'WR' || player.position === 'TE') && (
                    <>
                      <Button
                        variant={statView === 'receiving' ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStatView('receiving')}
                      >
                        Receiving
                      </Button>
                      <Button
                        variant={statView === 'rushing' ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStatView('rushing')}
                      >
                        Rushing
                      </Button>
                    </>
                  )}
                </div>
              )}
              
              {stats.length > 0 ? (
                <Table disableInnerScroll>
                  <TableHeader className="sticky top-0 z-20 bg-background shadow-[inset_0_-1px_0_0_hsl(var(--border))]">
                    <TableRow className="border-b-0 hover:bg-transparent">
                      <TableHead className="w-16 bg-background">Week</TableHead>
                      <TableHead className="w-16 bg-background">Opp</TableHead>
                      <TableHead className="w-16 bg-background text-right">Pts</TableHead>
                      {statsForView.map((stat) => (
                        <TableHead key={stat.key} className="bg-background text-right">
                          {stat.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.map((game, index) => (
                      <TableRow key={`${selectedSeason}-${game.week}-${index}`}>
                        <TableCell className="font-medium">
                          W{game.week}
                        </TableCell>
                        <TableCell className={game.opponent_team === 'BYE' ? 'text-muted-foreground italic' : 'text-muted-foreground'}>
                          {game.opponent_team === 'BYE' ? 'BYE' : (game.opponent_team || 'TBD')}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          {game.opponent_team === 'BYE' ? '-' : (() => {
                            if (isDefensePosition(player.position)) {
                              const defensePts = calculateDefenseFantasyPoints(game);
                              if (defensePts == null) return '-';
                              return defensePts.toFixed(1);
                            }
                            const pts = getSkillWeeklyFantasyPoints(game, player.position, scoringFormat);
                            if (pts == null) return '-';
                            const useTwoDecimals =
                              player.position === 'QB' || (game.passing_yards ?? 0) > 0;
                            const displayPts = pts.toFixed(useTwoDecimals ? 2 : 1);
                            const offenseOnly: FantasyBreakdownInput = {
                              passing_yards: game.passing_yards,
                              passing_tds: game.passing_tds,
                              passing_interceptions: game.passing_interceptions,
                              rushing_yards: game.rushing_yards,
                              rushing_tds: game.rushing_tds,
                              receptions: game.receptions,
                              receiving_yards: game.receiving_yards,
                              receiving_tds: game.receiving_tds,
                              fumbles: game.fumbles,
                            };
                            const breakdownOverride =
                              player.position === 'K'
                                ? ([
                                    ...getFantasyPointsBreakdown(offenseOnly, scoringFormat),
                                    ...getKickerFantasyBreakdownItems(game as unknown as Record<string, unknown>),
                                  ] as FantasyPointsBreakdownItem[])
                                : undefined;
                            return (
                              <FantasyPointsWithBreakdown
                                displayValue={displayPts}
                                stats={offenseOnly}
                                breakdownOverride={breakdownOverride}
                                scoringFormat={scoringFormat}
                              />
                            );
                          })()}
                        </TableCell>
                        {statsForView.map((stat) => (
                          <TableCell key={stat.key} className="text-right">
                            {player.position === 'K' &&
                            (stat.key === 'fg_made' || stat.key === 'fg_att')
                              ? kickerWeeklyFgStatCell(
                                  game,
                                  stat.key,
                                  getStatValue(game, stat.key)
                                )
                              : getStatValue(game, stat.key)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No game stats available yet</p>
                  <p className="text-sm">Stats will appear here once games are played</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="comparison" className="flex-1 min-h-0 overflow-auto mt-4 scrollbar-thin">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <p className="text-sm text-muted-foreground">Select another player to compare 2025 season stats side-by-side.</p>
                  <Input
                    value={comparisonQuery}
                    onChange={(e) => setComparisonQuery(e.target.value)}
                    placeholder={
                      comparisonPositionFilter
                        ? `Search ${comparisonPositionFilter}...`
                        : 'Search any skill player...'
                    }
                  />
                  {!!comparisonQuery.trim() && (
                    <div className="max-h-52 overflow-auto rounded-md border bg-background scrollbar-thin">
                      {comparisonLoading ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Searching...</div>
                      ) : comparisonResults.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No players found</div>
                      ) : (
                        <div className="p-1">
                          {comparisonResults.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="w-full rounded-sm px-2 py-2 text-left hover:bg-muted transition-colors"
                              onClick={() => {
                                setComparisonPlayer(p);
                                setComparisonQuery('');
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span className="truncate font-medium">{p.name}</span>
                                <PositionBadge position={p.position} className="text-[10px] shrink-0" />
                                {!isDefensePosition(p.position) && (
                                  <span className="text-xs text-muted-foreground shrink-0">
                                    {displayTeamAbbrevOrFa(p.team, p.position, p.name)}
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {!hasComparison ? (
                  <div className="text-center py-10 text-muted-foreground border rounded-lg">
                    <GitCompareArrows className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p>Select a player to start comparison</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <Select
                        value={comparisonStatSource}
                        onValueChange={(v) => setComparisonStatSource(v as 'player' | 'team')}
                      >
                        <SelectTrigger className="w-full sm:w-[260px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="player">Player stats (2025)</SelectItem>
                          <SelectItem value="team">Team ranks</SelectItem>
                        </SelectContent>
                      </Select>
                      {comparisonStatSource === 'team' && (
                        <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
                          NFL team ranks use regular-season stats: the #1 offense leads in scoring and yards gained; the #1
                          defense allows the fewest yards and points.
                        </p>
                      )}
                    </div>

                    <Table disableInnerScroll>
                      <TableHeader className="sticky top-0 z-20 bg-background shadow-[inset_0_-1px_0_0_hsl(var(--border))]">
                        <TableRow className="border-b-0 hover:bg-transparent">
                          <TableHead className="bg-background text-right min-w-[7rem] align-bottom">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="truncate max-w-[12rem]" title={player.name}>
                                {player.name}
                              </span>
                              {showTeamRankHeaderSubtitle && (
                                <span
                                  className="text-xs font-normal text-muted-foreground text-right leading-snug max-w-[min(100%,14rem)]"
                                  title={teamRankSubtitleLeft}
                                >
                                  {teamRankSubtitleLeft}
                                </span>
                              )}
                            </div>
                          </TableHead>
                          <TableHead className="bg-background text-center align-bottom">Stat</TableHead>
                          <TableHead className="bg-background text-left min-w-[7rem] align-bottom">
                            <div className="flex flex-col items-start gap-0.5">
                              <span className="truncate max-w-[12rem]" title={comparisonPlayer.name}>
                                {comparisonPlayer.name}
                              </span>
                              {showTeamRankHeaderSubtitle && (
                                <span
                                  className="text-xs font-normal text-muted-foreground text-left leading-snug max-w-[min(100%,14rem)]"
                                  title={teamRankSubtitleRight}
                                >
                                  {teamRankSubtitleRight}
                                </span>
                              )}
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparisonStatSource === 'team' && teamContext.loading ? (
                          <TableRow>
                            <TableCell colSpan={3} className="py-12 text-center">
                              <BrandedLoader />
                            </TableCell>
                          </TableRow>
                        ) : comparisonStatSource === 'team' && teamContext.error ? (
                          <TableRow>
                            <TableCell colSpan={3} className="py-8 text-center text-sm text-destructive">
                              {teamContext.error}
                            </TableCell>
                          </TableRow>
                        ) : (
                          activeComparisonRows.map((row) => {
                            const bold = pickBoldSide(row);
                            const hlLeft = positionComparisonHighlightClass(player.position);
                            const hlRight = positionComparisonHighlightClass(comparisonPlayer.position);
                            const leftCell =
                              row.sosCells &&
                              row.sosCells.leftPct != null &&
                              row.sosCells.leftRank != null ? (
                                <>
                                  {bold === 'left' ? (
                                    <span
                                      className={cn(
                                        'inline-block rounded-md px-1.5 py-0.5 font-semibold tabular-nums',
                                        hlLeft
                                      )}
                                    >
                                      {formatOpponentWinPctDisplay(row.sosCells.leftPct)}
                                    </span>
                                  ) : (
                                    <span className="tabular-nums">{formatOpponentWinPctDisplay(row.sosCells.leftPct)}</span>
                                  )}
                                  <span className="text-muted-foreground tabular-nums text-sm">
                                    {' '}
                                    ({sosOrdinal(row.sosCells.leftRank)})
                                  </span>
                                </>
                              ) : bold === 'left' ? (
                                <span
                                  className={cn(
                                    'inline-block rounded-md px-1.5 py-0.5 font-semibold tabular-nums',
                                    hlLeft
                                  )}
                                >
                                  {row.left}
                                </span>
                              ) : (
                                row.left
                              );
                            const rightCell =
                              row.sosCells &&
                              row.sosCells.rightPct != null &&
                              row.sosCells.rightRank != null ? (
                                <>
                                  {bold === 'right' ? (
                                    <span
                                      className={cn(
                                        'inline-block rounded-md px-1.5 py-0.5 font-semibold tabular-nums',
                                        hlRight
                                      )}
                                    >
                                      {formatOpponentWinPctDisplay(row.sosCells.rightPct)}
                                    </span>
                                  ) : (
                                    <span className="tabular-nums">{formatOpponentWinPctDisplay(row.sosCells.rightPct)}</span>
                                  )}
                                  <span className="text-muted-foreground tabular-nums text-sm">
                                    {' '}
                                    ({sosOrdinal(row.sosCells.rightRank)})
                                  </span>
                                </>
                              ) : bold === 'right' ? (
                                <span
                                  className={cn(
                                    'inline-block rounded-md px-1.5 py-0.5 font-semibold tabular-nums',
                                    hlRight
                                  )}
                                >
                                  {row.right}
                                </span>
                              ) : (
                                row.right
                              );
                            return (
                              <TableRow key={row.label}>
                                <TableCell className="text-right tabular-nums text-foreground align-middle">{leftCell}</TableCell>
                                <TableCell className="text-center text-muted-foreground text-sm">
                                  {row.label === '2026 SOS' ? (
                                    <Tooltip delayDuration={200}>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help border-b border-dotted border-muted-foreground/55">
                                          {row.label}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-[min(22rem,calc(100vw-2rem))] text-left leading-snug">
                                        {NFL_2026_SOS_HELP_TEXT}
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : row.label === 'O-line overall rank' ? (
                                    <OlineTeamRankStatTrigger
                                      mode="full"
                                      label={row.label}
                                      teamAbbrLeft={resolveTeamAbbrForDisplay(
                                        player.team,
                                        player.position,
                                        player.name
                                      )}
                                      teamAbbrRight={resolveTeamAbbrForDisplay(
                                        comparisonPlayer.team,
                                        comparisonPlayer.position,
                                        comparisonPlayer.name
                                      )}
                                      columnHeaderLeft={displayTeamAbbrevOrFa(
                                        player.team,
                                        player.position,
                                        player.name
                                      )}
                                      columnHeaderRight={displayTeamAbbrevOrFa(
                                        comparisonPlayer.team,
                                        comparisonPlayer.position,
                                        comparisonPlayer.name
                                      )}
                                    />
                                  ) : row.label === 'O-line pass rank' || row.label === 'O-line run rank' ? (
                                    <OlineTeamRankStatTrigger
                                      mode={row.label === 'O-line pass rank' ? 'pass' : 'run'}
                                      label={row.label}
                                      teamAbbrLeft={resolveTeamAbbrForDisplay(
                                        player.team,
                                        player.position,
                                        player.name
                                      )}
                                      teamAbbrRight={resolveTeamAbbrForDisplay(
                                        comparisonPlayer.team,
                                        comparisonPlayer.position,
                                        comparisonPlayer.name
                                      )}
                                      columnHeaderLeft={displayTeamAbbrevOrFa(
                                        player.team,
                                        player.position,
                                        player.name
                                      )}
                                      columnHeaderRight={displayTeamAbbrevOrFa(
                                        comparisonPlayer.team,
                                        comparisonPlayer.position,
                                        comparisonPlayer.name
                                      )}
                                    />
                                  ) : (
                                    row.label
                                  )}
                                </TableCell>
                                <TableCell className="text-left tabular-nums text-foreground align-middle">{rightCell}</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
