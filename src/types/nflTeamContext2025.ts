/** One row from `nfl_team_context_2025` — static team-level context for 2025 + 2026 SOS. */
export type NflTeamContext2025Row = {
  team_abbr: string;
  oline_unit_rank: number;
  oline_pass_rank: number;
  oline_run_rank: number;
  oline_pressure_pct: number;
  oline_pressure_roe: number;
  oline_pass_block_pff: number;
  oline_pass_block_win_rate_pct: number;
  oline_adj_ybco_per_att: number;
  oline_run_block_pff: number;
  oline_run_block_win_rate_pct: number;
  off_ppg: number | null;
  off_pass_ypg: number | null;
  off_rush_ypg: number | null;
  def_ppg_allowed: number | null;
  def_ypg_allowed: number | null;
  games_played: number | null;
  off_ppg_rank: number | null;
  off_pass_ypg_rank: number | null;
  off_rush_ypg_rank: number | null;
  def_ppg_allowed_rank: number | null;
  def_ypg_allowed_rank: number | null;
  sos_2026_rank: number | null;
  sos_2026_opp_win_pct: number | null;
};

/** Offense/defense rank columns used in player UI (1 = best). */
export type TeamRankMetric = 'offPpg' | 'offPassYpg' | 'offRushYpg' | 'defPpg' | 'defYpg';

const METRIC_TO_RANK_COLUMN: Record<TeamRankMetric, keyof NflTeamContext2025Row> = {
  offPpg: 'off_ppg_rank',
  offPassYpg: 'off_pass_ypg_rank',
  offRushYpg: 'off_rush_ypg_rank',
  defPpg: 'def_ppg_allowed_rank',
  defYpg: 'def_ypg_allowed_rank',
};

export function teamContextRankForMetric(
  row: NflTeamContext2025Row | null | undefined,
  metric: TeamRankMetric
): number | null {
  if (!row) return null;
  const v = row[METRIC_TO_RANK_COLUMN[metric]];
  return typeof v === 'number' ? v : null;
}

/** O-line shape for comparison panels (mapped from context row). */
export type NflOlineTeamView = {
  unitOverallRank: number;
  passOverallRank: number;
  runOverallRank: number;
  pressurePct: number;
  pressureRoe: number;
  passBlockPff: number;
  passBlockWinRatePct: number;
  adjYbcoPerAtt: number;
  runBlockPff: number;
  runBlockWinRatePct: number;
};

export function olineViewFromContext(row: NflTeamContext2025Row): NflOlineTeamView {
  return {
    unitOverallRank: row.oline_unit_rank,
    passOverallRank: row.oline_pass_rank,
    runOverallRank: row.oline_run_rank,
    pressurePct: row.oline_pressure_pct,
    pressureRoe: row.oline_pressure_roe,
    passBlockPff: row.oline_pass_block_pff,
    passBlockWinRatePct: row.oline_pass_block_win_rate_pct,
    adjYbcoPerAtt: row.oline_adj_ybco_per_att,
    runBlockPff: row.oline_run_block_pff,
    runBlockWinRatePct: row.oline_run_block_win_rate_pct,
  };
}

export type NflOlineRawMetricId = keyof NflOlineTeamView;

export type NflOlineMetricLeagueTier = 'top' | 'above' | 'average' | 'below' | 'bottom';

const LOWER_IS_BETTER_METRIC: ReadonlySet<NflOlineRawMetricId> = new Set([
  'unitOverallRank',
  'passOverallRank',
  'runOverallRank',
  'pressurePct',
  'pressureRoe',
]);

/** Rank 1 = best in NFL for this metric among loaded team rows. */
export function getOlineMetricLeagueRank(
  allRows: NflOlineTeamView[],
  metric: NflOlineRawMetricId,
  value: number
): number {
  const lowerBetter = LOWER_IS_BETTER_METRIC.has(metric);
  let strictlyBetter = 0;
  for (const row of allRows) {
    const v = row[metric];
    if (lowerBetter ? v < value : v > value) strictlyBetter += 1;
  }
  return 1 + strictlyBetter;
}

export function getOlineMetricLeagueTier(
  allRows: NflOlineTeamView[],
  metric: NflOlineRawMetricId,
  value: number
): NflOlineMetricLeagueTier {
  const rank = getOlineMetricLeagueRank(allRows, metric, value);
  if (rank <= 6) return 'top';
  if (rank <= 13) return 'above';
  if (rank <= 19) return 'average';
  if (rank <= 26) return 'below';
  return 'bottom';
}
