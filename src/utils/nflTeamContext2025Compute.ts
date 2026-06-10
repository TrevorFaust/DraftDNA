import { TEAM_ABBREV_TO_FULL_NAME, canonicalTeamAbbr } from '@/utils/teamMapping';

const NFL_TEAM_ABBRS = Object.keys(TEAM_ABBREV_TO_FULL_NAME);

export type TeamSeasonAgg = {
  games: number;
  offPpg: number;
  offPassYpg: number;
  offRushYpg: number;
  defPpg: number;
  defYpg: number;
};

export type TeamSeasonRankKey =
  | 'offPpgRank'
  | 'offPassYpgRank'
  | 'offRushYpgRank'
  | 'defPpgAllowedRank'
  | 'defYpgAllowedRank';

export type ComputedTeamSeasonRanks = TeamSeasonAgg & {
  offPpgRank: number;
  offPassYpgRank: number;
  offRushYpgRank: number;
  defPpgAllowedRank: number;
  defYpgAllowedRank: number;
};

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

type Agg = {
  pf: number;
  pa: number;
  games: number;
  passYds: number;
  rushYds: number;
  yardsAllowed: number;
};

function assignRanks(
  teams: string[],
  getValue: (t: string) => number | null,
  higherIsBetter: boolean
): Map<string, number> {
  const entries = teams
    .map((t) => ({ t, v: getValue(t) }))
    .filter((x): x is { t: string; v: number } => x.v != null && Number.isFinite(x.v));
  entries.sort((a, b) => (higherIsBetter ? b.v - a.v : a.v - b.v));
  const map = new Map<string, number>();
  let i = 0;
  while (i < entries.length) {
    let j = i + 1;
    while (j < entries.length && entries[j].v === entries[i].v) j++;
    const rank = i + 1;
    for (let k = i; k < j; k++) map.set(entries[k].t, rank);
    i = j;
  }
  return map;
}

type GameRow = {
  week: number | null;
  home_team: string | null;
  away_team: string | null;
  home_score: unknown;
  away_score: unknown;
};

type TeamStatsRow = {
  team: string | null;
  week: number | null;
  passing_yards: unknown;
  rushing_yards: unknown;
  total_yards: unknown;
};

/** Aggregate 2025 regular-season team offense/defense from games + team_stats rows. */
export function computeNfl2025TeamSeasonFromRows(
  games: GameRow[],
  teamStatsRows: TeamStatsRow[]
): Map<string, ComputedTeamSeasonRanks> {
  const teamWeekStats = new Map<string, number | null>();
  for (const row of teamStatsRows) {
    const t = canonicalTeamAbbr(row.team);
    const week = row.week;
    if (!t || week === null) continue;
    teamWeekStats.set(`${t}__${week}`, toFiniteNumber(row.total_yards));
  }

  const agg = new Map<string, Agg>();
  for (const abbr of NFL_TEAM_ABBRS) {
    agg.set(abbr, { pf: 0, pa: 0, games: 0, passYds: 0, rushYds: 0, yardsAllowed: 0 });
  }

  for (const row of teamStatsRows) {
    const t = canonicalTeamAbbr(row.team);
    if (!t) continue;
    const bucket = agg.get(t);
    if (!bucket) continue;
    bucket.passYds += toFiniteNumber(row.passing_yards) ?? 0;
    bucket.rushYds += toFiniteNumber(row.rushing_yards) ?? 0;
  }

  for (const g of games) {
    const h = canonicalTeamAbbr(g.home_team);
    const a = canonicalTeamAbbr(g.away_team);
    const w = g.week;
    if (!h || !a || w === null) continue;

    const hs = toFiniteNumber(g.home_score);
    const ascr = toFiniteNumber(g.away_score);
    if (hs === null || ascr === null) continue;

    const homeBucket = agg.get(h);
    const awayBucket = agg.get(a);
    if (homeBucket) {
      homeBucket.pf += hs;
      homeBucket.pa += ascr;
      homeBucket.games += 1;
      homeBucket.yardsAllowed += teamWeekStats.get(`${a}__${w}`) ?? 0;
    }
    if (awayBucket) {
      awayBucket.pf += ascr;
      awayBucket.pa += hs;
      awayBucket.games += 1;
      awayBucket.yardsAllowed += teamWeekStats.get(`${h}__${w}`) ?? 0;
    }
  }

  const metrics = new Map<string, TeamSeasonAgg>();
  for (const t of NFL_TEAM_ABBRS) {
    const b = agg.get(t)!;
    if (b.games <= 0) continue;
    metrics.set(t, {
      games: b.games,
      offPpg: b.pf / b.games,
      offPassYpg: b.passYds / b.games,
      offRushYpg: b.rushYds / b.games,
      defPpg: b.pa / b.games,
      defYpg: b.yardsAllowed / b.games,
    });
  }

  const rankedTeams = [...metrics.keys()];
  const offPpgRank = assignRanks(rankedTeams, (t) => metrics.get(t)?.offPpg ?? null, true);
  const offPassYpgRank = assignRanks(rankedTeams, (t) => metrics.get(t)?.offPassYpg ?? null, true);
  const offRushYpgRank = assignRanks(rankedTeams, (t) => metrics.get(t)?.offRushYpg ?? null, true);
  const defPpgAllowedRank = assignRanks(rankedTeams, (t) => metrics.get(t)?.defPpg ?? null, false);
  const defYpgAllowedRank = assignRanks(rankedTeams, (t) => metrics.get(t)?.defYpg ?? null, false);

  const out = new Map<string, ComputedTeamSeasonRanks>();
  for (const t of rankedTeams) {
    const m = metrics.get(t)!;
    out.set(t, {
      ...m,
      offPpgRank: offPpgRank.get(t)!,
      offPassYpgRank: offPassYpgRank.get(t)!,
      offRushYpgRank: offRushYpgRank.get(t)!,
      defPpgAllowedRank: defPpgAllowedRank.get(t)!,
      defYpgAllowedRank: defYpgAllowedRank.get(t)!,
    });
  }
  return out;
}
