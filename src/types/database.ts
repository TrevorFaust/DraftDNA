export interface Player {
  id: string;
  name: string;
  position: string;
  team: string | null;
  adp: number;
  bye_week: number | null;
  created_at: string;
}

export interface UserRanking {
  id: string;
  user_id: string;
  player_id: string;
  rank: number;
  created_at: string;
  updated_at: string;
}

export interface MockDraft {
  id: string;
  user_id: string;
  name: string;
  num_teams: number;
  num_rounds: number;
  user_pick_position: number;
  draft_order: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

export interface DraftPick {
  id: string;
  mock_draft_id: string;
  player_id: string;
  team_number: number;
  round_number: number;
  pick_number: number;
  created_at: string;
}

export interface RankedPlayer extends Player {
  rank: number;
}
