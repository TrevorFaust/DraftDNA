import { ClipboardList, ListChecks, ListOrdered, Medal, Table2, type LucideIcon } from 'lucide-react';

export type LeagueInviteActivity = {
  title: string;
  body: string;
  path: string;
  icon: LucideIcon;
};

export const LEAGUE_JOIN_ACTIVITIES: LeagueInviteActivity[] = [
  {
    title: 'Rankings',
    body: "Build your own player board with this league's scoring.",
    path: '/rankings',
    icon: ListOrdered,
  },
  {
    title: 'Mock Draft',
    body: "Run mocks with this league's roster settings.",
    path: '/mock-draft',
    icon: ClipboardList,
  },
  {
    title: 'Player Stats',
    body: 'Sort and compare the player pool.',
    path: '/players',
    icon: Table2,
  },
  {
    title: 'Team Rankings',
    body: "Rank every team's rooms, then set the lineup on the team you claimed.",
    path: '/league-ranker',
    icon: Medal,
  },
  {
    title: "Pick'em",
    body: 'Pick NFL winners each week and keep a record against the league.',
    path: '/pickem',
    icon: ListChecks,
  },
];

export function leagueInviteMessage(leagueName: string, url: string): string {
  const name = leagueName.trim() || 'my league';
  return [
    `You're invited to ${name} on Draft DNA.`,
    '',
    "If you don't have an account yet, this link will ask you to create one. You pick a team when you join. Then you get the full site with this league: rankings, mocks, team boards, and weekly pick'em. Only the commissioner can change league settings or move people between teams.",
    '',
    url,
  ].join('\n');
}

export function formatLeagueInviteMeta(preview: {
  num_teams?: number | null;
  scoring_format?: string | null;
  league_type?: string | null;
  is_superflex?: boolean | null;
  member_count?: number | null;
}): string | null {
  const parts: string[] = [];
  if (preview.num_teams) parts.push(`${preview.num_teams}-team`);
  if (preview.scoring_format === 'half_ppr') parts.push('Half PPR');
  else if (preview.scoring_format === 'standard') parts.push('Standard');
  else if (preview.scoring_format === 'ppr') parts.push('PPR');
  if (preview.league_type === 'dynasty') parts.push('Dynasty');
  else if (preview.league_type === 'season') parts.push('Redraft');
  if (preview.is_superflex) parts.push('Superflex');
  if (typeof preview.member_count === 'number' && preview.member_count > 0) {
    parts.push(`${preview.member_count} member${preview.member_count === 1 ? '' : 's'}`);
  }
  return parts.length ? parts.join(' · ') : null;
}
