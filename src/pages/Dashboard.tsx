import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLeagues } from '@/hooks/useLeagues';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { 
  ListOrdered, 
  Zap, 
  History, 
  Trophy, 
  Plus, 
  ArrowRight,
  Loader2,
  Users
} from 'lucide-react';

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { leagues, loading: leaguesLoading } = useLeagues();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || leaguesLoading) {
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
    },
    {
      title: 'Mock Draft',
      description: 'Start a new mock draft with customizable settings',
      icon: Zap,
      path: '/mock-draft',
      gradient: 'bg-gradient-gold',
      hoverBorder: 'hover:border-accent/50',
    },
    {
      title: 'Draft History',
      description: 'Review your past mock drafts and analyze performance',
      icon: History,
      path: '/history',
      gradient: 'bg-secondary',
      hoverBorder: 'hover:border-border',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-10">
          <h1 className="font-display text-4xl md:text-5xl tracking-wide mb-2">
            Welcome back
          </h1>
          <p className="text-muted-foreground text-lg">
            What would you like to do today?
          </p>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {quickActions.map((action) => (
            <Link 
              key={action.path} 
              to={action.path}
              className={`glass-card p-6 group ${action.hoverBorder} transition-all duration-300 block`}
            >
              <div className={`w-14 h-14 rounded-xl ${action.gradient} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
                <action.icon className="w-7 h-7 text-primary-foreground" />
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
                <div 
                  key={league.id}
                  className="p-4 rounded-lg bg-secondary/30 border border-border/50 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Trophy className="w-5 h-5 text-primary" />
                    <h3 className="font-medium truncate">{league.name}</h3>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {league.num_teams} teams • Pick #{league.user_pick_position}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tips Section */}
        <div className="mt-8 glass-card p-6">
          <h3 className="font-display text-xl mb-4">Quick Tips</h3>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Use the league selector in the navbar to filter your mock drafts by league</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Drag and drop players in Rankings to create your custom big board</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Your rankings will be used to sort available players during mock drafts</span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;