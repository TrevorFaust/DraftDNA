import { useEffect, useRef, useState } from 'react';
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

const CACHE_KEY = 'draftdna_nfl_team_context_2025_v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12_000;

/** Columns used by Player Stats / SOS / O-line UI — avoid select('*'). */
const TEAM_CONTEXT_SELECT = [
  'team_abbr',
  'oline_unit_rank',
  'oline_pass_rank',
  'oline_run_rank',
  'oline_pressure_pct',
  'oline_pressure_roe',
  'oline_pass_block_pff',
  'oline_pass_block_win_rate_pct',
  'oline_adj_ybco_per_att',
  'oline_run_block_pff',
  'oline_run_block_win_rate_pct',
  'off_ppg',
  'off_pass_ypg',
  'off_rush_ypg',
  'def_ppg_allowed',
  'def_ypg_allowed',
  'games_played',
  'off_ppg_rank',
  'off_pass_ypg_rank',
  'off_rush_ypg_rank',
  'def_ppg_allowed_rank',
  'def_ypg_allowed_rank',
  'sos_2026_rank',
  'sos_2026_opp_win_pct',
].join(',');

let sharedPromise: Promise<NflTeamContext2025Row[]> | null = null;
let memoryCache: { at: number; rows: NflTeamContext2025Row[] } | null = null;

function readSessionCache(): NflTeamContext2025Row[] | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; rows: NflTeamContext2025Row[] };
    if (!parsed?.rows?.length || Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.rows;
  } catch {
    return null;
  }
}

function writeSessionCache(rows: NflTeamContext2025Row[]) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), rows }));
  } catch {
    /* ignore quota */
  }
}

async function fetchAllTeamContext(): Promise<NflTeamContext2025Row[]> {
  if (memoryCache && Date.now() - memoryCache.at < CACHE_TTL_MS) {
    return memoryCache.rows;
  }
  const sessionRows = readSessionCache();
  if (sessionRows) {
    memoryCache = { at: Date.now(), rows: sessionRows };
    return sessionRows;
  }

  const query = (supabase as any)
    .from('nfl_team_context_2025')
    .select(TEAM_CONTEXT_SELECT)
    .order('team_abbr');

  const result = await Promise.race([
    query.then((r: { data: unknown; error: { message?: string } | null }) => r),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Team context timed out')), FETCH_TIMEOUT_MS)
    ),
  ]);

  if (result.error) throw result.error;
  let rows = (result.data ?? []) as NflTeamContext2025Row[];

  // Fallback if narrow select fails on older schema
  if (rows.length === 0) {
    const retry = await (supabase as any).from('nfl_team_context_2025').select('*').order('team_abbr');
    if (retry.error) throw retry.error;
    rows = (retry.data ?? []) as NflTeamContext2025Row[];
  }

  memoryCache = { at: Date.now(), rows };
  writeSessionCache(rows);
  return rows;
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
  const [lookup, setLookup] = useState<NflTeamContextLookup>(() => {
    if (!enabled) return EMPTY;
    const cached = memoryCache?.rows ?? readSessionCache();
    if (cached?.length) return buildLookup(cached);
    return { ...EMPTY, loading: true };
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      setLookup(EMPTY);
      return;
    }

    if (!sharedPromise) {
      sharedPromise = fetchAllTeamContext().finally(() => {
        /* keep sharedPromise set on success so remounts reuse; clear only on failure below */
      });
    }

    const hadCache = (memoryCache?.rows?.length ?? 0) > 0 || (readSessionCache()?.length ?? 0) > 0;
    if (!hadCache) {
      setLookup((prev) => ({ ...prev, loading: true, error: null }));
    }

    sharedPromise
      .then((rows) => {
        if (!mountedRef.current) return;
        setLookup(buildLookup(rows));
      })
      .catch((e) => {
        if (!mountedRef.current) return;
        sharedPromise = null;
        memoryCache = null;
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
