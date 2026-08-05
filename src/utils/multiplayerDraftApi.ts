import { supabase } from '@/integrations/supabase/client';
import type {
  MpKeeperInput,
  MultiplayerDraft,
  MultiplayerKeeper,
  MultiplayerParticipant,
  MultiplayerPick,
  MultiplayerResult,
} from '@/types/multiplayerDraft';

function rpcError(error: { message?: string } | null): Error {
  return new Error(error?.message || 'Multiplayer draft request failed');
}

export async function mpCreateDraft(params: {
  name: string;
  numTeams: number;
  numRounds: number;
  hostTeamNumber: number;
  draftOrder?: string;
  pickTimer?: number;
  cpuSpeed?: string;
  scoringFormat?: string | null;
  leagueType?: string | null;
  isSuperflex?: boolean;
  positionLimits?: Record<string, number>;
  playerPool?: string;
  teamNames?: Record<string, string>;
  sourceLeagueId?: string | null;
  boardPlayerIds: string[];
  boardPlayerPositions: string[];
  keepers?: MpKeeperInput[];
  displayName?: string;
}): Promise<{ draft_id: string; invite_code: string; keeper_count?: number }> {
  const { data, error } = await supabase.rpc('mp_create_draft' as any, {
    p_name: params.name,
    p_num_teams: params.numTeams,
    p_num_rounds: params.numRounds,
    p_host_team_number: params.hostTeamNumber,
    p_draft_order: params.draftOrder ?? 'snake',
    p_pick_timer: params.pickTimer ?? 30,
    p_cpu_speed: params.cpuSpeed ?? 'normal',
    p_scoring_format: params.scoringFormat ?? null,
    p_league_type: params.leagueType ?? null,
    p_is_superflex: params.isSuperflex ?? false,
    p_position_limits: params.positionLimits ?? {},
    p_player_pool: params.playerPool ?? 'all',
    p_team_names: params.teamNames ?? {},
    p_source_league_id: params.sourceLeagueId ?? null,
    p_board_player_ids: params.boardPlayerIds,
    p_board_player_positions: params.boardPlayerPositions,
    p_keepers: params.keepers ?? [],
    p_display_name: params.displayName ?? 'Host',
  });
  if (error) throw rpcError(error);
  return data as { draft_id: string; invite_code: string; keeper_count?: number };
}

export async function mpJoinDraft(params: {
  inviteCode: string;
  guestSessionId?: string | null;
  displayName?: string;
}): Promise<{
  draft_id: string;
  invite_code: string;
  participant_id: string;
  team_number: number | null;
  status?: string;
  rejoined?: boolean;
}> {
  const { data, error } = await supabase.rpc('mp_join_draft' as any, {
    p_invite_code: params.inviteCode,
    p_guest_session_id: params.guestSessionId ?? null,
    p_display_name: params.displayName ?? 'Guest',
  });
  if (error) throw rpcError(error);
  return data as any;
}

export async function mpClaimSlot(
  draftId: string,
  teamNumber: number,
  guestSessionId?: string | null
) {
  const { data, error } = await supabase.rpc('mp_claim_slot' as any, {
    p_draft_id: draftId,
    p_team_number: teamNumber,
    p_guest_session_id: guestSessionId ?? null,
  });
  if (error) throw rpcError(error);
  return data as { participant_id: string; team_number: number };
}

export async function mpReleaseSlot(draftId: string, guestSessionId?: string | null) {
  const { data, error } = await supabase.rpc('mp_release_slot' as any, {
    p_draft_id: draftId,
    p_guest_session_id: guestSessionId ?? null,
  });
  if (error) throw rpcError(error);
  return data;
}

export async function mpHostMoveKick(params: {
  draftId: string;
  participantId: string;
  action: 'kick' | 'move' | 'remove_seat';
  newTeamNumber?: number | null;
}) {
  const { data, error } = await supabase.rpc('mp_host_move_kick' as any, {
    p_draft_id: params.draftId,
    p_participant_id: params.participantId,
    p_action: params.action,
    p_new_team_number: params.newTeamNumber ?? null,
  });
  if (error) throw rpcError(error);
  return data;
}

export async function mpSetReady(
  draftId: string,
  ready: boolean,
  guestSessionId?: string | null
) {
  const { data, error } = await supabase.rpc('mp_set_ready' as any, {
    p_draft_id: draftId,
    p_ready: ready,
    p_guest_session_id: guestSessionId ?? null,
  });
  if (error) throw rpcError(error);
  return data;
}

