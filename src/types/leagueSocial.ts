export type LeagueMemberRole = 'owner' | 'member';

export type LeagueMember = {
  user_id: string;
  username: string;
  role: LeagueMemberRole;
  joined_at: string;
  team_number: number | null;
};

export type LeagueSeat = {
  team_number: number;
  team_name: string;
  user_id: string | null;
  username: string | null;
};

export type LeagueJoinResult = {
  league_id: string;
  name: string;
  already_member: boolean;
  team_number?: number | null;
};

export type LeagueInvitePreview = {
  league_id: string;
  name: string;
  already_member: boolean;
  num_teams?: number | null;
  scoring_format?: string | null;
  league_type?: string | null;
  is_superflex?: boolean | null;
  owner_username?: string | null;
  member_count?: number | null;
};

export type PickemMemberPick = {
  user_id: string;
  username: string;
  picked_abbr: string | null;
};

export type PickemGame = {
  id: string;
  espn_event_id: string;
  kickoff_at: string;
  status: 'scheduled' | 'in_progress' | 'final';
  home_abbr: string;
  away_abbr: string;
  home_name: string | null;
  away_name: string | null;
  home_score: number | null;
  away_score: number | null;
  winner_abbr: string | null;
  locked: boolean;
  my_pick: string | null;
  member_picks: PickemMemberPick[];
};

export type PickemStanding = {
  user_id: string;
  username: string;
  role: LeagueMemberRole;
  wins: number;
  losses: number;
  pushes: number;
  is_you: boolean;
};

export type PickemWeekBoard = {
  season: number;
  week: number;
  games: PickemGame[];
  standings: PickemStanding[];
};
