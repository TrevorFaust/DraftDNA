import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../.env') });

async function main() {
  const url = process.env.VITE_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });

  const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  const hostUserId = listed!.users[0].id;
  const invite = `IDLE${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const { data: board } = await admin.from('players').select('id, position').limit(80);
  const ids = (board || []).map((p) => p.id);
  const pos = (board || []).map((p) => p.position || 'RB');

  const { data: draft, error } = await admin
    .from('multiplayer_drafts')
    .insert({
      host_user_id: hostUserId,
      invite_code: invite,
      name: 'Idle timeout test',
      status: 'lobby',
      visibility: 'open',
      num_teams: 4,
      num_rounds: 15,
      board_player_ids: ids,
      board_player_positions: pos,
    } as any)
    .select('id, lobby_last_activity_at, status, visibility')
    .single();
  if (error || !draft) throw new Error(error?.message || 'insert failed');

  // Age with server clock (client Date.now() can skew vs Postgres now()).
  const { error: ageErr } = await admin.rpc('mp_touch_lobby_activity' as any, {
    p_draft_id: draft.id,
  });
  void ageErr;
  const { data: agedSql, error: sqlAgeErr } = await admin
    .from('multiplayer_drafts')
    .update({
      // Far enough in the past that server now()-10m is definitely later.
      lobby_last_activity_at: '2000-01-01T00:00:00.000Z',
    } as any)
    .eq('id', draft.id)
    .select('lobby_last_activity_at, visibility, status')
    .single();
  if (sqlAgeErr) throw new Error(sqlAgeErr.message);
  console.log('aged row', agedSql);

  const { data: nAnon, error: expErrAnon } = await anon.rpc('mp_expire_stale_open_lobbies' as any);
  console.log('anon expire', { nAnon, expErrAnon });
  const { data: nAdmin, error: expErrAdmin } = await admin.rpc('mp_expire_stale_open_lobbies' as any);
  console.log('admin expire', { nAdmin, expErrAdmin });
  const countOf = (raw: unknown) => {
    if (typeof raw === 'number') return raw;
    const row = raw as { expired_count?: number } | null;
    return typeof row?.expired_count === 'number' ? row.expired_count : 0;
  };
  const nAnonCount = countOf(nAnon);
  const nAdminCount = countOf(nAdmin);
  const n = nAnonCount > 0 ? nAnonCount : nAdminCount;
  if (expErrAnon && expErrAdmin) throw new Error(expErrAnon.message || expErrAdmin.message);

  const { data: after, error: afterErr } = await admin
    .from('multiplayer_drafts')
    .select('status')
    .eq('id', draft.id)
    .maybeSingle();

  const { data: list } = await anon.rpc('mp_list_open_lobbies' as any, { p_limit: 50 });
  const still = ((list || []) as any[]).some((r) => r.draft_id === draft.id);

  await admin.from('multiplayer_drafts').delete().eq('id', draft.id);

  const pass =
    after?.status === 'cancelled' && !still && typeof n === 'number' && n >= 1 && !afterErr;
  console.log(
    JSON.stringify(
      {
        pass,
        expiredCount: n,
        nAnon: nAnonCount,
        nAdmin: nAdminCount,
        serverNow:
          typeof nAnon === 'object' && nAnon && 'server_now' in nAnon
            ? (nAnon as { server_now?: string }).server_now
            : null,
        status: after?.status,
        stillListed: still,
        draftId: draft.id,
        afterErr: afterErr?.message ?? null,
      },
      null,
      2
    )
  );
  if (!pass) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
