/**
 * ESPN-style defense fantasy for 2025 — shared by PlayerDetailDialog and usePlayer2025Stats
 * so rankings PPG matches weekly points when DB `fantasy_points` is unset.
 */

export function toFiniteNumber(value: unknown): number | null {
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

export function pickNumber(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const n = toFiniteNumber(row[key]);
    if (n !== null) return n;
  }
  return null;
}

/** Interception return TDs — `def_tds` in DB is this bucket (not fumble-recovery TDs). */
export function pickInterceptionReturnTds(row: Record<string, unknown>): number | null {
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

export function pickFumbleRecoveryReturnTds(row: Record<string, unknown>): number | null {
  return pickNumber(row, [
    'fumble_recovery_tds',
    'fumble_recovery_td',
    'fumble_return_tds',
    'fumble_return_td',
    'defensive_fumble_recovery_tds',
  ]);
}

/** KR/PR/block-FG return TDs — main column or sum of parts in `team_stats_2025`. */
export function pickSpecialTeamsTds(row: Record<string, unknown>): number | null {
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
  if (values.some((v) => v === null || v === undefined || Number.isNaN(v as number))) return null;
  return values.reduce((acc, v) => acc + (v ?? 0), 0);
}

export function pointsForPaTier(pa: number | null): number {
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

export function pointsForYardsTier(yards: number | null): number {
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

/** Subset of dialog `WeeklyStats` used for defense fantasy calculation. */
export type DefenseFantasyGameInput = {
  week: number;
  opponent_team: string | null;
  def_pa: number | null;
  def_total_yards: number | null;
  def_tds: number | null;
  def_fumble_recovery_tds: number | null;
  def_special_teams_tds: number | null;
  def_interceptions: number | null;
  def_fumbles: number | null;
  def_sacks: number | null;
  opponent_sack_fumble_lost: number | null;
  def_blocked_kicks: number | null;
  def_safeties: number | null;
  defense_team_abbr: string | null;
  fumble_recovery_opp: number | null;
};

export function calculateDefenseFantasyPoints(game: DefenseFantasyGameInput): number | null {
  if (game.opponent_team === 'BYE') return null;

  const sacks = game.def_sacks ?? 0;
  const interceptions = game.def_interceptions ?? 0;
  const fumbleRecoveries =
    game.fumble_recovery_opp != null
      ? game.fumble_recovery_opp
      : (game.def_fumbles ?? 0) + (game.opponent_sack_fumble_lost ?? 0);

  const intRetTds = game.def_tds ?? 0;
  const fumRecTds = game.def_fumble_recovery_tds ?? 0;
  const stTds = game.def_special_teams_tds ?? 0;
  const tdPoints = (intRetTds + fumRecTds + stTds) * 6;

  const blockedKicks = game.def_blocked_kicks ?? 0;
  const safeties = game.def_safeties ?? 0;

  const paTier = pointsForPaTier(game.def_pa);
  const yardsTier = pointsForYardsTier(game.def_total_yards);

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

type GameCell = { opponent: string; pointsAllowed: number | null };

/**
 * Merge `team_stats_2025` + opponent row + scores into the shape `calculateDefenseFantasyPoints` expects.
 * Returns `null` for bye weeks (no opponent). For missing `s`, pass `undefined` (treated like an empty stats row).
 */
export function buildDefenseFantasyGameInput(
  week: number,
  scheduleTeam: string | null,
  game: GameCell | undefined,
  s: Record<string, unknown> | null | undefined,
  opponentStats: Record<string, unknown> | null | undefined
): DefenseFantasyGameInput | null {
  const opponent = game?.opponent || null;
  const pointsAllowed = game?.pointsAllowed ?? null;
  const isByeWeek = !opponent || opponent === '';
  if (isByeWeek) return null;

  const row = s ?? {};
  const ownFrRaw = pickNumber(row, ['fumble_recovery_opp', 'fumble_recoveries', 'def_fumbles']);
  const oppSflRaw = pickNumber(opponentStats ?? {}, ['sack_fumble_lost']);
  const fumbleRecTotal =
    ownFrRaw == null && oppSflRaw == null ? null : (ownFrRaw ?? 0) + (oppSflRaw ?? 0);

  const oppFgBlocked = pickNumber(opponentStats ?? {}, ['fg_blocked', 'field_goals_blocked']);
  const oppPatBlocked = pickNumber(opponentStats ?? {}, [
    'pat_blocked',
    'xp_blocked',
    'extra_point_blocked',
    'extra_points_blocked',
  ]);
  const blockedKicksTotal =
    oppFgBlocked == null && oppPatBlocked == null ? null : (oppFgBlocked ?? 0) + (oppPatBlocked ?? 0);

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

  return {
    week,
    opponent_team: opponent,
    defense_team_abbr: scheduleTeam ?? null,
    def_pa:
      fantasyPa ??
      pickNumber(row, ['def_pa', 'points_allowed', 'pts_allowed', 'points_against', 'pa']),
    def_total_yards:
      pickNumber(opponentStats ?? {}, ['total_yards', 'total_yards_allowed']) ??
      sumNumbers([
        pickNumber(opponentStats ?? {}, ['rushing_yards']),
        pickNumber(opponentStats ?? {}, ['passing_yards']),
        pickNumber(opponentStats ?? {}, ['sack_yards_lost']),
      ]),
    def_tds: pickInterceptionReturnTds(row),
    def_fumble_recovery_tds: pickFumbleRecoveryReturnTds(row),
    def_special_teams_tds: pickSpecialTeamsTds(row),
    def_interceptions: pickNumber(row, ['def_interceptions', 'def_int', 'interceptions']),
    def_fumbles: pickNumber(row, ['def_fumbles', 'fumble_recoveries', 'fumble_recovery_opp']),
    def_sacks: pickNumber(row, ['def_sacks', 'defensive_sacks', 'sacks']),
    opponent_sack_fumble_lost: oppSflRaw,
    def_blocked_kicks: blockedKicksTotal,
    def_safeties: pickNumber(row, ['def_safties', 'def_safeties', 'safeties', 'sf']),
    fumble_recovery_opp: fumbleRecTotal,
  };
}
