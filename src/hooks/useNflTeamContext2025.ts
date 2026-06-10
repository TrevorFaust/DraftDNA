import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { canonicalTeamAbbr } from '@/utils/teamMapping';
import type {
  NflOlineTeamView,
  NflTeamContext2025Row,
  TeamRankMetric,
} from '@/types/nflTeamContext2025';
import {
  olineViewFromContext,
  teamContextRankForMetric,
} from '@/types/nflTeamContext2025';

export type NflTeamContextLookup = {
  loading: boolean;
  error: string | null;
  byAbbr: Map<string, NflTeamContext2025Row>;
  olineByAbbr: Map<string, NflOlineTeamView>;
  allOlineRows: NflOlineTeamView[];
  getForTeam: (teamAbbr: string | null | undefined) => NflTeamContext2025Row | null;
  getOlineForTeam: (teamAbbr: string | null | undefined) => NflOlineTeamView | null;
  getRank: (teamAbbr: string | null | undefined, metric: TeamRankMetric) => number | null;
  getSosRank: (teamAbbr: string | null | undefined) => number | null;
  getSosOppWinPct: (teamAbbr: string | null | undefined) => number | null;
};

const EMPTY: NflTeamContextLookup = {
  loading: false,
  error: null,
  byAbbr: new Map(),
  olineByAbbr: new Map(),
  allOlineRows: [],
  getForTeam: () => null,
  getOlineForTeam: () => null,
  getRank: () => null,
  getSosRank: () => null,
  getSosOppWinPct: () => null,
};

let sharedPromise: Promise<NflTeamContext2025Row[]> | null = null;

async function fetchAllTeamContext(): Promise<NflTeamContext2025Row[]> {
  const { data, error } = await supabase
    .from('nfl_team_context_2025')
    .select('*')
    .order('team_abbr');
  if (error) throw error;
  return (data ?? []) as NflTeamContext2025Row[];
}

function buildLookup(rows: NflTeamContext2025Row[]): NflTeamContextLookup {
  const byAbbr = new Map<string, NflTeamContext2025Row>();
  const olineByAbbr = new Map<string, NflOlineTeamView>();
  const allOlineRows: NflOlineTeamView[] = [];

  for (const row of rows) {
    const abbr = canonicalTeamAbbr(row.team_abbr);
    if (!abbr) continue;
    byAbbr.set(abbr, row);
    const ol = olineViewFromContext(row);
    olineByAbbr.set(abbr, ol);
    allOlineRows.push(ol);
  }

  const getForTeam = (teamAbbr: string | null | undefined) => {
    const c = canonicalTeamAbbr(teamAbbr);
    if (!c || c === 'FA') return null;
    return byAbbr.get(c) ?? null;
  };

  return {
    loading: false,
    error: null,
    byAbbr,
    olineByAbbr,
    allOlineRows,
    getForTeam,
    getOlineForTeam: (teamAbbr) => {
      const row = getForTeam(teamAbbr);
      return row ? olineViewFromContext(row) : null;
    },
    getRank: (teamAbbr, metric) => teamContextRankForMetric(getForTeam(teamAbbr), metric),
    getSosRank: (teamAbbr) => getForTeam(teamAbbr)?.sos_2026_rank ?? null,
    getSosOppWinPct: (teamAbbr) => getForTeam(teamAbbr)?.sos_2026_opp_win_pct ?? null,
  };
}

/** Single cached fetch of all 32 rows from `nfl_team_context_2025`. */
export function useNflTeamContext2025(enabled = true): NflTeamContextLookup {
  const [lookup, setLookup] = useState<NflTeamContextLookup>(() =>
    enabled ? { ...EMPTY, loading: true } : EMPTY
  );
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      setLookup(EMPTY);
      return;
    }

    if (!sharedPromise) {
      sharedPromise = fetchAllTeamContext();
    }

    setLookup((prev) => ({ ...prev, loading: true, error: null }));

    sharedPromise
      .then((rows) => {
        if (!mountedRef.current) return;
        setLookup(buildLookup(rows));
      })
      .catch((e) => {
        if (!mountedRef.current) return;
        sharedPromise = null;
        setLookup({
          ...EMPTY,
          error: e instanceof Error ? e.message : 'Failed to load team context',
        });
      });

    return () => {
      mountedRef.current = false;
    };
  }, [enabled]);

  return lookup;
}

export type { TeamRankMetric };
