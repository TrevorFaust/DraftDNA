// Sync NFL regular-season games + scores from ESPN's public scoreboard.
// Any signed-in user can trigger it so pick'em stays current without a cron job.
//
// POST { "season": 2026, "week": 1 }  — one week
// POST { "season": 2026 }             — current week, plus full season if sparse

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

type EspnCompetitor = {
  homeAway?: string;
  score?: string;
  winner?: boolean;
  team?: { abbreviation?: string; displayName?: string };
};

type EspnEvent = {
  id?: string;
  date?: string;
  competitions?: Array<{
    date?: string;
    status?: { type?: { state?: string; completed?: boolean } };
    competitors?: EspnCompetitor[];
  }>;
};

type EspnScoreboard = {
  week?: { number?: number };
  season?: { year?: number };
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

function mapStatus(state: string | undefined, completed: boolean | undefined): GameRow['status'] {
  if (completed || state === 'post') return 'final';
  if (state === 'in') return 'in_progress';
  return 'scheduled';
}

function gamesFromScoreboard(data: EspnScoreboard, fallbackSeason: number, fallbackWeek: number): GameRow[] {
  const season = data.season?.year ?? fallbackSeason;
  const week = data.week?.number ?? fallbackWeek;
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
      status: mapStatus(comp.status?.type?.state, comp.status?.type?.completed),
      updated_at: nowIso,
    });
  }

  return rows;
}

async function fetchWeek(season: number, week: number): Promise<{ rows: GameRow[]; currentWeek: number }> {
  const url = `${ESPN_SCOREBOARD}?dates=${season}&seasontype=2&week=${week}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ESPN scoreboard ${res.status} for week ${week}`);
  }
  const data = (await res.json()) as EspnScoreboard;
  const currentWeek = data.week?.number ?? week;
  return { rows: gamesFromScoreboard(data, season, week), currentWeek };
}

async function fetchCurrent(season: number): Promise<{ rows: GameRow[]; week: number; season: number }> {
  const url = `${ESPN_SCOREBOARD}?dates=${season}&seasontype=2`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ESPN scoreboard ${res.status}`);
  }
  const data = (await res.json()) as EspnScoreboard;
  const resolvedSeason = data.season?.year ?? season;
  const week = data.week?.number ?? 1;
  return { rows: gamesFromScoreboard(data, resolvedSeason, week), week, season: resolvedSeason };
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
      const { rows, currentWeek } = await fetchWeek(season, body.week);
      allRows.push(...rows);
      syncedWeek = currentWeek;
    } else {
      const current = await fetchCurrent(season);
      allRows.push(...current.rows);
      syncedWeek = current.week;

      const { count } = await admin
        .from('nfl_games')
        .select('id', { count: 'exact', head: true })
        .eq('season', current.season)
        .eq('season_type', 2);

      const needFull = body.full === true || (count ?? 0) < 200;
      if (needFull) {
        const weeks = Array.from({ length: 18 }, (_, i) => i + 1);
        const batches = [weeks.slice(0, 6), weeks.slice(6, 12), weeks.slice(12, 18)];
        for (const batch of batches) {
          const fetched = await Promise.all(batch.map((week) => fetchWeek(current.season, week)));
          for (const item of fetched) allRows.push(...item.rows);
        }
      }
    }

    const unique = new Map<string, GameRow>();
    for (const row of allRows) unique.set(row.espn_event_id, row);
    const payload = [...unique.values()];

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
