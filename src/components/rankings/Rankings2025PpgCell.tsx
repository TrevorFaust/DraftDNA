import { cn } from '@/lib/utils';

type Stats2025 = {
  avgPointsPerGame: number | null;
  gamesPlayed?: number;
  totalFantasyPoints?: number;
};

function resolvePpg2025(stats2025?: Stats2025 | null): number | null {
  if (!stats2025) return null;
  if (stats2025.avgPointsPerGame != null) return stats2025.avgPointsPerGame;
  if (stats2025.gamesPlayed && stats2025.gamesPlayed > 0) {
    return (stats2025.totalFantasyPoints ?? 0) / stats2025.gamesPlayed;
  }
  return null;
}

type Rankings2025PpgCellProps = {
  stats2025?: Stats2025 | null;
  className?: string;
};

/** Fixed-width 2025 PPG column so Comm RK / My RK stay aligned when stats are missing (e.g. rookies). */
export function Rankings2025PpgCell({ stats2025, className }: Rankings2025PpgCellProps) {
  const ppg = resolvePpg2025(stats2025);

  return (
    <div
      className={cn(
        'hidden sm:block shrink-0 min-w-[2.75rem] px-1.5 border-l border-border/50 text-center',
        className
      )}
    >
      <span className="block text-[10px] text-muted-foreground leading-tight">2025 PPG</span>
      <span
        className={cn(
          'font-semibold text-sm tabular-nums',
          ppg != null ? 'text-primary' : 'text-muted-foreground'
        )}
      >
        {ppg != null ? ppg.toFixed(1) : '—'}
      </span>
    </div>
  );
}
