import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TEAM_ABBREV_TO_FULL_NAME, canonicalTeamAbbr } from '@/utils/teamMapping';

const NFL_TEAM_ABBRS = Object.keys(TEAM_ABBREV_TO_FULL_NAME);

export type TeamRankMetric = 'offPpg' | 'offPassYpg' | 'offRushYpg' | 'defPpg' | 'defYpg';

export type Nfl2025TeamSeasonMetrics = {
  games: number;
  offPpg: number;
  offPassYpg: number;
  offRushYpg: number;
  defPpg: number;
  defYpg: number;
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

export function useNfl2025TeamRankings(enabled: boolean) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metricsByTeam, setMetricsByTeam] = useState<Map<string, Nfl2025TeamSeasonMetrics>>(new Map());
  const [ranksByMetric, setRanksByMetric] = useState<Record<TeamRankMetric, Map<string, number>>>({
    offPpg: new Map(),
    offPassYpg: new Map(),
    offRushYpg: new Map(),
    defPpg: new Map(),
    defYpg: new Map(),
  });
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!enabled || fetchedRef.current) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [gamesRes, statsRes] = await Promise.all([
          supabase
            .from('games_2025')
            .select('week, home_team, away_team, home_score, away_score')
            .eq('season', 2025)
            .eq('game_type', 'REG')
            .lte('week', 18),
          // Table may be absent from generated Database types
          (supabase as { from: (name: string) => ReturnType<typeof supabase.from> })
            .from('team_stats_2025')
            .select('team, week, passing_yards, rushing_yards, total_yards')
            .lte('week', 18),
        ]);

        if (gamesRes.error) throw gamesRes.error;
        const statsPayload = statsRes as {
          data: Record<string, unknown>[] | null;
          error: { message?: string } | null;
        };
        if (statsPayload.error) {
          throw new Error(statsPayload.error.message ?? 'team_stats fetch failed');
        }

        const games = gamesRes.data ?? [];
        const teamStatsRows = statsPayload.data ?? [];

        const teamWeekStats = new Map<string, { total_yards: number | null }>();
        for (const row of teamStatsRows) {
          const rawTeam = typeof row.team === 'string' ? row.team : null;
          const week = typeof row.week === 'number' ? row.week : null;
          const t = canonicalTeamAbbr(rawTeam);
          if (!t || week === null) continue;
          const ty = toFiniteNumber(row.total_yards);
          teamWeekStats.set(`${t}__${week}`, { total_yards: ty });
        }

        const agg = new Map<string, Agg>();
        for (const abbr of NFL_TEAM_ABBRS) {
          agg.set(abbr, { pf: 0, pa: 0, games: 0, passYds: 0, rushYds: 0, yardsAllowed: 0 });
        }

        for (const row of teamStatsRows) {
          const rawTeam = typeof row.team === 'string' ? row.team : null;
          const t = canonicalTeamAbbr(rawTeam);
          if (!t) continue;
          const bucket = agg.get(t);
          if (!bucket) continue;
          bucket.passYds += toFiniteNumber(row.passing_yards) ?? 0;
          bucket.rushYds += toFiniteNumber(row.rushing_yards) ?? 0;
        }

        for (const g of games) {
          const h = canonicalTeamAbbr(typeof g.home_team === 'string' ? g.home_team : null);
          const a = canonicalTeamAbbr(typeof g.away_team === 'string' ? g.away_team : null);
          const w = typeof g.week === 'number' ? g.week : null;
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
            const oppOff = teamWeekStats.get(`${a}__${w}`);
            homeBucket.yardsAllowed += toFiniteNumber(oppOff?.total_yards) ?? 0;
          }
          if (awayBucket) {
            awayBucket.pf += ascr;
            awayBucket.pa += hs;
            awayBucket.games += 1;
            const oppOff = teamWeekStats.get(`${h}__${w}`);
            awayBucket.yardsAllowed += toFiniteNumber(oppOff?.total_yards) ?? 0;
          }
        }

        const metrics = new Map<string, Nfl2025TeamSeasonMetrics>();
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
        const nextRanks: Record<TeamRankMetric, Map<string, number>> = {
          offPpg: assignRanks(rankedTeams, (t) => metrics.get(t)?.offPpg ?? null, true),
          offPassYpg: assignRanks(rankedTeams, (t) => metrics.get(t)?.offPassYpg ?? null, true),
          offRushYpg: assignRanks(rankedTeams, (t) => metrics.get(t)?.offRushYpg ?? null, true),
          defPpg: assignRanks(rankedTeams, (t) => metrics.get(t)?.defPpg ?? null, false),
          defYpg: assignRanks(rankedTeams, (t) => metrics.get(t)?.defYpg ?? null, false),
        };

        if (!cancelled) {
          setMetricsByTeam(metrics);
          setRanksByMetric(nextRanks);
          fetchedRef.current = true;
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load team rankings');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const getRank = useMemo(() => {
    return (teamAbbr: string | null | undefined, metric: TeamRankMetric): number | null => {
      const c = canonicalTeamAbbr(teamAbbr);
      if (!c) return null;
      return ranksByMetric[metric].get(c) ?? null;
    };
  }, [ranksByMetric]);

  const getMetrics = useMemo(() => {
    return (teamAbbr: string | null | undefined): Nfl2025TeamSeasonMetrics | null => {
      const c = canonicalTeamAbbr(teamAbbr);
      if (!c) return null;
      return metricsByTeam.get(c) ?? null;
    };
  }, [metricsByTeam]);

  return { loading, error, metricsByTeam, ranksByMetric, getRank, getMetrics };
}