export async function mpSetTeamName(
  draftId: string,
  teamNumber: number,
  teamName: string,
  guestSessionId?: string | null
) {
  const { data, error } = await supabase.rpc('mp_set_team_name' as any, {
    p_draft_id: draftId,
    p_team_number: teamNumber,
    p_team_name: teamName,
    p_guest_session_id: guestSessionId ?? null,
  });
  if (error) throw rpcError(error);
  return data as {
    ok: boolean;
    team_number: number;
    team_name: string;
    team_names: Record<string, string>;
  };
}

export async function mpStartDraft(draftId: string) {
  const { data, error } = await supabase.rpc('mp_start_draft' as any, {
    p_draft_id: draftId,
  });
  if (error) throw rpcError(error);
  return data;
}

export async function mpMakePick(
  draftId: string,
  playerId: string,
  guestSessionId?: string | null
) {
  const { data, error } = await supabase.rpc('mp_make_pick' as any, {
    p_draft_id: draftId,
    p_player_id: playerId,
    p_guest_session_id: guestSessionId ?? null,
  });
  if (error) throw rpcError(error);
  return data;
}

export async function mpTickDraft(draftId: string, guestSessionId?: string | null) {
  const { data, error } = await supabase.rpc('mp_tick_draft' as any, {
    p_draft_id: draftId,
    p_guest_session_id: guestSessionId ?? null,
  });
  if (error) throw rpcError(error);
  return data as {
    status: string;
    current_pick_number?: number;
    pick_deadline_at?: string | null;
    server_now?: string;
    waiting_on_team?: number;
    actions: Array<Record<string, unknown>>;
  };
}

export async function mpSetAutodraft(
  draftId: string,
  enabled: boolean,
  guestSessionId?: string | null
) {
  const { data, error } = await supabase.rpc('mp_set_autodraft' as any, {
    p_draft_id: draftId,
    p_enabled: enabled,
    p_guest_session_id: guestSessionId ?? null,
  });
  if (error) throw rpcError(error);
  return data as { ok: boolean; is_autodraft: boolean };
}

export async function mpSetConnected(
  draftId: string,
  connected: boolean,
  guestSessionId?: string | null
) {
  const { data, error } = await supabase.rpc('mp_set_connected' as any, {
    p_draft_id: draftId,
    p_connected: connected,
    p_guest_session_id: guestSessionId ?? null,
  });
  if (error) throw rpcError(error);
  return data as { ok: boolean; is_connected: boolean };
}

export type ActiveMpDraftRow = {
  draft_id: string;
  invite_code: string;
  name: string;
  status: string;
  team_number: number | null;
};

function mapActiveMpRows(data: unknown): ActiveMpDraftRow[] {
  return ((data || []) as any[])
    .filter((row) => row.draft && ['lobby', 'drafting'].includes(row.draft.status))
    .map((row) => ({
      draft_id: row.draft.id,
      invite_code: row.draft.invite_code,
      name: row.draft.name,
      status: row.draft.status,
      team_number: row.team_number,
    }));
}

/** Active lobby/drafting multiplayer sessions for the signed-in user (rejoin). */
export async function fetchMyActiveMpDrafts(userId: string): Promise<ActiveMpDraftRow[]> {
  const { data, error } = await (supabase as any)
    .from('multiplayer_draft_participants')
    .select('team_number, draft:multiplayer_drafts!inner(id, invite_code, name, status)')
    .eq('user_id', userId);
  if (error) throw rpcError(error);
  return mapActiveMpRows(data);
}

/** Active drafts for a guest browser session (same localStorage guest id). */
export async function fetchGuestActiveMpDrafts(
  guestSessionId: string
): Promise<ActiveMpDraftRow[]> {
  const { data, error } = await (supabase as any)
    .from('multiplayer_draft_participants')
    .select('team_number, draft:multiplayer_drafts!inner(id, invite_code, name, status)')
    .eq('guest_session_id', guestSessionId);
  if (error) throw rpcError(error);
  return mapActiveMpRows(data);
}

export async function mpSaveResults(draftId: string, results: Array<Record<string, unknown>>) {
  const { data, error } = await supabase.rpc('mp_save_results' as any, {
    p_draft_id: draftId,
    p_results: results,
  });
  if (error) throw rpcError(error);
  return data;
}

export async function mpReplaceKeepers(draftId: string, keepers: MpKeeperInput[]) {
  const { data, error } = await supabase.rpc('mp_replace_keepers' as any, {
    p_draft_id: draftId,
    p_keepers: keepers,
  });
  if (error) throw rpcError(error);
  return data;
}

