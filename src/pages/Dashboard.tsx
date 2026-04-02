import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLeagues } from '@/hooks/useLeagues';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { 
  ListOrdered, 
  History, 
  Trophy, 
  Plus, 
  ArrowRight,
  Loader2,
  Users,
  BarChart3,
  Target,
  Medal,
  ChevronRight,
} from 'lucide-react';
import { ClipboardList } from 'lucide-react';
import { SEASON, PICK_SIX_VIEW_OTHERS_PICKS } from '@/constants/contest';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PositionBadge } from '@/components/PositionBadge';

type LeaderboardRow = {
  rank: number;
  user_id: string;
  positions_submitted: number;
  username: string | null;
};

type UserPickRow = {
  position: string;
  rank: number;
  player_id: string;
  player_name: string | null;
  player_team: string | null;
  tiebreaker_value: number | null;
};

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { leagues, loading: leaguesLoading, setSelectedLeague } = useLeagues();
  const navigate = useNavigate();
  const [teamNamesByLeagueId, setTeamNamesByLeagueId] = useState<Record<string, string>>({});
  const [draftCountByLeagueId, setDraftCountByLeagueId] = useState<Record<string, number>>({});
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [picksDialogOpen, setPicksDialogOpen] = useState(false);
  const [picksDialogUser, setPicksDialogUser] = useState<LeaderboardRow | null>(null);
  const [userPicks, setUserPicks] = useState<UserPickRow[]>([]);
  const [userPicksLoading, setUserPicksLoading] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)('get_pick_six_leaderboard', { p_season: SEASON });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      setLeaderboard(
        rows.map((r: { rank?: number | string; user_id: string; positions_submitted?: number | string; username?: string | null }) => ({
          rank: Number(r.rank ?? 0),
          user_id: r.user_id,
          positions_submitted: Number(r.positions_submitted ?? 0),
          username: r.username ?? null,
        }))
      );
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
      setLeaderboard([]);
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  const openUserPicks = useCallback(async (row: LeaderboardRow) => {
    if (!PICK_SIX_VIEW_OTHERS_PICKS && user && row.user_id !== user.id) return;
    setPicksDialogUser(row);
    setPicksDialogOpen(true);
    setUserPicks([]);
    setUserPicksLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)('get_pick_six_user_picks', {
        p_season: SEASON,
        p_user_id: row.user_id,
      });
      if (error) throw error;
      setUserPicks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch user picks:', err);
      setUserPicks([]);
    } finally {
      setUserPicksLoading(false);
    }
  }, [user]);

  const closePicksDialog = useCallback(() => {
    setPicksDialogOpen(false);
    setPicksDialogUser(null);
    setUserPicks([]);
  }, []);

  const fetchLeagueDetails = useCallback(async () => {
    if (!user || leagues.length === 0) {
      setTeamNamesByLeagueId({});
      setDraftCountByLeagueId({});
      return;
    }
    try {
      // Fetch team names from league_teams (user's team = team_number matching user_pick_position)
      const leagueIds = leagues.map((l) => l.id);
      const { data: teamData } = await supabase
        .from('league_teams')
        .select('league_id, team_number, team_name')
        .in('league_id', leagueIds);

      const namesByLeague: Record<string, string> = {};
      leagues.forEach((league) => {
        const userTeam = teamData?.find(
          (t) => t.league_id === league.id && t.team_number === league.user_pick_position
        );
        namesByLeague[league.id] =
          userTeam?.team_name?.trim() || `Team #${league.user_pick_position}`;
      });
      setTeamNamesByLeagueId(namesByLeague);

      // Fetch completed mock drafts and count per league
      const { data: draftsData } = await supabase
        .from('mock_drafts')
        .select('league_id')
        .eq('user_id', user.id)
        .eq('status', 'completed');

      const countByLeague: Record<string, number> = {};
      leagues.forEach((l) => {
        countByLeague[l.id] = 0;
      });
      draftsData?.forEach((d) => {
        if (d.league_id) {
          countByLeague[d.league_id] = (countByLeague[d.league_id] ?? 0) + 1;
        }
      });
      setDraftCountByLeagueId(countByLeague);
    } catch (err) {
      console.error('Failed to fetch league details:', err);
    }
  }, [user, leagues]);

  useEffect(() => {
    fetchLeagueDetails();
  }, [fetchLeagueDetails]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  if (authLoading || (user && leaguesLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const quickActions = [
    {
      title: 'Rankings',
      description: 'Build your custom player rankings with drag-and-drop reordering',
      icon: ListOrdered,
      path: '/rankings',
      gradient: 'bg-gradient-primary',
      hoverBorder: 'hover:border-primary/50',
      iconColor: 'text-primary-foreground',
    },
    {
      title: 'Mock Draft',
      description: 'Start a new mock draft with customizable settings',
      icon: ClipboardList,
      path: '/mock-draft',
      gradient: 'bg-gradient-gold',
      hoverBorder: 'hover:border-accent/50',
      iconColor: 'text-primary-foreground',
    },
    {
      title: 'Statistics',
      description: 'View draft faves and fades with in-depth player analysis',
      icon: BarChart3,
      path: '/statistics',
      gradient: 'bg-gradient-to-br from-violet-500 to-purple-600',
      hoverBorder: 'hover:border-violet-500/50',
      iconColor: 'text-white',
    },
    {
      title: 'Draft History',
      description: 'Review your past mock drafts and analyze performance',
      icon: History,
      path: '/history',
      gradient: 'bg-gradient-to-br from-emerald-500 to-teal-600',
      hoverBorder: 'hover:border-emerald-500/50',
      iconColor: 'text-white',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-10">
          <h1 className="font-display text-4xl md:text-5xl tracking-wide mb-2">
            {user ? 'Welcome back' : 'Welcome'}
          </h1>
          <p className="text-muted-foreground text-lg">
            What would you like to do today?
          </p>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {quickActions.map((action) => (
            <Link 
              key={action.path} 
              to={action.path}
              className={`glass-card p-6 group ${action.hoverBorder} transition-all duration-300 block`}
            >
              <div className={`w-14 h-14 rounded-xl ${action.gradient} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform overflow-hidden`}>
                <action.icon className={`w-7 h-7 ${action.iconColor}`} />
              </div>
              <h3 className="font-display text-2xl mb-2 group-hover:text-primary transition-colors">
                {action.title}
              </h3>
              <p className="text-muted-foreground text-sm">
                {action.description}
              </p>
              <div className="mt-4 flex items-center text-primary text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Go to {action.title} <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </Link>
          ))}
        </div>

        {/* Pick Six Challenge - half size card + half description */}
        <div className="flex flex-col md:flex-row gap-6 mb-12">
          <Link
            to="/prediction-challenge"
            className="flex-1 md:max-w-[50%] glass-card p-6 group hover:border-amber-500/50 transition-all duration-300 flex items-center justify-center min-h-[140px]"
          >
            <div className="flex items-center gap-4 w-full justify-center">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-lg shrink-0">
                <Target className="w-7 h-7 text-white" />
              </div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  Pick Six Challenge
                </h2>
                <ArrowRight className="w-5 h-5 text-amber-600 dark:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </Link>
          <div className="flex-1 md:max-w-[50%] flex flex-col justify-center">
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">
              Win up to $30k by correctly guessing the top fantasy players at each position.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              Track your progress on the leaderboard — see how you rank with 1 correct, 2 correct, all 6, and more.
            </p>
            <div>
              <h3 className="font-display text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Medal className="w-4 h-4 text-amber-500" />
                Leaderboard
              </h3>
              {leaderboardLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading…
                </div>
              ) : leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">No entries yet. Make your predictions to get on the board!</p>
              ) : (
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin">
                  {leaderboard.slice(0, 10).map((row) => {
                    const displayName = user && row.user_id === user.id
                      ? 'You'
                      : (row.username?.trim() || `User #${row.rank}`);
                    const isClickable = PICK_SIX_VIEW_OTHERS_PICKS || (user && row.user_id === user.id);
                    return (
                      <button
                        key={row.user_id}
                        type="button"
                        onClick={() => isClickable && openUserPicks(row)}
                        disabled={!isClickable}
                        className={`w-full flex items-center justify-between text-sm py-1 rounded px-1 -mx-1 text-left transition-colors ${
                          user && row.user_id === user.id ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground'
                        } ${isClickable ? 'hover:bg-muted/60 cursor-pointer' : 'cursor-default'}`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="text-muted-foreground w-5 shrink-0">#{row.rank}</span>
                          <span className="truncate">{displayName}</span>
                          {isClickable && <ChevronRight className="w-4 h-4 shrink-0 opacity-50" />}
                        </span>
                        <span className="shrink-0 ml-2">
                          {row.positions_submitted}/6 positions
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Leagues Section */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Trophy className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-display text-2xl">Your Leagues</h2>
                <p className="text-sm text-muted-foreground">Manage your fantasy leagues</p>
              </div>
            </div>
            <Link to="/settings">
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="w-4 h-4" /> Create League
              </Button>
            </Link>
          </div>

          {leagues.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-border rounded-lg">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">No leagues yet</p>
              <Link to="/settings">
                <Button variant="default" size="sm">
                  Create Your First League
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {leagues.map((league) => (
                <button
                  key={league.id}
                  type="button"
                  onClick={() => {
                    setSelectedLeague(league);
                    navigate('/rankings');
                  }}
                  className="w-full text-left p-4 rounded-lg bg-secondary/30 border border-border/50 hover:border-primary/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Trophy className="w-5 h-5 text-primary flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium truncate">{league.name}</h3>
                        <p className="text-sm text-primary truncate">
                          {teamNamesByLeagueId[league.id] ?? `Team #${league.user_pick_position}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground text-right flex-shrink-0">
                      {league.num_teams} teams • Pick #{league.user_pick_position}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {draftCountByLeagueId[league.id] ?? 0} mock draft{(draftCountByLeagueId[league.id] ?? 0) !== 1 ? 's' : ''} completed
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pick Six: view a user's picks (after deadline, or own picks anytime) */}
        <Dialog open={picksDialogOpen} onOpenChange={(open) => !open && closePicksDialog()}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-500" />
                {picksDialogUser && (user && picksDialogUser.user_id === user.id ? "Your Pick Six" : `${picksDialogUser.username?.trim() || "User"}'s Pick Six`)}
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto overflow-x-hidden flex-1 pr-2 -mr-2 scrollbar-thin">
              {userPicksLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading picks…
                </div>
              ) : userPicks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No picks to display.</p>
              ) : (
                <div className="space-y-6">
                  {(['QB', 'RB', 'WR', 'TE', 'K', 'D/ST'] as const).map((pos) => {
                    const rows = userPicks.filter((p) => p.position === pos).sort((a, b) => a.rank - b.rank);
                    if (rows.length === 0) return null;
                    const tiebreaker = rows[0]?.tiebreaker_value ?? null;
                    return (
                      <div key={pos}>
                        <div className="flex items-center justify-between mb-2">
                          <PositionBadge position={pos} />
                          {tiebreaker != null && (
                            <span className="text-xs text-muted-foreground">Tiebreaker: {Number(tiebreaker).toLocaleString()}</span>
                          )}
                        </div>
                        <ol className="list-decimal list-inside space-y-1 text-sm">
                          {rows.map((r) => (
                            <li key={`${pos}-${r.rank}`} className="flex items-center gap-2">
                              <span className="text-muted-foreground w-5 shrink-0">{r.rank}.</span>
                              <span className="font-medium truncate">{r.player_name ?? '—'}</span>
                              {r.player_team && (
                                <span className="text-muted-foreground shrink-0">({r.player_team})</span>
                              )}
                            </li>
                          ))}
                        </ol>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Dashboard;