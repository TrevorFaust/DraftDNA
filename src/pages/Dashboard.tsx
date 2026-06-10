import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLeagues } from '@/hooks/useLeagues';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import {
  ListOrdered,
  Trophy,
  Plus,
  ArrowRight,
  Users,
  BarChart3,
  Table2,
} from 'lucide-react';
import { ClipboardList } from 'lucide-react';
import { PICK_SIX_TOTAL_PRIZE_POOL_USD } from '@/constants/contest';
import { BrandedLoader } from '@/components/BrandedLoader';
import { PickSixMark } from '@/components/PickSixIcon';
import { PickSixDashboardLeaderboard } from '@/components/PickSixDashboardLeaderboard';

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { leagues, loading: leaguesLoading, setSelectedLeague } = useLeagues();
  const navigate = useNavigate();
  const [teamNamesByLeagueId, setTeamNamesByLeagueId] = useState<Record<string, string>>({});
  const [draftCountByLeagueId, setDraftCountByLeagueId] = useState<Record<string, number>>({});

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

  if (authLoading || (user && leaguesLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BrandedLoader />
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
      title: 'Draft Stats',
      description: 'View draft faves and fades with in-depth player analysis',
      icon: BarChart3,
      path: '/statistics',
      gradient: 'bg-gradient-to-br from-violet-500 to-purple-600',
      hoverBorder: 'hover:border-violet-500/50',
      iconColor: 'text-white',
    },
    {
      title: 'Player Stats',
      description:
        'Spreadsheet-style view: sort, filter, and compare the full player pool with all fantasy-relevant stats',
      icon: Table2,
      path: '/players',
      gradient: 'bg-gradient-to-br from-[hsl(350_78%_72%)] to-[hsl(28_92%_58%)]',
      hoverBorder: 'hover:border-[hsl(350_50%_50%/0.45)]',
      iconColor: 'text-primary-foreground',
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

        {/* Pick Six Challenge + position leaderboard */}
        <div className="flex flex-col lg:flex-row gap-6 mb-12">
          <Link
            to="/prediction-challenge"
            className="lg:w-[38%] shrink-0 glass-card p-6 group hover:border-primary/50 transition-all duration-300 flex flex-col items-center text-center"
          >
            <PickSixMark frameClassName="h-16 w-16 rounded-xl bg-gradient-primary transition-transform group-hover:scale-105 mb-4" />
            <div className="flex items-center justify-center gap-2 mb-3">
              <h2 className="font-display text-2xl group-hover:text-primary transition-colors">
                Pick Six Challenge
              </h2>
              <ArrowRight className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {`Win up to $${PICK_SIX_TOTAL_PRIZE_POOL_USD / 1000}k by correctly guessing the top fantasy players at each position for this upcoming 2026 season.`}
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed mt-2">
              Lock in your top 6 per position before the deadline, then track how they stack up against live fantasy leaders as the season plays out.
            </p>
          </Link>
          <div className="flex-1 min-w-0 glass-card p-5">
            <PickSixDashboardLeaderboard />
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

      </main>
    </div>
  );
};

export default Dashboard;