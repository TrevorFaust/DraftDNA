// Sync `players.team` and `players.jersey_number` from Sleeper's NFL players map.
//
// Secrets (Dashboard → Edge Functions → Secrets):
//   SUPABASE_SERVICE_ROLE_KEY — DB updates (auto-provided on Supabase)
//   SUPABASE_ANON_KEY — validate caller JWT (auto-provided)
//
// Access (any one):
//   1) Header `x-sync-secret` = SYNC_PLAYER_TEAMS_SECRET (cron / curl only — keep secret private)
//   2) Authorization: Bearer <user access_token> where JWT `sub` is in ADMIN_SYNC_USER_IDS (browser)
//      Callers must send the user JWT, not the anon key (client uses getSession + explicit header).
//
// Edge secret name must match what Deno reads (case-sensitive): prefer ADMIN_SYNC_USER_IDS.
// Also accepts admin_sync_user_ids if you created that name in the dashboard by mistake.
// After saving a secret, the dashboard shows a digest/hash — not your UUID. That is normal.
//
// Body (JSON POST): { "season": 2025 } — optional; also supports ?season=2025 on URL.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-secret',
};

type SleeperPlayer = {
  team?: string | null;
  number?: number | string | null;
};

function normTeam(t: unknown): string | null {
  if (t == null) return null;
  const s = String(t).trim().toUpperCase();
  return s.length > 0 ? s : null;
}

function normJersey(n: unknown): number | null {
  if (n == null || n === '') return null;
  const x = typeof n === 'number' ? n : parseInt(String(n), 10);
  return Number.isFinite(x) ? x : null;
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function authorizeRequest(req: Request, supabaseUrl: string): Promise<boolean> {
  const syncSecret = Deno.env.get('SYNC_PLAYER_TEAMS_SECRET');
  const hdrSecret = req.headers.get('x-sync-secret');
  if (syncSecret && hdrSecret === syncSecret) {
    return true;
  }

  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const authHeader = req.headers.get('Authorization');
  if (!anonKey || !authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();
  if (error || !user) {
    return false;
  }

  const rawList =
    Deno.env.get('ADMIN_SYNC_USER_IDS') ?? Deno.env.get('admin_sync_user_ids') ?? '';
  const adminIds = rawList
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (adminIds.length === 0) {
    console.warn(
      'sync-player-teams: no admin user allowlist — denying browser JWT auth. Set Edge secret ADMIN_SYNC_USER_IDS (or admin_sync_user_ids) to your auth user UUID(s), comma-separated, or use x-sync-secret.'
    );
    return false;
  }

  return adminIds.includes(user.id.toLowerCase());
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ok = await authorizeRequest(req, supabaseUrl);
    if (!ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            'Unauthorized. Set Edge secret ADMIN_SYNC_USER_IDS to your auth user UUID (Dashboard → Authentication → Users), or call with x-sync-secret.',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const qSeason = url.searchParams.get('season');

    let season: number | null = null;
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      const ct = req.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) {
        try {
          const raw = await req.text();
          if (raw) {
            const body = JSON.parse(raw) as { season?: number };
            if (body?.season != null && body.season !== ('' as unknown as number)) {
              season = Number(body.season);
            }
          }
        } catch {
          /* ignore */
        }
      }
    }
    if (season == null && qSeason != null && qSeason !== '') {
      season = Number(qSeason);
    }
    if (season != null && !Number.isFinite(season)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid season' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    console.log('Fetching Sleeper NFL players...');
    const sleeperRes = await fetch('https://api.sleeper.app/v1/players/nfl');
    if (!sleeperRes.ok) {
      throw new Error(`Sleeper HTTP ${sleeperRes.status}`);
    }
    const sleeperPlayers = (await sleeperRes.json()) as Record<string, SleeperPlayer>;

    const pageSize = 1000;
    let from = 0;
    const players: {
      id: string;
      sleeper_id: string;
      team: string | null;
      jersey_number: number | null;
    }[] = [];

    for (;;) {
      let q = supabase
        .from('players')
        .select('id, sleeper_id, team, jersey_number')
        .not('sleeper_id', 'is', null)
        .order('id')
        .range(from, from + pageSize - 1);

      if (season != null) {
        q = q.eq('season', season);
      }

      const { data: page, error: pageError } = await q;
      if (pageError) throw pageError;
      const rows = page ?? [];
      players.push(...(rows as typeof players));
      if (rows.length < pageSize) break;
      from += pageSize;
    }

    type Change = {
      id: string;
      team: string | null;
      jersey_number: number | null;
    };

    const updates: Change[] = [];

    for (const player of players) {
      const sid = player.sleeper_id?.trim();
      if (!sid) continue;

      const sp = sleeperPlayers[sid];
      if (!sp) continue;

      const newTeam = normTeam(sp.team);
      const newJersey = normJersey(sp.number);

      const curTeam = normTeam(player.team);
      const curJersey = player.jersey_number;

      const teamChanged = newTeam !== curTeam;
      const jerseyChanged = newJersey !== curJersey;

      if (teamChanged || jerseyChanged) {
        updates.push({
          id: player.id,
          team: newTeam,
          jersey_number: newJersey,
        });
      }
    }

    let updated = 0;
    let failed = 0;
    const batchSize = 25;

    for (let i = 0; i < updates.length; i += batchSize) {
      const chunk = updates.slice(i, i + batchSize);
      const results = await Promise.all(
        chunk.map((u) =>
          supabase
            .from('players')
            .update({ team: u.team, jersey_number: u.jersey_number })
            .eq('id', u.id)
        )
      );
      for (const { error } of results) {
        if (error) {
          failed++;
          console.error('Update error:', error.message);
        } else {
          updated++;
        }
      }
    }

    const maxSample = 100;
    const sample = updates.slice(0, maxSample);

    return new Response(
      JSON.stringify({
        success: true,
        season: season ?? 'all',
        checked: players.length,
        pendingChanges: updates.length,
        updated,
        failed,
        sample,
        sampleTruncated: updates.length > maxSample,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('sync-player-teams:', err);
    return new Response(
      JSON.stringify({ success: false, error: errMessage(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