export async function fetchMpDraftByInvite(inviteCode: string): Promise<MultiplayerDraft | null> {
  const { data, error } = await (supabase as any)
    .from('multiplayer_drafts')
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase().trim())
    .maybeSingle();
  if (error) throw rpcError(error);
  return (data as MultiplayerDraft | null) ?? null;
}

export async function fetchMpDraft(draftId: string): Promise<MultiplayerDraft | null> {
  const { data, error } = await (supabase as any)
    .from('multiplayer_drafts')
    .select('*')
    .eq('id', draftId)
    .maybeSingle();
  if (error) throw rpcError(error);
  return (data as MultiplayerDraft | null) ?? null;
}

export async function fetchMpParticipants(draftId: string): Promise<MultiplayerParticipant[]> {
  const { data, error } = await (supabase as any)
    .from('multiplayer_draft_participants')
    .select('*')
    .eq('draft_id', draftId)
    .order('joined_at', { ascending: true });
  if (error) throw rpcError(error);
  return (data || []) as MultiplayerParticipant[];
}

export async function fetchMpKeepers(draftId: string): Promise<MultiplayerKeeper[]> {
  const { data, error } = await (supabase as any)
    .from('multiplayer_draft_keepers')
    .select('*')
    .eq('draft_id', draftId);
  if (error) throw rpcError(error);
  return (data || []) as MultiplayerKeeper[];
}

export async function fetchMpPicks(draftId: string): Promise<MultiplayerPick[]> {
  const { data, error } = await (supabase as any)
    .from('multiplayer_draft_picks')
    .select('*')
    .eq('draft_id', draftId)
    .order('pick_number', { ascending: true });
  if (error) throw rpcError(error);
  return (data || []) as MultiplayerPick[];
}

export async function fetchMpResults(draftId: string): Promise<MultiplayerResult[]> {
  const { data, error } = await (supabase as any)
    .from('multiplayer_draft_results')
    .select('*')
    .eq('draft_id', draftId);
  if (error) throw rpcError(error);
  return (data || []) as MultiplayerResult[];
}

export type MpHistoryDraftRow = {
  draft: MultiplayerDraft;
  team_number: number;
  result: MultiplayerResult | null;
  picks: MultiplayerPick[];
};

/** Completed multiplayer mocks the signed-in user played (for History). */
export async function fetchMyCompletedMpHistory(userId: string): Promise<MpHistoryDraftRow[]> {
  const { data: partRows, error: partError } = await (supabase as any)
    .from('multiplayer_draft_participants')
    .select('team_number, draft:multiplayer_drafts!inner(*)')
    .eq('user_id', userId);
  if (partError) throw rpcError(partError);

  const completed = (partRows || [])
    .map((row: { team_number: number | null; draft: MultiplayerDraft }) => ({
      team_number: row.team_number,
      draft: row.draft,
    }))
    .filter(
      (row: { team_number: number | null; draft: MultiplayerDraft }) =>
        row.draft?.status === 'completed' && typeof row.team_number === 'number'
    ) as Array<{ team_number: number; draft: MultiplayerDraft }>;

  if (completed.length === 0) return [];

  const draftIds = completed.map((r) => r.draft.id);
  const picksByDraft = new Map<string, MultiplayerPick[]>();
  const resultByDraftTeam = new Map<string, MultiplayerResult>();

  const DRAFT_BATCH = 40;
  for (let i = 0; i < draftIds.length; i += DRAFT_BATCH) {
    const batch = draftIds.slice(i, i + DRAFT_BATCH);
    const [{ data: picks }, { data: results }] = await Promise.all([
      (supabase as any)
        .from('multiplayer_draft_picks')
        .select('*')
        .in('draft_id', batch)
        .order('pick_number', { ascending: true }),
      (supabase as any)
        .from('multiplayer_draft_results')
        .select('*')
        .in('draft_id', batch)
        .eq('user_id', userId),
    ]);

    for (const pick of (picks || []) as MultiplayerPick[]) {
      const list = picksByDraft.get(pick.draft_id) || [];
      list.push(pick);
      picksByDraft.set(pick.draft_id, list);
    }
    for (const result of (results || []) as MultiplayerResult[]) {
      resultByDraftTeam.set(`${result.draft_id}:${result.team_number}`, result);
    }
  }

  return completed
    .map((row) => ({
      draft: row.draft,
      team_number: row.team_number,
      result: resultByDraftTeam.get(`${row.draft.id}:${row.team_number}`) ?? null,
      picks: picksByDraft.get(row.draft.id) || [],
    }))
    .sort(
      (a, b) =>
        new Date(b.draft.completed_at || b.draft.created_at).getTime() -
        new Date(a.draft.completed_at || a.draft.created_at).getTime()
    );
}
