/**
 * Fantasy points calculation by league scoring format.
 * The only difference between formats is reception scoring:
 * - standard: 0 pts per reception
 * - ppr: 1 pt per reception
 * - half_ppr: 0.5 pts per reception
 *
 * Base scoring (same for all): 0.1 per rush/rec yard, 6 per TD, etc.
 */

import { computeKickerFantasyPointsFromRow } from '@/utils/kickerFantasyPoints';

export type ScoringFormat = 'standard' | 'ppr' | 'half_ppr';

/**
 * Get the points per reception for a given scoring format.
 */
export function getPprValue(format: ScoringFormat): number {
  switch (format) {
    case 'standard':
      return 0;
    case 'ppr':
      return 1;
    case 'half_ppr':
      return 0.5;
    default:
      return 1; // default PPR
  }
}

/**
 * Compute fantasy points for a game given standard and PPR values from the database.
 * - fantasy_points = standard (no reception points)
 * - fantasy_points_ppr = standard + receptions (1 pt each)
 * - half_ppr = standard + receptions * 0.5
 */
export function getFantasyPointsForFormat(
  format: ScoringFormat,
  standardPoints: number | null,
  pprPoints: number | null,
  receptions: number | null
): number | null {
  if (standardPoints == null && pprPoints == null) return null;
  const rec = receptions ?? 0;
  const standard = standardPoints ?? (pprPoints != null ? pprPoints - rec : null);
  const ppr = pprPoints ?? (standard != null ? standard + rec : null);

  if (standard == null && ppr == null) return null;

  switch (format) {
    case 'standard':
      return standard;
    case 'ppr':
      return ppr;
    case 'half_ppr':
      return standard + rec * 0.5;
    default:
      return ppr ?? standard; // default PPR
  }
}

/** ESPN-style fantasy scoring rates (standard across formats except receptions). */
const RATES = {
  passing_yards: 1 / 25,   // 0.04 per yard
  passing_td: 4,
  int: -2,
  rushing_yards: 0.1,
  rushing_td: 6,
  receiving_yards: 0.1,
  receiving_td: 6,
  fumble: -2,
  def_int: 2,
  def_fumble: 2,
  def_sack: 1,
  def_td: 6,
} as const;

export interface FantasyPointsBreakdownItem {
  label: string;
  statValue: number;
  points: number;
}

export interface FantasyBreakdownInput {
  passing_yards?: number | null;
  passing_tds?: number | null;
  passing_interceptions?: number | null;
  rushing_yards?: number | null;
  rushing_tds?: number | null;
  receptions?: number | null;
  receiving_yards?: number | null;
  receiving_tds?: number | null;
  fumbles?: number | null;
  def_tds?: number | null;
  def_interceptions?: number | null;
  def_fumbles?: number | null;
  def_sacks?: number | null;
}

/**
 * Compute per-stat fantasy point breakdown for display (e.g. "5 pts · 50 rush yds").
 * Only includes rows with non-zero contributions.
 */
