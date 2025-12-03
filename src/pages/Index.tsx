import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';
import { Zap, ListOrdered, Trophy, History, ArrowRight, Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/rankings');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <Navbar />

      {/* Hero Section */}
      <main className="relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(190_95%_50%/0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_hsl(45_100%_55%/0.1),transparent_50%)]" />

        <div className="max-w-6xl mx-auto px-4 pt-20 pb-32 relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6 animate-fade-in">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary">Fantasy Football Draft Tool</span>
            </div>
            
            <h1 className="font-display text-6xl md:text-8xl tracking-wide mb-6 animate-slide-up">
              <span className="text-gradient">DOMINATE</span>
              <br />
              <span className="text-foreground">YOUR DRAFT</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              Create custom player rankings, run unlimited mock drafts, and prepare for 
              draft day like a pro. Your board, your way.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <Link to="/auth">
                <Button variant="hero" size="xl" className="gap-2">
                  Get Started <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <div className="glass-card p-6 group hover:border-primary/50 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4 group-hover:shadow-glow transition-shadow">
                <ListOrdered className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="font-display text-2xl mb-2">CUSTOM RANKINGS</h3>
              <p className="text-muted-foreground">
                Drag-and-drop to build your personal big board. Override ADP with your own valuations.
              </p>
            </div>

            <div className="glass-card p-6 group hover:border-accent/50 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-gradient-gold flex items-center justify-center mb-4 group-hover:shadow-[0_0_30px_hsl(45_100%_55%/0.3)] transition-shadow">
                <Zap className="w-6 h-6 text-accent-foreground" />
              </div>
              <h3 className="font-display text-2xl mb-2">MOCK DRAFTS</h3>
              <p className="text-muted-foreground">
                Simulate real drafts with customizable settings. Snake or linear, 8-16 teams.
              </p>
            </div>

            <div className="glass-card p-6 group hover:border-primary/50 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4 group-hover:bg-secondary/80 transition-colors">
                <History className="w-6 h-6 text-foreground" />
              </div>
              <h3 className="font-display text-2xl mb-2">DRAFT HISTORY</h3>
              <p className="text-muted-foreground">
                Review past mock drafts, analyze your picks, and refine your strategy.
              </p>
            </div>
          </div>

          {/* Stats Section */}
          <div className="mt-20 glass-card p-8 animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="font-display text-4xl text-gradient-gold">60+</div>
                <div className="text-sm text-muted-foreground mt-1">NFL Players</div>
              </div>
              <div className="text-center">
                <div className="font-display text-4xl text-gradient">6</div>
                <div className="text-sm text-muted-foreground mt-1">Positions</div>
              </div>
              <div className="text-center">
                <div className="font-display text-4xl text-gradient-gold">∞</div>
                <div className="text-sm text-muted-foreground mt-1">Mock Drafts</div>
              </div>
              <div className="text-center">
                <div className="font-display text-4xl text-gradient">FREE</div>
                <div className="text-sm text-muted-foreground mt-1">To Use</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-border/50 py-8">
          <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
            <p>Built for fantasy football enthusiasts. Good luck in your drafts!</p>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Index;
