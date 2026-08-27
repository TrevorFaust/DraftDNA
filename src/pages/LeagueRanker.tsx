import { Navbar } from '@/components/Navbar';
import { FantasyRankerApp } from '@/features/league-ranker/FantasyRankerApp';

const LeagueRanker = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <FantasyRankerApp />
      </main>
    </div>
  );
};

export default LeagueRanker;