export function getFantasyPointsBreakdown(
  stats: FantasyBreakdownInput,
  scoringFormat: ScoringFormat
): FantasyPointsBreakdownItem[] {
  const ppr = getPprValue(scoringFormat);
  const items: FantasyPointsBreakdownItem[] = [];

  const py = (stats.passing_yards ?? 0);
  if (py) {
    items.push({ label: 'Pass Yds', statValue: py, points: Math.round(py * RATES.passing_yards * 100) / 100 });
  }
  const ptd = (stats.passing_tds ?? 0);
  if (ptd) {
    items.push({ label: 'Pass TDs', statValue: ptd, points: ptd * RATES.passing_td });
  }
  const ints = (stats.passing_interceptions ?? 0);
  if (ints) {
    items.push({ label: 'INT', statValue: ints, points: ints * RATES.int });
  }
  const ry = (stats.rushing_yards ?? 0);
  if (ry) {
    items.push({ label: 'Rush Yds', statValue: ry, points: Math.round(ry * RATES.rushing_yards * 100) / 100 });
  }
  const rtd = (stats.rushing_tds ?? 0);
  if (rtd) {
    items.push({ label: 'Rush TDs', statValue: rtd, points: rtd * RATES.rushing_td });
  }
  const rec = (stats.receptions ?? 0);
  if (rec && ppr > 0) {
    items.push({ label: 'Receptions', statValue: rec, points: Math.round(rec * ppr * 100) / 100 });
  }
  const recy = (stats.receiving_yards ?? 0);
  if (recy) {
    items.push({ label: 'Rec Yds', statValue: recy, points: Math.round(recy * RATES.receiving_yards * 100) / 100 });
  }
  const rectd = (stats.receiving_tds ?? 0);
  if (rectd) {
    items.push({ label: 'Rec TDs', statValue: rectd, points: rectd * RATES.receiving_td });
  }
  const fum = (stats.fumbles ?? 0);
  if (fum) {
    items.push({ label: 'Fumbles', statValue: fum, points: fum * RATES.fumble });
  }
  const di = (stats.def_interceptions ?? 0);
  if (di) {
    items.push({ label: 'Def INT', statValue: di, points: di * RATES.def_int });
  }
  const df = (stats.def_fumbles ?? 0);
  if (df) {
    items.push({ label: 'Def FR', statValue: df, points: df * RATES.def_fumble });
  }
  const ds = (stats.def_sacks ?? 0);
  if (ds) {
    items.push({ label: 'Def Sacks', statValue: ds, points: ds * RATES.def_sack });
  }
  const dtd = (stats.def_tds ?? 0);
  if (dtd) {
    items.push({ label: 'Def TD', statValue: dtd, points: dtd * RATES.def_td });
  }

  return items;
}

/** Sum of per-stat breakdown points (matches ESPN-style rates in `getFantasyPointsBreakdown`). */
export function sumFantasyBreakdownPoints(
  stats: FantasyBreakdownInput,
  scoringFormat: ScoringFormat
): number {
  return getFantasyPointsBreakdown(stats, scoringFormat).reduce((sum, item) => sum + item.points, 0);
}

/** Minimal weekly row fields used for skill-position fantasy (incl. kickers). */
export type SkillWeeklyFantasyGameStats = Pick<
  FantasyBreakdownInput,
  | 'passing_yards'
  | 'passing_tds'
  | 'passing_interceptions'
  | 'rushing_yards'
  | 'rushing_tds'
  | 'receptions'
  | 'receiving_yards'
  | 'receiving_tds'
  | 'fumbles'
> & {
  fantasy_points?: number | null;
  fantasy_points_ppr?: number | null;
};

function offenseBreakdownInputFromWeekly(game: SkillWeeklyFantasyGameStats): FantasyBreakdownInput {
  return {
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
}

/**
 * Weekly fantasy points for a skill player. Kickers: DB `fantasy_points` often omits FG/PAT, so we
 * take max(DB-derived format points, breakdown from counting stats). Other positions unchanged.
 */
export function getSkillWeeklyFantasyPoints(
  game: SkillWeeklyFantasyGameStats,
  position: string | null | undefined,
  scoringFormat: ScoringFormat
): number | null {
  const fromDb = getFantasyPointsForFormat(
    scoringFormat,
    game.fantasy_points ?? null,
    game.fantasy_points_ppr ?? null,
    game.receptions ?? null
  );

  const isK = position?.trim().toUpperCase() === 'K';
  if (!isK) {
    return fromDb;
  }

  const offensePts = sumFantasyBreakdownPoints(offenseBreakdownInputFromWeekly(game), scoringFormat);
  const kickPts = computeKickerFantasyPointsFromRow(game as unknown as Record<string, unknown>);
  const fromBreakdown = offensePts + kickPts;
  if (fromDb == null) {
    return fromBreakdown === 0 ? null : fromBreakdown;
  }
  return Math.max(fromDb, fromBreakdown);
}
