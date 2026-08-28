import { supabase } from '@/integrations/supabase/client';
import type {
  LeagueInvitePreview,
  LeagueJoinResult,
  LeagueMember,
  LeagueMemberRole,
  LeagueSeat,
} from '@/types/leagueSocial';

function asJsonArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && ('user_id' in data || 'team_number' in data)) {
    return [data];
  }
  if (typeof data === 'string') {
    try {
      const parsed: unknown = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : asJsonArray(parsed);
    } catch {
      return [];
    }
  }
  return [];
}

function asUserId(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  return null;
}

function asTeamNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asSeats(data: unknown): LeagueSeat[] {
  return asJsonArray(data).map((row) => {
    const item = row as Record<string, unknown>;
    return {
      team_number: Number(item.team_number),
      team_name: String(item.team_name ?? `Team ${item.team_number}`),
      user_id: asUserId(item.user_id),
      username: typeof item.username === 'string' ? item.username : null,
    };
  });
}

function asMembers(data: unknown): LeagueMember[] {
  return asJsonArray(data).map((row) => {
    const item = row as Record<string, unknown>;
    return {
      user_id: asUserId(item.user_id) ?? '',
      username: String(item.username ?? 'Member'),
      role: item.role === 'owner' ? 'owner' : 'member',
      joined_at: String(item.joined_at ?? ''),
      team_number: asTeamNumber(item.team_number),
    };
  });
}

export async function leagueGetOrCreateInvite(leagueId: string): Promise<string> {
  const { data, error } = await supabase.rpc('league_get_or_create_invite' as never, {
    p_league_id: leagueId,
  });
  if (error) throw error;
  return String(data);
}

export async function leagueRotateInvite(leagueId: string): Promise<string> {
  const { data, error } = await supabase.rpc('league_rotate_invite' as never, {
    p_league_id: leagueId,
  });
  if (error) throw error;
  return String(data);
}

export async function leagueListMembers(leagueId: string): Promise<LeagueMember[]> {
  const { data, error } = await supabase.rpc('league_list_members' as never, {
    p_league_id: leagueId,
  });
  if (error) throw error;
  return asMembers(data);
}

export async function leagueMyMembership(
  leagueId: string,
  userId: string,
): Promise<{ team_number: number | null; role: LeagueMemberRole } | null> {
  try {
    const { data, error } = await supabase.rpc('league_my_seat' as never, {
      p_league_id: leagueId,
    });
    if (!error && data && typeof data === 'object') {
      const row = data as Record<string, unknown>;
      return {
        team_number: asTeamNumber(row.team_number),
        role: row.role === 'owner' ? 'owner' : 'member',
      };
    }
  } catch (err) {
    console.error(err);
  }

  try {
    const me = (await leagueListMembers(leagueId)).find((member) => member.user_id === userId);
    if (me) return { team_number: me.team_number, role: me.role };
  } catch (err) {
    console.error(err);
  }

  const { data, error } = await (supabase as any)
    .from('league_members')
    .select('team_number, role')
    .eq('league_id', leagueId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    team_number: asTeamNumber(data.team_number),
    role: data.role === 'owner' ? 'owner' : 'member',
  };
}

export async function leagueAddMemberByUsername(
  leagueId: string,
  username: string,
  teamNumber?: number | null,
): Promise<void> {
  const { error } = await supabase.rpc('league_add_member_by_username' as never, {
    p_league_id: leagueId,
    p_username: username,
    p_team_number: teamNumber ?? null,
  });
  if (error) throw error;
}

export async function leagueRemoveMember(leagueId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('league_remove_member' as never, {
    p_league_id: leagueId,
    p_user_id: userId,
  });
  if (error) throw error;
}

export async function leagueLeave(leagueId: string): Promise<void> {
  const { error } = await supabase.rpc('league_leave' as never, { p_league_id: leagueId });
  if (error) throw error;
}

export async function leagueJoin(code: string, teamNumber: number): Promise<LeagueJoinResult> {
  const { data, error } = await supabase.rpc('league_join' as never, {
    p_code: code,
    p_team_number: teamNumber,
  });
  if (error) throw error;
  return data as LeagueJoinResult;
}

export async function leagueClaimTeam(leagueId: string, teamNumber: number): Promise<void> {
  const { error } = await supabase.rpc('league_claim_team' as never, {
    p_league_id: leagueId,
    p_team_number: teamNumber,
  });
  if (error) throw error;
}

export async function leagueSetMemberTeam(
  leagueId: string,
  userId: string,
  teamNumber: number | null,
): Promise<void> {
  const { error } = await supabase.rpc('league_set_member_team' as never, {
    p_league_id: leagueId,
    p_user_id: userId,
    p_team_number: teamNumber,
  });
  if (error) throw error;
}

export async function leagueInviteSeats(code: string): Promise<LeagueSeat[]> {
  const { data, error } = await supabase.rpc('league_invite_seats' as never, {
    p_code: code,
  });
  if (error) throw error;
  return asSeats(data);
}

export async function leagueListSeats(leagueId: string): Promise<LeagueSeat[]> {
  const { data, error } = await supabase.rpc('league_list_seats' as never, {
    p_league_id: leagueId,
  });
  if (error) throw error;
  return asSeats(data);
}

export async function leagueSetTeamName(
  leagueId: string,
  teamNumber: number,
  teamName: string,
): Promise<void> {
  const { error } = await supabase.rpc('league_set_team_name' as never, {
    p_league_id: leagueId,
    p_team_number: teamNumber,
    p_team_name: teamName,
  });
  if (error) throw error;
}

export async function leaguePreviewInvite(code: string): Promise<LeagueInvitePreview> {
  const { data, error } = await supabase.rpc('league_preview_invite' as never, { p_code: code });
  if (error) throw error;
  return data as LeagueInvitePreview;
}

export function leagueInvitePath(code: string): string {
  return `/join/${code.toUpperCase()}`;
}

export function leagueInviteUrl(code: string): string {
  return `${window.location.origin}${leagueInvitePath(code)}`;
}
