import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';
import { ListOrdered, ArrowRight, Table2, ClipboardList } from 'lucide-react';
import { SiteLogo } from '@/components/SiteLogo';
import { BrandedLoader } from '@/components/BrandedLoader';
import { PickSixMark } from '@/components/PickSixIcon';
import {
  SEASON,
  LEAGUE_FORMAT_COMBINATION_COUNT,
  PICK_SIX_TOTAL_PRIZE_POOL_USD,
  formatContestPrizeUsd,
} from '@/constants/contest';

const pickSixPrizePoolDisplay = formatContestPrizeUsd(PICK_SIX_TOTAL_PRIZE_POOL_USD);
const pickSixPrizePoolShort = `$${Math.round(PICK_SIX_TOTAL_PRIZE_POOL_USD / 1000)}K`;

/** Rough combined-pool size for marketing (adjust if your merged `players` count changes). */
const LANDING_PLAYERS_HEADLINE = '1100+';

const iconBoxBlue =
  'w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4 group-hover:shadow-glow transition-shadow';
/** Salmon / coral strand (closer to logo DNA accent than pure red). */
const iconBoxCoral =
  'w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(350_78%_72%)] to-[hsl(28_92%_58%)] flex items-center justify-center mb-4 text-primary-foreground group-hover:shadow-[0_0_26px_hsl(350_75%_58%/0.35)] transition-shadow';

/** Blue tile — matches landing stats strip rhythm (blue / coral / blue / …). */
const iconBoxPickSix = iconBoxBlue;

const statCellBlue =
  'rounded-xl border border-primary/35 bg-primary/[0.07] px-3 py-5 text-center shadow-sm';
const statCellCoral =
  'rounded-xl border border-[hsl(350_45%_45%/0.4)] bg-[hsl(350_32%_48%/0.12)] px-3 py-5 text-center shadow-sm';

const statNumberCoral =
  'font-display text-4xl bg-gradient-to-br from-[hsl(350_85%_78%)] to-[hsl(32_95%_62%)] bg-clip-text text-transparent';

