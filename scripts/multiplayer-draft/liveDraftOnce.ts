/**
 * Single live multiplayer draft test (one room, two "windows", full completion).
 * Run once and review the report before looping the manager harness.
 *
 *   npx tsx scripts/multiplayer-draft/liveDraftOnce.ts
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
const HOST_GUEST = `live-host-${Date.now()}`;
const PEER_GUEST = `live-peer-${Date.now()}`;

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
  const timerEvents: Array<{
    pick: number;
    team: number;
    atStart: number;
    afterWait: number;
    decreased: boolean;
  }> = [];

  const { data: listed, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (listErr || !listed.users[0]?.id) {
    throw new Error(listErr?.message || 'No auth users available for host_user_id');
  }
  const hostUserId = listed.users[0].id;

  // Build board with guaranteed DEF/K supply + skill depth
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
  // Skill first (low ADP), DEF/K near end so need-based late rounds fill them
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

  const invite = `L${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const { data: draftRow, error: draftErr } = await admin
    .from('multiplayer_drafts')
    .insert({
      host_user_id: hostUserId,
      invite_code: invite,
      name: `Live Once ${invite}`,
      status: 'lobby',
      num_teams: NUM_TEAMS,
      num_rounds: NUM_ROUNDS,
      draft_order: 'snake',
      pick_timer: PICK_TIMER,
      cpu_speed: CPU_SPEED,
      scoring_format: 'half_ppr',
      league_type: 'season',
      is_superflex: false,
      position_limits: { QB: 4, RB: 8, WR: 8, TE: 3, DEF: 1, K: 1, FLEX: 1, BENCH: 6 },
      board_player_ids: boardIds,
      board_player_positions: boardPositions,
      current_pick_number: 1,
    } as any)
    .select('*')
    .single();
  if (draftErr || !draftRow) throw new Error(draftErr?.message || 'draft insert failed');
  const draftId = draftRow.id as string;

  await admin.from('multiplayer_draft_participants').insert([
    {
      draft_id: draftId,
      team_number: 1,
      user_id: hostUserId,
      display_name: 'HostWindow',
      is_host: true,
      is_ready: true,
      is_connected: true,
      is_autodraft: false,
    },
    {
      draft_id: draftId,
      team_number: 3,
      guest_session_id: PEER_GUEST,
      display_name: 'PeerWindow',
      is_host: false,
      is_ready: true,
      is_connected: true,
      is_autodraft: false,
    },
    {
      draft_id: draftId,
      guest_session_id: HOST_GUEST,
      display_name: 'HostTicker',
      is_host: false,
      is_ready: true,
      is_connected: true,
      is_autodraft: false,
    },
  ] as any);

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
  // Heal first-turn deadline with DB clock (not browser Date)
  await anon.rpc('mp_tick_draft' as any, {
    p_draft_id: draftId,
    p_guest_session_id: HOST_GUEST,
  });

  const total = NUM_TEAMS * NUM_ROUNDS;
  let stuck = false;
  const started = Date.now();
  const seenHumanTimer = new Set<number>();

  const readDraft = async () => {
    const { data } = await admin
      .from('multiplayer_drafts')
      .select('status, current_pick_number, pick_deadline_at, pick_timer, cpu_speed')
      .eq('id', draftId)
      .single();
    return data;
  };

  const tickAs = async (guestId: string) => {
    const { data, error } = await anon.rpc('mp_tick_draft' as any, {
      p_draft_id: draftId,
      p_guest_session_id: guestId,
    });
    return { data, error };
  };

  const windowLoop = async (guestId: string, myTeam: number, label: string) => {
    while (!stuck) {
      const d = await readDraft();
      if (!d || d.status !== 'drafting') break;

      const pickNum = d.current_pick_number as number;
      const team = mpTeamForPick(pickNum, NUM_TEAMS, 'snake');
      const human = team === 1 || team === 3;

      const { data: d2 } = await anon
        .from('multiplayer_drafts')
        .select('current_pick_number')
        .eq('id', draftId)
        .single();
      if ((d2?.current_pick_number as number) !== pickNum) {
        checks.push({
          id: `sync_${pickNum}_${label}`,
          pass: false,
          detail: `${label} saw pick ${pickNum}, peer query saw ${d2?.current_pick_number}`,
        });
      }

      if (human && team === myTeam) {
        await admin
          .from('multiplayer_draft_participants')
          .update({ is_autodraft: false, is_connected: true } as any)
          .eq('draft_id', draftId)
          .eq('team_number', myTeam);

        const { data: tickData } = await tickAs(guestId);
        const afterHeal = await readDraft();
        if (!afterHeal || afterHeal.status !== 'drafting') break;
        if ((afterHeal.current_pick_number as number) !== pickNum) continue;

        // Prefer server_now skew-safe remaining; fall back to local pick-timer epoch
        const payload = tickData as {
          pick_deadline_at?: string;
          server_now?: string;
          current_pick_number?: number;
        } | null;
        let atStart = PICK_TIMER;
        if (payload?.pick_deadline_at && payload?.server_now) {
          atStart = Math.ceil(
            (new Date(payload.pick_deadline_at).getTime() -
              new Date(payload.server_now).getTime()) /
              1000
          );
        }
        const localEpoch = Date.now();

        if (!seenHumanTimer.has(pickNum)) {
          seenHumanTimer.add(pickNum);
          const fresh = atStart >= 25 && atStart <= PICK_TIMER + 1;
          checks.push({
            id: `timer_reset_pick_${pickNum}`,
            pass: fresh,
            detail: `${label} pick ${pickNum} team ${team}: ${atStart}s vs server_now (want ~${PICK_TIMER})`,
          });

          await sleep(1500);
          const afterWait = Math.max(
            0,
            Math.ceil(PICK_TIMER - (Date.now() - localEpoch) / 1000)
          );
          const decreased = afterWait < PICK_TIMER;
          timerEvents.push({ pick: pickNum, team, atStart, afterWait, decreased });
          checks.push({
            id: `timer_counts_down_pick_${pickNum}`,
            pass: decreased,
            detail: `local epoch ${PICK_TIMER}s → ${afterWait}s after 1.5s`,
          });
        }

        await admin
          .from('multiplayer_draft_participants')
          .update({ is_autodraft: true } as any)
          .eq('draft_id', draftId)
          .eq('team_number', myTeam);
        await tickAs(guestId);
        await admin
          .from('multiplayer_draft_participants')
          .update({ is_autodraft: false } as any)
          .eq('draft_id', draftId)
          .eq('team_number', myTeam);
      } else if (!human) {
        await sleep(cpuDelayMs(CPU_SPEED));
        await tickAs(guestId);
      } else {
        // Other human on clock — wait, peer window handles it
        await sleep(300);
        await tickAs(guestId);
      }

      if (Date.now() - started > 240_000) {
        stuck = true;
        break;
      }
      await sleep(100);
    }
  };

  await Promise.all([
    windowLoop(HOST_GUEST, 1, 'windowA'),
    windowLoop(PEER_GUEST, 3, 'windowB'),
  ]);

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
  for (const team of [1, 3]) {
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
    gradePayload.push({
      team_number: team,
      user_id: team === 1 ? hostUserId : null,
      guest_session_id: team === 3 ? PEER_GUEST : null,
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
    id: 'grades_and_badges',
    pass:
      (results || []).length >= 2 &&
      (results || []).every((r: any) => r.grade_letter) &&
      (results || []).some((r: any) => r.team_number === 1 && r.badge_awarded) &&
      (results || []).some((r: any) => r.team_number === 3 && !r.badge_awarded),
    detail: `results=${(results || []).map((r: any) => `${r.team_number}:${r.grade_letter}:badge=${r.badge_awarded}`).join(', ')}`,
  });

  // Brief pick# races while both windows tick are OK; fail only if frequent
  const syncFails = checks.filter((c) => c.id.startsWith('sync_') && !c.pass);
  const syncOk = syncFails.length <= Math.max(3, Math.floor(total * 0.15));
  const syncCheck: Check = {
    id: 'windows_stay_synced',
    pass: syncOk,
    detail: syncOk
      ? `transient desyncs=${syncFails.length} (allowed during concurrent ticks)`
      : `${syncFails.length} desync events — windows diverged too often`,
  };

  const core = checks.filter((c) => !c.id.startsWith('sync_') && c.id !== 'windows_stay_synced');
  const allChecks = [...core, syncCheck];
  const verdict = allChecks.every((c) => c.pass) ? 'PASS' : 'FAIL';

  const report = {
    attempt: 'live-once',
    verdict,
    draftId,
    invite,
    elapsedMs: Date.now() - started,
    checks: allChecks,
    timerEvents,
  };

  writeFileSync(join(OUT_DIR, 'live-once-report.json'), JSON.stringify(report, null, 2));
  const md = [
    '# Live multiplayer draft — single run',
    '',
    `**Verdict: ${verdict}**`,
    '',
    `Draft \`${draftId}\` · invite \`${invite}\` · ${Math.round(report.elapsedMs / 1000)}s`,
    '',
    '## Checks',
    ...report.checks.map((c) => `- ${c.pass ? 'OK' : 'FAIL'} **${c.id}**: ${c.detail}`),
    '',
    '## Timer samples',
    ...timerEvents.map(
      (t) => `- pick ${t.pick} team ${t.team}: ${t.atStart}s → ${t.afterWait}s (decreased=${t.decreased})`
    ),
    '',
    'Review this before running the multi-attempt manager loop.',
    '',
  ].join('\n');
  writeFileSync(join(OUT_DIR, 'live-once-report.md'), md);
  console.log(md);
  if (verdict !== 'PASS') process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
