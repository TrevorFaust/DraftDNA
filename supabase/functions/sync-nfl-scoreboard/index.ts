// Sync NFL regular-season games + scores from ESPN's public scoreboard.
// Any signed-in user can trigger it so pick'em stays current without a cron job.
//
// POST { "season": 2026, "week": 1 }  — one week
// POST { "season": 2026 }             — current week + previous week, plus full season if sparse
//
// Do not call ESPN with dates=<year> and no week. That dump returns ~100 events
// labeled as week 18 and the matchup upsert fails with "ON CONFLICT cannot
// affect row a second time", so finished weeks never get scores.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ESPN_SCOREBOARD =
  'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

const ALT_ABBR: Record<string, string> = {
  WSH: 'WAS',
  LA: 'LAR',
  JAC: 'JAX',
  ARZ: 'ARI',
  GNB: 'GB',
  KAN: 'KC',
  NWE: 'NE',
  NOR: 'NO',
  SFO: 'SF',
  TAM: 'TB',
  SD: 'LAC',
  SDG: 'LAC',
};

const MAX_GAMES_PER_WEEK = 16;
const REGULAR_SEASON_WEEKS = 18;

type EspnCompetitor = {
  homeAway?: string;
  score?: string;
  winner?: boolean;
  team?: { abbreviation?: string; displayName?: string };
};

type EspnEvent = {
  id?: string;
  date?: string;
  week?: { number?: number };
  competitions?: Array<{
    date?: string;
    status?: { type?: { state?: string; completed?: boolean; name?: string } };
    competitors?: EspnCompetitor[];
  }>;
};

type EspnCalendarEntry = {
  label?: string;
  value?: string;
  startDate?: string;
  endDate?: string;
};

type EspnScoreboard = {
  week?: { number?: number };
  season?: { year?: number; type?: number };
  leagues?: Array<{
    season?: { year?: number; type?: { type?: number } };
    calendar?: Array<{ label?: string; value?: string; entries?: EspnCalendarEntry[] }>;
  }>;
  events?: EspnEvent[];
};

type GameRow = {
  espn_event_id: string;
  season: number;
  week: number;
  season_type: number;
  home_abbr: string;
  away_abbr: string;
  home_name: string | null;
  away_name: string | null;
  kickoff_at: string;
  home_score: number | null;
  away_score: number | null;
  status: 'scheduled' | 'in_progress' | 'final';
  updated_at: string;
};

function canonicalAbbr(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const u = raw.trim().toUpperCase();
  return ALT_ABBR[u] ?? u;
}

