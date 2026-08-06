export type MultiplayerDraftStatus = 'lobby' | 'drafting' | 'completed' | 'cancelled';

export interface MultiplayerDraft {
  id: string;
  host_user_id: string;
  invite_code: string;
  name: string;
  status: MultiplayerDraftStatus;
  num_teams: number;
  num_rounds: number;
  draft_order: string;
  pick_timer: number;
  cpu_speed: string;
  scoring_format: string | null;
  league_type: string | null;
  is_superflex: boolean;
  position_limits: Record<string, number>;
  player_pool: string | null;
  team_names: Record<string, string>;
  source_league_id: string | null;
  board_player_ids: string[];
  board_player_positions: string[];
  current_pick_number: number;
  pick_deadline_at: string | null;
  cpu_archetypes: Record<string, unknown> | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface MultiplayerParticipant {
  id: string;
  draft_id: string;
  team_number: number | null;
  user_id: string | null;
  guest_session_id: string | null;
  display_name: string;
  is_host: boolean;
  is_ready: boolean;
  is_connected: boolean;
  is_autodraft: boolean;
  missed_turns_streak: number;
  joined_at: string;
}

export interface MultiplayerKeeper {
  id: string;
  draft_id: string;
  team_number: number;
  player_id: string;
  round_number: number;
  created_at: string;
}

export interface MultiplayerPick {
  id: string;
  draft_id: string;
  player_id: string;
  team_number: number;
  round_number: number;
  pick_number: number;
  is_autodraft: boolean;
  is_keeper: boolean;
  created_at: string;
}

export interface MultiplayerResult {
  id: string;
  draft_id: string;
  team_number: number;
  user_id: string | null;
  guest_session_id: string | null;
  grade_letter: string | null;
  grade_score: number | null;
  grade_payload: Record<string, unknown> | null;
  detected_archetype: string | null;
  detected_archetype_index: number | null;
  detected_chaos_archetype: string | null;
  badge_awarded: boolean;
  created_at: string;
}

export interface MpKeeperInput {
  team_number: number;
  player_id: string;
  round_number: number;
}

export interface MultiplayerDraftMessage {
  id: string;
  draft_id: string;
  participant_id: string | null;
  user_id: string | null;
  guest_session_id: string | null;
  display_name: string;
  body: string;
  created_at: string;
}
