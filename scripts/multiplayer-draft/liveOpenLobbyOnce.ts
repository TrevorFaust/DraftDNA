/**
 * Live open-lobby E2E: create an open room, discover via mp_list_open_lobbies,
 * fill all seats with guests, complete the draft, save grades.
 *
 *   npx tsx scripts/multiplayer-draft/liveOpenLobbyOnce.ts
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mpTeamForPick } from '../../src/utils/multiplayerDraftMath';
import { teamFillsRequiredStarters, type SimPick, type SimPlayer } from './simulateMultiplayerDraft';

config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../.env') });

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'output');
const NUM_TEAMS = 4;
const NUM_ROUNDS = 15;
const PICK_TIMER = 30;
const CPU_SPEED = 'rapid';
const stamp = Date.now();
const PEERS = [
  { guest: `open-peer-a-${stamp}`, name: 'OpenPeerA', team: 2 },
  { guest: `open-peer-b-${stamp}`, name: 'OpenPeerB', team: 3 },
  { guest: `open-peer-c-${stamp}`, name: 'OpenPeerC', team: 4 },
];
/** Tick as a seated peer — lobby join caps humans at num_teams, so no spare ticker seat. */
const TICKER_GUEST = PEERS[0].guest;

type Check = { id: string; pass: boolean; detail: string };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function cpuDelayMs(speed: string) {
  if (speed === 'rapid' || speed === 'instant') return 360;
  if (speed === 'fast') return 375;
  if (speed === 'slow') return 1500;
  return 750;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !serviceKey || !anonKey) {
    throw new Error('Missing VITE_SUPABASE_URL / keys in .env');
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const checks: Check[] = [];

  const { data: listed, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (listErr || !listed.users[0]?.id) {
    throw new Error(listErr?.message || 'No auth users available for host_user_id');
  }
  const hostUserId = listed.users[0].id;

  const [{ data: skill }, { data: defs }, { data: kicks }] = await Promise.all([
    admin.from('players').select('id, position, adp').order('adp', { ascending: true, nullsFirst: false }).limit(200),
    admin.from('players').select('id, position, adp').or('position.eq.DEF,position.eq.D/ST,position.eq.DST').limit(40),
    admin.from('players').select('id, position, adp').eq('position', 'K').limit(40),
  ]);
  if (!skill?.length) throw new Error('No skill players');

  const byId = new Map<string, { id: string; position: string; adp: number | null }>();
  for (const p of [...(defs || []), ...(kicks || []), ...skill]) {
    if (!byId.has(p.id)) byId.set(p.id, p as any);
  }
  const boardPlayers = [...byId.values()].sort((a, b) => {
    const ap = (a.position || '').toUpperCase();
    const bp = (b.position || '').toUpperCase();
    const aLate = ap === 'K' || ap === 'DEF' || ap === 'D/ST' || ap === 'DST' ? 1 : 0;
    const bLate = bp === 'K' || bp === 'DEF' || bp === 'D/ST' || bp === 'DST' ? 1 : 0;
    if (aLate !== bLate) return aLate - bLate;
    return (a.adp ?? 999) - (b.adp ?? 999);
  });
  const boardIds = boardPlayers.map((p) => p.id);
  const boardPositions = boardPlayers.map((p) => p.position || 'FLEX');
  const positionLimits = {
    QB: 4,
    RB: 8,
    WR: 8,
    TE: 3,
    DEF: 1,
    K: 1,
    FLEX: 1,
    BENCH: 6,
    starters: { QB: 1, RB: 2, WR: 2, TE: 1, DEF: 1, K: 1 },
  };

  const openInvite = `O${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const closedInvite = `C${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const { data: openDraft, error: openErr } = await admin
    .from('multiplayer_drafts')
    .insert({
      host_user_id: hostUserId,
      invite_code: openInvite,
      name: `Open Lobby Live ${openInvite}`,
      status: 'lobby',
      visibility: 'open',
      num_teams: NUM_TEAMS,
      num_rounds: NUM_ROUNDS,
      draft_order: 'snake',
      pick_timer: PICK_TIMER,
      cpu_speed: CPU_SPEED,
      scoring_format: 'half_ppr',
      league_type: 'season',
      is_superflex: true,
      position_limits: positionLimits,
      board_player_ids: boardIds,
      board_player_positions: boardPositions,
      current_pick_number: 1,
    } as any)
    .select('*')
    .single();
  if (openErr || !openDraft) throw new Error(openErr?.message || 'open draft insert failed');
  const draftId = openDraft.id as string;

  const { data: closedDraft, error: closedErr } = await admin
    .from('multiplayer_drafts')
    .insert({
      host_user_id: hostUserId,
      invite_code: closedInvite,
      name: `Closed Control ${closedInvite}`,
      status: 'lobby',
      visibility: 'invite',
      num_teams: NUM_TEAMS,
      num_rounds: NUM_ROUNDS,
      draft_order: 'snake',
      pick_timer: PICK_TIMER,
      cpu_speed: CPU_SPEED,
      scoring_format: 'ppr',
      league_type: 'season',
      is_superflex: false,
      position_limits: positionLimits,
      board_player_ids: boardIds,
      board_player_positions: boardPositions,
      current_pick_number: 1,
    } as any)
    .select('id')
    .single();
  if (closedErr || !closedDraft) throw new Error(closedErr?.message || 'closed draft insert failed');

  await admin.from('multiplayer_draft_participants').insert({
    draft_id: draftId,
    team_number: 1,
    user_id: hostUserId,
    display_name: 'OpenHost',
    is_host: true,
    is_ready: true,
    is_connected: true,
    is_autodraft: false,
  } as any);

  await admin.from('multiplayer_draft_participants').insert({
    draft_id: closedDraft.id,
    team_number: 1,
    user_id: hostUserId,
    display_name: 'ClosedHost',
    is_host: true,
    is_ready: true,
    is_connected: true,
  } as any);

  // Discover open lobby (anon) — closed must not appear
  const { data: openList, error: listRpcErr } = await anon.rpc('mp_list_open_lobbies' as any, {
    p_limit: 50,
  });
  if (listRpcErr) throw new Error(listRpcErr.message);
  const listedOpen = ((openList || []) as any[]).find((r) => r.draft_id === draftId);
  const listedClosed = ((openList || []) as any[]).find((r) => r.draft_id === closedDraft.id);

  checks.push({
    id: 'open_lobby_listed',
    pass: Boolean(listedOpen),
    detail: listedOpen
      ? `found ${listedOpen.name} seats ${listedOpen.seats_filled}/${listedOpen.num_teams} sf=${listedOpen.is_superflex} scoring=${listedOpen.scoring_format}`
      : 'open lobby missing from mp_list_open_lobbies',
  });
  checks.push({
    id: 'invite_lobby_hidden',
    pass: !listedClosed,
    detail: listedClosed ? 'invite-only lobby incorrectly listed' : 'invite-only lobby hidden',
  });
  checks.push({
    id: 'list_meta_format',
    pass:
      Boolean(listedOpen) &&
      listedOpen.seats_filled === 1 &&
      listedOpen.num_teams === NUM_TEAMS &&
      listedOpen.is_superflex === true &&
      listedOpen.scoring_format === 'half_ppr' &&
      listedOpen.league_type === 'season' &&
      listedOpen.invite_code === openInvite,
    detail: listedOpen
      ? `seats=${listedOpen.seats_filled} invite=${listedOpen.invite_code} host=${listedOpen.host_display_name}`
      : 'no row for meta check',
  });

  if (!listedOpen) {
    writeReport(checks, draftId, openInvite, 0, 'FAIL');
    process.exitCode = 1;
    return;
  }

  // Peers join via invite from the public list (same path as UI Join)
  for (const peer of PEERS) {
    const { data: joinData, error: joinErr } = await anon.rpc('mp_join_draft' as any, {
      p_invite_code: listedOpen.invite_code,
      p_guest_session_id: peer.guest,
      p_display_name: peer.name,
    });
    if (joinErr) throw new Error(`join ${peer.name}: ${joinErr.message}`);
    const { error: claimErr } = await anon.rpc('mp_claim_slot' as any, {
      p_draft_id: draftId,
      p_team_number: peer.team,
      p_guest_session_id: peer.guest,
    });
    if (claimErr) throw new Error(`claim ${peer.name}: ${claimErr.message}`);
    const { error: readyErr } = await anon.rpc('mp_set_ready' as any, {
      p_draft_id: draftId,
      p_ready: true,
      p_guest_session_id: peer.guest,
    });
    if (readyErr) throw new Error(`ready ${peer.name}: ${readyErr.message}`);
    void joinData;
  }

  const { data: afterJoinList } = await anon.rpc('mp_list_open_lobbies' as any, { p_limit: 50 });
  const afterJoin = ((afterJoinList || []) as any[]).find((r) => r.draft_id === draftId);
  checks.push({
    id: 'all_seats_filled_via_open_join',
    pass: afterJoin == null || afterJoin.seats_filled === NUM_TEAMS,
    detail: afterJoin
      ? `still listed with seats_filled=${afterJoin.seats_filled} (full lobbies should drop off)`
      : `full lobby dropped from open list (expected) after ${NUM_TEAMS} seated humans`,
  });

  const { data: parts } = await admin
    .from('multiplayer_draft_participants')
    .select('team_number, display_name, guest_session_id, user_id, is_ready')
    .eq('draft_id', draftId)
    .not('team_number', 'is', null);
  const seated = (parts || []).filter((p) => p.team_number != null);
  checks.push({
    id: 'four_humans_seated_ready',
    pass:
      seated.length === NUM_TEAMS &&
      seated.every((p) => p.is_ready) &&
      seated.some((p) => p.user_id === hostUserId) &&
      PEERS.every((peer) =>
        seated.some((p) => p.guest_session_id === peer.guest && p.team_number === peer.team)
      ),
    detail: seated
      .map((p) => `#${p.team_number}:${p.display_name}:ready=${p.is_ready}`)
      .join(', '),
  });

  // Start draft (admin mirrors host start after ready checks)
  const { error: startErr } = await admin
    .from('multiplayer_drafts')
    .update({
      status: 'drafting',
      started_at: new Date().toISOString(),
      current_pick_number: 1,
      pick_deadline_at: null,
    } as any)
    .eq('id', draftId);
  if (startErr) throw new Error(startErr.message);

  await anon.rpc('mp_tick_draft' as any, {
    p_draft_id: draftId,
    p_guest_session_id: TICKER_GUEST,
  });

  // Autodraft all human seats so the room finishes
  await admin
    .from('multiplayer_draft_participants')
    .update({ is_autodraft: true, is_connected: true } as any)
    .eq('draft_id', draftId);

  const total = NUM_TEAMS * NUM_ROUNDS;
  const started = Date.now();
  let stuck = false;

  const readDraft = async () => {
    const { data } = await admin
      .from('multiplayer_drafts')
      .select('status, current_pick_number, pick_deadline_at')
      .eq('id', draftId)
      .single();
    return data;
  };

  while (!stuck) {
    const d = await readDraft();
    if (!d || d.status !== 'drafting') break;
    const pickNum = d.current_pick_number as number;
    const team = mpTeamForPick(pickNum, NUM_TEAMS, 'snake');
    void team;
    await sleep(cpuDelayMs(CPU_SPEED));
    await anon.rpc('mp_tick_draft' as any, {
      p_draft_id: draftId,
      p_guest_session_id: TICKER_GUEST,
    });
    if (Date.now() - started > 240_000) {
      stuck = true;
      break;
    }
  }

  const { data: finalDraft } = await admin.from('multiplayer_drafts').select('*').eq('id', draftId).single();
  const { data: finalPicks } = await admin
    .from('multiplayer_draft_picks')
    .select('*')
    .eq('draft_id', draftId)
    .order('pick_number');

  const completed = finalDraft?.status === 'completed';
  const pickCount = finalPicks?.length ?? 0;
  checks.push({
    id: 'draft_completed',
    pass: completed && pickCount === total,
    detail: `status=${finalDraft?.status} picks=${pickCount}/${total}`,
  });
  checks.push({
    id: 'never_stuck',
    pass: !stuck,
    detail: stuck ? 'hit 240s stall timeout' : 'completed without stall timeout',
  });

  const board: SimPlayer[] = boardPlayers.map((p) => ({
    id: p.id,
    position: p.position || 'FLEX',
    adp: p.adp ?? 999,
  }));
  const simPicks: SimPick[] = (finalPicks || []).map((p: any) => ({
    player_id: p.player_id,
    team_number: p.team_number,
    round_number: p.round_number,
    pick_number: p.pick_number,
    is_autodraft: !!p.is_autodraft,
    is_keeper: !!p.is_keeper,
  }));
  const starterErrors: string[] = [];
  for (let t = 1; t <= NUM_TEAMS; t++) {
    const teamPicks = simPicks.filter((p) => p.team_number === t);
    if (teamPicks.length !== NUM_ROUNDS) starterErrors.push(`team ${t} picks ${teamPicks.length}/${NUM_ROUNDS}`);
    if (!teamFillsRequiredStarters(teamPicks, board)) starterErrors.push(`team ${t} missing starters`);
  }
  checks.push({
    id: 'all_teams_full_starters',
    pass: starterErrors.length === 0,
    detail: starterErrors.length === 0 ? 'all teams fill QB/2RB/2WR/TE/DEF/K' : starterErrors.join('; '),
  });

  const dup = pickCount - new Set((finalPicks || []).map((p: any) => p.player_id)).size;
  checks.push({
    id: 'no_duplicate_players',
    pass: dup === 0,
    detail: dup === 0 ? 'no duplicates' : `duplicates=${dup}`,
  });

  const { computeDraftGrade, toDraftGradePicks } = await import('../../src/utils/draftGrade');
  const gradePayload = [];
  for (let team = 1; team <= NUM_TEAMS; team++) {
    const rows = (finalPicks || []).filter((p: any) => p.team_number === team);
    const gradePicks = toDraftGradePicks(
      rows.map((p: any) => {
        const pl = boardPlayers.find((x) => x.id === p.player_id);
        return {
          pick_number: p.pick_number,
          round_number: p.round_number,
          is_autodraft: p.is_autodraft,
          is_keeper: p.is_keeper,
          player: pl
            ? { id: pl.id, name: 'x', position: pl.position, team: null, adp: pl.adp, bye_week: null }
            : undefined,
        };
      })
    );
    const grade = computeDraftGrade(gradePicks, { numTeams: NUM_TEAMS, numRounds: NUM_ROUNDS });
    const peer = PEERS.find((p) => p.team === team);
    gradePayload.push({
      team_number: team,
      user_id: team === 1 ? hostUserId : null,
      guest_session_id: peer?.guest ?? null,
      grade_letter: grade?.grade ?? null,
      grade_score: grade?.numericScore ?? null,
      grade_payload: grade,
      detected_archetype: 'The Alphabetical',
      detected_archetype_index: 0,
      detected_chaos_archetype: null,
      badge_awarded: team === 1,
    });
  }

  if (completed) {
    for (const row of gradePayload) {
      await admin.from('multiplayer_draft_results').upsert(
        { draft_id: draftId, ...row } as any,
        { onConflict: 'draft_id,team_number' }
      );
    }
  }

  const { data: results } = await admin.from('multiplayer_draft_results').select('*').eq('draft_id', draftId);
  checks.push({
    id: 'grades_and_summaries',
    pass:
      (results || []).length === NUM_TEAMS &&
      (results || []).every((r: any) => r.grade_letter && r.grade_payload) &&
      (results || []).some((r: any) => r.team_number === 1 && r.badge_awarded) &&
      (results || []).filter((r: any) => r.team_number !== 1).every((r: any) => !r.badge_awarded),
    detail: `results=${(results || []).map((r: any) => `${r.team_number}:${r.grade_letter}:badge=${r.badge_awarded}`).join(', ')}`,
  });

  // Cleanup control closed lobby
  await admin.from('multiplayer_drafts').delete().eq('id', closedDraft.id);

  const verdict = checks.every((c) => c.pass) ? 'PASS' : 'FAIL';
  writeReport(checks, draftId, openInvite, Date.now() - started, verdict);
  if (verdict !== 'PASS') process.exitCode = 1;
}

function writeReport(
  checks: Check[],
  draftId: string,
  invite: string,
  elapsedMs: number,
  verdict: string
) {
  const report = {
    attempt: 'live-open-lobby-once',
    verdict,
    draftId,
    invite,
    elapsedMs,
    checks,
  };
  writeFileSync(join(OUT_DIR, 'live-open-lobby-report.json'), JSON.stringify(report, null, 2));
  const md = [
    '# Live open multiplayer lobby — single run',
    '',
    `**Verdict: ${verdict}**`,
    '',
    `Draft \`${draftId}\` · invite \`${invite}\` · ${Math.round(elapsedMs / 1000)}s`,
    '',
    '## Checks',
    ...checks.map((c) => `- ${c.pass ? 'OK' : 'FAIL'} **${c.id}**: ${c.detail}`),
    '',
  ].join('\n');
  writeFileSync(join(OUT_DIR, 'live-open-lobby-report.md'), md);
  console.log(md);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