function parseScore(raw: string | undefined): number | null {
  if (raw == null || raw === '') return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function mapStatus(state: string | undefined, completed: boolean | undefined, name?: string): GameRow['status'] {
  if (completed || state === 'post' || name === 'STATUS_FINAL') return 'final';
  if (state === 'in' || name === 'STATUS_IN_PROGRESS') return 'in_progress';
  return 'scheduled';
}

function scoreboardSeason(data: EspnScoreboard, fallback: number): number {
  return data.season?.year ?? data.leagues?.[0]?.season?.year ?? fallback;
}

function scoreboardWeek(data: EspnScoreboard, fallback: number): number {
  const fromPayload = data.week?.number;
  if (typeof fromPayload === 'number' && fromPayload >= 1 && fromPayload <= 22) return fromPayload;

  const now = Date.now();
  const regular = data.leagues?.[0]?.calendar?.find(
    (block) => block.value === '2' || /regular/i.test(block.label ?? '')
  );
  for (const entry of regular?.entries ?? []) {
    const week = Number.parseInt(entry.value ?? '', 10);
    const start = entry.startDate ? Date.parse(entry.startDate) : Number.NaN;
    const end = entry.endDate ? Date.parse(entry.endDate) : Number.NaN;
    if (!Number.isInteger(week) || !Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (now >= start && now <= end) return week;
  }
  return fallback;
}

function matchupKey(row: GameRow): string {
  return `${row.season}:${row.season_type}:${row.week}:${row.home_abbr}@${row.away_abbr}`;
}

function statusRank(status: GameRow['status']): number {
  if (status === 'final') return 2;
  if (status === 'in_progress') return 1;
  return 0;
}

function gamesFromScoreboard(data: EspnScoreboard, fallbackSeason: number, fallbackWeek: number): GameRow[] {
  const season = scoreboardSeason(data, fallbackSeason);
  const boardWeek = scoreboardWeek(data, fallbackWeek);
  const nowIso = new Date().toISOString();
  const rows: GameRow[] = [];

  for (const event of data.events ?? []) {
    const espnId = event.id?.trim();
    const comp = event.competitions?.[0];
    if (!espnId || !comp) continue;

    const home = comp.competitors?.find((c) => c.homeAway === 'home');
    const away = comp.competitors?.find((c) => c.homeAway === 'away');
    const homeAbbr = canonicalAbbr(home?.team?.abbreviation);
    const awayAbbr = canonicalAbbr(away?.team?.abbreviation);
    const kickoff = comp.date || event.date;
    if (!homeAbbr || !awayAbbr || !kickoff) continue;

    const eventWeek = event.week?.number;
    const week =
      typeof eventWeek === 'number' && eventWeek >= 1 && eventWeek <= 22 ? eventWeek : boardWeek;

    rows.push({
      espn_event_id: espnId,
      season,
      week,
      season_type: 2,
      home_abbr: homeAbbr,
      away_abbr: awayAbbr,
      home_name: home?.team?.displayName?.trim() || null,
      away_name: away?.team?.displayName?.trim() || null,
      kickoff_at: kickoff,
      home_score: parseScore(home?.score),
      away_score: parseScore(away?.score),
      status: mapStatus(comp.status?.type?.state, comp.status?.type?.completed, comp.status?.type?.name),
      updated_at: nowIso,
    });
  }

  return rows;
}

function keepRegularSeasonWeeks(rows: GameRow[], expectedWeek?: number): GameRow[] {
  const byWeek = new Map<number, GameRow[]>();
  for (const row of rows) {
    if (row.season_type !== 2) continue;
    if (row.week < 1 || row.week > REGULAR_SEASON_WEEKS) continue;
    const list = byWeek.get(row.week) ?? [];
    list.push(row);
    byWeek.set(row.week, list);
  }

  const kept: GameRow[] = [];
  for (const [week, list] of byWeek) {
    if (expectedWeek != null && week !== expectedWeek) continue;
    if (list.length > MAX_GAMES_PER_WEEK) continue;
    kept.push(...list);
  }
  return kept;
}

function mergeRows(allRows: GameRow[]): GameRow[] {
  const unique = new Map<string, GameRow>();
  for (const row of allRows) {
    const key = matchupKey(row);
    const existing = unique.get(key);
    if (!existing || statusRank(row.status) >= statusRank(existing.status)) {
      unique.set(key, row);
    }
  }
  return [...unique.values()];
}

async function fetchScoreboard(url: string): Promise<EspnScoreboard> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ESPN scoreboard ${res.status}`);
  }
  return (await res.json()) as EspnScoreboard;
}

async function fetchWeek(season: number, week: number): Promise<{ rows: GameRow[]; currentWeek: number; season: number }> {
  const url = `${ESPN_SCOREBOARD}?dates=${season}&seasontype=2&week=${week}`;
  const data = await fetchScoreboard(url);
  const resolvedSeason = scoreboardSeason(data, season);
  const currentWeek = scoreboardWeek(data, week);
  return {
    rows: keepRegularSeasonWeeks(gamesFromScoreboard(data, resolvedSeason, week), week),
    currentWeek,
    season: resolvedSeason,
  };
}

async function fetchLive(): Promise<{ rows: GameRow[]; week: number; season: number }> {
  const data = await fetchScoreboard(ESPN_SCOREBOARD);
  const season = scoreboardSeason(data, 2026);
  const week = scoreboardWeek(data, 1);
  return {
    rows: keepRegularSeasonWeeks(gamesFromScoreboard(data, season, week), week),
    week,
    season,
  };
}

async function authorizeUser(req: Request, supabaseUrl: string): Promise<boolean> {
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const authHeader = req.headers.get('Authorization');
  if (!anonKey || !authHeader?.startsWith('Bearer ')) return false;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();
  return Boolean(user) && !error;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing Supabase env');
    }

    const allowed = await authorizeUser(req, supabaseUrl);
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Sign in to refresh the schedule' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body: { season?: number; week?: number; full?: boolean } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      body = {};
    }

    const season = Number.isFinite(body.season) ? Number(body.season) : 2026;
    const admin = createClient(supabaseUrl, serviceKey);
    const allRows: GameRow[] = [];
    let syncedWeek: number | null = body.week ?? null;

    if (typeof body.week === 'number') {
      const requested = await fetchWeek(season, body.week);
      allRows.push(...requested.rows);
      syncedWeek = requested.currentWeek;
    } else {
      const live = await fetchLive();
      allRows.push(...live.rows);
      syncedWeek = live.week;

      if (live.week > 1) {
        const previous = await fetchWeek(live.season, live.week - 1);
        allRows.push(...previous.rows);
      }

      const { count } = await admin
        .from('nfl_games')
        .select('id', { count: 'exact', head: true })
        .eq('season', live.season)
        .eq('season_type', 2);

      const scored = await admin
        .from('nfl_games')
        .select('id', { count: 'exact', head: true })
        .eq('season', live.season)
        .eq('season_type', 2)
        .eq('status', 'final');

      const needFull = body.full === true || (count ?? 0) < 200 || (scored.count ?? 0) === 0;
      if (needFull) {
        const weeks = Array.from({ length: REGULAR_SEASON_WEEKS }, (_, i) => i + 1);
        const batches = [weeks.slice(0, 6), weeks.slice(6, 12), weeks.slice(12, 18)];
        for (const batch of batches) {
          const fetched = await Promise.all(batch.map((week) => fetchWeek(live.season, week)));
          for (const item of fetched) allRows.push(...item.rows);
        }
      }
    }

    const payload = mergeRows(allRows);

    if (payload.length > 0) {
      const { error } = await admin.from('nfl_games').upsert(payload, {
        onConflict: 'season,season_type,week,home_abbr,away_abbr',
      });
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        season,
        week: syncedWeek,
        upserted: payload.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
