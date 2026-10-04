import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLeagues } from '@/hooks/useLeagues';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Plus, Users } from 'lucide-react';
import { LeagueCabinet } from '@/components/LeagueCabinet';
import { PICK_SIX_CATEGORY_PRIZE_USD, PICK_SIX_TOTAL_PRIZE_POOL_USD, SEASON } from '@/constants/contest';
import { BrandedLoader } from '@/components/BrandedLoader';
import { PickSixMark } from '@/components/PickSixIcon';
import { PickSixDashboardLeaderboard } from '@/components/PickSixDashboardLeaderboard';
import { ClaimTeamPanel } from '@/components/league/ClaimTeamPanel';
import { Playbook, type PlaybookPage } from '@/components/Playbook';
import { RankingsStage } from '@/components/playbook/RankingsStage';
import { MockDraftStage } from '@/components/playbook/MockDraftStage';
import { DraftStatsStage } from '@/components/playbook/DraftStatsStage';
import { PlayerStatsStage } from '@/components/playbook/PlayerStatsStage';
import { SeasonStage } from '@/components/playbook/SeasonStage';
import { BadgesStage } from '@/components/playbook/BadgesStage';
import { usePendingTeamClaim } from '@/hooks/usePendingTeamClaim';

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { leagues, selectedLeague, loading: leaguesLoading, setSelectedLeague } = useLeagues();
  const { claim, loading: claimLoading, saving, error, pickedTeam, setPickedTeam, submit } =
    usePendingTeamClaim();
  const navigate = useNavigate();

  if (authLoading || (user && (leaguesLoading || claimLoading))) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="flex min-h-[70vh] items-center justify-center px-4">
          <BrandedLoader />
        </main>
      </div>
    );
  }

  if (claim) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 py-8">
          <ClaimTeamPanel
            leagueName={claim.leagueName}
            seats={claim.seats}
            pickedTeam={pickedTeam}
            saving={saving}
            error={error}
            onPick={setPickedTeam}
            onClaim={() => void submit()}
          />
        </main>
      </div>
    );
  }

  const plays: PlaybookPage[] = [
    {
      id: 'rankings',
      title: 'Rankings',
      body: "Line your board up against consensus and find the players you're willing to reach for.",
      href: '/rankings',
      actionLabel: 'Open rankings',
      preview: <RankingsStage />,
    },
    {
      id: 'mock',
      title: 'Mock draft',
      body: 'Run mocks until you are confident in your draft strategy.',
      href: '/mock-draft',
      actionLabel: 'Start a mock',
      preview: <MockDraftStage />,
    },
    {
      id: 'draft-stats',
      title: 'Draft stats',
      body: 'See who you draft, who you are high on, and who you avoid.',
      href: '/statistics',
      actionLabel: 'Open draft stats',
      preview: <DraftStatsStage />,
    },
    {
      id: 'players',
      title: 'Player stats',
      body: 'Look through the stats and find the gems hiding behind the numbers.',
      href: '/players',
      actionLabel: 'Open stat sheet',
      preview: <PlayerStatsStage />,
    },
    {
      id: 'season',
      title: 'Season predictions',
      body: 'Pick how you think the season plays out, then follow along and see how close you were.',
      href: '/season-predictions',
      actionLabel: 'Open predictions',
      preview: <SeasonStage />,
    },
    {
      id: 'badges',
      title: 'Badges',
      body: 'Figure out your draft strategies and which badges fit your scheme.',
      href: '/badges',
      actionLabel: 'Open badges',
      preview: <BadgesStage />,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="font-display text-4xl tracking-wide md:text-5xl">
            {user ? 'Welcome back' : 'Welcome'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Browse the features and get a read on the draft before it's game time.
          </p>
        </div>

        <Playbook
          label="Play"
          spineTitle="Features"
          numbered={false}
          showIndex={false}
          pages={plays}
          emptyTitle="No pages"
          emptyBody="Nothing to open yet."
          autoAdvanceMs={10_000}
        />

        <section className="mt-8 space-y-4">
          <Link
            to="/prediction-challenge"
            className="glass-card group flex items-center gap-4 p-4 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-5"
          >
            <PickSixMark
              fit="contain"
              tone="gold"
              hug
              frameClassName="h-[5.5rem] w-[5.34rem] shrink-0 rounded-md border border-border bg-background sm:h-[6.29rem] sm:w-[6.1rem]"
            />
            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <h2 className="font-display text-2xl group-hover:text-primary sm:text-3xl">Pick Six</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {`Predict the top 6 players for the ${SEASON} season at QB, RB, WR, TE, K, and D/ST in the order you think they finish. A perfect board at any one position pays out $${PICK_SIX_CATEGORY_PRIZE_USD / 1000}k, pull out a miracle and hit all six boards for the full pool of $${PICK_SIX_TOTAL_PRIZE_POOL_USD / 1000}k.`}
              </p>
            </div>
          </Link>
          <div className="glass-card min-w-0 p-4">
            <PickSixDashboardLeaderboard />
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl">Your leagues</h2>
            <Link to="/settings">
              <Button variant="outline" size="sm" className="h-11 gap-2">
                <Plus className="h-4 w-4" /> Create league
              </Button>
            </Link>
          </div>
          {leagues.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-4 py-8 text-center">
              <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="mb-4 text-muted-foreground">No leagues yet.</p>
              <Link to="/settings">
                <Button size="sm" className="h-11">
                  Create your first league
                </Button>
              </Link>
            </div>
          ) : (
            <LeagueCabinet
              leagues={leagues}
              userId={user?.id}
              initialLeagueId={selectedLeague?.id}
              onOpen={(league) => {
                const match = leagues.find((item) => item.id === league.id);
                if (!match) return;
                setSelectedLeague(match);
                navigate('/rankings');
              }}
              onInvite={(league) => {
                const match = leagues.find((item) => item.id === league.id);
                if (!match) return;
                setSelectedLeague(match);
                navigate('/league-settings?tab=members');
              }}
            />
          )}
        </section>
      </main>
    </div>
  );
};

export default Dashboard;