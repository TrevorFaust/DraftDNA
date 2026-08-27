import { supabase } from '@/integrations/supabase/client';
import type { LeagueInvitePreview, LeagueJoinResult, LeagueMember, LeagueSeat } from '@/types/leagueSocial';

function asSeats(data: unknown): LeagueSeat[] {
  if (!Array.isArray(data)) return [];
  return data.map((row) => {
    const item = row as Record<string, unknown>;
    return {
      team_number: Number(item.team_number),
      team_name: String(item.team_name ?? `Team ${item.team_number}`),
      user_id: typeof item.user_id === 'string' ? item.user_id : null,
      username: typeof item.username === 'string' ? item.username : null,
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
  return (data ?? []) as LeagueMember[];
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