function InfinityGlyph({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-10 min-w-[2.75rem] items-center justify-center text-[2.25rem] leading-none ${className ?? 'text-primary'}`}
      style={{ fontFamily: '"Cambria Math", "Apple Symbols", "Segoe UI Symbol", "Times New Roman", serif' }}
      aria-hidden
    >
      {'\u221E'}
    </span>
  );
}

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BrandedLoader />
      </div>
    );
  }

  // If logged in, go to dashboard; if not, still allow access to features
  const ctaPath = user ? '/dashboard' : '/rankings';
  const ctaText = user ? 'Go to Dashboard' : 'Start Ranking Players';

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <Navbar />

      {/* Hero Section */}
      <main className="relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(190_95%_50%/0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_hsl(45_100%_55%/0.1),transparent_50%)]" />

        <div className="max-w-6xl mx-auto px-4 pt-20 pb-12 relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6 animate-fade-in">
              <SiteLogo size={22} className="w-[22px] h-[22px]" />
              <span className="text-sm text-primary">Fantasy Football Draft Tool</span>
            </div>
            
            <h1 className="font-display text-6xl md:text-8xl tracking-wide mb-6 animate-slide-up">
              <span className="text-gradient">DOMINATE</span>
              <br />
              <span className="text-foreground">YOUR DRAFT</span>
            </h1>
            
            <div
              className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8 space-y-2 leading-relaxed animate-slide-up"
              style={{ animationDelay: '0.1s' }}
            >
              <p>
                Rank your board, run mock drafts, and dig into player stats. Draft DNA keeps your {SEASON} fantasy
                football prep all in one place.
              </p>
              <p>
                Enter the Pick Six Challenge and put your football knowledge to the test playing for up to{' '}
                {pickSixPrizePoolDisplay} in prizes.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <Link to={ctaPath}>
                <Button variant="hero" size="xl" className="gap-2">
                  {ctaText} <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <Link to="/rankings" className="block">
              <div className="glass-card p-6 group hover:border-primary/50 transition-all duration-300 cursor-pointer h-full">
                <div className={iconBoxBlue}>
                  <ListOrdered className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="font-display text-2xl mb-2">CUSTOM RANKINGS</h3>
                <p className="text-muted-foreground">
                  Drag-and-drop to build your personal big board. Override ADP with your own valuations.
                </p>
              </div>
            </Link>

            <Link to="/mock-draft" className="block">
              <div className="glass-card p-6 group hover:border-[hsl(350_50%_50%/0.45)] transition-all duration-300 cursor-pointer h-full">
                <div className={iconBoxCoral}>
                  <ClipboardList className="w-6 h-6" />
                </div>
                <h3 className="font-display text-2xl mb-2">MOCK DRAFTS</h3>
                <p className="text-muted-foreground">
                  Simulate real drafts with customizable settings. Snake or linear, 4–32 teams.
                </p>
              </div>
            </Link>

            <Link to="/prediction-challenge" className="block">
              <div className="glass-card p-6 group hover:border-primary/50 transition-all duration-300 cursor-pointer h-full">
                <PickSixMark frameClassName={iconBoxPickSix} />
                <h3 className="font-display text-xl sm:text-2xl mb-2 leading-tight">PICK SIX CHALLENGE</h3>
                <p className="text-muted-foreground">
                  Lock in your {SEASON} fantasy scoring predictions and follow along as the year plays out for a chance
                  at {pickSixPrizePoolDisplay}.
                </p>
              </div>
            </Link>

            <Link to="/players" className="block">
              <div className="glass-card p-6 group hover:border-[hsl(350_50%_50%/0.45)] transition-all duration-300 cursor-pointer h-full">
                <div className={iconBoxCoral}>
                  <Table2 className="w-6 h-6" />
                </div>
                <h3 className="font-display text-2xl mb-2">PLAYER STATS</h3>
                <p className="text-muted-foreground">
                  Spreadsheet-style view: sort, filter, and compare the full player pool with all fantasy-relevant
                  stats.
                </p>
              </div>
            </Link>
          </div>

          {/* Stats Section */}
          <div className="mt-14 glass-card p-6 sm:p-8 animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
              <div className={statCellBlue}>
                <div className="font-display text-4xl text-gradient">{LANDING_PLAYERS_HEADLINE}</div>
                <div className="text-sm text-muted-foreground mt-1 leading-snug">Players to mock</div>
              </div>
              <div className={statCellCoral}>
                <div className={statNumberCoral}>{LEAGUE_FORMAT_COMBINATION_COUNT}</div>
                <div className="text-sm text-muted-foreground mt-1 leading-snug">League Formats</div>
              </div>
              <div className={statCellBlue}>
                <div className="font-display text-4xl text-gradient-gold">
                  {pickSixPrizePoolShort}
                  <sup className="text-[0.45em] font-sans font-normal -top-[0.15em] relative">*</sup>
                </div>
                <div className="text-sm text-muted-foreground mt-1 leading-snug">In cash prizes</div>
              </div>
              <div className={statCellCoral}>
                <div className="flex justify-center">
                  <InfinityGlyph className="text-[hsl(350_78%_72%)]" />
                </div>
                <div className="text-sm text-muted-foreground mt-1 leading-snug">Mock drafts</div>
              </div>
              <div className={`${statCellBlue} col-span-2 md:col-span-1 lg:col-span-1`}>
                <div className="font-display text-4xl text-gradient">FREE</div>
                <div className="text-sm text-muted-foreground mt-1 leading-snug">To use</div>
              </div>
            </div>
            <p className="text-center text-[11px] sm:text-xs text-muted-foreground mt-5 max-w-2xl mx-auto leading-relaxed">
              *Pick Six is free to play. Create an account and accept the official contest rules to enter. Prizes are
              awarded as described in the Official Rules (including up to {pickSixPrizePoolDisplay} in total prize
              money); see rules for eligibility, tie-breakers, and how winners are determined.
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-border/50 py-5">
          <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
            <p>Built for fantasy football enthusiasts. Good luck in your drafts!</p>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Index;
