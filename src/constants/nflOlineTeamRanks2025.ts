import { canonicalTeamAbbr } from "@/utils/teamMapping";

/**
 * NFL offensive line team metrics (2025 season), transcribed from a published
 * pass/run blocking rankings table. Overall ranks: 1 = best among 32 teams, 32 = worst.
 *
 * PFF-style **unit** overall O-line rank (1 = best) is stored as `unitOverallRank` (user-supplied
 * 2025 ordering). Use `passOverallRank` / `runOverallRank` for phase-only leaderboards; use
 * grades/rates in each row for deeper analysis.
 *
 * Column meanings (source table):
 * - PRESS %: Percentage of Dropbacks Under Pressure
 * - PrROE: Pressure Rate vs. Expected Pressure Rate based on QB Time to Throw
 * - PB PFF: Overall Pass-Blocking PFF Grade
 * - PB WR: Pass-Blocking Win Rate
 * - ADJ YBC/Att: Adjusted Yards Before Contact per Attempt
 * - RB PFF: Overall Run-Blocking PFF Grade
 * - RB WR: Run-Blocking Win Rate
 */

export type NflOlineTeamRow = {
  /** PFF-style unit overall O-line rank among 32 teams (1 = best) */
  unitOverallRank: number;
  /** Pass blocking overall rank among 32 teams */
  passOverallRank: number;
  /** Run blocking overall rank among 32 teams */
  runOverallRank: number;
  /** PRESS % — percentage of dropbacks under pressure */
  pressurePct: number;
  /** PrROE — pressure rate vs. expected given QB time to throw */
  pressureRoe: number;
  /** PB PFF — overall pass-blocking PFF grade */
  passBlockPff: number;
  /** PB WR — pass-blocking win rate (percent) */
  passBlockWinRatePct: number;
  /** ADJ YBC/Att — adjusted yards before contact per attempt */
  adjYbcoPerAtt: number;
  /** RB PFF — overall run-blocking PFF grade */
  runBlockPff: number;
  /** RB WR — run-blocking win rate (percent) */
  runBlockWinRatePct: number;
};

