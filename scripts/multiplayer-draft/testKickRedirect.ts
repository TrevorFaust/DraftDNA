/**
 * Live kick test: join via invite code (guest), host kicks, verify participant gone.
 *
 *   npx tsx scripts/multiplayer-draft/testKickRedirect.ts
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../.env') });

async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !serviceKey || !anonKey) {
    throw new Error('Missing VITE_SUPABASE_URL / keys in .env');
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const guest = createClient(url, anonKey, { auth: { persistSession: false } });

  const { data: listed, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (listErr || !listed.users[0]?.id) {
    throw new Error(listErr?.message || 'No auth users for host');
  }
  const hostUserId = listed.users[0].id;

  // Sign in host client with a magic path: use service to create a session is hard;
  // call kick via admin delete after verifying RPC with a signed-in host.
  // Create host auth client by generating a link is heavy — instead insert host row
  // and use admin RPC impersonation isn't available. Use SQL for kick path parity
  // by calling mp_host_move_kick as the host via a temporary password user login.

  const hostEmail = `kick-host-${Date.now()}@example.com`;
  const hostPass = `KickTest_${Math.random().toString(36).slice(2)}!aA1`;
  const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
    email: hostEmail,
    password: hostPass,
    email_confirm: true,
  });
  if (createErr || !createdUser.user) {
    throw new Error(createErr?.message || 'Could not create host user');
  }
  const realHostId = createdUser.user.id;

  const host = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signErr } = await host.auth.signInWithPassword({
    email: hostEmail,
    password: hostPass,
  });
  if (signErr) throw new Error(signErr.message);

  const { data: board } = await admin
    .from('players')
    .select('id, position')
    .order('adp', { ascending: true, nullsFirst: false })
    .limit(80);
  if (!board?.length) throw new Error('No players for board');

  const invite = `K${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const { data: draftRow, error: draftErr } = await admin
    .from('multiplayer_drafts')
    .insert({
      host_user_id: realHostId,
      invite_code: invite,
      name: `Kick Test ${invite}`,
      status: 'lobby',
      num_teams: 4,
      num_rounds: 15,
      draft_order: 'snake',
      pick_timer: 30,
      cpu_speed: 'rapid',
      board_player_ids: board.map((p) => p.id),
      board_player_positions: board.map((p) => p.position || 'FLEX'),
      current_pick_number: 1,
    } as any)
    .select('*')
    .single();
  if (draftErr || !draftRow) throw new Error(draftErr?.message || 'draft insert failed');
  const draftId = draftRow.id as string;

  await admin.from('multiplayer_draft_participants').insert({
    draft_id: draftId,
    team_number: 1,
    user_id: realHostId,
    display_name: 'Host',
    is_host: true,
    is_ready: true,
  });

  // Guest joins via invite code (same path as Mock Draft code box)
  const guestSession = `kick-guest-${Date.now()}`;
  const { data: joinData, error: joinErr } = await guest.rpc('mp_join_draft' as any, {
    p_invite_code: invite,
    p_guest_session_id: guestSession,
    p_display_name: 'CodeJoiner',
  });
  if (joinErr) throw new Error(`join failed: ${joinErr.message}`);

  const { data: claimData, error: claimErr } = await guest.rpc('mp_claim_slot' as any, {
    p_draft_id: draftId,
    p_team_number: 2,
    p_guest_session_id: guestSession,
  });
  if (claimErr) throw new Error(`claim failed: ${claimErr.message}`);

  const { data: beforeParts } = await guest
    .from('multiplayer_draft_participants')
    .select('id, display_name, team_number, guest_session_id')
    .eq('draft_id', draftId);
  const guestRow = (beforeParts || []).find((p: any) => p.guest_session_id === guestSession);
  if (!guestRow) throw new Error('Guest not in lobby after join+claim');

  console.log('Invite code:', invite);
  console.log('Joined as guest on seat', claimData, 'participant', guestRow.id);

  // Subscribe like the lobby (filtered by draft_id) and wait for DELETE
  let deleteSeen = false;
  const channel = guest
    .channel(`kick-test-${draftId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'multiplayer_draft_participants',
        filter: `draft_id=eq.${draftId}`,
      },
      (payload) => {
        console.log('Realtime event:', payload.eventType, (payload as any).old?.id || (payload as any).new?.id);
        if (payload.eventType === 'DELETE') deleteSeen = true;
      }
    )
    .subscribe();

  await new Promise((r) => setTimeout(r, 800));

  const { data: kickData, error: kickErr } = await host.rpc('mp_host_move_kick' as any, {
    p_draft_id: draftId,
    p_participant_id: guestRow.id,
    p_action: 'kick',
    p_new_team_number: null,
  });
  if (kickErr) throw new Error(`kick failed: ${kickErr.message}`);
  console.log('Kick RPC:', kickData);

  // Poll like the lobby backup (2s) + a bit of buffer for realtime
  let gone = false;
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const { data: afterParts } = await guest
      .from('multiplayer_draft_participants')
      .select('id, guest_session_id')
      .eq('draft_id', draftId);
    const stillThere = (afterParts || []).some((p: any) => p.guest_session_id === guestSession);
    if (!stillThere) {
      gone = true;
      break;
    }
  }

  await guest.removeChannel(channel);

  // Cleanup
  await admin.from('multiplayer_draft_participants').delete().eq('draft_id', draftId);
  await admin.from('multiplayer_drafts').delete().eq('id', draftId);
  await admin.auth.admin.deleteUser(realHostId);

  console.log('\nRESULTS');
  console.log('- guest removed from participants:', gone ? 'PASS' : 'FAIL');
  console.log('- realtime DELETE seen:', deleteSeen ? 'PASS' : 'FAIL (poll backup still covers UI)');
  console.log('- unused hostUserId ref:', hostUserId.slice(0, 8));
  console.log('- join payload:', joinData);

  if (!gone) {
    process.exitCode = 1;
    throw new Error('Guest still present after kick');
  }
  console.log('\nKick path OK — lobby poll/realtime should redirect client to /mock-draft');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
