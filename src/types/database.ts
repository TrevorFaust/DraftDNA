export interface Player {
  id: string;
  name: string;
  position: string;
  team: string | null;
  adp: number;
  bye_week: number | null;
  jersey_number: number | null;
  season: number | null;
  years_exp?: number | null;
  created_at: string;
  espn_id?: string | null;
  sleeper_id?: string | null;
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
  league_id: string | null;
  passed_players?: Array<{ pick_number: number; passed_players: string[] }>;
  is_favorite?: boolean;
  cpu_speed?: 'slow' | 'normal' | 'fast' | 'rapid' | 'instant'; // 'instant' kept for backward compatibility
  pick_timer?: number;
  /** Optional: archetype id(s) per CPU team. 2–3 ids per team (e.g. hero_rb + mid_qb + late_te). Legacy: single string still supported. */
  cpu_archetypes?: Record<number, string | string[]>;
  /** Archetype name (e.g. The Captain) detected for the user when draft was completed. Used for Badges. */
  user_detected_archetype?: string | null;
  /** Index into full archetype list (0-based) for correct badge slot when names duplicate. */
  user_detected_archetype_index?: number | null;
  /** Chaos archetype name when a chaos trigger fired; replace-type replaces main for display. */
  user_detected_chaos_archetype?: string | null;
}

export interface DraftPick {
  id: string;
  mock_draft_id: string;
  player_id: string;
  team_number: number;
  round_number: number;
  pick_number: number;
  created_at: string;
  /** True when the pick was made by auto-draft (timer expiry), not explicit user selection */
  is_autodraft?: boolean;
}

export interface League {
  id: string;
  user_id: string;
  name: string;
  num_teams: number;
  user_pick_position: number;
  created_at: string;
}

export interface LeagueKeeper {
  id: string;
  league_id: string;
  team_number: number;
  player_id: string;
  round_number: number;
  created_at: string;
}

export interface RankedPlayer extends Player {
  rank: number;
}

export interface PlayerGameStats {
  id: string;
  player_id: string;
  season: number;
  week: number;
  opponent: string;
  fantasy_points: number;
  passing_yards: number;
  passing_tds: number;
  interceptions: number;
  rushing_yards: number;
  rushing_tds: number;
  rushing_attempts: number;
  receptions: number;
  receiving_yards: number;
  receiving_tds: number;
  targets: number;
  fumbles: number;
  created_at: string;
}

export interface NFLSchedule {
  id: string;
  season: number;
  week: number;
  home_team: string;
  away_team: string;
  game_date: string | null;
  created_at: string;
}