export const NFL_OLINE_TEAM_2025: Record<string, NflOlineTeamRow> = {
  ARI: {
    passOverallRank: 19,
    runOverallRank: 20,
    unitOverallRank: 26,
    pressurePct: 39.0,
    pressureRoe: 7.74,
    passBlockPff: 60.5,
    passBlockWinRatePct: 63,
    adjYbcoPerAtt: 2.21,
    runBlockPff: 55.4,
    runBlockWinRatePct: 71,
  },
  ATL: {
    passOverallRank: 12,
    runOverallRank: 16,
    unitOverallRank: 14,
    pressurePct: 36.5,
    pressureRoe: 4.11,
    passBlockPff: 68.4,
    passBlockWinRatePct: 65,
    adjYbcoPerAtt: 1.98,
    runBlockPff: 71.0,
    runBlockWinRatePct: 70,
  },
  BAL: {
    passOverallRank: 29,
    runOverallRank: 2,
    unitOverallRank: 16,
    pressurePct: 43.3,
    pressureRoe: 12.2,
    passBlockPff: 62.6,
    passBlockWinRatePct: 69,
    adjYbcoPerAtt: 3.15,
    runBlockPff: 71.9,
    runBlockWinRatePct: 71,
  },
  BUF: {
    passOverallRank: 13,
    runOverallRank: 3,
    unitOverallRank: 6,
    pressurePct: 36.6,
    pressureRoe: 5.91,
    passBlockPff: 73.4,
    passBlockWinRatePct: 72,
    adjYbcoPerAtt: 2.64,
    runBlockPff: 75.7,
    runBlockWinRatePct: 75,
  },
  CAR: {
    passOverallRank: 25,
    runOverallRank: 9,
    unitOverallRank: 20,
    pressurePct: 41.8,
    pressureRoe: 10.12,
    passBlockPff: 67.4,
    passBlockWinRatePct: 59,
    adjYbcoPerAtt: 2.13,
    runBlockPff: 75.9,
    runBlockWinRatePct: 70,
  },
  CHI: {
    passOverallRank: 3,
    runOverallRank: 4,
    unitOverallRank: 3,
    pressurePct: 37.7,
    pressureRoe: -0.12,
    passBlockPff: 72.3,
    passBlockWinRatePct: 74,
    adjYbcoPerAtt: 2.47,
    runBlockPff: 77.4,
    runBlockWinRatePct: 74,
  },
  CIN: {
    passOverallRank: 10,
    runOverallRank: 25,
    unitOverallRank: 28,
    pressurePct: 34.1,
    pressureRoe: 1.97,
    passBlockPff: 61.0,
    passBlockWinRatePct: 57,
    adjYbcoPerAtt: 1.9,
    runBlockPff: 55.8,
    runBlockWinRatePct: 72,
  },
  CLE: {
    passOverallRank: 31,
    runOverallRank: 31,
    unitOverallRank: 31,
    pressurePct: 44.8,
    pressureRoe: 11.54,
    passBlockPff: 49.7,
    passBlockWinRatePct: 62,
    adjYbcoPerAtt: 1.14,
    runBlockPff: 55.4,
    runBlockWinRatePct: 70,
  },
  DAL: {
    passOverallRank: 16,
    runOverallRank: 11,
    unitOverallRank: 21,
    pressurePct: 37.3,
    pressureRoe: 4.66,
    passBlockPff: 53.7,
    passBlockWinRatePct: 63,
    adjYbcoPerAtt: 2.08,
    runBlockPff: 71.5,
    runBlockWinRatePct: 72,
  },
  DEN: {
    passOverallRank: 6,
    runOverallRank: 5,
    unitOverallRank: 1,
    pressurePct: 36.8,
    pressureRoe: 2.89,
    passBlockPff: 78.8,
    passBlockWinRatePct: 68,
    adjYbcoPerAtt: 2.37,
    runBlockPff: 73.3,
    runBlockWinRatePct: 74,
  },
  DET: {
    passOverallRank: 9,
    runOverallRank: 7,
    unitOverallRank: 12,
    pressurePct: 32.3,
    pressureRoe: 1.86,
    passBlockPff: 62.8,
    passBlockWinRatePct: 55,
    adjYbcoPerAtt: 2.52,
    runBlockPff: 69.8,
    runBlockWinRatePct: 71,
  },
  GB: {
    passOverallRank: 26,
    runOverallRank: 23,
    unitOverallRank: 19,
    pressurePct: 43.6,
    pressureRoe: 11.28,
    passBlockPff: 62.2,
    passBlockWinRatePct: 69,
    adjYbcoPerAtt: 1.89,
    runBlockPff: 60.1,
    runBlockWinRatePct: 71,
  },
  HOU: {
    passOverallRank: 18,
    runOverallRank: 29,
    unitOverallRank: 27,
    pressurePct: 37.5,
    pressureRoe: 6.28,
    passBlockPff: 63.3,
    passBlockWinRatePct: 55,
    adjYbcoPerAtt: 1.45,
    runBlockPff: 59.8,
    runBlockWinRatePct: 68,
  },
  IND: {
    passOverallRank: 8,
    runOverallRank: 6,
    unitOverallRank: 2,
    pressurePct: 33.0,
    pressureRoe: 3.29,
    passBlockPff: 74.6,
    passBlockWinRatePct: 56,
    adjYbcoPerAtt: 2.23,
    runBlockPff: 76.0,
    runBlockWinRatePct: 73,
  },
  JAX: {
    passOverallRank: 7,
    runOverallRank: 13,
    unitOverallRank: 24,
    pressurePct: 34.8,
    pressureRoe: 4.08,
    passBlockPff: 70.9,
    passBlockWinRatePct: 67,
    adjYbcoPerAtt: 2.08,
    runBlockPff: 66.7,
    runBlockWinRatePct: 74,
  },
  KC: {
    passOverallRank: 24,
    runOverallRank: 27,
    unitOverallRank: 10,
    pressurePct: 41.7,
    pressureRoe: 12.36,
    passBlockPff: 71.5,
    passBlockWinRatePct: 72,
    adjYbcoPerAtt: 1.67,
    runBlockPff: 62.2,
    runBlockWinRatePct: 70,
  },
  LV: {
    passOverallRank: 23,
    runOverallRank: 32,
    unitOverallRank: 32,
    pressurePct: 39.1,
    pressureRoe: 8.65,
    passBlockPff: 56.9,
    passBlockWinRatePct: 60,
    adjYbcoPerAtt: 1.2,
    runBlockPff: 53.0,
    runBlockWinRatePct: 70,
  },
  LAC: {
    passOverallRank: 32,
    runOverallRank: 30,
    unitOverallRank: 30,
    pressurePct: 43.2,
    pressureRoe: 14.59,
    passBlockPff: 49.7,
    passBlockWinRatePct: 54,
    adjYbcoPerAtt: 1.95,
    runBlockPff: 37.8,
    runBlockWinRatePct: 69,
  },
  LAR: {
    passOverallRank: 2,
    runOverallRank: 1,
    unitOverallRank: 4,
    pressurePct: 29.8,
    pressureRoe: -2.74,
    passBlockPff: 63.6,
    passBlockWinRatePct: 69,
    adjYbcoPerAtt: 2.62,
    runBlockPff: 87.9,
    runBlockWinRatePct: 74,
  },
  MIA: {
    passOverallRank: 11,
    runOverallRank: 19,
    unitOverallRank: 29,
    pressurePct: 32.0,
    pressureRoe: 2.32,
    passBlockPff: 54.9,
    passBlockWinRatePct: 59,
    adjYbcoPerAtt: 2.32,
    runBlockPff: 55.5,
    runBlockWinRatePct: 70,
  },
  MIN: {
    passOverallRank: 22,
    runOverallRank: 10,
    unitOverallRank: 18,
    pressurePct: 40.2,
    pressureRoe: 10.36,
    passBlockPff: 69.1,
    passBlockWinRatePct: 59,
    adjYbcoPerAtt: 2.2,
    runBlockPff: 67.8,
    runBlockWinRatePct: 74,
  },
  NE: {
    passOverallRank: 27,
    runOverallRank: 14,
    unitOverallRank: 11,
    pressurePct: 43.9,
    pressureRoe: 12.16,
    passBlockPff: 72.7,
    passBlockWinRatePct: 64,
    adjYbcoPerAtt: 2.31,
    runBlockPff: 62.2,
    runBlockWinRatePct: 72,
  },
  NO: {
    passOverallRank: 21,
    runOverallRank: 28,
    unitOverallRank: 25,
    pressurePct: 38.3,
    pressureRoe: 9.21,
    passBlockPff: 65.0,
    passBlockWinRatePct: 55,
    adjYbcoPerAtt: 1.86,
    runBlockPff: 49.8,
    runBlockWinRatePct: 71,
  },
  NYG: {
    passOverallRank: 28,
    runOverallRank: 22,
    unitOverallRank: 9,
    pressurePct: 42.9,
    pressureRoe: 12.59,
    passBlockPff: 71.1,
    passBlockWinRatePct: 66,
    adjYbcoPerAtt: 1.87,
    runBlockPff: 61.2,
    runBlockWinRatePct: 71,
  },
  NYJ: {
    passOverallRank: 30,
    runOverallRank: 15,
    unitOverallRank: 22,
    pressurePct: 42.9,
    pressureRoe: 13.54,
    passBlockPff: 68.2,
    passBlockWinRatePct: 58,
    adjYbcoPerAtt: 2.41,
    runBlockPff: 59.7,
    runBlockWinRatePct: 71,
  },
  PHI: {
    passOverallRank: 17,
    runOverallRank: 12,
    unitOverallRank: 7,
    pressurePct: 41.2,
    pressureRoe: 7.77,
    passBlockPff: 72.3,
    passBlockWinRatePct: 64,
    adjYbcoPerAtt: 2.19,
    runBlockPff: 67.9,
    runBlockWinRatePct: 72,
  },
  PIT: {
    passOverallRank: 1,
    runOverallRank: 18,
    unitOverallRank: 8,
    pressurePct: 26.4,
    pressureRoe: -2.83,
    passBlockPff: 74.8,
    passBlockWinRatePct: 70,
    adjYbcoPerAtt: 2.01,
    runBlockPff: 62.0,
    runBlockWinRatePct: 72,
  },
  SF: {
    passOverallRank: 4,
    runOverallRank: 8,
    unitOverallRank: 5,
    pressurePct: 34.3,
    pressureRoe: 0.49,
    passBlockPff: 66.7,
    passBlockWinRatePct: 66,
    adjYbcoPerAtt: 1.85,
    runBlockPff: 83.3,
    runBlockWinRatePct: 72,
  },
  SEA: {
    passOverallRank: 5,
    runOverallRank: 17,
    unitOverallRank: 15,
    pressurePct: 31.6,
    pressureRoe: 0.72,
    passBlockPff: 64.2,
    passBlockWinRatePct: 63,
    adjYbcoPerAtt: 1.98,
    runBlockPff: 64.4,
    runBlockWinRatePct: 73,
  },
  TB: {
    passOverallRank: 14,
    runOverallRank: 26,
    unitOverallRank: 17,
    pressurePct: 36.2,
    pressureRoe: 4.79,
    passBlockPff: 69.3,
    passBlockWinRatePct: 65,
    adjYbcoPerAtt: 1.94,
    runBlockPff: 56.9,
    runBlockWinRatePct: 70,
  },
  TEN: {
    passOverallRank: 15,
    runOverallRank: 21,
    unitOverallRank: 23,
    pressurePct: 38.5,
    pressureRoe: 4.71,
    passBlockPff: 69.2,
    passBlockWinRatePct: 64,
    adjYbcoPerAtt: 2.17,
    runBlockPff: 57.5,
    runBlockWinRatePct: 70,
  },
  WAS: {
    passOverallRank: 20,
    runOverallRank: 24,
    unitOverallRank: 13,
    pressurePct: 39.5,
    pressureRoe: 11.13,
    passBlockPff: 71.7,
    passBlockWinRatePct: 63,
    adjYbcoPerAtt: 1.95,
    runBlockPff: 57.2,
    runBlockWinRatePct: 71,
  },
};

