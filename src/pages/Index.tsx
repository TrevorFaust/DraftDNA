import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';
import { MockDraftTicker } from '@/components/landing/MockDraftTicker';
import { RankingsShuffle } from '@/components/landing/RankingsShuffle';
import { PickSixSlip } from '@/components/landing/PickSixSlip';
import { ArrowRight } from 'lucide-react';
import {
  SEASON,
  LEAGUE_FORMAT_COMBINATION_COUNT,
  PICK_SIX_TOTAL_PRIZE_POOL_USD,
  formatContestPrizeUsd,
} from '@/constants/contest';
import { cn } from '@/lib/utils';

const pickSixPrizePoolDisplay = formatContestPrizeUsd(PICK_SIX_TOTAL_PRIZE_POOL_USD);
const pickSixPrizePoolShort = `$${Math.round(PICK_SIX_TOTAL_PRIZE_POOL_USD / 1000)}K`;

/** Rough combined-pool size for marketing (adjust if your merged `players` count changes). */
const LANDING_PLAYERS_HEADLINE = '1100+';

/** The prize row is the one highlight, so it sits last and carries the gold. */
const stats = [
  { value: LANDING_PLAYERS_HEADLINE, label: 'Players to mock' },
  { value: String(LEAGUE_FORMAT_COMBINATION_COUNT), label: 'League formats' },
  { value: '∞', label: 'Mock drafts' },
  { value: 'Free', label: 'To use' },
  { value: pickSixPrizePoolShort, label: 'In cash prizes', note: true, highlight: true },
];

const features = [
  {
    to: '/rankings',
    title: 'Custom rankings',
    body: 'Put the players where you think they belong, and watch how far you drift from the crowd.',
    shot: '/landing/rankings.png',
    shotSize: { w: 1024, h: 457 },
    shotClass: 'object-[12%_top]',
    overlay: <RankingsShuffle />,
  },
  {
    to: '/mock-draft',
    title: 'Mock drafts',
    body: 'Draft the room before it drafts you. Snake or linear, from a four-team league to a 32-team gauntlet.',
    shot: '/landing/mock-draft.png',
    shotSize: { w: 1024, h: 573 },
    shotClass: 'object-top',
    tall: true,
    overlay: <MockDraftTicker />,
  },
  {
    to: '/prediction-challenge',
    title: 'Pick Six',
    body: `Name the ${SEASON} scoring champs before the season does. Six picks per position, up to ${pickSixPrizePoolDisplay} on the line.`,
    shot: '/landing/pick-six.png',
    shotSize: { w: 1024, h: 403 },
    // Pins the right edge so narrow screens keep the leaderboard clear of the slip.
    shotClass: 'object-[100%_top]',
    overlay: <PickSixSlip />,
  },
];

const Index = () => {
  const { user } = useAuth();

  const ctaPath = user ? '/dashboard' : '/rankings';
  const ctaText = user ? 'Go to dashboard' : 'Start ranking players';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="position-rail" aria-hidden />

      <main className="relative">
        <div className="desk-grain pointer-events-none absolute inset-0" />

        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-8 sm:pt-12">
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)_minmax(15rem,18rem)] lg:items-stretch lg:gap-x-8">
            <div className="hero-rise lg:col-span-2">
              <h1 className="font-editorial text-[clamp(3.6rem,10.25vw,9.25rem)] font-medium leading-[0.88] tracking-[-0.03em] text-foreground">
                <span className="italic text-primary">Dominate</span>
                <span className="mt-1 block">your draft</span>
              </h1>
              <div className="hero-rule mt-5" />
            </div>

            <div className="hero-rise lg:col-span-2 lg:row-start-2">
              <p className="max-w-3xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">
                Build the board you actually believe in, then run the mocks until your picks feel obvious. When the
                season starts, put six players on the line in Pick Six for a share of {pickSixPrizePoolDisplay}.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
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

            <dl
              className="hero-rise divide-y divide-border border border-border bg-card/80 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:h-fit lg:self-center"
              style={{ animationDelay: '80ms' }}
            >
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className={cn(
                    'flex items-baseline justify-between gap-4 px-4 py-3.5',
                    'highlight' in stat && stat.highlight && 'bg-primary/[0.07]',
                  )}
                >
                  <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{stat.label}</dt>
                  <dd
                    className={cn(
                      'font-editorial text-3xl font-medium leading-none',
                      'highlight' in stat && stat.highlight ? 'text-primary' : 'text-foreground',
                    )}
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
                    {'note' in stat && stat.note ? (
                      <sup className="ml-0.5 font-sans text-[0.45em] font-normal text-muted-foreground">*</sup>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-14 flex flex-col gap-8 sm:mt-16 sm:gap-10">
            {features.map((feature, index) => {
              const textOnRight = index % 2 === 1;
              return (
                <Link
                  key={feature.to}
                  to={feature.to}
                  draggable={false}
                  className={cn(
                    'group grid overflow-hidden rounded-md border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    textOnRight
                      ? 'md:grid-cols-[1fr_17rem] lg:grid-cols-[1fr_19rem]'
                      : 'md:grid-cols-[17rem_1fr] lg:grid-cols-[19rem_1fr]',
                  )}
                >
                  <div
                    className={cn(
                      'flex flex-col justify-center bg-card/70 p-5 sm:p-7',
                      textOnRight && 'md:col-start-2 md:row-start-1',
                    )}
                  >
                    <h2 className="font-editorial text-3xl font-medium leading-none tracking-tight text-foreground sm:text-4xl">
                      {feature.title}
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-foreground/80 sm:text-[15px]">{feature.body}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                      Open
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </span>
                  </div>
                  <div
                    className={cn(
                      'relative min-h-[11rem] overflow-hidden md:min-h-[19rem]',
                      'tall' in feature && feature.tall && 'md:min-h-[26rem]',
                      textOnRight && 'md:col-start-1 md:row-start-1',
                    )}
                  >
                    <img
                      src={feature.shot}
                      alt=""
                      width={feature.shotSize.w}
                      height={feature.shotSize.h}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      className={cn(
                        'absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100',
                        'shotClass' in feature && feature.shotClass ? feature.shotClass : 'object-top',
                      )}
                    />
                    <div
                      aria-hidden
                      className={cn(
                        'absolute inset-y-0 w-16',
                        textOnRight
                          ? 'right-0 bg-gradient-to-l from-card/80 to-transparent'
                          : 'left-0 bg-gradient-to-r from-card/80 to-transparent',
                      )}
                    />
                    {'overlay' in feature && feature.overlay ? (
                      <div className="pointer-events-none absolute inset-0 hidden md:block">
                        {feature.overlay}
                      </div>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>

          <p className="mx-auto mt-6 max-w-3xl text-center text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
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
