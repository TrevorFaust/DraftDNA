import {
  formatOpponentWinPctDisplay,
  sosOrdinal,
} from '@/constants/nfl2026StrengthOfSchedule';

/** SOS cell: win-pct primary, ordinal rank as muted side note (matches Pick Six overall-rank style). */
export function SosCellDisplay({ pct, rank }: { pct: number; rank: number }) {
  return (
    <span className="tabular-nums">
      <span>{formatOpponentWinPctDisplay(pct)}</span>
      <span className="text-[10px] text-muted-foreground/80 font-normal whitespace-nowrap">
        {' '}
        ({sosOrdinal(rank)})
      </span>
    </span>
  );
}