export function getNflOlineTeam2025(teamAbbr: string | null | undefined): NflOlineTeamRow | null {
  const c = canonicalTeamAbbr(teamAbbr);
  if (!c || c === "FA") return null;
  return NFL_OLINE_TEAM_2025[c] ?? null;
}

export function getNflOlinePassOverallRank(teamAbbr: string | null | undefined): number | null {
  return getNflOlineTeam2025(teamAbbr)?.passOverallRank ?? null;
}

export function getNflOlineRunOverallRank(teamAbbr: string | null | undefined): number | null {
  return getNflOlineTeam2025(teamAbbr)?.runOverallRank ?? null;
}

export function getNflOlineUnitOverallRank(teamAbbr: string | null | undefined): number | null {
  return getNflOlineTeam2025(teamAbbr)?.unitOverallRank ?? null;
}

/** Raw O-line stats used for league-wide context in comparison UI (includes rank fields for tiers). */
export type NflOlineRawMetricId =
  | "unitOverallRank"
  | "passOverallRank"
  | "runOverallRank"
  | "pressurePct"
  | "pressureRoe"
  | "passBlockPff"
  | "passBlockWinRatePct"
  | "adjYbcoPerAtt"
  | "runBlockPff"
  | "runBlockWinRatePct";

const LOWER_IS_BETTER_METRIC: ReadonlySet<NflOlineRawMetricId> = new Set([
  "unitOverallRank",
  "passOverallRank",
  "runOverallRank",
  "pressurePct",
  "pressureRoe",
]);

/**
 * Rank 1 = best in NFL for this metric among 32 teams (ties share the same rank).
 */
export function getNflOlineMetricLeagueRank2025(metric: NflOlineRawMetricId, value: number): number {
  const rows = Object.values(NFL_OLINE_TEAM_2025);
  const lowerBetter = LOWER_IS_BETTER_METRIC.has(metric);
  let strictlyBetter = 0;
  for (const row of rows) {
    const v = row[metric];
    if (lowerBetter ? v < value : v > value) strictlyBetter += 1;
  }
  return 1 + strictlyBetter;
}

export type NflOlineMetricLeagueTier = "top" | "above" | "average" | "below" | "bottom";

/**
 * Five league buckets by per-stat rank (1 = best among 32). Split 6+7+6+7+6 so the middle
 * “Average” band stays compact and the top/bottom tails stay balanced.
 */
export function getNflOlineMetricLeagueTier2025(metric: NflOlineRawMetricId, value: number): NflOlineMetricLeagueTier {
  const rank = getNflOlineMetricLeagueRank2025(metric, value);
  if (rank <= 6) return "top";
  if (rank <= 13) return "above";
  if (rank <= 19) return "average";
  if (rank <= 26) return "below";
  return "bottom";
}
