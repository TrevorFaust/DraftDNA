import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';
import { ListOrdered, ArrowRight, Table2, ClipboardList, type LucideIcon } from 'lucide-react';
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

const stats = [
  { value: LANDING_PLAYERS_HEADLINE, label: 'Players to mock', tone: 'ivory' as const },
  { value: String(LEAGUE_FORMAT_COMBINATION_COUNT), label: 'League formats', tone: 'gold' as const },
  { value: pickSixPrizePoolShort, label: 'In cash prizes', tone: 'gold' as const, note: true },
  { value: '∞', label: 'Mock drafts', tone: 'ivory' as const },
  { value: 'Free', label: 'To use', tone: 'ivory' as const },
];

type Feature = {
  to: string;
  title: string;
  body: string;
  icon?: LucideIcon;
  pickSix?: boolean;
};

const features: Feature[] = [
  {
    to: '/rankings',
    title: 'Custom rankings',
    body: 'Drag the board into your order. ADP stays visible so you can see where you disagree.',
    icon: ListOrdered,
  },
  {
    to: '/mock-draft',
    title: 'Mock drafts',
    body: 'Snake or linear, 4 to 32 teams. Run the room before the real one starts.',
    icon: ClipboardList,
  },
  {
    to: '/prediction-challenge',
    title: 'Pick Six',
    body: `Lock ${SEASON} scoring picks and follow the season. Up to ${pickSixPrizePoolDisplay} in prizes.`,
    pickSix: true,
  },
  {
    to: '/players',
    title: 'Player stats',
    body: 'Sort and filter the full pool. Every fantasy-relevant number is in one sheet.',
    icon: Table2,
  },
];

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon;
  return (
    <Link
      to={feature.to}
      className="group relative block h-full rounded-md border border-border bg-card px-4 py-4 transition-colors duration-200 hover:border-primary/55 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-3 left-0 w-0.5 origin-center scale-y-0 bg-primary transition-transform duration-200 group-hover:scale-y-100 group-focus-visible:scale-y-100"
      />
      <div className="mb-3 flex items-center justify-between gap-3">
        {feature.pickSix ? (
          <PickSixMark frameClassName="h-12 w-12 rounded-md border border-border bg-secondary" />
        ) : (
          Icon && (
            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-secondary text-primary">
              <Icon className="h-4 w-4" />
            </span>
          )
        )}
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
      <h2 className="text-base font-semibold tracking-tight text-foreground">{feature.title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
    </Link>
  );
}

const Index = () => {
  const { user } = useAuth();

  const ctaPath = user ? '/dashboard' : '/rankings';
  const ctaText = user ? 'Go to dashboard' : 'Start ranking players';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="position-rail" aria-hidden />

      <main className="relative">
        <div className="desk-grid pointer-events-none absolute inset-0" />

        <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-6 sm:pt-8">
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,20rem)] lg:gap-10">
            <div className="hero-rise">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Fantasy draft tool · {SEASON}
              </p>
              <h1 className="mt-3 font-editorial text-[clamp(3.4rem,8vw,6.25rem)] font-medium leading-[0.88] tracking-[-0.03em] text-foreground">
                <span className="italic text-primary">Dominate</span>
                <span className="mt-1 block">your draft</span>
              </h1>
              <div className="hero-rule mt-4" />
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">
                Rank the board, run a mock, and open the stat sheet on every player. Pick Six is free to enter, with up
                to {pickSixPrizePoolDisplay} in prizes.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link to={ctaPath} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Button variant="hero" size="lg" className="w-full gap-2 sm:w-auto">
                    {ctaText}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link
                  to="/prediction-challenge"
                  className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    Pick Six
                  </Button>
                </Link>
              </div>
            </div>

            <dl className="hero-rise divide-y divide-border border border-border bg-card/80" style={{ animationDelay: '80ms' }}>
              {stats.map((stat) => (
                <div key={stat.label} className="flex items-baseline justify-between gap-4 px-4 py-3">
                  <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{stat.label}</dt>
                  <dd
                    className={
                      stat.tone === 'gold'
                        ? 'font-editorial text-3xl font-medium leading-none text-primary'
                        : 'font-editorial text-3xl font-medium leading-none text-foreground'
                    }
                  >
                    {stat.value === '∞' ? (
                      <span
                        className="inline-block text-[2rem] leading-none"
                        style={{ fontFamily: '"Cambria Math", "Segoe UI Symbol", "Times New Roman", serif' }}
                        aria-label="Unlimited"
                      >
                        {'\u221E'}
                      </span>
                    ) : (
                      stat.value
                    )}
                    {stat.note ? (
                      <sup className="ml-0.5 font-sans text-[0.45em] font-normal text-muted-foreground">*</sup>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {features.map((feature, index) => (
              <div key={feature.to} className="hero-rise h-full" style={{ animationDelay: `${140 + index * 40}ms` }}>
                <FeatureCard feature={feature} />
              </div>
            ))}
          </div>

          <p className="mt-4 max-w-3xl text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
            *Pick Six is free to play. Create an account and accept the official contest rules to enter. Prizes are
            awarded as described in the Official Rules (including up to {pickSixPrizePoolDisplay} in total prize
            money); see rules for eligibility, tie-breakers, and how winners are determined.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Index;
